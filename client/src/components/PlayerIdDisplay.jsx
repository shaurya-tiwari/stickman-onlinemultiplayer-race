import { useState } from 'react';

const PlayerIdDisplay = ({ playerId }) => {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(playerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-gray-800 text-white py-2 px-4 flex items-center justify-center z-10">
      <div className="flex items-center space-x-2">
        <span className="text-sm">Your Player ID:</span>
        <code className="bg-gray-700 px-2 py-1 rounded font-mono text-yellow-300">{playerId}</code>
        <button 
          onClick={copyToClipboard}
          className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600"
        >
          {copied ? 'Copied!' : 'Copy ID'}
        </button>
        <span className="text-xs ml-2">Share this ID with friends to let them join your race!</span>
      </div>
    </div>
  );
};

export default PlayerIdDisplay; 