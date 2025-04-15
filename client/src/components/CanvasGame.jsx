import { useEffect, useRef, useState, useCallback } from 'react';
import PlayerIdDisplay from './PlayerIdDisplay';
import AddPlayerById from './AddPlayerById';
import GameSettings from './GameSettings';
import socket, {
  isPlayerVisible,
  visiblePlayers,
  safeEmit,
  updatePosition,
  lastKnownPosition,
  addGlobalEventListener,
  cleanupGlobalEventListeners
} from '../socket';

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

const CanvasGame = ({ playerName, isHost, onError }) => {
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
  // Flag to prevent immediate movement after restart
  const justRestarted = useRef(false);
  // Define game boundaries
  const maxX = 10000; // Maximum X position (adjust as needed for your game world)
  const maxY = 200;  // Maximum Y position for jumps
  const [showRestartNotification, setShowRestartNotification] = useState(false);
  // Race finish line
  const [raceDistance, setRaceDistance] = useState(5000);
  const [raceWinner, setRaceWinner] = useState(null);
  const [showWinnerNotification, setShowWinnerNotification] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectionAttempts = useRef(0);
  const [lastServerPosition, setLastServerPosition] = useState(null);
  const [collisionBounce, setCollisionBounce] = useState(false);
  const collisionTimer = useRef(null);
  const [raceStatus, setRaceStatus] = useState({
    isActive: false,
    distance: 5000
  });
  const [finishPosition, setFinishPosition] = useState(null);
  const [showPositionNotification, setShowPositionNotification] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState('');
  const errorMessageTimer = useRef(null);
  // Create a ref to track all timeouts for proper cleanup
  const timeoutsRef = useRef([]);

  // Add a new state to track if player is request accepter
  const [isRequestAccepter, setIsRequestAccepter] = useState(false);

  // Error handling for canvas rendering issues
  const [canvasError, setCanvasError] = useState(false);

  // Add a new state to track when user wants to exit
  const [exitGame, setExitGame] = useState(false);

  // Helper function to create and track timeouts - defined outside useEffect
  const createTrackedTimeout = useCallback((callback, delay) => {
    const id = setTimeout(callback, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // Initial validation of props
  useEffect(() => {
    try {
      // Validate playerName
      if (!playerName) {
        console.error('Missing player name');
        if (onError) onError(new Error('Missing player name'));
      }

      // Make sure we can render the canvas
      if (!canvasRef.current) {
        console.error('Canvas element not available');
        setCanvasError(true);
        if (onError) onError(new Error('Canvas initialization failed'));
      }

      // Check if the player is a request sender from localStorage
      const isRequestSender = localStorage.getItem('isRequestSender') === 'true';
      if (isRequestSender) {
        // If they are a request sender, they are not a request accepter
        setIsRequestAccepter(false);
        console.log('Player initialized as request sender');
      }
    } catch (error) {
      console.error('Error during component initialization:', error);
      setCanvasError(true);
      if (onError) onError(error);
    }
  }, [playerName, onError]);

  // Handle global errors and pass them up to the parent
  useEffect(() => {
    const handleGlobalError = (event) => {
      console.error('Error caught in CanvasGame:', event.error || event);
      if (onError) onError(event.error || new Error('Game error'));
    };

    window.addEventListener('error', handleGlobalError);

    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, [onError]);

  // Function to restart the race - modifying to only affect local player
  const restartRace = () => {
    // Skip if buttons are disabled for this player
    if (isRequestAccepter) {
      return;
    }

    // Only the host can restart the global race
    if (myId && isHost) {
      // Clear any finish states
      setRaceWinner(null);
      setHasFinished(false);
      setShowWinnerNotification(false);
      setFinishPosition(null);
      setShowPositionNotification(false);

      // Reset local velocity and position references
      velocityY.current = 0;
      lastPosRef.current = 0;




      // Force immediate update locally first
      setPlayers(prev => {
        const updated = { ...prev };
        if (updated[myId]) {
          updated[myId] = {
            ...updated[myId],
            x: 0,
            y: 0,
            isJumping: false
          };
        }
        return updated;
      });

      // Force immediate update to the server
      socket.emit('update-position', resetPosition);

      // Ensure we're at exactly position 0
      updatePosition(resetPosition);
    } else {
      // For non-host players, just reset their own view
      // Reset only the local player's position
      setPlayers(prev => {
        const updated = { ...prev };
        if (updated[myId]) {
          updated[myId] = {
            ...updated[myId],
            x: 0,
            y: 0,
            isJumping: false
          };
        }
        return updated;
      });

      // Reset velocity and position references
      velocityY.current = 0;
      lastPosRef.current = 0;

      // Reset race status only for this player
      setHasFinished(false);
      setShowWinnerNotification(false);
      setFinishPosition(null);
      setShowPositionNotification(false);

      // Explicitly send position update to server - use exact 0 positions
      const resetPosition = {
        x: 0,
        y: 0,
        isJumping: false
      };

      // Force immediate update to the server
      socket.emit('update-position', resetPosition);

      // Ensure we're at exactly position 0
      updatePosition(resetPosition);

      // Show notification only to this player
      setShowErrorMessage("Game restarted");
      setTimeout(() => setShowErrorMessage(""), 2000);
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

  // Add a validation function for finishing the race
  const validateRaceFinish = (x) => {
    // If already finished, no need to validate again
    if (hasFinished) return false;

    // Check if player has actually reached the finish line
    if (x >= raceDistance) {
      // Prevent cheating by large position jumps
      const lastPosValue = lastPosRef.current || 0;
      const maxJump = 20; // Maximum allowed jump in position between updates

      // If the jump is too large, it might be cheating
      if (x - lastPosValue > maxJump) {
        console.warn(`Suspicious finish: Jumped from ${lastPosValue} to ${x}`);
        // Don't count this as a finish, reset to last valid position
        return false;
      }

      setHasFinished(true);
      // Notify the server that this player has finished with validated position
      socket.emit('player-finished', {
        playerName: players[myId]?.name || 'Unknown Player',
        position: x
      });

      return true;
    }

    return false;
  };

  // Auto-request host status when we receive our ID
  const autoRequestHostStatus = useCallback((id) => {
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
  }, [isHost, playerName]);

  useEffect(() => {
    if (playerName) {
      socket.emit('set-name', playerName);
    }

    // If user selected to enter as host, automatically request to become host
    // when we receive our ID from the server
    autoRequestHostStatus(myId);

    // Define all event handlers first to allow proper cleanup
    const handleGameSettingsUpdated = ({ raceDistance: newDistance }) => {
      console.log(`Race distance updated to ${newDistance}m`);
      setRaceDistance(newDistance);
      // Reset race status when distance changes
      setRaceWinner(null);
      setHasFinished(false);
      setShowWinnerNotification(false);
      setFinishPosition(null);
      setShowPositionNotification(false);
    };

    const handleRaceWinner = ({ playerId, playerName }) => {
      console.log(`Race winner: ${playerName} (${playerId})`);
      setRaceWinner({ id: playerId, name: playerName });
      // Don't show the winner notification popup
      // setShowWinnerNotification(true);
      // createTrackedTimeout(() => setShowWinnerNotification(false), 5000);
    };

    const handleRestartRace = (data) => {
      // Set flag to prevent immediate movement after restart
      justRestarted.current = true;
      setTimeout(() => {
        justRestarted.current = false;
      }, 200);

      // Reset velocity and position references first
      velocityY.current = 0;
      lastPosRef.current = 0;

      // Reset all players positions immediately
      setPlayers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(playerId => {
          updated[playerId] = {
            ...updated[playerId],
            x: 0,
            y: 0,
            isJumping: false
          };
        });
        return updated;
      });

      // Reset race status
      setRaceWinner(null);
      setHasFinished(false);
      setShowWinnerNotification(false);
      setFinishPosition(null);
      setShowPositionNotification(false);

      // Update race status with data from server
      if (data) {
        setRaceStatus({
          isActive: true,
          startTime: data.startTime,
          distance: data.distance
        });
      }

      // Show restart notification for players who received the event
      setShowRestartNotification(true);
      createTrackedTimeout(() => setShowRestartNotification(false), 3000);

      // Force position update to server to ensure synchronization
      if (myId) {
        const resetPosition = {
          x: 0,
          y: 0,
          isJumping: false
        };

        // Make sure local player has reset position
        updatePosition(resetPosition);

        // Send to server after a small delay to ensure local state is updated first
        setTimeout(() => {
          socket.emit('update-position', resetPosition);
        }, 50);
      }
    };

    const handleInit = ({ id, players, trees: serverTrees, obstacles: serverObstacles }) => {
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

      // Load trees with error handling
      if (serverTrees?.length) {
        let loaded = 0;
        let errors = 0;
        const temp = [];
        const totalImages = serverTrees.length;

        serverTrees.forEach(tree => {
          const img = new Image();

          img.onload = () => {
            loaded++;
            temp.push({ x: tree.x, image: img });
            if (loaded + errors === totalImages) {
              setTrees(temp);
            }
          };

          img.onerror = () => {
            console.error(`Failed to load tree image: ${tree.image}`);
            errors++;
            // Still add an entry with default image or placeholder
            if (loaded + errors === totalImages) {
              setTrees(temp);
            }
          };

          // Set src after adding event handlers
          img.src = treeMap[tree.image] || treeMap['tree.png']; // Fallback to default
        });

        // Safety timeout to ensure trees are set even if some images fail to load
        const safetyTimer = setTimeout(() => {
          if (temp.length > 0 && temp.length < totalImages) {
            console.warn('Some tree images failed to load, using partial set');
            setTrees(temp);
          }
        }, 3000); // 3 second timeout

        // Add to tracked timeouts
        timeoutsRef.current.push(safetyTimer);
      }

      // Load obstacles with error handling
      if (serverObstacles?.length) {
        loadObstacles(serverObstacles);
      }
    };

    // Define the handler for loading obstacles
    const loadObstacles = (serverObstacles) => {
      let loaded = 0;
      let errors = 0;
      const temp = [];
      const totalImages = serverObstacles.length;

      serverObstacles.forEach(ob => {
        const img = new Image();

        img.onload = () => {
          loaded++;
          temp.push({ x: ob.x, image: img });
          if (loaded + errors === totalImages) {
            setObstacles(temp);
          }
        };

        img.onerror = () => {
          console.error(`Failed to load obstacle image: ${ob.image}`);
          errors++;
          // Still add an entry with default image or placeholder
          if (loaded + errors === totalImages) {
            setObstacles(temp);
          }
        };

        // Set src after adding event handlers
        img.src = obstacleMap[ob.image] || obstacleMap['rock.png']; // Fallback to default
      });

      // Safety timeout to ensure obstacles are set even if some images fail to load
      const safetyTimer = setTimeout(() => {
        if (temp.length > 0 && temp.length < totalImages) {
          console.warn('Some obstacle images failed to load, using partial set');
          setObstacles(temp);
        }
      }, 3000); // 3 second timeout

      timeoutsRef.current.push(safetyTimer);
    };

    const handleConnect = () => {
      console.log('Reconnected to server!');
      setIsReconnecting(false);
      reconnectionAttempts.current = 0;
    };

    const handleDisconnect = () => {
      console.log('Disconnected from server, attempting to reconnect...');
      setIsReconnecting(true);
      reconnectionAttempts.current += 1;
    };

    const handlePositionValidated = ({ id, x, y }) => {
      if (id === myId) {
        // Server has validated our position
        setLastServerPosition({ x, y });
      }
    };

    const handlePositionCorrection = ({ x, y }) => {
      // console.log(`Server position correction received: ${x}, ${y}`);

      // Update our position to match server's validated position
      setPlayers(prev => {
        if (prev[myId]) {
          return {
            ...prev,
            [myId]: {
              ...prev[myId],
              x, y
            }
          };
        }
        return prev;
      });

      // Show collision bounce animation
      setCollisionBounce(true);
      if (collisionTimer.current) {
        clearTimeout(collisionTimer.current);
      }

      collisionTimer.current = setTimeout(() => {
        setCollisionBounce(false);
      }, 500);

      timeoutsRef.current.push(collisionTimer.current);
    };

    // Register all event listeners
    socket.on('game-settings-updated', handleGameSettingsUpdated);
    socket.on('restart-race', handleRestartRace);
    socket.on('init', handleInit);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('position-validated', handlePositionValidated);
    socket.on('position-correction', handlePositionCorrection);

    // Keyboard event handlers for player movement
    const handleKeyDown = (e) => {
      if (['ArrowRight', 'ArrowUp'].includes(e.key)) {
        pressedKeys.current[e.key] = true;
        if (!isMoving) {
          setIsMoving(true);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (['ArrowRight', 'ArrowUp'].includes(e.key)) {
        pressedKeys.current[e.key] = false;
      }

      if (!pressedKeys.current['ArrowRight'] && !pressedKeys.current['ArrowUp']) {
        setIsMoving(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Clean up all event listeners when component unmounts
    return () => {
      // Clean up socket listeners
      socket.off('game-settings-updated', handleGameSettingsUpdated);
      socket.off('restart-race', handleRestartRace);
      socket.off('init', handleInit);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('position-validated', handlePositionValidated);
      socket.off('position-correction', handlePositionCorrection);

      // Clean up keyboard listeners
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      // Clear all timeouts
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];

      if (collisionTimer.current) {
        clearTimeout(collisionTimer.current);
      }
    };
  }, [playerName, myId, isHost, groundY, createTrackedTimeout, autoRequestHostStatus]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Pre-load and cache all images to avoid reloading them every frame
    // Create a single instance of each image that we'll reuse
    const treeImagesCache = {};
    const obstacleImagesCache = {};

    // Track loading state
    let isComponentMounted = true;

    // Load tree images
    const loadTreeImages = async () => {
      for (const [key, src] of Object.entries(treeMap)) {
        if (!isComponentMounted) return;

        try {
          const img = new Image();

          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => {
              console.error(`Failed to load tree image: ${key}`);
              reject(new Error(`Failed to load tree image: ${key}`));
            };
            img.src = src;
          }).catch(() => { }); // Catch errors but continue loading other images

          if (isComponentMounted) {
            treeImagesCache[key] = img;
          }
        } catch (error) {
          console.error(`Error loading tree image ${key}:`, error);
        }
      }
    };

    // Load obstacle images
    const loadObstacleImages = async () => {
      for (const [key, src] of Object.entries(obstacleMap)) {
        if (!isComponentMounted) return;

        try {
          const img = new Image();

          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => {
              console.error(`Failed to load obstacle image: ${key}`);
              reject(new Error(`Failed to load obstacle image: ${key}`));
            };
            img.src = src;
          }).catch(() => { }); // Catch errors but continue loading other images

          if (isComponentMounted) {
            obstacleImagesCache[key] = img;
          }
        } catch (error) {
          console.error(`Error loading obstacle image ${key}:`, error);
        }
      }
    };

    // Start loading images
    loadTreeImages();
    loadObstacleImages();

    const draw = () => {
      if (!ctx || !isComponentMounted) return;

      ctx.clearRect(0, 0, 800, 600);
      const me = players[myId];
      const cameraOffset = me ? me.x - fixedPlayerX : 0;
      const roadY = 400;

      // Visible area boundaries with buffer
      const visibleLeft = cameraOffset - 50;
      const visibleRight = cameraOffset + 850;

      // Draw a nicer ground/road with gradient
      const roadGradient = ctx.createLinearGradient(0, roadY - 15, 0, roadY + 15);
      roadGradient.addColorStop(0, '#888888');
      roadGradient.addColorStop(0.5, '#555555');
      roadGradient.addColorStop(1, '#333333');
      ctx.fillStyle = roadGradient;
      ctx.fillRect(0, roadY, ctx.canvas.width, 15);

      // // Draw grass below the road
      // ctx.fillStyle = '#fff';
      // ctx.fillRect(0, roadY + 15, 800, 600 - roadY - 15);

      // Draw trees with improved sizing and shadows - only draw visible trees
      trees.forEach(({ x, image }) => {
        // Skip trees outside the visible area for performance
        if (x < visibleLeft - 200 || x > visibleRight + 500) return;

        const drawX = x - cameraOffset;

        // Tree shadow
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(drawX + 220, roadY + 10, 60, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Tree image - use cached image if available or fall back to the one in the tree object
        const treeImg = image.src ? image : treeImagesCache[image] || image;
        ctx.drawImage(treeImg, drawX + 40, roadY - 280, 200, 280);
      });

      // Draw obstacles with improved sizing, shadows and effects - only draw visible obstacles
      obstacles.forEach(({ x, image }) => {
        // Skip obstacles outside the visible area for performance
        if (x < visibleLeft - 60 || x > visibleRight + 20) return;

        const drawX = x - cameraOffset;

        // Obstacle shadow
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(drawX + 30, roadY + 8, 25, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Obstacle image - use cached image if available or fall back to the one in the obstacle object
        const obstacleImg = image.src ? image : obstacleImagesCache[image] || image;
        ctx.drawImage(obstacleImg, drawX, roadY - 60, 60, 60);
      });

      // Draw the finish line only if in or near view
      const finishLineX = raceDistance - cameraOffset;
      if (finishLineX >= -100 && finishLineX <= 900) {
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

      }

      // Improve obstacle collision detection
      if (me && !me.isJumping) {
        // Only check obstacles near the player, not all of them
        const playerX = me.x;
        const playerWidth = 30;
        const proximityThreshold = 100; // Only check obstacles within this range

        // Filter to only obstacles near the player
        const nearbyObstacles = obstacles.filter(ob =>
          Math.abs(ob.x - playerX) < proximityThreshold
        );

        // Check collisions only with nearby obstacles
        for (const ob of nearbyObstacles) {
          const obsStart = ob.x;
          const obsEnd = ob.x + 60; // Obstacle width is 60px
          const playerLeft = playerX;
          const playerRight = playerX + playerWidth;

          // Check for collision with obstacle - more precise hitbox
          if (playerRight > obsStart + 10 && playerLeft < obsEnd - 30) {
            // Apply a small bounce back for more realistic physics
            const bounceBackDistance = 50; // or 70 for more push
            const newX = obsStart - playerWidth - bounceBackDistance;
            setPlayers(prev => ({ ...prev, [myId]: { ...me, x: newX } }));
            socket.emit('update-position', { ...me, x: newX });
            break; // Stop checking after first collision
          }
        }
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
    };

    let animationFrameId;
    const animate = () => {
      if (!isComponentMounted) return;
      draw();
      animationFrameId = requestAnimationFrame(animate);
    };

    // Start the animation
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      isComponentMounted = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Clear image caches to prevent memory leaks
      Object.keys(treeImagesCache).forEach(key => delete treeImagesCache[key]);
      Object.keys(obstacleImagesCache).forEach(key => delete obstacleImagesCache[key]);
    };
  }, [players, trees, obstacles, myId, raceDistance]);

  // Inject the animation styles when component mounts
  useEffect(() => {
    // Animation now handled directly by img tag switching
  }, []);

  // Add a recovery mechanism to handle when the player is missing from state
  useEffect(() => {
    // If myId exists but the player isn't in the players state, recover it
    if (myId && !players[myId] && playerName) {
      console.log(`Player ${myId} is missing from state, recovering...`);

      // Create a new player object with default values
      const recoveredPlayer = {
        x: lastKnownPosition.x || 0,
        y: lastKnownPosition.y || 0,
        name: playerName,
        isJumping: false
      };

      // Update the state
      setPlayers(prev => ({
        ...prev,
        [myId]: recoveredPlayer
      }));

      // Send the recovered position to the server
      socket.emit('update-position', recoveredPlayer);

      // Report the recovery for debugging
      console.log(`Recovered player ${myId} with position:`, recoveredPlayer);
    }
  }, [myId, players, playerName]);

  // Add auto-refresh mechanism for visibility issues
  useEffect(() => {
    const visibilityCheckInterval = setInterval(() => {
      // Check if we should be visible but aren't
      if (myId && !players[myId] && Object.keys(players).length > 0) {
        console.log("Visibility issue detected, refreshing player state");

        // Force re-render of myself
        const newPlayer = {
          x: lastKnownPosition.x || 0,
          y: lastKnownPosition.y || 0,
          name: playerName,
          isJumping: false
        };

        setPlayers(prev => ({ ...prev, [myId]: newPlayer }));
        socket.emit('update-position', newPlayer);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(visibilityCheckInterval);
  }, [myId, players, playerName]);

  // Add the game loop for player movement in a separate useEffect
  useEffect(() => {
    const gameInterval = setInterval(() => {
      // Skip updates if not properly connected or initialized
      if (!myId || !socket.connected) {
        return;
      }

      setPlayers(prev => {
        const me = prev[myId];
        if (!me) return prev;
        let updated = { ...me };
        let isCurrentlyMoving = false;

        // Don't allow movement if the player has finished the race or just restarted
        if (!hasFinished && !justRestarted.current) {
          if (pressedKeys.current['ArrowRight']) {
            // Calculate the new position
            let newX = updated.x + 5;

            // Track the last position for validation
            lastPosRef.current = updated.x;

            // Add boundary check for right movement
            newX = Math.min(newX, maxX);
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

          // Check if player has crossed the finish line with validation
          if (updated.x >= raceDistance && !hasFinished) {
            validateRaceFinish(updated.x);
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
          // Store position for client-side tracking
          updatePosition(updated);

          // Send position update to server only if we're connected
          if (socket.connected) {
            socket.emit('update-position', updated);
          }
          return { ...prev, [myId]: updated };
        }

        return prev;
      });
    }, 30);  // 30ms for approximately 33 fps

    // Clean up interval when component unmounts
    return () => clearInterval(gameInterval);
  }, [myId, raceDistance, hasFinished, isMoving, maxX, maxY, groundY, gravity, validateRaceFinish]);

  // Add an error fallback UI
  if (canvasError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-800 bg-opacity-25 rounded-lg">
        <h2 className="text-xl font-bold mb-4 text-white">Canvas Error</h2>
        <p className="text-white mb-4">There was a problem initializing the game canvas.</p>
        <button
          className="bg-blue-600 px-4 py-2 rounded-lg text-white font-bold"
          onClick={() => window.location.reload()}
        >
          Reload Game
        </button>
      </div>
    );
  }

  // Add this useEffect to track new players and update visiblePlayers accordingly
  useEffect(() => {
    // Listen for the 'new-player' event from the server
    const handleNewPlayer = ({ id, name, x, y, isRequestAccepter }) => {
      console.log(`New player joined: ${name} (${id}), position: ${x}, ${y}, isRequestAccepter: ${isRequestAccepter}`);

      // Add to players list if not already present
      setPlayers(prev => {
        if (!prev[id]) {
          return {
            ...prev,
            [id]: {
              name: name || `Player-${id.substring(0, 5)}`,
              x: x || 0,
              y: y || 0,
              isJumping: false
            }
          };
        }
        return prev;
      });

      // Add to visiblePlayers set
      visiblePlayers.add(id);
      console.log(`Added player ${id} to visiblePlayers, current list:`, Array.from(visiblePlayers));

      // Check if this player is tagged as a request accepter
      if (isRequestAccepter !== undefined && id === myId) {
        setIsRequestAccepter(isRequestAccepter);
      }
    };

    socket.on('new-player', handleNewPlayer);

    return () => {
      socket.off('new-player', handleNewPlayer);
    };
  }, [myId]); // Add myId to dependencies

  // Add this to listen for player movements
  useEffect(() => {
    const handlePlayerMoved = ({ id, x, y, isJumping, name }) => {
      // Ensure the player is in our visible players list
      visiblePlayers.add(id);

      // Update player position
      setPlayers(prev => {
        if (prev[id]) {
          return {
            ...prev,
            [id]: {
              ...prev[id],
              x,
              y,
              isJumping,
              name: name || prev[id].name
            }
          };
        }
        // If player doesn't exist, add them
        return {
          ...prev,
          [id]: {
            x,
            y,
            isJumping,
            name: name || `Player-${id.substring(0, 5)}`
          }
        };
      });
    };

    socket.on('player-moved', handlePlayerMoved);

    return () => {
      socket.off('player-moved', handlePlayerMoved);
    };
  }, []);

  // Function to handle game exit
  const handleExitGame = () => {
    // Skip if buttons are disabled for this player
    if (isRequestAccepter) {
      return;
    }

    // Notify server that player is leaving
    if (myId) {
      socket.emit('player-leave', { playerId: myId });
    }

    // Set exit state to true - will be handled by parent component
    setExitGame(true);

    // Clean up player data from localStorage
    localStorage.removeItem('playerName');
    localStorage.removeItem('isHost');
    localStorage.removeItem('isRequestSender');
  };

  // If user has chosen to exit, return null so parent can redirect
  useEffect(() => {
    if (exitGame && onError) {
      // Signal to parent that we want to exit (using the error handler as a callback)
      onError(new Error('EXIT_GAME'));
    }
  }, [exitGame, onError]);

  // Modify the refresh players function to only affect the local player
  const refreshLocalPlayer = () => {
    // Force re-render of myself if I'm missing from players
    if (myId && playerName) {
      const newPlayer = {
        x: lastKnownPosition.x || 0,
        y: lastKnownPosition.y || 0,
        name: playerName,
        isJumping: false
      };

      console.log("Refreshing local player:", newPlayer);
      setPlayers(prev => ({ ...prev, [myId]: newPlayer }));

      // Re-emit my position to ensure others can see me
      socket.emit('update-position', newPlayer);

      // Show notification only to this player
      setShowErrorMessage("Player refreshed");
      setTimeout(() => setShowErrorMessage(""), 2000);
    }
  };

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
              className="rounded-lg bg-white w-full max-w-[800px] h-auto"
              style={{
                boxShadow: 'inset 0 0 20px 10px rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
            />
          </div>

          {/* Consolidated Game UI Panel - Top right */}
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            {/* Score/Distance Display */}
            <div className="bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm rounded-lg py-2 px-4 text-white border border-indigo-500">
              <div className="text-sm font-bold text-yellow-300">Distance</div>
              <div className="font-mono text-2xl text-white" id="score">
                {players[myId] ? Math.floor(players[myId].x / 10) : 0} m
              </div>
            </div>

            {/* Game Controls Panel */}
            <div className="bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm rounded-lg p-3 border border-indigo-500 flex flex-col space-y-2">
              {/* Show message for request accepter */}
              {isRequestAccepter && (
                <div className="text-amber-300 text-xs mb-1 text-center">
                  Controls disabled for request accepter
                </div>
              )}

              {/* Exit Game Button */}
              <button
                onClick={handleExitGame}
                className={`bg-gradient-to-r from-gray-600 to-gray-800 text-white px-4 py-2 rounded-lg shadow-lg ${isRequestAccepter
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:from-gray-700 hover:to-gray-900 transform hover:scale-105 transition duration-300'
                  } flex items-center justify-center`}
                disabled={isRequestAccepter}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Exit
              </button>

              {/* Restart Race Button */}
              {/* <button
                onClick={restartRace}
                className={`bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-lg shadow-lg ${isRequestAccepter
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:from-red-600 hover:to-orange-600 transform hover:scale-105 transition duration-300'
                  } flex items-center justify-center`}
                disabled={isRequestAccepter}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isHost ? "Restart All" : "Restart Game"}
              </button> */}
            </div>
          </div>

          {/* Info Panel - Top left */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm rounded-lg p-4 text-white border border-indigo-600">
            {/* Player info */}
            <div className="flex items-center space-x-2 mb-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-bold text-indigo-300">PLAYER:</span>
              <span className="text-white">{players[myId]?.name || 'Player'}</span>
            </div>

            {/* Players count */}
            <div className="flex items-center space-x-2 mb-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-bold text-indigo-300">PLAYERS:</span>
              <span className="text-white">{Object.keys(players).length}</span>
            </div>

            {/* Game controls legend */}
            <div className="pt-2 border-t border-indigo-600">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <span className="font-bold text-indigo-300">CONTROLS:</span>
              </div>
              <div className="flex space-x-4 items-center">
                <div className="flex items-center space-x-1">
                  <div className="bg-gray-700 px-2 py-1 rounded text-yellow-300 font-semibold">→</div>
                  <span className="text-sm">Run</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="bg-gray-700 px-2 py-1 rounded text-yellow-300 font-semibold">↑</div>
                  <span className="text-sm">Jump</span>
                </div>
              </div>
            </div>
          </div>

          {/* Finish position notification (for non-winners) */}
          {showPositionNotification && finishPosition && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-80 text-white px-8 py-6 rounded-lg z-50 shadow-lg border-2 border-blue-500">
              <div className="flex items-center justify-center space-x-2 text-2xl font-bold mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812z" clipRule="evenodd" />
                </svg>
                <span>Race Complete!</span>
              </div>
              <div className="text-center text-xl font-bold mb-2">Position: {finishPosition}</div>
              <p className="text-center text-blue-200 text-sm">You finished the race!</p>
            </div>
          )}

          {/* Error message notification */}
          {showErrorMessage && (
            <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 bg-red-600 bg-opacity-90 text-white px-6 py-3 rounded-lg z-50 shadow-lg border border-red-400 animate-bounce">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{showErrorMessage}</span>
              </div>
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
              <p className="text-center mt-2 text-yellow-200">All players moved to starting line (0m)</p>
            </div>
          )}

          {/* Reconnection indicator */}
          {isReconnecting && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-80 text-white px-6 py-4 rounded-lg z-50 animate-pulse shadow-lg border-2 border-red-500">
              <div className="flex items-center justify-center space-x-2 text-xl font-bold">
                <svg className="w-6 h-6 text-red-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reconnecting to server...</span>
              </div>
              <p className="text-center mt-2 text-red-200">Attempt {reconnectionAttempts.current}</p>
            </div>
          )}

          {/* Overlay the stickman gifs on top of the canvas */}
          {Object.entries(players).map(([id, player]) => {
            // No longer checking visibility since all players in the state should be visible
            // console.log(`Rendering player ${id}, name: ${player.name}, isMyId: ${id === myId}`);

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
                overflow: 'visible', // Ensure image isn't clipped
                transition: 'transform 0.1s ease-out',
                transform: id === myId && collisionBounce ? 'translateX(-10px)' : 'translateX(0)'
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
      {/* 👇 Mobile Controls – Bottom Center Horizontal Layout */}
      <div className="fixed bottom-30 left-0 right-0 z-50 flex justify-around px-4 pointer-events-none">
        {/* Jump Button */}
        <div
          className="pointer-events-auto"
          onTouchStart={() => { pressedKeys.current['ArrowUp'] = true; }}
          onTouchEnd={() => { pressedKeys.current['ArrowUp'] = false; }}
        >
          <div className="bg-white/20 backdrop-blur-lg rounded-3xl shadow-[inset_5px_5px_15px_rgba(255,255,255,0.1),_inset_-5px_-5px_15px_rgba(0,0,0,0.2)] border border-white/30 px-10 py-6 text-2xl font-bold text-white tracking-wide active:scale-90 transition select-none">
            ⬆️
          </div>
        </div>

        {/* Run Button */}
        <div
          className="pointer-events-auto"
          onTouchStart={() => { pressedKeys.current['ArrowRight'] = true; }}
          onTouchEnd={() => { pressedKeys.current['ArrowRight'] = false; }}
        >
          <div className="bg-white/20 backdrop-blur-lg rounded-3xl shadow-[inset_5px_5px_15px_rgba(255,255,255,0.1),_inset_-5px_-5px_15px_rgba(0,0,0,0.2)] border border-white/30 px-10 py-6 text-2xl font-bold text-white tracking-wide active:scale-90 transition select-none">
            ▶️
          </div>
        </div>
      </div>



      {myId && <AddPlayerById myId={myId} />}
      {myId && <GameSettings myId={myId} />}
    </div>
  );
};

export default CanvasGame;

