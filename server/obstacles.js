// obstacles.js
let obstacles = [];

function generateObstacles() {
  obstacles = [];
  for (let i = 0; i < 30; i++) {
    const x = i * 600 + 500 + Math.random() * 300;
    const image = `obstacle${Math.floor(Math.random() * 3) + 1}.png`; // obstacle1.png to obstacle3.png
    obstacles.push({ x, image });
  }
}

// yaha CommonJS export ka jugad: global bana dete hain
global.sharedObstacles = { obstacles, generateObstacles };
