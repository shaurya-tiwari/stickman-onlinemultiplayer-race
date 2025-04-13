import { useEffect, useRef, useState } from 'react';
import PlayerIdDisplay from './PlayerIdDisplay';
import AddPlayerById from './AddPlayerById';
import GameSettings from './GameSettings';
import socket, { isPlayerVisible, visiblePlayers, safeEmit } from '../socket';

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

const CanvasGame = ({ playerName, isHost }) => {
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
  const [showRestartNotification, setShowRestartNotification] = useState(false);
  // Race finish line
  const [raceDistance, setRaceDistance] = useState(1000);
  const [raceWinner, setRaceWinner] = useState(null);
  const [showWinnerNotification, setShowWinnerNotification] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);

  // Function to restart the race
  const restartRace = () => {
    // Only the host can restart the race
    if (myId) {
      const me = players[myId];
      if (me) {
        // Reset my position
        const updatedMe = { ...me, x: 0, y: groundY, isJumping: false };
        setPlayers(prev => ({ ...prev, [myId]: updatedMe }));
        socket.emit('update-position', updatedMe);
      }
      
      // Reset race status
      setRaceWinner(null);
      setHasFinished(false);
      setShowWinnerNotification(false);
      
      // Emit restart race event to reset all players
      socket.emit('restart-race');
      
      // Show restart notification
      setShowRestartNotification(true);
      setTimeout(() => setShowRestartNotification(false), 3000);
    }
  };

  // Format a player ID for display (XXX-XXX-XXXX)
  const formatDisplayId = (id) => {
    if (!id) return '';
    const idStr = id.toString();
    if (idStr.length === 10) {
      return `${idStr.substring(0, 3)}-${idStr.substring(3, 6)}-${idStr.substring(6, 10)}`;
    }
    return id;
  };

  useEffect(() => {
    if (playerName) {
      socket.emit('set-name', playerName);
    }

    // If user selected to enter as host, automatically request to become host
    // when we receive our ID from the server
    const autoRequestHostStatus = (id) => {
      if (isHost && id) {
        console.log("Auto-requesting host status as user selected 'Enter as Host'");
        safeEmit('become-host', {}, (response) => {
          console.log("Host status response:", response);
          
          // Ensure host player is added to the players state if not already there
          if (response.success) {
            setPlayers(prev => {
              // If the host player isn't in the state yet, add them
              if (!prev[id]) {
                console.log(`Adding host player ${id} to state`);
                return {
                  ...prev,
                  [id]: { x: 0, y: 0, name: playerName, isJumping: false }
                };
              }
              return prev;
            });
          }
        });
      }
    };

    // Listen for race distance updates
    socket.on('game-settings-updated', ({ raceDistance: newDistance }) => {
      console.log(`Race distance updated to ${newDistance}m`);
      setRaceDistance(newDistance);
      // Reset race status when distance changes
      setRaceWinner(null);
      setHasFinished(false);
      setShowWinnerNotification(false);
    });

    // Listen for winner announcements
    socket.on('race-winner', ({ playerId, playerName }) => {
      console.log(`Race winner: ${playerName} (${playerId})`);
      setRaceWinner({ id: playerId, name: playerName });
      setShowWinnerNotification(true);
      setTimeout(() => setShowWinnerNotification(false), 5000);
    });

    // Listen for restart race event
    socket.on('restart-race', () => {
      // Reset all players positions
      setPlayers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(playerId => {
          if (playerId !== myId) { // Exclude myself as I've already updated my position
            updated[playerId] = {
              ...updated[playerId],
              x: 0,
              y: groundY,
              isJumping: false
            };
          }
        });
        return updated;
      });
      
      // Reset race status
      setRaceWinner(null);
      setHasFinished(false);
      setShowWinnerNotification(false);
      
      // Show restart notification for players who received the event
      setShowRestartNotification(true);
      setTimeout(() => setShowRestartNotification(false), 3000);
    });

    socket.on('init', ({ id, players, trees: serverTrees, obstacles: serverObstacles }) => {
      console.log(`Init received with ID: ${id}, players:`, players);
      setMyId(id);
      
      // IMPORTANT: Merge instead of replacing players to avoid losing existing players
      setPlayers(prev => {
        const merged = { ...prev, ...players };
        // Make sure we always have our own player in the state
        if (id && !merged[id] && playerName) {
          merged[id] = { x: 0, y: 0, name: playerName, isJumping: false };
        }
        return merged;
      });

      // Request host status if user selected to enter as host
      autoRequestHostStatus(id);

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

    socket.on('player-joined', (data) => {
      console.log(`CanvasGame: Player joined event received:`, data);
      console.log(`Current visiblePlayers:`, Array.from(visiblePlayers));
    });

    socket.on('new-player', ({ id, name, x, y }) => {
      console.log(`New player joined: ${id}, Name: ${name}, Current players:`, players);
      setPlayers(prev => {
        // Add the new player data to the players state
        const updated = {
          ...prev,
          [id]: { 
            x: x || 0, 
            y: y || groundY, 
            name: name || `Player-${id.substring(0, 5)}`, 
            isJumping: false 
          }
        };
        
        // Special case: if this is our own ID and we were missing from state
        if (id === myId && !prev[myId]) {
          console.log(`This is my ID (${id}) and I was missing from state, adding myself back`);
        }
        
        return updated;
      });
    });

    socket.on('player-moved', ({ id, x, y, name }) => {
      setPlayers(prev => {
        const existing = prev[id] || {};
        // Keep the player's name when updating position or use the name from the server
        const playerName = name || existing.name || `Player-${id.substring(0, 5)}`;
        return { ...prev, [id]: { ...existing, x, y, name: playerName } };
      });
    });

    socket.on('player-disconnected', ({ id }) => {
      console.log(`Player disconnected: ${id}`);
      setPlayers(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    });

    // Handle request acceptance
    socket.on('accept-join-request', ({ playerId }) => {
      console.log(`Accept join request received for player: ${playerId}`);
      // No need to check if players exist since the server already checked
      
      // Add the joining player with the correct name
      if (players[playerId]) {
        const playerName = players[playerId].name;
        setPlayers(prev => ({
          ...prev,
          [playerId]: { ...prev[playerId], name: playerName }
        }));
      }
    });

    socket.on('request-accepted', () => {
      console.log('My join request was accepted!');
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

        // Don't allow movement if the player has finished the race
        if (!hasFinished) {
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

          // Check if player has crossed the finish line
          if (updated.x >= raceDistance && !hasFinished) {
            setHasFinished(true);
            // Notify the server that this player has finished
            socket.emit('player-finished', { playerName: updated.name || 'Unknown Player' });
          }
        } else {
          // Player has finished - no more movement
          isCurrentlyMoving = false;
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

    // Add special debug button to console log all players 
    window.debugPlayers = () => {
      console.log("All players in state:", players);
      console.log("My ID:", myId);
      console.log("Visible players:", Array.from(visiblePlayers));
      return {
        players,
        myId,
        visiblePlayers: Array.from(visiblePlayers)
      };
    };

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      socket.off('init');
      socket.off('new-player');
      socket.off('player-moved');
      socket.off('player-disconnected');
      socket.off('restart-race');
      socket.off('accept-join-request');
      socket.off('player-joined');
      socket.off('request-accepted');
      socket.off('request-rejected');
      socket.off('game-settings-updated');
      socket.off('race-winner');
    };
  }, [myId, playerName, raceDistance, hasFinished, isHost]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');

    const draw = () => {
      ctx.clearRect(0, 0, 800, 600);
      const me = players[myId];
      const cameraOffset = me ? me.x - fixedPlayerX : 0;
      const roadY = 400;

      // Draw a gradient sky background
      const skyGradient = ctx.createLinearGradient(0, 0, 0, roadY);
      skyGradient.addColorStop(0, '#87CEEB'); // Sky blue at top
      skyGradient.addColorStop(0.7, '#B0E2FF'); // Lighter blue toward horizon
      skyGradient.addColorStop(1, '#E6F0FF'); // Almost white at horizon
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, 800, roadY);

      // Draw some distant clouds for depth
      const drawCloud = (x, y, size) => {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.arc(x + size * 0.5, y - size * 0.2, size * 0.7, 0, Math.PI * 2);
        ctx.arc(x + size, y, size * 0.8, 0, Math.PI * 2);
        ctx.arc(x + size * 1.5, y, size * 0.7, 0, Math.PI * 2);
        ctx.arc(x + size * 0.8, y + size * 0.3, size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      // Draw a few clouds with parallax effect (move slower than foreground)
      const parallaxFactor = 0.2;
      drawCloud(100 - cameraOffset * parallaxFactor, 100, 30);
      drawCloud(350 - cameraOffset * parallaxFactor, 150, 25);
      drawCloud(600 - cameraOffset * parallaxFactor, 80, 35);
      drawCloud(750 - cameraOffset * parallaxFactor, 180, 20);

      // Draw game boundaries - visible border to show play area
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, 800, 600);

      // Draw a nicer ground/road with gradient
      const roadGradient = ctx.createLinearGradient(0, roadY - 15, 0, roadY + 15);
      roadGradient.addColorStop(0, '#888888');
      roadGradient.addColorStop(0.5, '#555555');
      roadGradient.addColorStop(1, '#333333');
      ctx.fillStyle = roadGradient;
      ctx.fillRect(0, roadY, 800, 15);

      // Draw grass below the road
      ctx.fillStyle = '#4d8c57';
      ctx.fillRect(0, roadY + 15, 800, 600 - roadY - 15);

      // Draw trees with improved sizing and shadows
      trees.forEach(({ x, image }) => {
        const drawX = x - cameraOffset;
        // Only draw trees that are visible on screen (plus a small buffer)
        if (drawX > -200 && drawX < 1000) {
          // Tree shadow
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.beginPath();
          ctx.ellipse(drawX + 120, roadY + 10, 60, 15, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          
          // Tree image - larger and with better positioning
          ctx.drawImage(image, drawX + 40, roadY - 280, 200, 280);
        }
      });

      // Draw obstacles with improved sizing, shadows and effects
      obstacles.forEach(({ x, image }) => {
        const drawX = x - cameraOffset;
        // Only draw obstacles that are visible on screen (plus a small buffer)
        if (drawX > -60 && drawX < 860) {
          // Obstacle shadow
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.ellipse(drawX + 30, roadY + 8, 25, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          
          // Obstacle image - larger and with better positioning
          ctx.drawImage(image, drawX, roadY - 60, 60, 60);
        }
      });

      if (me && !me.isJumping) {
        obstacles.forEach(ob => {
          const obsStart = ob.x;
          // Update the collision detection to match the new obstacle size
          const obsEnd = ob.x + 60; // Updated from 40 to 60
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

      // Draw the finish line
      const finishLineX = raceDistance - cameraOffset;
      // Only draw if in view
      if (finishLineX >= -10 && finishLineX <= 810) {
        // Checkered pattern for finish line
        ctx.save();
        
        // Draw the finish line pole
        ctx.fillStyle = '#222222';
        ctx.fillRect(finishLineX - 5, roadY - 150, 10, 150);
        
        // Draw the finish banner
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(finishLineX - 5, roadY - 150, 200, 40);
        
        // Draw the FINISH text
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('FINISH', finishLineX + 10, roadY - 120);
        
        // Draw checkered pattern on the road
        const squareSize = 15;
        const checkerWidth = 60;
        for (let i = 0; i < checkerWidth / squareSize; i++) {
          for (let j = 0; j < 6; j++) {
            if ((i + j) % 2 === 0) {
              ctx.fillStyle = '#FFFFFF';
            } else {
              ctx.fillStyle = '#000000';
            }
            ctx.fillRect(
              finishLineX + (i * squareSize) - checkerWidth / 2, 
              roadY - 3 + (j * squareSize), 
              squareSize, 
              squareSize
            );
          }
        }
        
        ctx.restore();
      }

      // We no longer draw players on the canvas because we're using absolute positioned divs
    };

    const interval = setInterval(draw, 1000 / 60);
    return () => clearInterval(interval);
  }, [players, trees, obstacles, myId, raceDistance]);

  // Inject the animation styles when component mounts
  useEffect(() => {
    // Animation now handled directly by img tag switching
  }, []);

  return (
    <div className="relative">
      {myId && <PlayerIdDisplay playerId={myId} />}
      <div className="flex justify-center mt-12">
        <div className="relative">
          {/* Game Title Banner */}
          <div className="absolute -top-12 left-0 right-0 flex justify-center">
            <div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white px-6 py-2 rounded-t-xl shadow-lg border-t-2 border-l-2 border-r-2 border-indigo-500 transform -skew-x-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 font-extrabold text-xl tracking-wider">STICK MAN RACING</span>
            </div>
          </div>

          {/* Game frame with animated border */}
          <div className="p-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-xl animate-gradient-x">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="rounded-lg bg-white"
              style={{ 
                boxShadow: 'inset 0 0 20px 10px rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                overflow: 'hidden' 
              }}
            />
          </div>

          {/* Score/Distance Display */}
          <div className="absolute top-4 right-4 bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm rounded-lg py-2 px-4 text-white border border-indigo-500">
            <div className="text-sm font-bold text-yellow-300">Distance</div>
            <div className="font-mono text-2xl text-white" id="score">
              {players[myId] ? Math.floor(players[myId].x / 10) : 0} m
            </div>
          </div>

          {/* Restart Race Button */}
          <div className="absolute top-20 right-4">
            <button 
              onClick={restartRace}
              className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-lg shadow-lg hover:from-red-600 hover:to-orange-600 transform hover:scale-105 transition duration-300 flex items-center glow-pulse"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Restart Race
            </button>
          </div>
          
          {/* Refresh Players button */}
          <div className="absolute top-36 right-4">
            <button 
              onClick={() => {
                // Force re-render of myself if I'm missing from players
                if (myId && !players[myId] && playerName) {
                  const newPlayer = { x: 0, y: 0, name: playerName, isJumping: false };
                  console.log("Force adding myself back to players:", newPlayer);
                  setPlayers(prev => ({...prev, [myId]: newPlayer}));
                  
                  // Re-emit my position to ensure others can see me
                  socket.emit('update-position', newPlayer);
                }
                
                // If I'm a host, request host status info again
                if (isHost && myId) {
                  console.log("Re-requesting host status...");
                  safeEmit('become-host', {}, (response) => {
                    console.log("Host status re-request response:", response);
                  });
                }
              }}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 transition duration-300 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Players
            </button>
          </div>

          {/* Game controls overlay */}
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm rounded-lg p-3 text-white text-xs border border-indigo-600">
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <span className="font-bold text-indigo-300">CONTROLS:</span>
            </div>
            <div className="ml-6 space-y-1">
              <div className="flex items-center space-x-2">
                <div className="bg-gray-700 px-2 py-1 rounded text-yellow-300 font-semibold">→</div>
                <span>Run forward</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="bg-gray-700 px-2 py-1 rounded text-yellow-300 font-semibold">↑</div>
                <span>Jump</span>
              </div>
            </div>
          </div>

          {/* Player info panel */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm rounded-lg p-3 text-white text-xs border border-indigo-600">
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-bold text-indigo-300">PLAYER:</span>
              <span className="text-white">{players[myId]?.name || 'Player'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-bold text-indigo-300">PLAYERS:</span>
              <span className="text-white">{Object.keys(players).length}</span>
            </div>
          </div>

          {/* Race winner notification */}
          {showWinnerNotification && raceWinner && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-80 text-white px-8 py-6 rounded-lg z-50 shadow-lg border-2 border-yellow-500">
              <div className="flex items-center justify-center space-x-2 text-3xl font-bold mb-4">
                <svg className="w-10 h-10 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400">WINNER!</span>
              </div>
              <div className="text-center text-xl font-bold mb-2">{raceWinner.name}</div>
              <p className="text-center text-yellow-200 text-sm">First to reach the finish line!</p>
            </div>
          )}

          {/* Race restart notification */}
          {showRestartNotification && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-80 text-white px-6 py-4 rounded-lg z-50 animate-bounce shadow-lg border-2 border-yellow-500">
              <div className="flex items-center justify-center space-x-2 text-2xl font-bold">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Race Restarted!</span>
              </div>
              <p className="text-center mt-2 text-yellow-200">All players moved to starting line</p>
            </div>
          )}

          {/* Overlay the stickman gifs on top of the canvas */}
          {Object.entries(players).map(([id, player]) => {
            // Always render all players regardless of visiblePlayers status
            const playerVisible = visiblePlayers.has(id);
            console.log(`Rendering player ${id}, name: ${player.name}, visible: ${playerVisible}, isMyId: ${id === myId}`);
            
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
                onClick={() => console.log(`Clicked on player: ${id}, name: ${player.name}`)}
              >
                {/* Player name tag with better styling */}
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-black bg-opacity-70 rounded-md text-xs text-white border border-indigo-400 pulse-border">
                  {id === myId ? `${player.name || formatDisplayId(id)} (YOU)` : (player.name || formatDisplayId(id))}
                </div>
                
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
              </div>
            );
          })}

          {/* DEBUG: Always visible own player if not in players list */}
          {myId && !players[myId] && (
            <div 
              className="absolute bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg"
              onClick={() => {
                console.log("Missing player! Current state:", { 
                  myId, 
                  players: Object.keys(players),
                  visiblePlayers: Array.from(visiblePlayers)
                });
              }}
            >
              Player Missing! Click to debug
            </div>
          )}
        </div>
      </div>
      {myId && <AddPlayerById myId={myId} />}
      {myId && <GameSettings myId={myId} />}
    </div>
  );
};

export default CanvasGame;

