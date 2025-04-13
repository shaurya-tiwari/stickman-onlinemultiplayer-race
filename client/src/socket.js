// client/src/socket.js
import { io } from 'socket.io-client';

// Create socket with isolated rooms
const socket = io('http://localhost:3001', {
  autoConnect: true, // Connect automatically
  query: {
    isolation: 'true', // Flag to tell server we want isolation
    clientId: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Generate unique client ID
  }
});

// Track which players we can see (for client-side filtering)
const visiblePlayers = new Set();

// Add the current player to visible list when we get our ID
socket.on('init', ({ id }) => {
  if (id) {
    console.log(`Init received with my ID: ${id}`);
    visiblePlayers.add(id); // Always see ourselves
  }
});

// Add functionality to handle player joining
socket.on('player-joined', ({ id }) => {
  console.log(`Player joined and is now visible: ${id}`);
  visiblePlayers.add(id);
  console.log('Current visible players:', Array.from(visiblePlayers));
});

// Remove players when they disconnect
socket.on('player-disconnected', ({ id }) => {
  console.log(`Player disconnected: ${id}`);
  visiblePlayers.delete(id);
  console.log('Current visible players after disconnect:', Array.from(visiblePlayers));
});

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
  
  console.log(`Emitting ${event} with data:`, processedData);
  socket.emit(event, processedData, callback);
};

// Debug function to log all visible players
const logVisiblePlayers = () => {
  console.log('Current visible players:', Array.from(visiblePlayers));
};

// Export both the socket and helper functions
export default socket;
export { isPlayerVisible, visiblePlayers, formatDisplayId, cleanId, safeEmit, logVisiblePlayers };
