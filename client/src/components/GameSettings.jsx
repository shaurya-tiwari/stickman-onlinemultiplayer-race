import { useState, useEffect } from 'react';
import socket, { safeEmit } from '../socket';

const GameSettings = ({ myId }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [raceDistance, setRaceDistance] = useState(1000);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Predefined race distance options in meters
  const distanceOptions = [
    { value: 1000, label: '1000m (Short Race)' },
    { value: 2000, label: '2000m (Medium Race)' },
    { value: 5000, label: '5000m (Long Race)' },
    { value: 10000, label: '10000m (Marathon)' }
  ];

  useEffect(() => {
    // Check if current player is a host
    socket.on('host-status', ({ isHost: hostStatus }) => {
      setIsHost(hostStatus);
    });

    // Listen for game settings updates
    socket.on('game-settings-updated', ({ raceDistance: newDistance }) => {
      setRaceDistance(newDistance);
      setMessage(`Race distance updated to ${newDistance}m`);
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    });

    // When component mounts, check if I'm already a host
    if (myId) {
      safeEmit('check-host-status', {}, (response) => {
        console.log('Host status response:', response);
        setIsHost(response.isHost);
      });
    }

    return () => {
      socket.off('host-status');
      socket.off('game-settings-updated');
    };
  }, [myId]);

  const handleBecomeHost = () => {
    safeEmit('become-host', {}, (response) => {
      if (response.success) {
        setIsHost(true);
        setMessage('You are now the host!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(response.message || 'Failed to become host');
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    });
  };

  const handleUpdateSettings = (e) => {
    e.preventDefault();
    
    // First, emit a dummy position update to ensure server knows about us
    // This helps prevent the host from disappearing after settings update
    if (myId) {
      socket.emit('update-position', { x: 0, y: 0, isJumping: false });
    }
    
    safeEmit('update-game-settings', { raceDistance }, (response) => {
      if (response.success) {
        setMessage('Game settings updated successfully!');
        setMessageType('success');
        setShowSettings(false);
        setTimeout(() => setMessage(''), 3000);
        
        // Re-request host status to ensure we stay visible
        safeEmit('become-host', {}, (hostResponse) => {
          console.log('Re-request host status response:', hostResponse);
        });
      } else {
        setMessage(response.message || 'Failed to update settings');
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    });
  };

  return (
    <div className="fixed top-20 left-6 z-20">
      {/* Host button/indicator */}
      <div 
        className={`bg-gradient-to-r ${isHost ? 'from-amber-500 to-orange-600' : 'from-purple-600 to-pink-700'} text-white px-4 py-3 rounded-xl shadow-xl cursor-pointer transform hover:scale-105 transition duration-300 flex items-center`}
        onClick={() => isHost ? setShowSettings(true) : handleBecomeHost()}
        style={{
          boxShadow: isHost ? '0 0 15px rgba(245, 158, 11, 0.7)' : '0 0 15px rgba(147, 51, 234, 0.6)'
        }}
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {isHost ? 'Race Settings' : 'Become Host'}
      </div>

      {/* Race distance indicator */}
      <div className="mt-4 bg-black bg-opacity-60 backdrop-filter backdrop-blur-lg rounded-xl py-2 px-4 text-white border border-purple-500 border-opacity-30">
        <div className="text-sm font-bold text-amber-300">Race Finish Line</div>
        <div className="font-mono text-white">
          {raceDistance}m
        </div>
      </div>

      {/* Host settings popup */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-filter backdrop-blur-lg flex items-center justify-center z-40">
          <div className="bg-slate-900 bg-opacity-90 p-8 rounded-2xl shadow-2xl w-96 border border-purple-500 border-opacity-50 transform transition-all duration-300">
            <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-pink-500 flex items-center">
              <svg className="w-6 h-6 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Race Settings
            </h2>
            
            <form onSubmit={handleUpdateSettings}>
              <div className="relative mb-6">
                <label className="text-amber-300 text-sm font-medium mb-2 block">Race Distance</label>
                <select
                  value={raceDistance}
                  onChange={(e) => setRaceDistance(Number(e.target.value))}
                  className="w-full bg-black bg-opacity-50 border-b-2 border-purple-500 p-3 text-white focus:outline-none focus:border-amber-400 transition duration-300 rounded-md"
                >
                  {distanceOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {message && (
                <div className={`p-3 rounded-lg mb-6 flex items-center ${
                  messageType === 'error' ? 'bg-red-900 bg-opacity-50 text-red-200 border border-red-700' : 
                  messageType === 'success' ? 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700' : 
                  'bg-blue-900 bg-opacity-50 text-blue-200 border border-blue-700'
                }`}>
                  <svg className={`w-5 h-5 mr-2 ${
                    messageType === 'error' ? 'text-red-400' :
                    messageType === 'success' ? 'text-green-400' :
                    'text-blue-400'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    {messageType === 'error' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : messageType === 'success' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                  {message}
                </div>
              )}
              
              <div className="flex justify-between space-x-4">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-slate-700 text-slate-200 px-4 py-3 rounded-xl hover:bg-slate-600 transition duration-300 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-3 rounded-xl hover:from-amber-600 hover:to-orange-700 transition duration-300 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Apply Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameSettings; 