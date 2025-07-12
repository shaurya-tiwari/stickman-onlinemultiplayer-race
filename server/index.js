// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const obstacleModule = require('./obstacles');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://stickman-onlinemultiplayer-race.vercel.app',
    methods: ['GET','POST'],
    credentials: true
  },
  connectionStateRecovery: { maxDisconnectionDuration: 2*60*1000 }
});

const generateTenDigitId = () => {
  const first = Math.floor(Math.random()*9)+1;
  const rest = Math.floor(Math.random()*1e9).toString().padStart(9,'0');
  return `${first}${rest}`;
};

class Game {
  constructor() {
    this.existingIds = new Set();
    this.players = {};            // customId → { x,y,name,... }
    this.visibility = {};        // customId → Set of visible customIds
    this.inviteCodes = {};       // code → customId
    this.race = {
      isActive: false,
      startTime: null,
      finishTime: null,
      distance: 1000,
      winner: null,
    };
    this.playerRaceState = {};   // customId → state
    this.trees = [];
    this.obstacles = [];
    this.generateWorld();
  }
  generateWorld() {
    this.trees = [];
    const treeImages = [.../* 17 images */];
    for (let i=0;i<100;i++) {
      const x = i*400 + 300 + Math.random()*200;
      this.trees.push({ x, image: treeImages[Math.floor(Math.random()*treeImages.length)] });
    }
    this.generateObstacles();
  }
  generateObstacles() {
    this.obstacles = obstacleModule.generateObstacles(30, this.race.distance);
  }
  createCustomId() {
    let id;
    do { id = generateTenDigitId(); } while (this.existingIds.has(id));
    this.existingIds.add(id);
    return id;
  }
  cleanupPlayer(id) {
    delete this.players[id];
    delete this.visibility[id];
    delete this.playerRaceState[id];
    this.existingIds.delete(id);
    for (const [code, pid] of Object.entries(this.inviteCodes)) {
      if (pid===id) delete this.inviteCodes[code];
    }
    // purge from others' visibility
    Object.values(this.visibility).forEach(set => set.delete(id));
  }
  broadcastVisible(id, event, data) {
    (this.visibility[id]||[]).forEach(otherId => {
      if (otherId !== id) io.to(otherId).emit(event, data);
    });
  }
  startRace(byId) {
    this.race.isActive = true;
    this.race.startTime = Date.now();
    this.race.finishTime = null;
    this.race.winner = null;
    this.generateObstacles();

    // reset states
    Object.entries(this.players).forEach(([pid, p]) => {
      p.x = 0; p.y = 0; p.isJumping = false;
      this.playerRaceState[pid] = {
        lastPos: 0, finished: false, position: null, startTime: this.race.startTime
      };
    });
    io.emit('restart-race', {
      startTime: this.race.startTime,
      distance: this.race.distance,
      fromHost: true
    });

    setTimeout(() => {
      Object.entries(this.players).forEach(([pid, p]) => {
        if (!p.disconnectedAt) {
          io.to(pid).emit('position-validated', { id: pid, x:0,y:0 });
          this.broadcastVisible(pid,'player-moved',{ id: pid, x:0, y:0, name: p.name, isJumping:false });
        }
      });
    }, 200);
  }
}

const game = new Game();
let gameHost = null;

