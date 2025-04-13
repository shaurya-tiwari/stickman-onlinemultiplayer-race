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
    <div className="fixed bottom-4 right-4 z-20">
      <button
        onClick={() => setShowPopup(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Add Player by ID
      </button>

      {/* Notification for pending requests */}
      {pendingRequests.length > 0 && (
        <div className="fixed bottom-16 right-4 bg-white p-4 rounded shadow-lg z-30 w-72">
          <h3 className="font-bold mb-2">Join Requests ({pendingRequests.length})</h3>
          {pendingRequests.map(req => (
            <div key={req.id} className="border-b py-2 last:border-0">
              <p className="mb-2"><strong>{req.name}</strong> wants to join your race!</p>
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleAcceptRequest(req)}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                >
                  Accept
                </button>
                <button 
                  onClick={() => handleRejectRequest(req.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white p-6 rounded shadow-lg w-80">
            <h2 className="text-xl font-bold mb-4">Join a Player</h2>
            
            <form onSubmit={handleJoinById}>
              <input
                type="text"
                className="border p-2 w-full mb-4"
                placeholder="Enter player ID"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
              />
              
              {message && (
                <div className={`p-2 rounded mb-4 ${
                  messageType === 'error' ? 'bg-red-100 text-red-700' : 
                  messageType === 'success' ? 'bg-green-100 text-green-700' : 
                  'bg-blue-100 text-blue-700'
                }`}>
                  {message}
                </div>
              )}
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setShowPopup(false);
                    setMessage('');
                    setPlayerId('');
                  }}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Join
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