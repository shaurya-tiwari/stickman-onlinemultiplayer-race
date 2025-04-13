// client/src/socket.js
import { io } from 'socket.io-client';

// Create socket with isolated rooms and reconnection
const socket = io('http://localhost:3001', {
  autoConnect: true, // Connect automatically
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  query: {
    isolation: 'true', // Flag to tell server we want isolation
    clientId: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Generate unique client ID
  }
});

// Track which players we can see (for client-side filtering)
const visiblePlayers = new Set();
let myPlayerId = null;
let lastKnownPosition = { x: 0, y: 0 };

// Add the current player to visible list when we get our ID
socket.on('init', ({ id }) => {
  if (id) {
    console.log(`Init received with my ID: ${id}`);
    myPlayerId = id;
    visiblePlayers.add(id); // Always see ourselves
    console.log('Initialized visible players with self:', Array.from(visiblePlayers));
    
    // Store player ID in localStorage for potential reconnection
    localStorage.setItem('playerId', id);
  }
});

// Handle reconnection
socket.on('connect', () => {
  // Check if we were previously connected
  const storedPlayerId = localStorage.getItem('playerId');
  if (storedPlayerId && !myPlayerId) {
    console.log(`Attempting to reconnect with stored player ID: ${storedPlayerId}`);
    
    // Restore the player ID 
    myPlayerId = storedPlayerId;
    
    // Request race state update from server
    socket.emit('reconnect-to-race', (response) => {
      console.log('Reconnection response:', response);
      
      if (response.success) {
        // Update visible players based on server response
        visiblePlayers.clear();
        visiblePlayers.add(myPlayerId); // Always see ourselves
        
        // Add all visible players from response
        response.visiblePlayers.forEach(player => {
          visiblePlayers.add(player.id);
        });
        
        // Broadcast reconnection event for anyone listening
        const reconnectEvent = new CustomEvent('player-reconnected', {
          detail: {
            playerId: myPlayerId, 
            raceStatus: response.raceStatus,
            visiblePlayers: response.visiblePlayers
          }
        });
        window.dispatchEvent(reconnectEvent);
      } else {
        // Failed to reconnect with stored ID, clear it
        localStorage.removeItem('playerId');
        myPlayerId = null;
        console.log('Failed to reconnect with stored player ID, will create new session');
      }
    });
  }
});

// Track connection state
socket.on('disconnect', () => {
  console.log('Disconnected from server, will attempt to reconnect');
  // Store last position for reconnection
  if (myPlayerId) {
    localStorage.setItem('lastPosition', JSON.stringify(lastKnownPosition));
  }
});

// Add functionality to handle player joining
socket.on('player-joined', ({ id }) => {
  console.log(`Player joined and is now visible: ${id}`);
  visiblePlayers.add(id);
  
  // Always make sure we're in our own visibility list
  if (myPlayerId) {
    visiblePlayers.add(myPlayerId);
  }
  
  console.log('Current visible players:', Array.from(visiblePlayers));
});

// Add functionality to handle when another player reconnects
socket.on('player-reconnected', ({ id, name, x, y }) => {
  console.log(`Player reconnected: ${name} (${id})`);
  visiblePlayers.add(id);
  
  // Broadcast reconnection event for game component to update player position
  const playerReconnectedEvent = new CustomEvent('other-player-reconnected', {
    detail: { id, name, x, y }
  });
  window.dispatchEvent(playerReconnectedEvent);
});

// Modified: Update position tracking function
const updatePosition = (position) => {
  if (position) {
    lastKnownPosition = { ...position };
  }
};

// Add helpers to check if a player should be visible
const isPlayerVisible = (playerId) => {
  return visiblePlayers.has(playerId);
};

// Format a player ID for display (XXX-XXX-XXXX)
const formatDisplayId = (id) => {
  if (!id) return '';
  const idStr = id.toString();
  if (idStr.length === 10) {
    return `${idStr.substring(0, 3)}-${idStr.substring(3, 6)}-${idStr.substring(6, 10)}`;
  }
  return id;
};

// Remove formatting from ID (remove dashes)
const cleanId = (id) => {
  if (typeof id === 'string') {
    return id.replace(/-/g, '');
  }
  return id;
};

// Create safe socket emit wrapper that ensures IDs are clean
const safeEmit = (event, data, callback) => {
  // Deep copy the data to avoid modifying original
  const processedData = JSON.parse(JSON.stringify(data));
  
  // Process playerId properties
  if (processedData.playerId) {
    processedData.playerId = cleanId(processedData.playerId);
  }
  
  // Process targetId properties
  if (processedData.targetId) {
    processedData.targetId = cleanId(processedData.targetId);
  }
  
  // If this is a position update, track it locally too
  if (event === 'update-position') {
    updatePosition(processedData);
  }
  
  console.log(`Emitting ${event} with data:`, processedData);
  socket.emit(event, processedData, callback);
};

// Debug function to log all visible players
const logVisiblePlayers = () => {
  console.log('Current visible players:', Array.from(visiblePlayers));
  return Array.from(visiblePlayers);
};

// Export both the socket and helper functions
export default socket;
export { 
  isPlayerVisible, 
  visiblePlayers, 
  formatDisplayId, 
  cleanId, 
  safeEmit, 
  logVisiblePlayers, 
  myPlayerId,
  updatePosition,
  lastKnownPosition
};
