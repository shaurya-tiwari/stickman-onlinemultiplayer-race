import { useEffect, useRef, useState } from 'react';
import PlayerIdDisplay from './PlayerIdDisplay';
import AddPlayerById from './AddPlayerById';
import socket, { isPlayerVisible, visiblePlayers } from '../socket';

// Tree Images
import tree from '../assets/tree.png';
import tree2 from '../assets/tree2.png';
import tree3 from '../assets/tree3.png';
import tree4 from '../assets/tree4.png';
import tree5 from '../assets/tree5.png';
import tree6 from '../assets/tree6.png';
import tree7 from '../assets/tree7.png';

// Obstacle Images
import rock from '../assets/rock.png';
import barrel from '../assets/barrel.png';
import spike from '../assets/spike.png';

const treeMap = {
  'tree.png': tree,
  'tree2.png': tree2,
  'tree3.png': tree3,
  'tree4.png': tree4,
  'tree5.png': tree5,
  'tree6.png': tree6,
  'tree7.png': tree7,
};

const obstacleMap = {
  'rock.png': rock,
  'barrel.png': barrel,
  'spike.png': spike,
};

const CanvasGame = ({ playerName }) => {
  const canvasRef = useRef(null);
  const [players, setPlayers] = useState({});
  const [myId, setMyId] = useState(null);
  const [trees, setTrees] = useState([]);
  const [obstacles, setObstacles] = useState([]);
  const pressedKeys = useRef({});
  const velocityY = useRef(0);
  const gravity = 1;
  const groundY = 0;
  const fixedPlayerX = 400;

  useEffect(() => {
    if (playerName) {
      socket.emit('set-name', playerName);
    }

    socket.on('init', ({ id, players, trees: serverTrees, obstacles: serverObstacles }) => {
      setMyId(id);
      setPlayers(players);

      // Load trees
      if (serverTrees?.length) {
        let loaded = 0;
        const temp = [];
        serverTrees.forEach(tree => {
          const img = new Image();
          img.src = treeMap[tree.image];
          img.onload = () => {
            loaded++;
            temp.push({ x: tree.x, image: img });
            if (loaded === serverTrees.length) setTrees(temp);
          };
        });
      }

      // Load obstacles
      if (serverObstacles?.length) {
        let loaded = 0;
        const temp = [];
        serverObstacles.forEach(ob => {
          const img = new Image();
          img.src = obstacleMap[ob.image];
          img.onload = () => {
            loaded++;
            temp.push({ x: ob.x, image: img });
            if (loaded === serverObstacles.length) setObstacles(temp);
          };
        });
      }
    });

    socket.on('new-player', ({ id, name }) => {
      setPlayers(prev => ({
        ...prev,
        [id]: { x: 0, y: groundY, name, isJumping: false }
      }));
    });

    socket.on('player-moved', ({ id, x, y }) => {
      setPlayers(prev => {
        const existing = prev[id] || {};
        return { ...prev, [id]: { ...existing, x, y } };
      });
    });

    socket.on('player-disconnected', ({ id }) => {
      setPlayers(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    });

    const handleKeyDown = e => { pressedKeys.current[e.key] = true; };
    const handleKeyUp = e => { pressedKeys.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const interval = setInterval(() => {
      setPlayers(prev => {
        const me = prev[myId];
        if (!me) return prev;
        let updated = { ...me };

        if (pressedKeys.current['ArrowRight']) updated.x += 5;
        if (pressedKeys.current['ArrowUp'] && !updated.isJumping) {
          velocityY.current = -15;
          updated.isJumping = true;
        }

        if (updated.isJumping) {
          velocityY.current += gravity;
          updated.y -= velocityY.current;
          if (updated.y <= groundY) {
            updated.y = groundY;
            updated.isJumping = false;
            velocityY.current = 0;
          }
        }

        if (updated.x !== me.x || updated.y !== me.y) {
          socket.emit('update-position', updated);
          return { ...prev, [myId]: updated };
        }

        return prev;
      });
    }, 30);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [myId, playerName]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');

    const draw = () => {
      ctx.clearRect(0, 0, 800, 600);
      const me = players[myId];
      const cameraOffset = me ? me.x - fixedPlayerX : 0;
      const roadY = 400;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, roadY, 800, 3);

      trees.forEach(({ x, image }) => {
        const drawX = x - cameraOffset;
        ctx.drawImage(image, drawX + 40, roadY - 200, 160, 200);
      });

      obstacles.forEach(({ x, image }) => {
        const drawX = x - cameraOffset;
        ctx.drawImage(image, drawX, roadY - 40, 40, 40);
      });

      if (me && !me.isJumping) {
        obstacles.forEach(ob => {
          const obsStart = ob.x;
          const obsEnd = ob.x + 40;
          if (me.x + 20 > obsStart && me.x < obsEnd) {
            const newX = me.x - 20;
            setPlayers(prev => ({ ...prev, [myId]: { ...me, x: newX } }));
            socket.emit('update-position', { ...me, x: newX });
          }
        });
      }

      Object.entries(players).forEach(([id, player]) => {
        if (visiblePlayers.has(id)) {
          const drawX = id === myId ? fixedPlayerX : player.x - cameraOffset;
          ctx.fillStyle = id === myId ? 'blue' : 'red';
          ctx.fillRect(drawX, roadY - 40 - player.y, 20, 40);
          ctx.fillStyle = 'black';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(player.name || 'Player', drawX + 10, roadY - 45 - player.y);
        }
      });
    };

    const interval = setInterval(draw, 1000 / 60);
    return () => clearInterval(interval);
  }, [players, trees, obstacles, myId]);

  return (
    <div className="relative">
      {myId && <PlayerIdDisplay playerId={myId} />}
      <div className="flex justify-center mt-12">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="border-2 border-black bg-white"
          style={{ boxShadow: 'inset 0 0 20px 10px rgba(0, 0, 0, 0.5)' }}
        />
      </div>
      {myId && <AddPlayerById myId={myId} />}
    </div>
  );
};

export default CanvasGame;
