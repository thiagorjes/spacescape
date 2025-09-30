// Importa a função de verificação de autenticação e o motor de física
import { checkAuthState } from './auth-utils.js';
import { PhysicsEngine } from './physics.js';

// --- LÓGICA DO HEADER ---
function updateHeaderUI(user) {
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement) {
        userNameElement.textContent = user ? (user.username || user.displayName || 'Player') : 'Login';
    }
}

function setupHeaderListeners() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.user-name') || e.target.closest('.profile')) {
            const modal = document.getElementById('modal-background');
            if (modal) modal.style.display = 'flex';
        }
        if (e.target.closest('.home')) {
            window.location.href = 'index.html';
        }
    });

    document.addEventListener('authStateChange', (e) => {
        updateHeaderUI(e.detail.user);
    });
}
// --- FIM DA LÓGICA DO HEADER ---

// Protege a página e atualiza o header
checkAuthState(user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        updateHeaderUI(user);
    }
});

// Estado do jogo (controlado pela UI)
let gameState = {
    level: 1,
    deaths: 0,
    fuel: 100,
    temperature: 0,
    isOverheated: false,
    isFuelEmpty: false,
    gameStatus: 'ready' // 'ready', 'playing', 'paused'
};

// Elementos da UI
const elements = {
    startScreen: document.getElementById('startScreen'),
    fuelEmptyPopup: document.getElementById('fuelEmptyPopup'),
    winOverlay: document.getElementById('win-overlay'),
    overheatAlert: document.getElementById('overheatAlert'),
    stageTitle: document.getElementById('stageTitle'),
    finalStage: document.getElementById('finalStage'),
    finalDeaths: document.getElementById('finalDeaths'),
    startButton: document.getElementById('startButton'),
    restartButton: document.getElementById('restartButton'),
    nextLevelButton: document.getElementById('next-level-btn'),
    temperatureFill: document.getElementById('temperatureFill'),
    fuelFill: document.getElementById('fuelFill'),
    stageDisplay: document.getElementById('stageDisplay'),
    deathDisplay: document.getElementById('deathDisplay'),
    gameCanvas: document.getElementById('gameCanvas'),
    gameArea: document.getElementById('gameArea')
};

// Botões de controle
const controls = { left: 'left', right: 'right', up: 'up', down: 'down' };

let physicsEngine;

// Inicializa o jogo
function initGame() {
    physicsEngine = new PhysicsEngine(elements.gameCanvas, gameState);
    physicsEngine.init();
    updateDisplays();
    updateProgressBars();
    setupEventListeners();
    showStartScreen();
}

// Funções de atualização da UI
function updateDisplays() {
    const stageDigits = gameState.level.toString().padStart(2, '0');
    elements.stageDisplay.querySelectorAll('.segment').forEach((seg, i) => seg.textContent = stageDigits[i] || '0');
    const deathDigits = gameState.deaths.toString().padStart(2, '0');
    elements.deathDisplay.querySelectorAll('.segment').forEach((seg, i) => seg.textContent = deathDigits[i] || '0');
}

function updateProgressBars() {
    elements.fuelFill.style.height = `${100 - gameState.fuel}%`;
    elements.temperatureFill.style.height = `${gameState.temperature}%`;
}

// Funções de gerenciamento de popups
function showStartScreen() {
    elements.stageTitle.textContent = `STAGE ${String(gameState.level).padStart(2, '0')}`;
    elements.startScreen.style.display = 'flex';
    gameState.gameStatus = 'ready';
}

function hidePopups() {
    elements.startScreen.style.display = 'none';
    elements.fuelEmptyPopup.style.display = 'none';
    elements.winOverlay.style.display = 'none';
}

function showFuelEmptyPopup() {
    elements.finalStage.textContent = gameState.level;
    elements.finalDeaths.textContent = gameState.deaths;
    elements.fuelEmptyPopup.style.display = 'flex';
    gameState.isFuelEmpty = true;
    gameState.gameStatus = 'paused';
    physicsEngine.stop();
}

function showWinOverlay() {
    elements.winOverlay.style.display = 'flex';
    gameState.gameStatus = 'paused';
    physicsEngine.stop();
}

// Handlers de botões da UI
function handleStart() {
    hidePopups();
    gameState.gameStatus = 'playing';
    physicsEngine.start();
}

