// components/EnterName.jsx
import { useState } from 'react';

const EnterName = ({ onStart }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onStart(name.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg p-8 rounded-xl shadow-2xl border border-white border-opacity-20">
          <h2 className="text-2xl font-bold mb-6 text-center text-white">Enter Your Name</h2>
          <div className="relative mb-6">
            <input
              type="text"
              className="w-full bg-transparent border-b-2 border-blue-300 p-3 text-white placeholder-blue-200 focus:outline-none focus:border-yellow-400 transition duration-300"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold py-3 px-6 rounded-lg hover:from-yellow-500 hover:to-orange-600 transform hover:scale-105 transition duration-300 shadow-lg"
          >
            Start Racing!
          </button>
        </form>
        <div className="mt-8 text-center text-white text-opacity-80">
          <p className="text-sm">Use arrow keys to move and jump</p>
          <p className="text-sm mt-1">Share your ID with friends to race together!</p>
        </div>
      </div>
    </div>
  );
};

export default EnterName;
