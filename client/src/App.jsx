// App.jsx
import { useState } from 'react';
import CanvasGame from './components/CanvasGame';
import EnterName from './components/EnterName';

function App() {
  const [playerName, setPlayerName] = useState(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-indigo-800 to-purple-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-center text-5xl font-bold p-4 mb-6 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-400 to-pink-500 drop-shadow-lg">
          Stickman Racing
        </h1>
        {!playerName ? (
          <EnterName onStart={(name) => setPlayerName(name)} />
        ) : (
          <CanvasGame playerName={playerName} />
        )}
      </div>
    </div>
  );
}

export default App;
