const canvas = document.getElementById('gameCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext('2d');
// this.canvas.width = window.innerWidth;
// this.canvas.height = window.innerHeight;
const JUMP_HEIGHT_FACTOR = 1.9;
wheelTimer = 500;


const player = {
    x: 100,
    y: canvas.height - 100,
    width: canvas.clientWidth / 16,
    height: canvas.clientHeight / 16,
    speed: 5,
    jumping: false,
    jumpHeight: 0,
    jumpSpeed: 0.1,
    facingright: true,
    image: new Image(),
};

player.image.src = 'moongame/moonbuggy1.png';
player.height = player.height;
player.width = player.width;
player.jumpHeight = player.height * JUMP_HEIGHT_FACTOR;

const terrain = {
    data: [],
    width: canvas.width,
    segments: 80,
    maxHeight: 330,
    minHeight: 300,
    scrollOffset: 0,
};

function generateTerrain() {
    const step = terrain.width / terrain.segments;
    for (let i = 0; i <= terrain.segments; i++) {
        const x = i * step;
        y = canvas.height - terrain.minHeight;
        if (Math.random() > 0.8) {
            // make a hole a few segments wide
            // generate a random number between 1 and 3
            let randseg = Math.floor(Math.random() * 3) + 1;


            
            // while (i < terrain.segments && randseg>0) {
            //     i++;
            //     randseg--;
                y =
                    canvas.height -
                    terrain.minHeight +
                    (Math.random() * (terrain.maxHeight - terrain.minHeight));
                terrain.data.push({ x, y ,randseg});
            // }
        }
        else {
            terrain.data.push({ x, y ,randseg:0});
        }
    }
}

generateTerrain();

function drawTerrain() {
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    terrain.data.forEach((point) => {
        ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fillStyle = 'green';
    ctx.fill();
}

function getTerrainHeightAtX(x) {
    const terrainSegmentWidth = terrain.width / terrain.segments;
    const leftIndex = Math.floor(x / terrainSegmentWidth);
    const rightIndex = Math.ceil(x / terrainSegmentWidth);

    if (rightIndex >= terrain.data.length) {
        return terrain.data[terrain.data.length - 1].y;
    }

    const leftPoint = terrain.data[leftIndex];
    const rightPoint = terrain.data[rightIndex];
    const t = (x - leftPoint.x) / terrainSegmentWidth;

    return leftPoint.y + t * (rightPoint.y - leftPoint.y);
}

function getTerrainAngleAtX(x) {
    const terrainSegmentWidth = terrain.width / terrain.segments;
    const leftIndex = Math.floor(x / terrainSegmentWidth);
    const rightIndex = Math.ceil(x / terrainSegmentWidth);

    if (rightIndex >= terrain.data.length) {
        return 0;
    }

    const leftPoint = terrain.data[leftIndex];
    const rightPoint = terrain.data[rightIndex];

    return Math.atan2(rightPoint.y - leftPoint.y, rightPoint.x - leftPoint.x);
}


const keys = {
    left: false,
    right: false,
    space: false,
};

function drawPlayer() {
    ctx.save();

    const terrainAngle = getTerrainAngleAtX(player.x + player.width / 2);

    if (player.facingright) {
        ctx.translate(player.x + player.width / 2, player.y + player.height);
        ctx.rotate(terrainAngle);
        ctx.translate(-player.width / 2, -player.height);
    } else {
        ctx.translate(player.x + player.width / 2, player.y + player.height);
        ctx.rotate(terrainAngle);
        ctx.scale(-1, 1);
        ctx.translate(-player.width / 2, -player.height);
    }


    ctx.drawImage(player.image, 0, 0, player.width, player.height);
    ctx.restore();
}

function handleKeyDown(event) {
    switch (event.key) {
        case 'ArrowLeft':
            keys.left = true;
            break;
        case 'ArrowRight':
            keys.right = true;
            break;
        case ' ':
            keys.space = true;
            break;
    }
}

function handleKeyUp(event) {
    switch (event.key) {
        case 'ArrowLeft':
            keys.left = false;
            break;
        case 'ArrowRight':
            keys.right = false;
            break;
        case ' ':
            keys.space = false;
            break;
    }
}
function handleMouseClick(event) {
    keys.space = true;
    setTimeout(() => {
        keys.space = false;
    }, 100);
}

function handleMouseWheel(event) {
    const wheelDelta = Math.sign(event.deltaY);

    if (wheelDelta < 0) {
        keys.left = true;
    } else {
        keys.right = true;
    }
    wheelTimer += 500;
    setTimeout(() => {
        keys.left = false;
        keys.right = false;
    }, wheelTimer);
}




function updatePlayer() {
    if (keys.left) {
        if (player.x <= 0) return;
        player.x -= player.speed;
        if (player.facingright) {
            player.facingright = false;
        }
    }
    if (keys.right) {
        if (player.x >= canvas.width - player.width) return;
        player.x += player.speed;
        if (!player.facingright) {
            player.facingright = true;
        }
    }
    if (keys.space && !player.jumping) {
        player.jumping = true;
    }

    const terrainHeight = getTerrainHeightAtX(player.x + player.width / 2);

    if (!player.jumping) {
        // Set player's vertical position based on terrain height
        player.y = terrainHeight - player.height;
    } else {
        const jumpProgress = player.jumpHeight / (player.height * JUMP_HEIGHT_FACTOR);
        const jumpEasing = (Math.sin(jumpProgress * Math.PI) + 0.5) * player.height;
        player.y = terrainHeight - player.height - jumpEasing;
        player.jumpHeight -= player.jumpSpeed * jumpEasing;

        // Reset jump state when jumpHeight is very small or reaches 0
        if (player.jumpHeight <= 1e-6) {
            player.jumping = false;
            player.jumpHeight = player.height * JUMP_HEIGHT_FACTOR;
        }
    }
}



function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawTerrain();
    updatePlayer();
    drawPlayer();

    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
document.addEventListener('wheel', handleMouseWheel);
document.addEventListener('mouseclick', handleMouseClick);

gameLoop();
