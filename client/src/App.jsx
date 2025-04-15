// App.jsx
import { useState, useEffect, useCallback } from 'react';
import CanvasGame from './components/CanvasGame';
import EnterName from './components/EnterName';
import socket from './socket';

function App() {
  const [playerName, setPlayerName] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Try to load persisted state on startup
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('playerName');
      const savedIsHost = localStorage.getItem('isHost') === 'true';
      
      if (savedName) {
        console.log(`Restoring saved player name: ${savedName}`);
        setPlayerName(savedName);
        setIsHost(savedIsHost);
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
    }
  }, []);
  
  // Add error boundary recovery
  useEffect(() => {
    // Custom error handler
    const handleError = (event) => {
      console.error('Global error caught:', event.error || event.message);
      const errorMsg = event.error?.message || event.message || 'Unknown error occurred';
      setHasError(true);
      setErrorMessage(errorMsg);
    };
    
    // Register error handlers
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  // Monitor socket connection status
  useEffect(() => {
    const handleConnect = () => setConnectionStatus('connected');
    const handleDisconnect = () => setConnectionStatus('disconnected');
    const handleConnectError = () => setConnectionStatus('error');
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    
    // Initial status check
    if (socket.connected) {
      setConnectionStatus('connected');
    }
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  const handleStartGame = (name, asHost) => {
    try {
      // Validate name
      const trimmedName = name?.trim() || 'Player';
      
      // Store in state
      setPlayerName(trimmedName);
      setIsHost(!!asHost);
      setHasError(false);
      
      // Save to local storage for recovery
      localStorage.setItem('playerName', trimmedName);
      localStorage.setItem('isHost', asHost ? 'true' : 'false');
    } catch (error) {
      console.error('Error starting game:', error);
      // Still try to set the name with a fallback
      setPlayerName(name || 'Player');
      setIsHost(!!asHost);
    }
  };
  
  const handleReset = () => {
    setHasError(false);
    setErrorMessage('');
    setPlayerName(null);
    setIsHost(false);
    localStorage.removeItem('playerName');
    localStorage.removeItem('isHost');
  };

  const handleGameError = useCallback((error) => {
    console.error('Game error:', error);
    
    // Check if this is the special EXIT_GAME signal
    if (error?.message === 'EXIT_GAME') {
      console.log('Exiting game and returning to home screen');
      handleReset(); // Use the existing reset functionality
      return; // Don't set error state, just reset
    }
    
    // Normal error handling
    setErrorMessage(error?.message || 'An error occurred in the game.');
    setHasError(true);
  }, []);

  return (
    <div className="min-h-screen text-white" style={{
      background: 'linear-gradient(180deg, #1a202c 0%, #4a1d96 50%, #1a202c 100%)'
    }}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-center text-5xl font-bold p-4 mb-8 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-pink-600 drop-shadow-xl">
          Stickman Racing
        </h1>
        
        {/* Connection status indicator */}
        <div className="flex justify-center mb-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            connectionStatus === 'connected' ? 'bg-green-600' : 
            connectionStatus === 'disconnected' ? 'bg-red-600' : 
            connectionStatus === 'error' ? 'bg-red-800' : 'bg-yellow-600'
          }`}>
            {connectionStatus === 'connected' ? 'Connected' : 
             connectionStatus === 'disconnected' ? 'Disconnected' : 
             connectionStatus === 'error' ? 'Connection Error' : 'Connecting...'}
          </div>
        </div>
        
        {hasError ? (
          <div className="text-center p-4 bg-red-900 rounded-lg shadow-lg max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="mb-4">{errorMessage || 'An error occurred in the game. Please try again.'}</p>
          </div>
        ) : !playerName ? (
          <EnterName onStart={handleStartGame} />
        ) : (
          <CanvasGame 
            playerName={playerName} 
            isHost={isHost} 
            onError={handleGameError}
          />
        )}
      </div>
    </div>
  );
}

export default App;
