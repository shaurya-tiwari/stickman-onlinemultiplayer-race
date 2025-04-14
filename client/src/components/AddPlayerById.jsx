import { useState, useEffect } from 'react';
import socket, { visiblePlayers, cleanId, safeEmit } from '../socket';

const AddPlayerById = ({ myId }) => {
  const [showPopup, setShowPopup] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);

  // Format a player ID for display (XXX-XXX-XXXX)
  const formatDisplayId = (id) => {
    if (!id) return '';
    const idStr = id.toString();
    if (idStr.length === 10) {
      return `${idStr.substring(0, 3)}-${idStr.substring(3, 6)}-${idStr.substring(6, 10)}`;
    }
    return id;
  };

  useEffect(() => {
    // Listen for join requests from other players
    socket.on('join-request', ({ playerId, playerName }) => {
      console.log(`Received join request from: ${playerName} (${playerId})`);
      setPendingRequests(prev => [
        ...prev,
        { id: playerId, name: playerName }
      ]);
    });

    // Listen for acceptance/rejection responses
    socket.on('request-accepted', ({ isRequestSender }) => {
      console.log('Join request was accepted!', isRequestSender ? '(You are the request sender)' : '');
      setMessage('Join request accepted!');
      setMessageType('success');
      setTimeout(() => {
        setShowPopup(false);
        setMessage('');
      }, 2000);
      
      // Store in localStorage that this player is a request sender
      if (isRequestSender) {
        localStorage.setItem('isRequestSender', 'true');
      }
    });

    socket.on('request-rejected', () => {
      console.log('Join request was rejected.');
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
    
    // Reset any previous messages
    setMessage('');
    setMessageType('');
    
    // Validate input
    if (!playerId) {
      setMessage('Please enter a player ID');
      setMessageType('error');
      return;
    }
    
    try {
      // Clean the ID (remove any formatting)
      const cleanedId = cleanId(playerId.trim());
      
      if (!cleanedId) {
        setMessage('Please enter a player ID');
        setMessageType('error');
        return;
      }
      
      // Validate: must be 10 digits
      if (!/^\d{10}$/.test(cleanedId)) {
        setMessage('Player ID must be 10 digits');
        setMessageType('error');
        return;
      }
      
      // Prevent joining yourself
      if (cleanedId === myId) {
        setMessage('You cannot join yourself');
        setMessageType('error');
        return;
      }

      console.log(`Attempting to join player with ID: ${cleanedId}`);
      setMessage('Sending join request...');
      setMessageType('info');
      
      safeEmit('join-by-id', { targetId: cleanedId }, (response) => {
        console.log(`Join by ID response:`, response);
        if (response && response.success) {
          setMessage('Join request sent! Waiting for approval...');
          setMessageType('info');
        } else {
          setMessage(response?.message || 'Player ID not found');
          setMessageType('error');
        }
      });
    } catch (error) {
      console.error('Error in join request:', error);
      setMessage('An error occurred. Please try again.');
      setMessageType('error');
    }
  };

  const handleAcceptRequest = (requestInfo) => {
    try {
      if (!requestInfo || !requestInfo.id) {
        console.error('Invalid request info:', requestInfo);
        return;
      }
      
      console.log(`Accepting join request from player: ${requestInfo.id}`, requestInfo);
      // Use the safeEmit to ensure ID is properly formatted
      safeEmit('accept-join-request', { playerId: requestInfo.id });
      // Update UI immediately 
      setPendingRequests(prev => prev.filter(req => req.id !== requestInfo.id));
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleRejectRequest = (playerId) => {
    try {
      if (!playerId) {
        console.error('Invalid player ID for rejection');
        return;
      }
      
      console.log(`Rejecting join request from player: ${playerId}`);
      // Use the safeEmit to ensure ID is properly formatted
      safeEmit('reject-join-request', { playerId });
      // Update UI immediately 
      setPendingRequests(prev => prev.filter(req => req.id !== playerId));
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  // Format ID as user types (XXX-XXX-XXXX)
  const handleIdChange = (e) => {
    const input = e.target.value.replace(/-/g, ''); // Remove existing dashes
    const digits = input.replace(/\D/g, ''); // Keep only digits
    
    // Format with dashes
    let formattedValue = '';
    if (digits.length > 0) {
      formattedValue = digits.substring(0, 3);
      if (digits.length > 3) {
        formattedValue += '-' + digits.substring(3, 6);
      }
      if (digits.length > 6) {
        formattedValue += '-' + digits.substring(6, 10);
      }
    }
    
    // Limit to 10 digits (plus 2 dashes = 12 characters max)
    if (formattedValue.length <= 12) {
      setPlayerId(formattedValue);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-20">
      <button
        onClick={() => setShowPopup(true)}
        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 rounded-xl shadow-xl hover:opacity-90 transform hover:scale-105 transition duration-300 flex items-center animate-pulse"
        style={{
          boxShadow: '0 0 15px rgba(147, 51, 234, 0.6)'
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
        <div className="fixed bottom-24 right-6 bg-slate-900 bg-opacity-90 backdrop-filter backdrop-blur-lg p-5 rounded-xl shadow-2xl z-30 w-80 border border-purple-500 border-opacity-50">
          <h3 className="font-bold mb-4 text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-pink-500 flex items-center">
            <svg className="w-5 h-5 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Join Requests
          </h3>
          <div className="space-y-4">
            {pendingRequests.map(req => (
              <div key={req.id} className="border border-purple-700 border-opacity-50 rounded-lg p-4 bg-black bg-opacity-40">
                <p className="mb-3 text-white">
                  <span className="font-bold text-amber-300">{req.name}</span> wants to join your race!
                </p>
                <div className="text-xs text-purple-300 mb-3">ID: {formatDisplayId(req.id)}</div>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => handleAcceptRequest(req)}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-1.5 rounded-md text-sm hover:opacity-90 flex-1 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Accept
                  </button>
                  <button 
                    onClick={() => handleRejectRequest(req.id)}
                    className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-1.5 rounded-md text-sm hover:opacity-90 flex-1 flex items-center justify-center"
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
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-filter backdrop-blur-lg flex items-center justify-center z-40">
          <div className="bg-slate-900 bg-opacity-90 p-8 rounded-2xl shadow-2xl w-96 border border-purple-500 border-opacity-50 transform transition-all duration-300">
            <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-pink-500 flex items-center">
              <svg className="w-6 h-6 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Join a Friend's Race
            </h2>
            
            <form onSubmit={handleJoinById}>
              <div className="relative mb-6">
                <label className="text-amber-300 text-sm font-medium mb-2 block">Friend's Player ID</label>
                <input
                  type="text"
                  value={playerId}
                  onChange={handleIdChange}
                  placeholder="XXX-XXX-XXXX"
                  className="w-full bg-black bg-opacity-50 border-b-2 border-purple-500 p-3 text-white focus:outline-none focus:border-amber-400 transition duration-300 rounded-md"
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
                  onClick={() => setShowPopup(false)}
                  className="flex-1 bg-slate-700 text-slate-200 px-4 py-3 rounded-xl hover:bg-slate-600 transition duration-300 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-3 rounded-xl hover:opacity-90 transition duration-300 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Send Request
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