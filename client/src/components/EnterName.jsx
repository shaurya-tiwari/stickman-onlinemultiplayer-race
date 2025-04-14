// components/EnterName.jsx
import { useState } from 'react';

const EnterName = ({ onStart }) => {
  const [name, setName] = useState('');
  const [gameMode, setGameMode] = useState('solo'); // 'solo', 'host', or 'join'
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onStart(name.trim(), gameMode === 'host');
    }
  };

  const renderModeSelection = () => {
    return (
      <div className="space-y-6 w-full max-w-md">
        <h2 className="text-3xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-pink-500">Choose Game Mode</h2>
        
        <button
          onClick={() => {
            setGameMode('solo');
            setShowForm(true);
          }}
          className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-bold py-5 px-6 rounded-xl hover:opacity-90 transform hover:scale-105 transition duration-300 shadow-xl flex items-center justify-center"
        >
          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Single Player Race
        </button>
        
        <button
          onClick={() => {
            setGameMode('host');
            setShowForm(true);
          }}
          className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900 font-bold py-5 px-6 rounded-xl hover:opacity-90 transform hover:scale-105 transition duration-300 shadow-xl flex items-center justify-center"
        >
          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Host a Multiplayer Race
        </button>
        
        <button
          onClick={() => {
            setGameMode('join');
            setShowForm(true);
          }}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold py-5 px-6 rounded-xl hover:opacity-90 transform hover:scale-105 transition duration-300 shadow-xl flex items-center justify-center"
        >
          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Join an Existing Race
        </button>
      </div>
    );
  };

  const renderNameForm = () => {
    return (
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-black bg-opacity-30 backdrop-filter backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-purple-500 border-opacity-20">
          <div className="flex items-center mb-6">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-purple-300 hover:text-purple-100 mr-4"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-pink-500">
              {gameMode === 'solo' ? 'Single Player Race' : 
               gameMode === 'host' ? 'Host a Multiplayer Race' : 'Join an Existing Race'}
            </h2>
          </div>
          
          <div className="relative mb-8">
            <input
              type="text"
              className="w-full bg-transparent border-b-2 border-purple-400 p-3 text-white placeholder-purple-300 focus:outline-none focus:border-amber-400 transition duration-300"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            className={`w-full ${gameMode === 'host' 
              ? "bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900" 
              : gameMode === 'join'
              ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white"
              : "bg-gradient-to-r from-indigo-500 to-blue-600 text-white"} 
              font-bold py-3 px-6 rounded-xl hover:opacity-90 transform hover:scale-105 transition duration-300 shadow-xl`}
          >
            {gameMode === 'host' ? 'Start as Host!' : 
             gameMode === 'join' ? 'Join Race!' : 'Start Racing!'}
          </button>
        </form>
        <div className="mt-8 text-center text-purple-200 text-opacity-80">
          <p className="text-sm">Use arrow keys to move and jump</p>
          {gameMode === 'host' && <p className="text-sm mt-3 text-amber-300">As host, you can set the race distance and manage players!</p>}
          {gameMode === 'join' && <p className="text-sm mt-3 text-purple-300">You can find other players using their ID</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center">
      {showForm ? renderNameForm() : renderModeSelection()}
    </div>
  );
};

export default EnterName;
