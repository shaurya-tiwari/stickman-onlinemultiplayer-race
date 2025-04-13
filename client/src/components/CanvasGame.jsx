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
import tree9 from '../assets/tree9.png';
import tree10 from '../assets/tree10.png';
import tree11 from '../assets/tree11.png';
import tree12 from '../assets/tree12.png';
import tree13 from '../assets/tree13.png';
import tree14 from '../assets/tree14.png';
import tree15 from '../assets/tree15.png';
import tree16 from '../assets/tree16.png';
import tree17 from '../assets/tree17.png';

// Obstacle Images
import rock from '../assets/rock.png';
import barrel from '../assets/barrel.png';
import spike from '../assets/spike.png';

// Player Image
import stickmanStill from '../assets/stickmanStill.png'; // still frame
import stickmanGif from '../assets/stickman.gif'; // animated gif for movement

const treeMap = {
  'tree.png': tree,
  'tree2.png': tree2,
  'tree3.png': tree3,
  'tree4.png': tree4,
  'tree5.png': tree5,
  'tree6.png': tree6,
  'tree7.png': tree7,
  'tree9.png': tree9,
  'tree10.png': tree10,
  'tree11.png': tree11,
  'tree12.png': tree12,
  'tree13.png': tree13,
  'tree14.png': tree14,
  'tree15.png': tree15,
  'tree16.png': tree16,
  'tree17.png': tree17,
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
  const [isMoving, setIsMoving] = useState(false);
  const lastPosRef = useRef(0);
  // Define game boundaries
  const maxX = 10000; // Maximum X position (adjust as needed for your game world)
  const maxY = 200;  // Maximum Y position for jumps

  useEffect(() => {
    if (playerName) {
      socket.emit('set-name', playerName);
    }

    socket.on('init', ({ id, players, trees: serverTrees, obstacles: serverObstacles }) => {
      setMyId(id);
      setPlayers(players);

      if (players[id]) {
        lastPosRef.current = players[id].x;
      }

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
        // Remove player movement tracking for animation
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

    const handleKeyDown = e => {
      pressedKeys.current[e.key] = true;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        setIsMoving(true);
      }
    };

    const handleKeyUp = e => {
      pressedKeys.current[e.key] = false;

      // If no key is pressed, stop the animation immediately
      if (!pressedKeys.current['ArrowRight'] && !pressedKeys.current['ArrowUp']) {
        setIsMoving(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const interval = setInterval(() => {
      setPlayers(prev => {
        const me = prev[myId];
        if (!me) return prev;
        let updated = { ...me };
        let isCurrentlyMoving = false;

        if (pressedKeys.current['ArrowRight']) {
          // Add boundary check for right movement
          const newX = Math.min(updated.x + 5, maxX);
          updated.x = newX;
          isCurrentlyMoving = true;
        }

        if (pressedKeys.current['ArrowUp'] && !updated.isJumping) {
          velocityY.current = -15;
          updated.isJumping = true;
          isCurrentlyMoving = true;
        }

        if (updated.isJumping) {
          velocityY.current += gravity;
          // Apply velocity with boundary check for Y position
          updated.y = Math.min(Math.max(updated.y - velocityY.current, groundY), maxY);
          isCurrentlyMoving = true;

          if (updated.y <= groundY) {
            updated.y = groundY;
            updated.isJumping = false;
            velocityY.current = 0;

            // Only consider moving if still pressing right arrow
            isCurrentlyMoving = pressedKeys.current['ArrowRight'];
          }
        }

        // Update the movement state if needed
        if (isCurrentlyMoving !== isMoving) {
          setIsMoving(isCurrentlyMoving);
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

      // Draw a plain white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 600);

      // Draw game boundaries - visible border to show play area
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, 800, 600);

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
          const playerLeft = me.x;
          const playerRight = me.x + 30;
          
          // Check for collision with obstacle
          if (playerRight > obsStart && playerLeft < obsEnd) {
            // Move player back to avoid penetrating the obstacle
            const newX = obsStart - 30;
            setPlayers(prev => ({ ...prev, [myId]: { ...me, x: newX } }));
            socket.emit('update-position', { ...me, x: newX });
          }
        });
      }

      // Ensure player stays within horizontal game boundaries (for network updates)
      if (me) {
        const worldLeft = 0;
        const worldRight = maxX;
        
        if (me.x < worldLeft) {
          setPlayers(prev => ({ ...prev, [myId]: { ...me, x: worldLeft } }));
          socket.emit('update-position', { ...me, x: worldLeft });
        } else if (me.x > worldRight) {
          setPlayers(prev => ({ ...prev, [myId]: { ...me, x: worldRight } }));
          socket.emit('update-position', { ...me, x: worldRight });
        }
      }

      // We no longer draw players on the canvas because we're using absolute positioned divs
    };

    const interval = setInterval(draw, 1000 / 60);
    return () => clearInterval(interval);
  }, [players, trees, obstacles, myId]);

  // Inject the animation styles when component mounts
  useEffect(() => {
    // Animation now handled directly by img tag switching
  }, []);

  return (
    <div className="relative">
      {myId && <PlayerIdDisplay playerId={myId} />}
      <div className="flex justify-center mt-12">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="border-2 border-black bg-white"
            style={{ boxShadow: 'inset 0 0 20px 10px rgba(0, 0, 0, 0.5)' }}
          />

          {/* Overlay the stickman gifs on top of the canvas */}
          {Object.entries(players).map(([id, player]) => {
            if (visiblePlayers.has(id)) {
              const me = players[myId];
              const cameraOffset = me ? me.x - fixedPlayerX : 0;
              const drawX = id === myId ? fixedPlayerX : player.x - cameraOffset;
              const roadY = 400;

              // Only animate the local player, other players always use static image
              const playerMoving = id === myId ? isMoving : false;

              // Ensure player stays within canvas boundaries for display
              const constrainedX = Math.max(0, Math.min(drawX, 770)); // 800 - player width (30px)
              const constrainedY = Math.max(0, Math.min(roadY - 60 - player.y, 540)); // 600 - player height (60px)

              // Create a more reliable animation approach
              const getPlayerStyle = () => {
                const baseStyle = {
                  position: 'absolute',
                  left: `${constrainedX}px`,
                  top: `${constrainedY}px`,
                  width: '30px', // Increased from 20px to 30px
                  height: '60px', // Increased from 40px to 60px
                  zIndex: 10,
                  overflow: 'visible' // Ensure image isn't clipped
                };
                
                return baseStyle;
              };
              
              return (
                <div
                  key={id}
                  style={getPlayerStyle()}
                >
                  {/* Only render one image at a time */}
                  <img
                    key={`stickman-${id}-${playerMoving}`} // Force re-render when animation state changes
                    src={playerMoving ? stickmanGif : stickmanStill}
                    alt="stickman"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain', // Changed from 'cover' to 'contain'
                      objectPosition: 'center',
                      display: 'block'
                    }}
                  />
                  <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap">
                    {player.name || 'Player'}
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
      {myId && <AddPlayerById myId={myId} />}
    </div>
  );
};

export default CanvasGame;

