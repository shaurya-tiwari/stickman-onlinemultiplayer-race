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
// Game host and race settings
let gameHost = null;
let raceDistance = 1000; // Default race distance
let raceFinished = false;
let raceWinner = null;

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

// Track player race state with timestamps
let playerRaceState = {};
// Track race status
let raceStatus = {
  isActive: false,
  startTime: null,
  finishTime: null,
  distance: 1000
};

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
    console.log(`Player ${socket.customId} setting name to ${name}`);
    
    // Initialize the player
    players[socket.customId] = { x: 0, y: 0, name, isJumping: false };
    
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

  // Position updates - Add server-side validation and position tracking
  socket.on('update-position', data => {
    if (players[socket.customId]) {
      // Store previous position for validation
      const prevX = players[socket.customId].x || 0;
      
      // Validate movement - Ensure players can't jump too far
      // Maximum allowed movement speed (pixels per update)
      const maxMoveSpeed = 20;
      
      // Calculate the requested movement
      const requestedMove = data.x - prevX;
      
      // Validate the movement speed
      let validatedX = data.x;
      if (Math.abs(requestedMove) > maxMoveSpeed) {
        // Limit the movement to the maximum allowed speed
        validatedX = prevX + (Math.sign(requestedMove) * maxMoveSpeed);
        console.log(`Player ${socket.customId} movement throttled from ${data.x} to ${validatedX}`);
      }
      
      // Apply validated position
      players[socket.customId].x = validatedX;
      players[socket.customId].y = data.y;
      players[socket.customId].isJumping = data.isJumping || false;
      players[socket.customId].lastUpdateTime = Date.now();
      
      // Check if player has finished the race
      if (raceStatus.isActive && !raceFinished && validatedX >= raceDistance) {
        handlePlayerFinish(socket.customId, players[socket.customId].name);
      }
      
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

  // Helper function to handle player finish
  const handlePlayerFinish = (playerId, playerName) => {
    // Only register the first player to finish
    if (!raceFinished) {
      raceFinished = true;
      raceStatus.finishTime = Date.now();
      raceWinner = {
        id: playerId,
        name: playerName || players[playerId]?.name || 'Unknown Player'
      };
      
      console.log(`Player ${playerId} (${raceWinner.name}) won the race!`);
      
      // Broadcast winner to all players
      io.emit('race-winner', {
        playerId: playerId,
        playerName: raceWinner.name
      });
    }
  };

  // Modified: Player race finish handling with server validation
  socket.on('player-finished', ({ playerName }) => {
    // Get the player's current position
    const player = players[socket.customId];
    if (player && player.x >= raceDistance) {
      handlePlayerFinish(socket.customId, playerName);
    } else {
      console.log(`Player ${socket.customId} attempted to claim race finish but didn't meet distance requirement.`);
    }
  });

  // Handle race restart with improved synchronization
  socket.on('restart-race', () => {
    // Host can restart the race
    if (socket.customId === gameHost || !gameHost) {
      // Reset race state
      raceFinished = false;
      raceWinner = null;
      raceStatus.isActive = true;
      raceStatus.startTime = Date.now();
      raceStatus.finishTime = null;
      raceStatus.distance = raceDistance;
      
      console.log(`Race restarted by ${socket.customId}`);
      
      // Reset all player positions server-side
      Object.keys(players).forEach(playerId => {
        players[playerId].x = 0;
        players[playerId].y = 0;
        players[playerId].isJumping = false;
        
        // Create or update race state for each player
        playerRaceState[playerId] = {
          startTime: raceStatus.startTime,
          lastPosition: 0,
          finished: false
        };
      });
      
      // Broadcast race restart to ALL connected players
      io.emit('restart-race');
    }
  });

  // Add a new event for player reconnection
  socket.on('reconnect-to-race', (callback) => {
    const playerId = socket.customId;
    console.log(`Player ${playerId} is reconnecting to the race`);
    
    // If player exists but disconnected, restore their state
    if (players[playerId]) {
      console.log(`Restoring race state for player ${playerId}`);
      
      // Send current race status
      callback({
        success: true,
        raceStatus: {
          isActive: raceStatus.isActive,
          raceDistance: raceStatus.distance,
          raceFinished: raceFinished,
          raceWinner: raceWinner ? {
            id: raceWinner.id,
            name: raceWinner.name
          } : null
        },
        // Send players positions that this player should see
        visiblePlayers: Array.from(playerVisibility[playerId] || [])
          .filter(id => players[id])
          .map(id => ({
            id,
            name: players[id].name,
            x: players[id].x,
            y: players[id].y,
            isJumping: players[id].isJumping
          }))
      });
      
      // Notify other players about this player's reconnection
      playerVisibility[playerId]?.forEach(visibleToId => {
        if (visibleToId !== playerId) {
          io.to(visibleToId).emit('player-reconnected', {
            id: playerId,
            name: players[playerId].name,
            x: players[playerId].x,
            y: players[playerId].y
          });
        }
      });
    } else {
      // Player doesn't exist in the current race
      callback({
        success: false,
        message: 'No active race found for this player'
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
    
    // Make ALL players in the game visible to each other, bypass the visibility system
    // This ensures everyone can see each other regardless of how they joined
    
    // Get all players who are currently visible to the host
    const allPlayers = new Set([...playerVisibility[socket.customId] || [], socket.customId, playerId]);
    
    // Make each player visible to all other players
    allPlayers.forEach(id => {
      if (!playerVisibility[id]) {
        playerVisibility[id] = new Set([id]); // Always see yourself
      } else {
        // Make sure player can still see themselves (important for host)
        playerVisibility[id].add(id);
      }
      
      // Make all other players visible to this player
      allPlayers.forEach(otherId => {
        if (id !== otherId) {
          playerVisibility[id].add(otherId);
          
          // Send event to make this player visible to the other player
          io.to(id).emit('player-joined', { id: otherId });
          
          // Send player data to this player
          if (players[otherId]) {
            io.to(id).emit('new-player', {
              id: otherId,
              name: players[otherId].name,
              x: players[otherId].x, 
              y: players[otherId].y
            });
          }
        }
      });
    });
    
    // Make sure to re-broadcast the host to itself!
    // This is a critical fix for the visibility issue
    if (players[socket.customId]) {
      socket.emit('player-joined', { id: socket.customId });
      socket.emit('new-player', {
        id: socket.customId,
        name: players[socket.customId].name,
        x: players[socket.customId].x,
        y: players[socket.customId].y
      });
    }
    
    console.log('Updated visibility for all players in the game');
    console.log('Host visibility set:', Array.from(playerVisibility[socket.customId]));
    
    // Specifically notify the joining player that their request was accepted
    io.to(playerId).emit('request-accepted');
    console.log(`Notified joining player that request was accepted`);
  });

  // Handle request rejection
  socket.on('reject-join-request', ({ playerId }) => {
    console.log(`Player ${socket.customId} is rejecting join request from ${playerId}`);
    io.to(playerId).emit('request-rejected');
  });

  // Host management
  socket.on('check-host-status', (data, callback) => {
    const isHost = gameHost === socket.customId;
    console.log(`Player ${socket.customId} checked host status: ${isHost}`);
    callback({ isHost });
  });

  socket.on('become-host', (data, callback) => {
    // If there's no host or the current host is disconnected
    if (!gameHost || !players[gameHost]) {
      gameHost = socket.customId;
      console.log(`Player ${socket.customId} is now the host`);
      
      // Initialize the player if not already initialized
      if (!players[socket.customId]) {
        players[socket.customId] = { x: 0, y: 0, name: 'Host', isJumping: false };
      }
      
      // Make sure the host has a visibility set
      if (!playerVisibility[socket.customId]) {
        playerVisibility[socket.customId] = new Set([socket.customId]);
      } else {
        // Always make sure the host can see themselves
        playerVisibility[socket.customId].add(socket.customId);
      }
      
      // CRITICAL FIX: Ensure the host exists in their own players list
      // If the host is starting a new game and hasn't seen any player list yet
      // This makes sure they initialize with themselves visible
      socket.emit('init', {
        id: socket.customId,
        players: { [socket.customId]: players[socket.customId] },
        trees,
        obstacles
      });
      
      // Make sure the host is visible to themselves
      socket.emit('player-joined', { id: socket.customId });
      
      // Send host player data to themselves to ensure they see themselves
      socket.emit('new-player', {
        id: socket.customId,
        name: players[socket.customId].name,
        x: players[socket.customId].x,
        y: players[socket.customId].y
      });
      
      // Notify the new host
      callback({ success: true });
      
      // Broadcast host change to all connected players
      io.emit('host-status', { hostId: gameHost, hostName: players[gameHost]?.name || 'Unknown Host' });
      
      // Send current game settings to the new host
      socket.emit('game-settings-updated', { raceDistance });
      
      // Print debug info
      console.log('Host visibility set:', Array.from(playerVisibility[socket.customId]));
    } else {
      console.log(`Player ${socket.customId} tried to become host but ${gameHost} is already host`);
      callback({ 
        success: false, 
        message: 'There is already an active host for this game' 
      });
    }
  });

  socket.on('update-game-settings', ({ raceDistance: newDistance }, callback) => {
    // Only the host can update game settings
    if (socket.customId === gameHost) {
      raceDistance = newDistance;
      console.log(`Host ${socket.customId} updated race distance to ${raceDistance}m`);
      
      // Reset race state when settings change
      raceFinished = false;
      raceWinner = null;
      
      // Make sure the host is still visible to themselves after settings update
      if (playerVisibility[socket.customId]) {
        // Make sure the host can see themselves
        playerVisibility[socket.customId].add(socket.customId);
        
        // Re-send the host to themselves to fix visibility issues
        socket.emit('player-joined', { id: socket.customId });
        
        // CRITICAL FIX: Re-send player data and ensure host is in their own players list
        if (players[socket.customId]) {
          socket.emit('new-player', {
            id: socket.customId,
            name: players[socket.customId].name,
            x: players[socket.customId].x,
            y: players[socket.customId].y
          });
        }
      }
      
      // Broadcast settings to all players
      io.emit('game-settings-updated', { raceDistance });
      
      callback({ success: true });
    } else {
      console.log(`Player ${socket.customId} tried to update settings but is not the host`);
      callback({ 
        success: false, 
        message: 'Only the host can update game settings' 
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.customId}`);
    
    // If the host disconnects, clear the host
    if (socket.customId === gameHost) {
      gameHost = null;
      console.log('Game host disconnected, host position is now open');
    }
    
    // Store race state before disconnection, keeping the player's data
    // for potential reconnection for a limited time (5 minutes)
    if (players[socket.customId]) {
      players[socket.customId].disconnectedAt = Date.now();
      
      // We'll keep the player data for reconnection purposes
      // but mark them as disconnected for other players
      
      // Schedule cleanup after 5 minutes
      setTimeout(() => {
        // Only remove if the player hasn't reconnected
        if (players[socket.customId] && players[socket.customId].disconnectedAt) {
          console.log(`Cleaning up disconnected player ${socket.customId} after timeout`);
          
          // Perform full cleanup now
          delete players[socket.customId];
          delete playerVisibility[socket.customId];
          delete playerRaceState[socket.customId];
          
          // Remove invite code if it belonged to this player
          for (const code in inviteCodes) {
            if (inviteCodes[code] === socket.customId) {
              delete inviteCodes[code];
            }
          }
        }
      }, 5 * 60 * 1000); // 5 minutes in milliseconds
    }
    
    // Notify only players who could see this player about the disconnection
    if (playerVisibility[socket.customId]) {
      playerVisibility[socket.customId].forEach(visibleToId => {
        if (visibleToId !== socket.customId) { // Don't send to self (who is disconnecting)
          io.to(visibleToId).emit('player-disconnected', { id: socket.customId });
        }
      });
    }
    
    // Release the ID for reuse after a longer timeout (to allow reconnection)
    setTimeout(() => {
      existingIds.delete(socket.customId);
    }, 10 * 60 * 1000); // 10 minutes
  });
});

// Add a cleanup task to detect and clean up inactive players
setInterval(() => {
  const now = Date.now();
  const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
  
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    
    // Check if player is disconnected for too long
    if (player.disconnectedAt && (now - player.disconnectedAt > inactiveThreshold)) {
      console.log(`Removing inactive disconnected player ${playerId}`);
      
      // Perform full cleanup
      delete players[playerId];
      delete playerVisibility[playerId];
      delete playerRaceState[playerId];
      
      // Remove invite code if it belonged to this player
      for (const code in inviteCodes) {
        if (inviteCodes[code] === playerId) {
          delete inviteCodes[code];
        }
      }
      
      // Release the ID
      existingIds.delete(playerId);
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

server.listen(3001, () => console.log('Server running on port 3001'));
