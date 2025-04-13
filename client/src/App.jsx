// App.jsx
import { useState } from 'react';
import CanvasGame from './components/CanvasGame';
import EnterName from './components/EnterName';

function App() {
  const [playerName, setPlayerName] = useState(null);
  const [isHost, setIsHost] = useState(false);

  const handleStartGame = (name, asHost) => {
    setPlayerName(name);
    setIsHost(asHost);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-center text-5xl font-bold p-4 mb-8 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-pink-600 drop-shadow-xl">
          Stickman Racing
        </h1>
        {!playerName ? (
          <EnterName onStart={handleStartGame} />
        ) : (
          <CanvasGame playerName={playerName} isHost={isHost} />
        )}
      </div>
    </div>
  );
}

export default App;
