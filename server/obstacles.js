// obstacles.js
let obstacles = [];

const obstacleTypes = [
  {
    name: 'rock',
    filename: 'rock.png',
    width: 90,
    height: 130,

    collisionAdjustment: { x: 5, y: 5, width: -30, height: -10 } // Smaller hitbox than visual
  },
  {
    name: 'barrel',
    filename: 'barrel.png',
    width: 70,
    height: 70,
    collisionAdjustment: { x: 10, y: 10, width: -10, height: -10 } // Smaller hitbox than visual
  },
  {
    name: 'spike',
    filename: 'spike.png',
    width: 60,
    height: 60,
    collisionAdjustment: { x: 15, y: 30, width: -20, height: -20 } // Much smaller hitbox for the spikes
  }
];

// Get collision box for an obstacle based on its type and position
const getCollisionBox = (obstacle) => {
  try {
    if (!obstacle || typeof obstacle !== 'object') {
      console.warn('Invalid obstacle object in getCollisionBox');
      return { x: 0, y: 0, width: 0, height: 0 }; // Safe default
    }

    const obstacleType = obstacleTypes.find(type =>
      type.filename === obstacle.image || type.name === obstacle.type
    );

    if (!obstacleType) {
      // Default collision box if type not found
      console.warn(`Unknown obstacle type/image: ${obstacle.image || obstacle.type}`);
      return {
        x: obstacle.x || 0,
        y: 0,
        width: 90,
        height: 90
      };
    }

    // Apply collision adjustment from the obstacle type
    const adj = obstacleType.collisionAdjustment;
    return {
      x: (obstacle.x || 0) + adj.x,
      y: 0 + adj.y,
      width: obstacleType.width + adj.width,
      height: obstacleType.height + adj.height
    };
  } catch (error) {
    console.error('Error in getCollisionBox:', error);
    return { x: 0, y: 0, width: 0, height: 0 }; // Safe default
  }
};

// Check if player collides with an obstacle
const checkCollision = (player, obstacle) => {
  try {
    // Validate input parameters
    if (!player || !obstacle || typeof player !== 'object' || typeof obstacle !== 'object') {
      console.warn('Invalid player or obstacle in checkCollision');
      return false;
    }

    const obstacleBox = getCollisionBox(obstacle);

    // Jumping players only collide if they're low enough
    if (player.isJumping && player.y > obstacleBox.height) {
      return false;
    }

    // Create player collision box (adjust as needed)
    const playerBox = {
      x: player.x || 0,
      y: 0,
      width: 30, // Player width
      height: 70  // Player height
    };

    // Standard AABB collision detection
    return (
      playerBox.x < obstacleBox.x + obstacleBox.width &&
      playerBox.x + playerBox.width > obstacleBox.x &&
      playerBox.y < obstacleBox.y + obstacleBox.height &&
      playerBox.y + playerBox.height > obstacleBox.y
    );
  } catch (error) {
    console.error('Error in checkCollision:', error);
    return false; // Safe default - no collision
  }
};

// Generate obstacles with better distribution
const generateObstacles = (count, distance) => {
  try {
    const obstaclesList = [];
    const minDistance = 150;  // Minimum distance between obstacles
    const safeCount = Math.min(Math.max(0, count || 0), 100); // Ensure count is reasonable

    for (let i = 0; i < safeCount; i++) {
      // Calculate position with minimum safe distance
      let x;
      if (i === 0) {
        // First obstacle should be far enough from start
        x = 500 + Math.random() * 300;
      } else {
        // Ensure minimum distance from previous obstacle
        x = obstaclesList[i - 1].x + minDistance + Math.random() * 300;
      }

      // Ensure we don't place obstacles too close to finish line
      if (distance && x > distance - 200) {
        continue;
      }

      // Select random obstacle type
      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];

      obstaclesList.push({
        x,
        type: type.name,
        image: type.filename
      });
    }

    return obstaclesList;
  } catch (error) {
    console.error('Error generating obstacles:', error);
    return []; // Return empty array on error
  }
};

// Use proper CommonJS exports
module.exports = {
  obstacles,
  obstacleTypes,
  getCollisionBox,
  checkCollision,
  generateObstacles
};
