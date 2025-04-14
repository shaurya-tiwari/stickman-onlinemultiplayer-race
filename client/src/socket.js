// client/src/socket.js
import { io } from 'socket.io-client';

// Create socket with improved reconnection logic and fallback options
let socketUrl = 'http://localhost:3001';
// Try to determine if we're in production by checking the window location
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  // Use relative URL in production to match current domain
  socketUrl = '/';
}

const socket = io(socketUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10, // Increased from 5
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  query: {
    isolation: 'true',
    clientId: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
});

// Track which players we can see (for client-side filtering)
const visiblePlayers = new Set();
let myPlayerId = null;
let lastKnownPosition = { x: 0, y: 0 };
let reconnecting = false;
let reconnectionTimer = null;

// Store event listeners for cleanup
const globalEventListeners = [];

// Add event listener with cleanup tracking
const addGlobalEventListener = (event, handler) => {
  window.addEventListener(event, handler);
  globalEventListeners.push({ event, handler });
};

// Clean up all registered global event listeners
const cleanupGlobalEventListeners = () => {
  globalEventListeners.forEach(({ event, handler }) => {
    window.removeEventListener(event, handler);
  });
  globalEventListeners.length = 0;
};

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

// Improved reconnection handler
socket.on('connect', () => {
  console.log('Connected to server!');
  clearTimeout(reconnectionTimer);
  reconnecting = false;
  
  // Check if we were previously connected
  const storedPlayerId = localStorage.getItem('playerId');
  if (storedPlayerId && !myPlayerId) {
    console.log(`Attempting to reconnect with stored player ID: ${storedPlayerId}`);
    
    // Restore the player ID 
    myPlayerId = storedPlayerId;
    
    // Request race state update from server with retry mechanism
    const attemptReconnection = (retryCount = 0) => {
      if (retryCount > 3) {
        console.log('Failed to reconnect after multiple attempts');
        localStorage.removeItem('playerId');
        myPlayerId = null;
        return;
      }
      
      socket.emit('reconnect-to-race', (response) => {
        console.log('Reconnection response:', response);
        
        if (response && response.success) {
          // Update visible players based on server response
          visiblePlayers.clear();
          visiblePlayers.add(myPlayerId); // Always see ourselves
          
          // Add all visible players from response
          if (response.visiblePlayers && Array.isArray(response.visiblePlayers)) {
            response.visiblePlayers.forEach(player => {
              if (player && player.id) {
                visiblePlayers.add(player.id);
              }
            });
          }
          
          // Broadcast reconnection event for anyone listening
          const reconnectEvent = new CustomEvent('player-reconnected', {
            detail: {
              playerId: myPlayerId, 
              raceStatus: response.raceStatus || { isActive: false, distance: 1000 },
              visiblePlayers: response.visiblePlayers || []
            }
          });
          window.dispatchEvent(reconnectEvent);
        } else {
          // Retry reconnection after a short delay
          console.log(`Reconnection attempt ${retryCount + 1} failed, retrying...`);
          setTimeout(() => attemptReconnection(retryCount + 1), 1000);
        }
      });
    };
    
    attemptReconnection();
  }
});

// Track connection state with improved error handling
socket.on('disconnect', () => {
  console.log('Disconnected from server, will attempt to reconnect');
  reconnecting = true;
  
  // Store last position for reconnection
  if (myPlayerId) {
    localStorage.setItem('lastPosition', JSON.stringify(lastKnownPosition));
  }
  
  // Set a timeout to clear stored data if reconnection fails for too long
  reconnectionTimer = setTimeout(() => {
    if (reconnecting) {
      console.log('Reconnection failed for too long, clearing stored player data');
      localStorage.removeItem('playerId');
      localStorage.removeItem('lastPosition');
      myPlayerId = null;
      visiblePlayers.clear();
    }
  }, 5 * 60 * 1000); // 5 minutes timeout
});

// Add error handling for connection errors
socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
  
  // If we keep getting connection errors, eventually reset
  if (socket.io.reconnectionAttempts >= 5) {
    console.log('Multiple connection errors, resetting connection state');
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
  if (!socket.connected) {
    console.warn('Attempted to update position while disconnected');
    return;
  }
  
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
  try {
    // Validate parameters
    if (!event) {
      console.error('safeEmit called without event name');
      return;
    }
    
    // Check if socket is connected
    if (!socket.connected) {
      console.warn(`Attempted to emit ${event} while socket is disconnected`);
      return;
    }
    
    // Deep copy the data to avoid modifying original
    let processedData = {};
    try {
      processedData = data ? JSON.parse(JSON.stringify(data)) : {};
    } catch (parseError) {
      console.error(`Error serializing data for ${event}:`, parseError);
      processedData = { ...data }; // Fallback to shallow copy
    }
    
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
    
    // Create a safer callback wrapper
    const safeCallback = callback ? (...args) => {
      try {
        callback(...args);
      } catch (callbackError) {
        console.error(`Error in socket.io callback for ${event}:`, callbackError);
      }
    } : undefined;
    
    // Finally emit the event
    socket.emit(event, processedData, safeCallback);
  } catch (error) {
    console.error(`Error in safeEmit for ${event}:`, error);
  }
};

// Debug function to log all visible players
const logVisiblePlayers = () => {
  console.log('Current visible players:', Array.from(visiblePlayers));
  return Array.from(visiblePlayers);
};

// Clean up resources when unloading
window.addEventListener('beforeunload', () => {
  if (reconnectionTimer) {
    clearTimeout(reconnectionTimer);
  }
  cleanupGlobalEventListeners();
  socket.disconnect();
});

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
  lastKnownPosition,
  addGlobalEventListener,
  cleanupGlobalEventListeners
};
