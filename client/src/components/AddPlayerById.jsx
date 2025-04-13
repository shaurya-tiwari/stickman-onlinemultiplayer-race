import { useState, useEffect } from 'react';
import socket, { visiblePlayers } from '../socket';

const AddPlayerById = ({ myId }) => {
  const [showPopup, setShowPopup] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    // Listen for join requests from other players
    socket.on('join-request', ({ playerId, playerName }) => {
      setPendingRequests(prev => [
        ...prev,
        { id: playerId, name: playerName }
      ]);
    });

    // Listen for acceptance/rejection responses
    socket.on('request-accepted', () => {
      setMessage('Join request accepted!');
      setMessageType('success');
      setTimeout(() => {
        setShowPopup(false);
        setMessage('');
      }, 2000);
    });

    socket.on('request-rejected', () => {
      setMessage('Join request was rejected.');
      setMessageType('error');
      setTimeout(() => setMessage(''), 3000);
    });

    return () => {
      socket.off('join-request');
      socket.off('request-accepted');
      socket.off('request-rejected');
    };
  }, []);

  const handleJoinById = (e) => {
    e.preventDefault();
    if (!playerId.trim()) {
      setMessage('Please enter a player ID');
      setMessageType('error');
      return;
    }

    socket.emit('join-by-id', { targetId: playerId.trim() }, (response) => {
      if (response.success) {
        setMessage('Join request sent! Waiting for approval...');
        setMessageType('info');
      } else {
        setMessage(response.message || 'Player ID not found');
        setMessageType('error');
      }
    });
  };

  const handleAcceptRequest = (requestInfo) => {
    socket.emit('accept-join-request', { playerId: requestInfo.id });
    setPendingRequests(prev => prev.filter(req => req.id !== requestInfo.id));
  };

  const handleRejectRequest = (playerId) => {
    socket.emit('reject-join-request', { playerId });
    setPendingRequests(prev => prev.filter(req => req.id !== playerId));
  };

  return (
    <div className="fixed bottom-6 right-6 z-20">
      <button
        onClick={() => setShowPopup(true)}
        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-lg shadow-lg hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105 transition duration-300 flex items-center animate-pulse"
        style={{
          boxShadow: '0 0 15px rgba(79, 70, 229, 0.6)'
        }}
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Join a Friend
      </button>

      {/* Notification badge for pending requests */}
      {pendingRequests.length > 0 && (
        <div className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-lg animate-pulse">
          {pendingRequests.length}
        </div>
      )}

      {/* Pending requests panel */}
      {pendingRequests.length > 0 && (
        <div className="fixed bottom-24 right-6 bg-gray-900 bg-opacity-90 backdrop-filter backdrop-blur-sm p-5 rounded-xl shadow-2xl z-30 w-80 border border-purple-500 border-opacity-50">
          <h3 className="font-bold mb-4 text-xl text-white flex items-center">
            <svg className="w-5 h-5 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Join Requests
          </h3>
          <div className="space-y-4">
            {pendingRequests.map(req => (
              <div key={req.id} className="border border-gray-700 rounded-lg p-4 bg-black bg-opacity-30">
                <p className="mb-3 text-white"><span className="font-bold text-yellow-300">{req.name}</span> wants to join your race!</p>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => handleAcceptRequest(req)}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-1.5 rounded-md text-sm hover:from-green-600 hover:to-emerald-700 flex-1 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Accept
                  </button>
                  <button 
                    onClick={() => handleRejectRequest(req.id)}
                    className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-1.5 rounded-md text-sm hover:from-red-600 hover:to-pink-700 flex-1 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-gray-900 bg-opacity-90 p-8 rounded-xl shadow-2xl w-96 border border-indigo-500 border-opacity-50 transform transition-all duration-300">
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center">
              <svg className="w-6 h-6 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Join a Friend's Race
            </h2>
            
            <form onSubmit={handleJoinById}>
              <div className="relative mb-6">
                <label className="text-blue-300 text-sm font-medium mb-2 block">Friend's Player ID</label>
                <input
                  type="text"
                  className="w-full bg-black bg-opacity-50 border-b-2 border-indigo-500 p-3 text-white placeholder-indigo-300 focus:outline-none focus:border-yellow-400 transition duration-300 rounded-md"
                  placeholder="Enter player ID"
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                />
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
                  onClick={() => {
                    setShowPopup(false);
                    setMessage('');
                    setPlayerId('');
                  }}
                  className="flex-1 bg-gray-700 text-gray-200 px-4 py-3 rounded-lg hover:bg-gray-600 transition duration-300 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition duration-300 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Join Race
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddPlayerById; 