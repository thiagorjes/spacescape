// Game state
let gameState = {
    level: 1,
    collisionCount: 0,
    fuel: 100,
    temperature: 0,
    isOverheated: false,
    isFuelEmpty: false,
    gameStatus: 'ready' // 'loading', 'ready', 'playing'
};

// DOM elements
const elements = {
    startScreen: document.getElementById('startScreen'),
    fuelEmptyPopup: document.getElementById('fuelEmptyPopup'),
    overheatAlert: document.getElementById('overheatAlert'),
    stageTitle: document.getElementById('stageTitle'),
    finalStage: document.getElementById('finalStage'),
    finalDeaths: document.getElementById('finalDeaths'),
    startButton: document.getElementById('startButton'),
    restartButton: document.getElementById('restartButton'),
    temperatureFill: document.getElementById('temperatureFill'),
    fuelFill: document.getElementById('fuelFill'),
    stageDisplay: document.getElementById('stageDisplay'),
    deathDisplay: document.getElementById('deathDisplay'),
    gameArea: document.getElementById('gameArea'),
    gameEntities: document.getElementById('gameEntities')
};

// Control buttons
const controls = {
    left: document.getElementById('leftButton'),
    right: document.getElementById('rightButton'),
    up: document.getElementById('upButton'),
    down: document.getElementById('downButton')
};

// Initialize game
function initGame() {
    updateDisplays();
    updateProgressBars();
    setupEventListeners();
    showStartScreen();
}

// Update displays
function updateDisplays() {
    // Update stage display
    const stageDigits = gameState.level.toString().padStart(2, '0').split('');
    const stageSegments = elements.stageDisplay.querySelectorAll('.segment');
    stageSegments.forEach((segment, index) => {
        segment.textContent = stageDigits[index] || '0';
    });

    // Update death display
    const deathDigits = gameState.collisionCount.toString().padStart(2, '0').split('');
    const deathSegments = elements.deathDisplay.querySelectorAll('.segment');
    deathSegments.forEach((segment, index) => {
        segment.textContent = deathDigits[index] || '0';
    });
}

// Update progress bars
function updateProgressBars() {
    const fuelPercent = gameState.fuel;
    const temperaturePercent = gameState.temperature;

    elements.fuelFill.style.height = `${100-fuelPercent}%`;
    elements.temperatureFill.style.height = `${100-temperaturePercent}%`;
}

// Show start screen
function showStartScreen() {
    elements.stageTitle.textContent = `STAGE ${gameState.level.toString().padStart(2, '0')}`;
    elements.startScreen.style.display = 'flex';
    gameState.gameStatus = 'ready';
}

// Hide start screen
function hideStartScreen() {
    elements.startScreen.style.display = 'none';
    gameState.gameStatus = 'playing';
}

// Show fuel empty popup
function showFuelEmptyPopup() {
    elements.finalStage.textContent = gameState.level;
    elements.finalDeaths.textContent = gameState.collisionCount;
    elements.fuelEmptyPopup.style.display = 'flex';
    gameState.isFuelEmpty = true;
}

// Hide fuel empty popup
function hideFuelEmptyPopup() {
    elements.fuelEmptyPopup.style.display = 'none';
    gameState.isFuelEmpty = false;
}

// Show overheat alert
function showOverheatAlert() {
    elements.overheatAlert.style.display = 'block';
}

// Hide overheat alert
function hideOverheatAlert() {
    elements.overheatAlert.style.display = 'none';
}

// Handle start button click
function handleStart() {
    hideStartScreen();
    // Here you would initialize the game engine
    // For now, we'll just simulate the game start
    console.log('Game started for level', gameState.level);
}

// Handle restart button click
function handleRestart() {
    hideFuelEmptyPopup();
    gameState.level = 1;
    gameState.collisionCount = 0;
    gameState.fuel = 100;
    gameState.temperature = 0;
    gameState.isOverheated = false;
    updateDisplays();
    updateProgressBars();
    showStartScreen();
}

