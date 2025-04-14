const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const obstacleModule = require('./obstacles');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'https://stickman-onlinemultiplayer-race.vercel.app' },
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
  // Use the improved obstacles generator with better spacing
  obstacles = obstacleModule.generateObstacles(30, raceDistance);
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
    try {
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
          if (!playerVisibility[socket.customId]) {
            playerVisibility[socket.customId] = new Set([socket.customId]);
          }
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
    } catch (error) {
      console.error(`Error in join-with-code: ${error.message}`);
      callback({ success: false, message: 'Server error during join' });
    }
  });

  // Handle regular player name set (first player or no invite)
  socket.on('set-name', (name) => {
    try {
      // Validate name - ensure it's a string and not empty
      const validName = name && typeof name === 'string' ? name.trim() : 'Player';
      const displayName = validName || `Player-${socket.customId.substring(0, 5)}`;
      
      console.log(`Player ${socket.customId} setting name to ${displayName}`);
      
      // Initialize the player
      players[socket.customId] = { x: 0, y: 0, name: displayName, isJumping: false };
      
      // Create visible players object (only self)
      const visiblePlayers = {};
      visiblePlayers[socket.customId] = players[socket.customId];
      
      // Make sure player visibility is initialized
      if (!playerVisibility[socket.customId]) {
        playerVisibility[socket.customId] = new Set([socket.customId]);
      }
      
      // Send only this player's info in the init event
      socket.emit('init', {
        id: socket.customId,
        players: visiblePlayers,
        trees,
        obstacles
      });
    } catch (error) {
      console.error(`Error in set-name for ${socket.customId}:`, error);
      // Still try to initialize the player with a default name
      players[socket.customId] = { x: 0, y: 0, name: `Player-${socket.customId.substring(0, 5)}`, isJumping: false };
      
      // Send basic init to avoid client being stuck
      socket.emit('init', {
        id: socket.customId,
        players: { [socket.customId]: players[socket.customId] },
        trees,
        obstacles
      });
    }
  });

  // Position updates - Add server-side validation and position tracking
  socket.on('update-position', data => {
    try {
      // First check if the customId exists on the socket
      if (!socket.customId) {
        console.warn(`Position update received before socket has a customId assigned`);
        return;
      }

      // Initialize the player if they don't exist yet but have a customId
      if (!players[socket.customId]) {
        console.log(`Creating missing player for ${socket.customId} during position update`);
        players[socket.customId] = { 
          x: 0, 
          y: 0, 
          name: `Player-${socket.customId.substring(0, 5)}`,
          isJumping: false 
        };

        // Make sure visibility is initialized
        if (!playerVisibility[socket.customId]) {
          playerVisibility[socket.customId] = new Set([socket.customId]);
        }
      }

      // Validate data format
      if (!data || typeof data !== 'object') {
        console.warn(`Invalid position data from ${socket.customId}`);
        return;
      }
      
      // Store previous position for validation
      const prevX = players[socket.customId].x || 0;
      
      // Throttle updates from the same player (avoid flooding)
      const now = Date.now();
      const lastUpdate = players[socket.customId].lastUpdateTime || 0;
      const minUpdateInterval = 20; // Minimum 20ms between updates from the same player
      
      if (now - lastUpdate < minUpdateInterval) {
        // Silently ignore too frequent updates
        return;
      }
      
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
        
        // Send position correction to the client
        socket.emit('position-correction', {
          x: validatedX,
          y: data.y
        });
      }
      
      // Ensure X and Y are numbers
      if (isNaN(validatedX) || isNaN(data.y)) {
        console.warn(`Player ${socket.customId} sent non-numeric position: ${validatedX}, ${data.y}`);
        return;
      }
      
      // Apply validated position
      players[socket.customId].x = validatedX;
      players[socket.customId].y = data.y;
      players[socket.customId].isJumping = !!data.isJumping;
      players[socket.customId].lastUpdateTime = now;
      
      // Check for collisions with obstacles
      let hasCollision = false;
      for (const obstacle of obstacles) {
        if (obstacleModule.checkCollision(players[socket.customId], obstacle)) {
          // Move player back to avoid obstacle
          const collisionBox = obstacleModule.getCollisionBox(obstacle);
          validatedX = collisionBox.x - 32; // Move player just before obstacle
          players[socket.customId].x = validatedX;
          
          // Send position correction to the client
          socket.emit('position-correction', {
            x: validatedX,
            y: players[socket.customId].y
          });
          
          hasCollision = true;
          break;
        }
      }
      
      // Check if player has finished the race
      if (!hasCollision && raceStatus.isActive && !raceFinished && validatedX >= raceDistance) {
        handlePlayerFinish(socket.customId, players[socket.customId].name);
      }
      
      // Only emit to players who can see this player
      if (playerVisibility[socket.customId]) {
        playerVisibility[socket.customId].forEach(visibleToId => {
          if (visibleToId !== socket.customId) { // Don't send to self
            try {
              io.to(visibleToId).emit('player-moved', { 
                id: socket.customId, 
                x: players[socket.customId].x, 
                y: players[socket.customId].y,
                name: players[socket.customId].name
              });
            } catch (emitError) {
              console.error(`Error emitting player-moved to ${visibleToId}:`, emitError);
            }
          }
        });
      }
    } catch (error) {
      console.error(`Error processing position update for ${socket.customId}:`, error);
    }
  });

  // Helper function to handle player finish
  const handlePlayerFinish = (playerId, playerName) => {
    // Validate that the player exists and has actually reached the finish line
    if (!players[playerId]) {
      console.log(`Player ${playerId} not found in players list, ignoring finish attempt`);
      return;
    }
    
    // Verify the player's position
    if (players[playerId].x < raceDistance) {
      console.log(`Player ${playerId} position (${players[playerId].x}) doesn't match race distance (${raceDistance}), ignoring finish attempt`);
      return;
    }
    
    // Only register the first player to finish
    if (!raceFinished) {
      raceFinished = true;
      raceStatus.finishTime = Date.now();
      raceWinner = {
        id: playerId,
        name: playerName || players[playerId]?.name || 'Unknown Player'
      };
      
      console.log(`Player ${playerId} (${raceWinner.name}) won the race!`);
      
      // Record the finish in race state for this player
      if (!playerRaceState[playerId]) {
        playerRaceState[playerId] = {};
      }
      
      playerRaceState[playerId].finished = true;
      playerRaceState[playerId].finishTime = raceStatus.finishTime;
      playerRaceState[playerId].position = 1; // First place
      
      // Broadcast winner to all players - disable this to remove the 1000m announcements
      /*
      io.emit('race-winner', {
        playerId: playerId,
        playerName: raceWinner.name
      });
      */
    } else {
      // Player finished but wasn't first
      // Record their finish for future position tracking
      if (!playerRaceState[playerId]) {
        playerRaceState[playerId] = {};
      }
      
      playerRaceState[playerId].finished = true;
      playerRaceState[playerId].finishTime = Date.now();
      
      // Count how many players finished before this one
      let position = 1; // Start at 1 (first place already taken)
      Object.keys(playerRaceState).forEach(pid => {
        if (pid !== playerId && playerRaceState[pid].finished && 
            playerRaceState[pid].finishTime < playerRaceState[playerId].finishTime) {
          position++;
        }
      });
      
      playerRaceState[playerId].position = position + 1;
      
      console.log(`Player ${playerId} (${playerName || players[playerId]?.name}) finished in position ${position + 1}`);
      
      // Notify only this player of their finish position
      io.to(playerId).emit('player-finished-position', {
        position: position + 1
      });
    }
  };

  // Modified: Player race finish handling with server validation
  socket.on('player-finished', ({ playerName, position }) => {
    // Get the player's current position
    const player = players[socket.customId];
    if (player && player.x >= raceDistance) {
      // For security, verify the server-side position matches the race distance requirement
      handlePlayerFinish(socket.customId, playerName);
    } else {
      console.log(`Player ${socket.customId} attempted to claim race finish but didn't meet distance requirement.`);
      
      // Send corrected position back to the client if they claim to have finished but haven't
      if (player) {
        socket.emit('position-correction', {
          x: player.x,
          y: player.y
        });
      }
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
      
      // Regenerate obstacles for variety
      generateObstacles();
      
      console.log(`Race restarted by ${socket.customId}`);
      
      // Reset all player positions server-side
      Object.keys(players).forEach(playerId => {
        // Skip players who are disconnected
        if (players[playerId].disconnectedAt) return;
        
        // Reset player position
        players[playerId].x = 0;
        players[playerId].y = 0;
        players[playerId].isJumping = false;
        
        // Create or update race state for each player
        playerRaceState[playerId] = {
          startTime: raceStatus.startTime,
          lastPosition: 0,
          finished: false,
          finishTime: null,
          position: null
        };
      });
      
      // Broadcast race restart to ALL connected players
      io.emit('restart-race', {
        startTime: raceStatus.startTime,
        distance: raceDistance,
        fromHost: true
      });
      
      // Force position update to all connected players to ensure synchronization
      setTimeout(() => {
        Object.keys(players).forEach(playerId => {
          // Skip disconnected players
          if (players[playerId].disconnectedAt) return;
          
          // Find the socket associated with this player
          const playerSocket = findSocketByCustomId(playerId);
          if (playerSocket) {
            // Send position validation to each player
            playerSocket.emit('position-validated', {
              id: playerId,
              x: 0,
              y: 0
            });
            
            // Broadcast the reset position to players who can see this player
            if (playerVisibility[playerId]) {
              playerVisibility[playerId].forEach(visibleToId => {
                if (visibleToId !== playerId) {
                  io.to(visibleToId).emit('player-moved', {
                    id: playerId,
                    x: 0,
                    y: 0,
                    isJumping: false,
                    name: players[playerId].name
                  });
                }
              });
            }
          }
        });
      }, 200); // Small delay to ensure restart-race event is processed first
    } else {
      // Notify the player they don't have permission to restart
      socket.emit('error-message', {
        message: 'Only the host can restart the race'
      });
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
    try {
      console.log(`Player ${socket.customId} accepted join request from ${playerId}`);
      
      // Make sure both players exist
      if (players[socket.customId] && players[playerId]) {
        // Add visibility between the players
        if (!playerVisibility[socket.customId]) {
          playerVisibility[socket.customId] = new Set([socket.customId]);
        }
        playerVisibility[socket.customId].add(playerId);
        
        if (!playerVisibility[playerId]) {
          playerVisibility[playerId] = new Set([playerId]);
        }
        playerVisibility[playerId].add(socket.customId);
        
        // Notify the joining player that their request was accepted
        io.to(playerId).emit('request-accepted', {
          hostId: socket.customId,
          hostName: players[socket.customId].name,
          isRequestSender: true
        });
        
        // Send each player's info to the other
        io.to(socket.customId).emit('new-player', {
          id: playerId,
          name: players[playerId].name,
          x: players[playerId].x,
          y: players[playerId].y,
          isRequestAccepter: true
        });
        
        io.to(playerId).emit('new-player', {
          id: socket.customId,
          name: players[socket.customId].name,
          x: players[socket.customId].x,
          y: players[socket.customId].y,
          isRequestAccepter: false
        });
        
        // Notify both sides that the player is now visible
        io.to(socket.customId).emit('player-joined', { id: playerId });
        io.to(playerId).emit('player-joined', { id: socket.customId });
      }
    } catch (error) {
      console.error(`Error in accept-join-request for ${socket.customId}:`, error);
    }
  });

  // Handle player leaving the game voluntarily
  socket.on('player-leave', ({ playerId }) => {
    try {
      console.log(`Player ${socket.customId} is leaving the game`);
      
      // Mark this player as disconnected with timestamp
      if (players[socket.customId]) {
        players[socket.customId].disconnectedAt = Date.now();
        players[socket.customId].disconnectedVoluntarily = true;
      }
      
      // If this player is host, remove host status
      if (gameHost === socket.customId) {
        console.log(`Host player ${socket.customId} is leaving, clearing host status`);
        gameHost = null;
      }
      
      // Notify other players that can see this player
      for (const [id, visibleToIds] of Object.entries(playerVisibility)) {
        if (visibleToIds.has(socket.customId) && id !== socket.customId) {
          visibleToIds.delete(socket.customId);
          io.to(id).emit('player-disconnected', { id: socket.customId });
        }
      }
      
      // Clean up visibility tracking for this player
      delete playerVisibility[socket.customId];
    } catch (error) {
      console.error(`Error in player-leave for ${socket.customId}:`, error);
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    try {
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
          try {
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
          } catch (cleanupError) {
            console.error(`Error during cleanup for player ${socket.customId}:`, cleanupError);
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
        try {
          existingIds.delete(socket.customId);
        } catch (idError) {
          console.error(`Error releasing player ID ${socket.customId}:`, idError);
        }
      }, 10 * 60 * 1000); // 10 minutes
    } catch (error) {
      console.error(`Error in disconnect handler for player ${socket.customId}:`, error);
    }
  });
});

// Add a cleanup task to detect and clean up inactive players
setInterval(() => {
  try {
    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    
    Object.keys(players).forEach(playerId => {
      try {
        const player = players[playerId];
        
        // Check if player is disconnected for too long
        if (player && player.disconnectedAt && (now - player.disconnectedAt > inactiveThreshold)) {
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
          
          // Notify other players that this player has been permanently removed
          for (const [id, visibleToIds] of Object.entries(playerVisibility)) {
            if (visibleToIds.has(playerId)) {
              visibleToIds.delete(playerId);
              io.to(id).emit('player-disconnected', { id: playerId });
            }
          }
        }
      } catch (playerError) {
        console.error(`Error cleaning up player ${playerId}:`, playerError);
      }
    });
  } catch (error) {
    console.error('Error in cleanup task:', error);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

server.listen(3001, () => {
  console.log('Server is running on port 3001');
});
