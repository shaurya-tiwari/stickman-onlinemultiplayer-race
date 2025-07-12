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

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('playerName');
      const savedIsHost = localStorage.getItem('isHost') === 'true';
      if (savedName) {
        setPlayerName(savedName);
        setIsHost(savedIsHost);
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
    }
  }, []);

  useEffect(() => {
    const handleError = (event) => {
      const errorMsg = event.error?.message || event.message || 'Unknown error occurred';
      setHasError(true);
      setErrorMessage(errorMsg);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  useEffect(() => {
    const handleConnect = () => setConnectionStatus('connected');
    const handleDisconnect = () => setConnectionStatus('disconnected');
    const handleConnectError = () => setConnectionStatus('error');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    if (socket.connected) setConnectionStatus('connected');

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  const handleStartGame = (name, asHost) => {
    try {
      const trimmedName = name?.trim() || 'Player';
      setPlayerName(trimmedName);
      setIsHost(!!asHost);
      setHasError(false);
      localStorage.setItem('playerName', trimmedName);
      localStorage.setItem('isHost', asHost ? 'true' : 'false');
    } catch (error) {
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
    if (error?.message === 'EXIT_GAME') {
      handleReset();
      return;
    }
    setErrorMessage(error?.message || 'An error occurred in the game.');
    setHasError(true);
  }, []);

  const getStatusDot = () => {
    const map = {
      connected: 'bg-green-500',
      disconnected: 'bg-red-500',
      error: 'bg-orange-500',
      connecting: 'bg-yellow-400 animate-pulse'
    };
    return map[connectionStatus] || 'bg-gray-400';
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-200 text-gray-900 font-sans overflow-x-hidden">
      <div className="flex flex-col items-center px-4 py-10 min-h-screen">
        <div className="text-center mb-4">
          <h1 className="text-5xl font-bold tracking-tight text-gray-800">Stickman Racing</h1>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm font-medium text-gray-600">
            <div className={`w-3 h-3 rounded-full ${getStatusDot()}`} />
            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </div>
        </div>

        <div className="w-full max-w-3xl">
          {hasError ? (
            <div className="p-6 bg-white/60 backdrop-blur-md border border-gray-200 rounded-xl shadow-lg text-center">
              <h2 className="text-2xl font-semibold text-red-700 mb-2">Oops! Something went wrong</h2>
              <p className="text-sm text-red-600">{errorMessage}</p>
              <button
                onClick={handleReset}
                className="mt-4 px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md transition"
              >
                Go Back
              </button>
            </div>
          ) : !playerName ? (
            <div className="p-6 bg-white/50 backdrop-blur-lg rounded-xl shadow-md border border-gray-200">
              <EnterName onStart={handleStartGame} />
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden shadow-2xl backdrop-blur-md bg-white/40 border border-white/30">
              <CanvasGame
                playerName={playerName}
                isHost={isHost}
                onError={handleGameError}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
