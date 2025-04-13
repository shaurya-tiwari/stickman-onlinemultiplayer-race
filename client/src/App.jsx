// App.jsx
import { useState } from 'react';
import CanvasGame from './components/CanvasGame';
import EnterName from './components/EnterName';

function App() {
  const [playerName, setPlayerName] = useState(null);

  return (
    <div className="min-h-screen bg-gray-100">
      <h1 className="text-center text-2xl font-bold p-4">Stickman Racing</h1>
      {!playerName ? (
        <EnterName onStart={(name) => setPlayerName(name)} />
      ) : (
        <CanvasGame playerName={playerName} />
      )}
    </div>
  );
}

export default App;
