import { useState } from 'react';

const PlayerIdDisplay = ({ playerId }) => {
  const [copied, setCopied] = useState(false);
  
  // Format the 10-digit ID for better readability: XXX-XXX-XXXX
  const formatPlayerId = (id) => {
    if (!id) return '';
    const idStr = id.toString();
    if (idStr.length === 10) {
      return `${idStr.substring(0, 3)}-${idStr.substring(3, 6)}-${idStr.substring(6, 10)}`;
    }
    return id;
  };
  
  const copyToClipboard = () => {
    // Always copy the unformatted ID
    navigator.clipboard.writeText(playerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-gray-900 bg-opacity-85 backdrop-filter backdrop-blur-sm text-white py-3 px-4 shadow-lg z-10">
      <div className="flex items-center justify-center flex-wrap gap-2">
        <span className="text-sm font-medium text-blue-300">Your Player ID:</span>
        <code className="bg-gray-800 px-3 py-1 rounded-md font-mono text-yellow-300 border border-gray-700">
          {formatPlayerId(playerId)}
        </code>
        <button 
          onClick={copyToClipboard}
          className={`${copied ? 'bg-green-500' : 'bg-indigo-600'} text-white text-xs px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 flex items-center`}
        >
          {copied ? (
            <>
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Copy ID
            </>
          )}
        </button>
        <span className="text-xs text-gray-300">Share this ID with friends to let them join your race!</span>
      </div>
    </div>
  );
};

export default PlayerIdDisplay; 