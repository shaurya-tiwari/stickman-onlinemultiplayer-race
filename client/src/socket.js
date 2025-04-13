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
    visiblePlayers.add(id); // Always see ourselves
  }
});

// Add functionality to handle player joining
socket.on('player-joined', ({ id }) => {
  visiblePlayers.add(id);
});

// Add helpers to check if a player should be visible
const isPlayerVisible = (playerId) => {
  return visiblePlayers.has(playerId);
};

// Export both the socket and helper functions
export default socket;
export { isPlayerVisible, visiblePlayers };