function handleRestart() {
    hidePopups();
    gameState.level = 1;
    gameState.deaths = 0;
    gameState.fuel = 100;
    gameState.temperature = 0;
    gameState.isOverheated = false;
    gameState.isFuelEmpty = false;
    physicsEngine.reset();
    updateDisplays();
    updateProgressBars();
    showStartScreen();
}

function handleNextLevel() {
    hidePopups();
    gameState.level++;
    gameState.fuel = 100;
    gameState.temperature = 0;
    gameState.isOverheated = false;
    gameState.isFuelEmpty = false;
    physicsEngine.reset();
    updateDisplays();
    updateProgressBars();
    showStartScreen();
}

// Handler de controles do jogador
function handleControl(direction, isPressed) {
    if (gameState.gameStatus !== 'playing') return;
    physicsEngine.setInput(direction, isPressed);
}

// Configura os event listeners
function setupEventListeners() {
    elements.startButton.addEventListener('click', handleStart);
    elements.restartButton.addEventListener('click', handleRestart);
    elements.nextLevelButton.addEventListener('click', handleNextLevel);

    Object.values(controls).forEach(dir => {
        const btn = document.getElementById(`${dir}Button`);
        btn.addEventListener('mousedown', () => handleControl(dir, true));
        btn.addEventListener('mouseup', () => handleControl(dir, false));
        btn.addEventListener('mouseleave', () => handleControl(dir, false));
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleControl(dir, true); });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); handleControl(dir, false); });
    });

    const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    document.addEventListener('keydown', (e) => {
        if (keyMap[e.key]) { e.preventDefault(); handleControl(keyMap[e.key], true); }
    });
    document.addEventListener('keyup', (e) => {
        if (keyMap[e.key]) { e.preventDefault(); handleControl(keyMap[e.key], false); }
    });

    document.addEventListener('gameEvent', (e) => onGameEvent(e.detail));

    // Game loop para UI (temperatura, etc)
    setInterval(updateUIState, 100);
}

function updateUIState() {
    if (gameState.gameStatus === 'playing' && !physicsEngine.keyMap['up'] && !physicsEngine.keyMap['down']) {
        gameState.temperature = Math.max(0, gameState.temperature - 0.5);
    }
    if (gameState.temperature > 80 && !gameState.isOverheated) {
        gameState.isOverheated = true;
        elements.overheatAlert.style.display = 'block';
    } else if (gameState.temperature <= 80 && gameState.isOverheated) {
        gameState.isOverheated = false;
        elements.overheatAlert.style.display = 'none';
    }
    updateProgressBars();
}

// Handler para eventos vindos do motor de física
function onGameEvent(event) {
    switch (event.type) {
        case 'explosion':
            showExplosion(event.position);
            break;
        case 'level-win':
            showWinOverlay();
            break;
        case 'death-reset':
            hidePopups();
            gameState.deaths++;
            gameState.fuel = 100;
            gameState.temperature = 0;
            physicsEngine.reset();
            updateDisplays();
            updateProgressBars();
            showStartScreen();
            break;
        case 'fuel-empty':
            showFuelEmptyPopup();
            break;
        case 'control-active':
            gameState.fuel = Math.max(0, gameState.fuel - 0.1);
            gameState.temperature = Math.min(100, gameState.temperature + 0.2);
            if(gameState.fuel <= 0 && !gameState.isFuelEmpty) onGameEvent({type: 'fuel-empty'});
            break;
    }
}

// Função para mostrar efeito de explosão
function showExplosion(position) {
    const explosion = document.createElement('div');
    Object.assign(explosion.style, {
        position: 'absolute',
        left: `${position.x}px`, top: `${position.y}px`,
        width: '50px', height: '50px',
        background: 'radial-gradient(circle, #ffaa00, #ff4444, transparent)',
        borderRadius: '50%', transform: 'translate(-50%, -50%)',
        pointerEvents: 'none', zIndex: '999',
        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out'
    });
    elements.gameArea.appendChild(explosion);
    setTimeout(() => {
        explosion.style.transform = 'translate(-50%, -50%) scale(3)';
        explosion.style.opacity = '0';
        setTimeout(() => explosion.remove(), 500);
    }, 10);
}

// Inicia o jogo
document.addEventListener('DOMContentLoaded', () => {
    setupHeaderListeners();
    initGame();
});

