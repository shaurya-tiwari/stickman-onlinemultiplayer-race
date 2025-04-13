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
// Track which players can see each other
let playerVisibility = {};

let treeImages = [
  'tree.png', 'tree2.png', 'tree3.png', 'tree4.png', 'tree5.png', 
  'tree6.png', 'tree7.png', 'tree9.png', 'tree10.png', 'tree11.png', 
  'tree12.png', 'tree13.png', 'tree14.png', 'tree15.png', 'tree16.png', 'tree17.png'
];
let trees = [];
let obstacles = [];

const generateTrees = () => {
  trees = [];
  for (let i = 0; i < 100; i++) {
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
  
  // Initialize visibility for this player (only see yourself)
  playerVisibility[socket.id] = new Set([socket.id]);

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
      // Initialize player
      players[socket.id] = { x: 0, y: 0, name };
      
      // Create visible players object (only self and host)
      const visiblePlayers = {};
      visiblePlayers[socket.id] = players[socket.id];
      
      // If host exists, add them to visible players and make this player visible to host
      if (players[hostId]) {
        visiblePlayers[hostId] = players[hostId];
        
        // Add host to this player's visibility
        playerVisibility[socket.id].add(hostId);
        
        // Add this player to host's visibility
        if (!playerVisibility[hostId]) {
          playerVisibility[hostId] = new Set([hostId]);
        }
        playerVisibility[hostId].add(socket.id);
        
        // Notify host about this player
        io.to(hostId).emit('new-player', { id: socket.id, name });
        io.to(hostId).emit('player-joined', { id: socket.id });
      }
      
      // Send initialization with only visible players
      socket.emit('init', {
        id: socket.id,
        players: visiblePlayers,
        trees,
        obstacles
      });
      
      callback({ success: true });
    } else {
      callback({ success: false, message: 'Invalid code' });
    }
  });

  // Handle regular player name set (first player or no invite)
  socket.on('set-name', (name) => {
    // Initialize the player
    players[socket.id] = { x: 0, y: 0, name };
    
    // Create visible players object (only self)
    const visiblePlayers = {};
    visiblePlayers[socket.id] = players[socket.id];
    
    // Send only this player's info in the init event
    socket.emit('init', {
      id: socket.id,
      players: visiblePlayers,
      trees,
      obstacles
    });
  });

  // Position updates
  socket.on('update-position', data => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      
      // Only emit to players who can see this player
      playerVisibility[socket.id].forEach(visibleToId => {
        if (visibleToId !== socket.id) { // Don't send to self
          io.to(visibleToId).emit('player-moved', { 
            id: socket.id, 
            x: players[socket.id].x, 
            y: players[socket.id].y 
          });
        }
      });
    }
  });

  // Join by player ID
  socket.on('join-by-id', ({ targetId }, callback) => {
    // Check if target player exists
    if (players[targetId]) {
      // Send join request to the target player
      io.to(targetId).emit('join-request', {
        playerId: socket.id,
        playerName: players[socket.id]?.name || 'Unknown Player'
      });
      
      callback({ success: true });
    } else {
      callback({ 
        success: false, 
        message: 'Player not found. Please check the ID and try again.' 
      });
    }
  });

  // Handle request acceptance
  socket.on('accept-join-request', ({ playerId }) => {
    // Make sure both players exist
    if (!players[socket.id] || !players[playerId]) return;
    
    // Position the joining player near the accepting player
    const hostX = players[socket.id].x;
    const hostY = players[socket.id].y;
    
    // Set joining player's position to be slightly behind the host
    players[playerId].x = hostX - 100;
    players[playerId].y = hostY;
    
    // Make players visible to each other
    // Add host to joining player's visibility
    playerVisibility[playerId].add(socket.id);
    
    // Add joining player to host's visibility
    playerVisibility[socket.id].add(playerId);
    
    // Send the host to the joining player 
    io.to(playerId).emit('new-player', { 
      id: socket.id, 
      name: players[socket.id].name,
      x: players[socket.id].x,
      y: players[socket.id].y
    });
    
    // Let client know this player is now visible
    io.to(playerId).emit('player-joined', { id: socket.id });
    
    // Send the joining player to the host
    io.to(socket.id).emit('new-player', { 
      id: playerId, 
      name: players[playerId].name,
      x: players[playerId].x,
      y: players[playerId].y 
    });
    
    // Let host know this player is now visible
    io.to(socket.id).emit('player-joined', { id: playerId });
    
    // Notify the joining player that their request was accepted
    io.to(playerId).emit('request-accepted');
  });

  // Handle request rejection
  socket.on('reject-join-request', ({ playerId }) => {
    io.to(playerId).emit('request-rejected');
  });

  // Handle race restart
  socket.on('restart-race', () => {
    // Only broadcast to players who can see this player (the host)
    if (playerVisibility[socket.id]) {
      playerVisibility[socket.id].forEach(visibleToId => {
        if (visibleToId !== socket.id) { // Don't send to self (the initiator)
          io.to(visibleToId).emit('restart-race');
        }
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Notify only players who could see this player
    if (playerVisibility[socket.id]) {
      playerVisibility[socket.id].forEach(visibleToId => {
        if (visibleToId !== socket.id) { // Don't send to self (who is disconnecting)
          io.to(visibleToId).emit('player-disconnected', { id: socket.id });
          
          // Also remove the disconnected player from other players' visibility
          if (playerVisibility[visibleToId]) {
            playerVisibility[visibleToId].delete(socket.id);
          }
        }
      });
    }
    
    delete players[socket.id];
    delete playerVisibility[socket.id];

    // Remove invite code if it belonged to this player
    for (const code in inviteCodes) {
      if (inviteCodes[code] === socket.id) {
        delete inviteCodes[code];
      }
    }
  });
});

server.listen(3001, () => console.log('Server running on port 3001'));
