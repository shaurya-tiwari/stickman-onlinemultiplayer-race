const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  // Use custom ID generation for 10-digit numbers
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
  }
});

// Function to generate a random 10-digit number
const generateTenDigitId = () => {
  // Ensure first digit is not zero (to keep it 10 digits)
  const firstDigit = Math.floor(Math.random() * 9) + 1;
  // Generate the remaining 9 digits
  const remainingDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  return `${firstDigit}${remainingDigits}`;
};

// Track existing IDs to avoid duplicates
const existingIds = new Set();

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
  // Generate a unique 10-digit ID for this connection
  let customId;
  do {
    customId = generateTenDigitId();
  } while (existingIds.has(customId));
  
  existingIds.add(customId);
  
  // Store the custom ID in the socket object
  socket.customId = customId;
  
  console.log(`Player connected: ${socket.customId} (socket.id: ${socket.id})`);
  
  // Create a reverse mapping from socket.id to customId for easier lookups
  socket.join(customId); // Join a room with the customId name for direct messaging
  
  // Initialize visibility for this player (only see yourself)
  playerVisibility[socket.customId] = new Set([socket.customId]);

  // Helper function to find the socket by custom ID
  const findSocketByCustomId = (customId) => {
    const sockets = io.sockets.sockets;
    for (const [id, s] of sockets) {
      if (s.customId === customId) {
        return s;
      }
    }
    return null;
  };

  // Generate a unique invite code
  socket.on('generate-code', (callback) => {
    const code = Math.random().toString(36).substr(2, 6);
    inviteCodes[code] = socket.customId;
    console.log(`Generated invite code ${code} for player ${socket.customId}`);
    callback(code);
  });

  // Join using an invite code
  socket.on('join-with-code', ({ code, name }, callback) => {
    const hostId = inviteCodes[code];
    if (hostId) {
      // Initialize player
      players[socket.customId] = { x: 0, y: 0, name };
      
      // Create visible players object (only self and host)
      const visiblePlayers = {};
      visiblePlayers[socket.customId] = players[socket.customId];
      
      // If host exists, add them to visible players and make this player visible to host
      if (players[hostId]) {
        visiblePlayers[hostId] = players[hostId];
        
        // Add host to this player's visibility
        playerVisibility[socket.customId].add(hostId);
        
        // Add this player to host's visibility
        if (!playerVisibility[hostId]) {
          playerVisibility[hostId] = new Set([hostId]);
        }
        playerVisibility[hostId].add(socket.customId);
        
        // Notify host about this player
        io.to(hostId).emit('new-player', { id: socket.customId, name });
        io.to(hostId).emit('player-joined', { id: socket.customId });
      }
      
      // Send initialization with only visible players
      socket.emit('init', {
        id: socket.customId,
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
    players[socket.customId] = { x: 0, y: 0, name };
    
    // Create visible players object (only self)
    const visiblePlayers = {};
    visiblePlayers[socket.customId] = players[socket.customId];
    
    // Send only this player's info in the init event
    socket.emit('init', {
      id: socket.customId,
      players: visiblePlayers,
      trees,
      obstacles
    });
  });

  // Position updates
  socket.on('update-position', data => {
    if (players[socket.customId]) {
      players[socket.customId].x = data.x;
      players[socket.customId].y = data.y;
      
      // Only emit to players who can see this player
      playerVisibility[socket.customId].forEach(visibleToId => {
        if (visibleToId !== socket.customId) { // Don't send to self
          io.to(visibleToId).emit('player-moved', { 
            id: socket.customId, 
            x: players[socket.customId].x, 
            y: players[socket.customId].y,
            name: players[socket.customId].name
          });
        }
      });
    }
  });

  // Join by player ID
  socket.on('join-by-id', ({ targetId }, callback) => {
    console.log(`Player ${socket.customId} is trying to join player ${targetId}`);
    
    // Check if target player exists
    if (players[targetId]) {
      console.log(`Target player ${targetId} found. Sending join request.`);
      
      // Initialize the player if not already initialized
      if (!players[socket.customId]) {
        players[socket.customId] = { x: 0, y: 0, name: 'Player' };
      }
      
      // Send join request to the target player
      // We need to use socket.id to emit to a particular socket, but customId for the data
      io.to(targetId).emit('join-request', {
        playerId: socket.customId,
        playerName: players[socket.customId]?.name || 'Unknown Player'
      });
      
      callback({ success: true });
    } else {
      console.log(`Target player ${targetId} not found.`);
      callback({ 
        success: false, 
        message: 'Player not found. Please check the ID and try again.' 
      });
    }
  });

  // Handle request acceptance
  socket.on('accept-join-request', ({ playerId }) => {
    console.log(`Player ${socket.customId} is accepting join request from ${playerId}`);
    
    // Make sure both players exist
    if (!players[socket.customId]) {
      console.log(`Error: Host player ${socket.customId} does not exist`);
      return;
    }
    
    if (!players[playerId]) {
      console.log(`Error: Joining player ${playerId} does not exist`);
      return;
    }
    
    // Position the joining player near the accepting player
    const hostX = players[socket.customId].x;
    const hostY = players[socket.customId].y;
    
    console.log(`Setting joining player position to ${hostX-100}, ${hostY}`);
    
    // Set joining player's position to be slightly behind the host
    players[playerId].x = hostX - 100;
    players[playerId].y = hostY;
    
    // Make players visible to each other
    // Initialize visibility sets if they don't exist
    if (!playerVisibility[playerId]) {
      playerVisibility[playerId] = new Set([playerId]);
    }
    
    if (!playerVisibility[socket.customId]) {
      playerVisibility[socket.customId] = new Set([socket.customId]);
    }
    
    // Add the players to each other's visibility sets
    playerVisibility[playerId].add(socket.customId);
    playerVisibility[socket.customId].add(playerId);
    
    console.log('Host visibility set:', Array.from(playerVisibility[socket.customId]));
    console.log('Joining player visibility set:', Array.from(playerVisibility[playerId]));
    
    // Find the joining player's socket using the custom ID
    const joiningPlayerSocket = findSocketByCustomId(playerId);
    if (!joiningPlayerSocket) {
      console.log(`Warning: Could not find socket for joining player ${playerId}`);
    } else {
      console.log(`Found socket for joining player: ${joiningPlayerSocket.id}`);
    }
    
    // Step 1: Tell the joining player that the host is now visible to them
    io.to(playerId).emit('player-joined', { id: socket.customId });
    console.log(`Sent player-joined to joining player for host ${socket.customId}`);
    
    // Step 2: Tell the host that the joining player is now visible to them
    socket.emit('player-joined', { id: playerId });
    console.log(`Sent player-joined to host for joining player ${playerId}`);
    
    // Step 3: Send the host's player data to the joining player
    io.to(playerId).emit('new-player', { 
      id: socket.customId, 
      name: players[socket.customId].name,
      x: players[socket.customId].x,
      y: players[socket.customId].y
    });
    console.log(`Sent host player data to joining player`);
    
    // Step 4: Send the joining player's data to the host
    socket.emit('new-player', { 
      id: playerId, 
      name: players[playerId].name,
      x: players[playerId].x,
      y: players[playerId].y 
    });
    console.log(`Sent joining player data to host`);
    
    // Step 5: Tell the joining player their request was accepted
    io.to(playerId).emit('request-accepted');
    console.log(`Notified joining player that request was accepted`);
  });

  // Handle request rejection
  socket.on('reject-join-request', ({ playerId }) => {
    console.log(`Player ${socket.customId} is rejecting join request from ${playerId}`);
    io.to(playerId).emit('request-rejected');
  });

  // Handle race restart
  socket.on('restart-race', () => {
    // Only broadcast to players who can see this player (the host)
    if (playerVisibility[socket.customId]) {
      playerVisibility[socket.customId].forEach(visibleToId => {
        if (visibleToId !== socket.customId) { // Don't send to self (the initiator)
          io.to(visibleToId).emit('restart-race');
        }
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.customId}`);
    
    // Notify only players who could see this player
    if (playerVisibility[socket.customId]) {
      playerVisibility[socket.customId].forEach(visibleToId => {
        if (visibleToId !== socket.customId) { // Don't send to self (who is disconnecting)
          io.to(visibleToId).emit('player-disconnected', { id: socket.customId });
          
          // Also remove the disconnected player from other players' visibility
          if (playerVisibility[visibleToId]) {
            playerVisibility[visibleToId].delete(socket.customId);
          }
        }
      });
    }
    
    // Release the ID for reuse
    existingIds.delete(socket.customId);
    
    delete players[socket.customId];
    delete playerVisibility[socket.customId];

    // Remove invite code if it belonged to this player
    for (const code in inviteCodes) {
      if (inviteCodes[code] === socket.customId) {
        delete inviteCodes[code];
      }
    }
  });
});

server.listen(3001, () => console.log('Server running on port 3001'));