// Handle control presses
function handleControl(direction, isPressed) {
    if (gameState.gameStatus !== 'playing') return;

    console.log(`${direction} ${isPressed ? 'pressed' : 'released'}`);

    // Here you would send the control to the game engine
    // For now, we'll simulate fuel consumption and temperature changes
    if (isPressed) {
        // Simulate fuel consumption
        gameState.fuel = Math.max(0, gameState.fuel - 0.1);
        gameState.temperature = Math.min(100, gameState.temperature + 0.5);

        if (gameState.fuel <= 0) {
            showFuelEmptyPopup();
        }

        if (gameState.temperature >= 80 && !gameState.isOverheated) {
            gameState.isOverheated = true;
            showOverheatAlert();
        }

        updateProgressBars();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Start button
    elements.startButton.addEventListener('click', handleStart);

    // Restart button
    elements.restartButton.addEventListener('click', handleRestart);

    // Control buttons
    Object.keys(controls).forEach(direction => {
        const button = controls[direction];

        button.addEventListener('mousedown', () => handleControl(direction, true));
        button.addEventListener('mouseup', () => handleControl(direction, false));
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleControl(direction, true);
        });
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleControl(direction, false);
        });
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'ArrowLeft':
                e.preventDefault();
                handleControl('left', true);
                break;
            case 'ArrowRight':
                e.preventDefault();
                handleControl('right', true);
                break;
            case 'ArrowUp':
                e.preventDefault();
                handleControl('up', true);
                break;
            case 'ArrowDown':
                e.preventDefault();
                handleControl('down', true);
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'ArrowLeft':
                e.preventDefault();
                handleControl('left', false);
                break;
            case 'ArrowRight':
                e.preventDefault();
                handleControl('right', false);
                break;
            case 'ArrowUp':
                e.preventDefault();
                handleControl('up', false);
                break;
            case 'ArrowDown':
                e.preventDefault();
                handleControl('down', false);
                break;
        }
    });
}

// Game event handlers (to be called by game engine)
function onGameEvent(event) {
    switch(event.type) {
        case 'explosion':
            gameState.collisionCount++;
            gameState.fuel = Math.max(0, gameState.fuel - 5);
            updateDisplays();
            updateProgressBars();
            // Show explosion effect
            showExplosion(event.position);
            break;
        case 'levelEnd':
            gameState.level++;
            updateDisplays();
            setTimeout(() => {
                showStartScreen();
            }, 100);
            break;
        case 'blackHole':
            gameState.collisionCount++;
            updateDisplays();
            setTimeout(() => {
                showStartScreen();
            }, 2000);
            break;
        case 'fuel-updated':
            gameState.fuel = event.fuel;
            updateProgressBars();
            if (gameState.fuel <= 0 && !gameState.isFuelEmpty) {
                showFuelEmptyPopup();
            }
            break;
        case 'temperature-updated':
            gameState.temperature = event.temperature;
            gameState.isOverheated = event.isOverheated;
            updateProgressBars();
            if (gameState.isOverheated) {
                showOverheatAlert();
            } else {
                hideOverheatAlert();
            }
            break;
    }
}

// Show explosion effect (placeholder)
function showExplosion(position) {
    // Create explosion element
    const explosion = document.createElement('div');
    explosion.style.position = 'absolute';
    explosion.style.left = `${position.x}px`;
    explosion.style.top = `${position.y}px`;
    explosion.style.width = '50px';
    explosion.style.height = '50px';
    explosion.style.background = 'radial-gradient(circle, #ffaa00, #ff4444, transparent)';
    explosion.style.borderRadius = '50%';
    explosion.style.pointerEvents = 'none';
    explosion.style.zIndex = '999';

    elements.gameArea.appendChild(explosion);

    // Remove after animation
    setTimeout(() => {
        if (explosion.parentNode) {
            explosion.parentNode.removeChild(explosion);
        }
    }, 2000);
}

// Start the game when page loads
document.addEventListener('DOMContentLoaded', initGame);
