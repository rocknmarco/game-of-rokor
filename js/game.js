const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const tileSize = 32;
let player = { x: 1, y: 1 };
let currentRoom = null;

async function loadRoom(name) {
    const response = await fetch(`data/rooms/${name}.json`);
    currentRoom = await response.json();
    draw();
}

function drawTile(tx, ty, color) {
    ctx.fillStyle = color;
    ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
}

function draw() {
    if (!currentRoom) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < currentRoom.tiles.length; y++) {
        for (let x = 0; x < currentRoom.tiles[y].length; x++) {
            const tile = currentRoom.tiles[y][x];
            const color = tile === 1 ? '#666' : '#222';
            drawTile(x, y, color);
        }
    }
    drawTile(player.x, player.y, '#0f0');
}

function movePlayer(dx, dy) {
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (currentRoom.tiles[ny] && currentRoom.tiles[ny][nx] === 0) {
        player.x = nx;
        player.y = ny;
    }
    draw();
}

window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp': movePlayer(0, -1); break;
        case 'ArrowDown': movePlayer(0, 1); break;
        case 'ArrowLeft': movePlayer(-1, 0); break;
        case 'ArrowRight': movePlayer(1, 0); break;
    }
});

loadRoom('room1');