io.on('connection', socket => {
  socket.customId = game.createCustomId();
  socket.join(socket.customId);

  game.players[socket.customId] = { x:0, y:0, name:null, isJumping:false };
  game.visibility[socket.customId] = new Set([socket.customId]);

  const safeEmit = (cb, ...args) => {
    try { cb(...args); }
    catch(e){ socket.emit('error-message',{ message: 'Server error' }); console.error(e); }
  };

  // Shared init logic:
  const sendInit = () => {
    const visible = {};
    [...(game.visibility[socket.customId]||[])].forEach(pid => {
      const p = game.players[pid];
      if (p) visible[pid] = p;
    });
    socket.emit('init', {
      id: socket.customId,
      players: visible,
      trees: game.trees,
      obstacles: game.obstacles
    });
  };

  socket.on('generate-code', cb => safeEmit(() => {
    const code = Math.random().toString(36).substr(2,6);
    game.inviteCodes[code] = socket.customId;
    cb(code);
  }));

  socket.on('join-with-code', ({ code, name }, cb) => safeEmit(() => {
    const hostId = game.inviteCodes[code];
    if (!hostId || !game.players[hostId]) return void cb({ success:false, message:'Invalid code' });

    const display = (name?.trim()) || `Player-${socket.customId.substr(0,5)}`;
    const me = game.players[socket.customId];
    me.name = display;

    game.visibility[socket.customId].add(hostId);
    game.visibility[hostId].add(socket.customId);

    io.to(hostId).emit('new-player',{ id: socket.customId, name: display });
    io.to(hostId).emit('player-joined',{ id: socket.customId });

    sendInit();
    cb({ success:true });
  }));

  socket.on('set-name', name => safeEmit(() => {
    const display = (name?.trim()) || `Player-${socket.customId.substr(0,5)}`;
    game.players[socket.customId].name = display;
    sendInit();
  }));

  socket.on('update-position', data => safeEmit(() => {
    if (!data || typeof data !== 'object') return;
    const player = game.players[socket.customId];
    if (!player) return;

    const now = Date.now();
    const last = player.lastUpdateTime||0;
    if (now-last < 20) return;
    player.lastUpdateTime = now;

    const prevX = player.x;
    let newX = data.x;
    const move = newX - prevX;
    if (Math.abs(move)>20) newX = prevX + Math.sign(move)*20;

    if (isNaN(newX)||isNaN(data.y)) return;
    player.x = newX; player.y = data.y; player.isJumping = !!data.isJumping;

    // collision
    for (const obs of game.obstacles) {
      if (obstacleModule.checkCollision(player, obs)) {
        const box = obstacleModule.getCollisionBox(obs);
        player.x = box.x - 32;
        socket.emit('position-correction', { x: player.x, y: player.y });
        break;
      }
    }

    if (game.race.isActive && !game.playerRaceState[socket.customId]?.finished && player.x >= game.race.distance) {
      handleFinish(socket.customId, player.name);
    }

    game.broadcastVisible(socket.customId,'player-moved',{
      id: socket.customId,
      x: player.x,
      y: player.y,
      name: player.name,
      isJumping: player.isJumping
    });
  }));

  const handleFinish = (pid, pname) => {
    if (game.race.winner) return;
    game.race.winner = { id: pid, name: pname };
    game.race.finishTime = Date.now();
    game.playerRaceState[pid].finished = true;
    game.playerRaceState[pid].position = 1;

    io.emit('race-winner',{ playerId:pid, playerName:pname });
    // record other finishes if needed...
  };

  socket.on('player-finished', ({ playerName }) => safeEmit(() => {
    const player = game.players[socket.customId];
    if (player && player.x>=game.race.distance) handleFinish(socket.customId, playerName||player.name);
    else socket.emit('position-correction',{ x:player?.x||0,y:player?.y||0 });
  }));

  socket.on('restart-race', () => safeEmit(() => {
    if (!gameHost) gameHost = socket.customId;
    if (gameHost !== socket.customId) return void socket.emit('error-message',{ message: 'Only host can restart' });
    game.startRace(socket.customId);
  }));

  socket.on('reconnect-to-race', cb => safeEmit(() => {
    const pid = socket.customId, pl = game.players[pid];
    if (!pl) return void cb({ success:false, message:'No active race' });

    const vp = Array.from(game.visibility[pid]||[]).filter(id=>game.players[id]).map(id=>{
      const p = game.players[id];
      return { id, name: p.name, x:p.x, y:p.y, isJumping:p.isJumping };
    });

    cb({
      success:true,
      raceStatus: {...game.race},
      visiblePlayers: vp,
      trees: game.trees,
      obstacles: game.obstacles
    });
    game.broadcastVisible(pid,'player-reconnected',{
      id: pid,
      name: pl.name, x:pl.x, y:pl.y
    });
  }));

  socket.on('disconnect', () => safeEmit(() => {
    const pid = socket.customId;
    const now = Date.now();
    const player = game.players[pid];
    if (player) {
      player.disconnectedAt = now;
      setTimeout(() => {
        if (game.players[pid]?.disconnectedAt && Date.now()-game.players[pid].disconnectedAt >= 5*60*1000) {
          if (gameHost === pid) gameHost = null;
          game.cleanupPlayer(pid);
        }
      }, 5*60*1000);
      game.visibility[pid]?.forEach(otherId=> {
        if (otherId!==pid) io.to(otherId).emit('player-disconnected',{ id: pid });
      });
    }
  }));

  // periodic cleanup (in case timeout not fired)
  // ... similarly as your original interval but calling game.cleanupPlayer

});

server.listen(3001, () => console.log('Server running on 3001'));
