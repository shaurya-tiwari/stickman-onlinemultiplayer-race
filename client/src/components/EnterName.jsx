// components/EnterName.jsx
import { useState } from 'react';

const EnterName = ({ onStart }) => {
  const [name, setName] = useState('');
  const [asHost, setAsHost] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onStart(name.trim(), asHost);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-black bg-opacity-30 backdrop-filter backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-purple-500 border-opacity-20">
          <h2 className="text-2xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-pink-500">Enter Your Name</h2>
          <div className="relative mb-8">
            <input
              type="text"
              className="w-full bg-transparent border-b-2 border-purple-400 p-3 text-white placeholder-purple-300 focus:outline-none focus:border-amber-400 transition duration-300"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          {/* Host option */}
          <div className="flex items-center mb-8">
            <input
              id="host-checkbox"
              type="checkbox"
              checked={asHost}
              onChange={() => setAsHost(!asHost)}
              className="w-5 h-5 text-amber-500 bg-transparent border-2 border-amber-400 rounded focus:ring-amber-400"
            />
            <label htmlFor="host-checkbox" className="ml-3 text-md text-purple-200">
              Enter as Game Host
            </label>
          </div>
          
          <button
            type="submit"
            className={`w-full ${asHost 
              ? "bg-gradient-to-r from-amber-400 to-orange-500 text-gray-900" 
              : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"} font-bold py-3 px-6 rounded-xl hover:opacity-90 transform hover:scale-105 transition duration-300 shadow-xl`}
          >
            {asHost ? 'Start Racing as Host!' : 'Start Racing!'}
          </button>
        </form>
        <div className="mt-8 text-center text-purple-200 text-opacity-80">
          <p className="text-sm">Use arrow keys to move and jump</p>
          <p className="text-sm mt-1">Share your ID with friends to race together!</p>
          {asHost && <p className="text-sm mt-3 text-amber-300">As host, you can set the race distance!</p>}
        </div>
      </div>
    </div>
  );
};

export default EnterName;
