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
    <div className="flex flex-col items-center justify-center h-screen">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md">
        <h2 className="text-xl font-bold mb-4">Enter Your Name</h2>
        <input
          type="text"
          className="border p-2 w-64 mb-4"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Start Game
        </button>
      </form>
    </div>
  );
};

export default EnterName;
