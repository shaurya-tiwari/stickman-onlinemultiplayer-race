const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

let players = {};
let inviteCodes = {};

let treeImages = ['tree.png', 'tree2.png', 'tree3.png', 'tree4.png', 'tree5.png', 'tree6.png', 'tree7.png'];
let trees = [];
let obstacles = [];

const generateTrees = () => {
  trees = [];
  for (let i = 0; i < 50; i++) {
    const x = i * 400 + 300 + Math.random() * 200;
    const image = treeImages[Math.floor(Math.random() * treeImages.length)];
    trees.push({ x, image });
  }
};
generateTrees();

const generateObstacles = () => {
  obstacles = [];
  const obstacleTypes = ['rock.png', 'barrel.png', 'spike.png'];
  for (let i = 0; i < 30; i++) {
    const x = i * 600 + 500 + Math.random() * 300;
    const image = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    obstacles.push({ x, image });
  }
};
generateObstacles();

io.on('connection', socket => {
  console.log(`Player connected: ${socket.id}`);

  // Generate a unique invite code
  socket.on('generate-code', (callback) => {
    const code = Math.random().toString(36).substr(2, 6);
    inviteCodes[code] = socket.id;
    callback(code);
  });

  // Join using an invite code
  socket.on('join-with-code', ({ code, name }, callback) => {
    const hostId = inviteCodes[code];
    if (hostId) {
      players[socket.id] = { x: 0, y: 0, name };
      socket.emit('init', {
        id: socket.id,
        players,
        trees,
        obstacles
      });
      socket.broadcast.emit('new-player', { id: socket.id, name });
      callback({ success: true });
    } else {
      callback({ success: false, message: 'Invalid code' });
    }
  });

  // Handle regular player name set (first player or no invite)
  socket.on('set-name', (name, hostId = null) => {
    // Optional: restrict access if hostId is invalid
    if (hostId && !players[hostId]) return;

    players[socket.id] = { x: 0, y: 0, name };
    socket.emit('init', {
      id: socket.id,
      players,
      trees,
      obstacles
    });
    socket.broadcast.emit('new-player', { id: socket.id, name });
  });

  // Position updates
  socket.on('update-position', data => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      io.emit('player-moved', { id: socket.id, x: data.x, y: data.y });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];

    // Remove invite code if it belonged to this player
    for (const code in inviteCodes) {
      if (inviteCodes[code] === socket.id) {
        delete inviteCodes[code];
      }
    }

    io.emit('player-disconnected', { id: socket.id });
  });
});

server.listen(3001, () => console.log('Server running on port 3001'));
