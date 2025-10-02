// Importa funções de autenticação, motor de física e serviços do Firebase
import {
    checkAuthState
} from './auth-utils.js';
import {
    PhysicsEngine
} from './physics.js';
import {
    db
} from './firebase_config.js'; // Importa o Firestore DB
import {
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


const FUEL_CONSUMPTION_THRUST = 0.01;
const FUEL_CONSUMPTION_TURN = 0.005;
const HEAT_RATE = 0.00001;

// --- LÓGICA DO HEADER ---
function updateHeaderUI(user) {
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement) {
        userNameElement.textContent = user ? (user.username || user.displayName || 'Player') : 'Login';
    }
}

function setupHeaderListeners() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.user-name') || e.target.closest('#account')) {
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

let currentUser = null;

let gameState = {
    level: 1,
    deaths: 0,
    fuel: 100,
    temperature: 0,
    isOverheated: false,
    isFuelEmpty: false,
    gameStatus: 'loading'
};

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
    gameArea: document.getElementById('gameArea'),
    // NOVO: Referência ao contêiner do anúncio mobile
    mobileAdContainer: document.getElementById('ads-mobile-container')
};

let physicsEngine;
let isMobileAdInitialized = false; // Flag para inicializar o anúncio apenas uma vez

// --- FUNÇÃO HELPER PARA VERIFICAR SE É MOBILE ---
const isMobile = () => window.innerWidth < 768;


// --- FUNÇÕES DE DADOS (FIRESTORE) ---
async function saveGameState(options = {}) {
    const {
        isGameOver = false, isNewRun = false
    } = options;
    if (!currentUser) return;

    const gameStateRef = doc(db, "game_state", currentUser.uid);

    try {
        const docSnap = await getDoc(gameStateRef);
        let sessions = docSnap.exists() ? docSnap.data().sessions || [] : [];

        if (isNewRun) {
            sessions.forEach(session => {
                if (session.gameover === false) {
                    session.gameover = true;
                }
            });
        }

        const activeSessionIndex = sessions.findIndex(s => s.gameover === false);

        const sessionData = {
            ...gameState,
            gameover: isGameOver,
            timestamp: new Date(),
            userId: currentUser.uid,
            username: currentUser.username || currentUser.displayName || "Anônimo"
        };

        if (isNewRun || activeSessionIndex === -1) {
            sessions.push(sessionData);
        } else {
            sessions[activeSessionIndex] = sessionData;
        }

        await setDoc(gameStateRef, {
            sessions
        });

    } catch (error) {
        console.error("Erro ao salvar o progresso: ", error);
    }
}

async function loadGameState() {
    if (!currentUser) return;
    const gameStateRef = doc(db, "game_state", currentUser.uid);
    try {
        const docSnap = await getDoc(gameStateRef);
        if (docSnap.exists() && docSnap.data().sessions) {
            const sessions = docSnap.data().sessions;
            const activeSession = sessions.find(s => s.gameover === false);
            if (activeSession) {
                gameState.level = activeSession.level || 1;
                gameState.deaths = activeSession.deaths || 0;
                gameState.fuel = activeSession.fuel !== undefined ? activeSession.fuel : 100;
                gameState.temperature = 0;
                initGame();
                return;
            }
        }
        gameState = {
            level: 1,
            deaths: 0,
            fuel: 100,
            temperature: 0,
            gameStatus: 'ready'
        };
        await saveGameState({
            isGameOver: false,
            isNewRun: true
        });
        initGame();
    } catch (error) {
        console.error("Erro ao carregar o progresso: ", error);
        initGame();
    }
}

async function fetchAndDisplayRanking() {
    // Se for mobile e o anúncio estiver visível, inicializa o AdSense
    if (elements.mobileAdContainer.style.display === 'block') {
        if (!isMobileAdInitialized) {
            try {
                console.log('AdSense .push() chamado para o slot mobile.');
                (adsbygoogle = window.adsbygoogle || []).push({});
                isMobileAdInitialized = true; // Evita múltiplas chamadas
            } catch (e) {
                console.error("Erro ao chamar adsbygoogle.push():", e);
            }
        }
    }
}


// --- LÓGICA DO JOGO ---

function initGame() {
    physicsEngine = new PhysicsEngine(elements.gameCanvas, gameState);
    physicsEngine.init();
    updateDisplays();
    updateProgressBars();
    setupEventListeners();
    showStartScreen();
}

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

async function showFuelEmptyPopup() {
    elements.finalStage.textContent = gameState.level;
    elements.finalDeaths.textContent = gameState.deaths;
    elements.fuelEmptyPopup.style.display = 'flex';
    gameState.isFuelEmpty = true;
    gameState.gameStatus = 'paused';
    physicsEngine.stop();
    await saveGameState({
        isGameOver: true
    });
    // ... (código restante)
}

function showWinOverlay() {
    elements.winOverlay.style.display = 'flex';
    gameState.gameStatus = 'paused';
    physicsEngine.stop();
    saveGameState({
        isGameOver: false
    });
    elements.mobileAdContainer.style.display = 'block'; // Mostra container do anúncio
    fetchAndDisplayRanking();
}

function handleStart() {
    hidePopups();
    // Oculta o container do anúncio ao iniciar o jogo
    if (elements.mobileAdContainer) {
        elements.mobileAdContainer.style.display = 'none';
    }
    gameState.gameStatus = 'playing';
    physicsEngine.start();
}

function handleRestart() {
    hidePopups();
    gameState = {
        level: 1,
        deaths: 0,
        fuel: 100,
        temperature: 0
    };
    physicsEngine.reset();
    updateDisplays();
    updateProgressBars(); 
    
    saveGameState({
        isGameOver: false,
        isNewRun: true
    });
    window.location = 'index.html'
}

// AJUSTADO: Agora lida com o anúncio mobile
function handleNextLevel() {
    hidePopups();
    gameState.level++;
    gameState.temperature = 0;
    physicsEngine.reset();
    updateDisplays();
    updateProgressBars();
    
    showStartScreen(); // Mostra a tela de início (que agora contém o anúncio)

    saveGameState(false);
}

function handleControl(direction, isPressed) {
    if (gameState.gameStatus !== 'playing') return;
    physicsEngine.setInput(direction, isPressed);
}

function setupEventListeners() {
    elements.startButton.addEventListener('click', handleStart);
    elements.restartButton.addEventListener('click', handleRestart);
    elements.nextLevelButton.addEventListener('click', handleNextLevel);
    // ... (código de controles existente sem alterações)
    const controls = {
        left: 'left',
        right: 'right',
        up: 'up',
        down: 'down'
    };
    Object.values(controls).forEach(dir => {
        const btn = document.getElementById(`${dir}Button`);
        btn.addEventListener('mousedown', () => handleControl(dir, true));
        btn.addEventListener('mouseup', () => handleControl(dir, false));
        btn.addEventListener('mouseleave', () => handleControl(dir, false));
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleControl(dir, true);
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleControl(dir, false);
        });
    });

    const keyMap = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right'
    };
    document.addEventListener('keydown', (e) => {
        if (keyMap[e.key]) {
            e.preventDefault();
            handleControl(keyMap[e.key], true);
        }
    });
    document.addEventListener('keyup', (e) => {
        if (keyMap[e.key]) {
            e.preventDefault();
            handleControl(keyMap[e.key], false);
        }
    });

    document.addEventListener('gameEvent', (e) => onGameEvent(e.detail));
    setInterval(updateUIState, 100);
}

function updateUIState() {
    // ... (código existente sem alterações)
    if (gameState.gameStatus === 'playing' && !physicsEngine.keyMap['up'] && !physicsEngine.keyMap['down']) {
        gameState.temperature = Math.max(0, gameState.temperature - 0.5);
    }
    if (gameState.temperature >= 100) {
        gameState.isOverheated = true;
    } else if (gameState.temperature <= 20) {
        gameState.isOverheated = false;
    }
    if (gameState.isOverheated) {
        elements.overheatAlert.style.display = 'block';
    } else {
        elements.overheatAlert.style.display = 'none';
    }
    updateProgressBars();
}

function onGameEvent(event) {
    // ... (código existente sem alterações)
    switch (event.type) {
        case 'level-win':
            showWinOverlay();
            break;
        case 'death-reset':
            hidePopups();
            gameState.deaths++;
            gameState.fuel = Math.max(0, gameState.fuel - 5);
            gameState.temperature = 0;

            if (gameState.fuel <= 0) {
                showFuelEmptyPopup();
                return;
            }

            physicsEngine.reset();
            updateDisplays();
            updateProgressBars();
            showStartScreen();
            saveGameState({
                isGameOver: false
            });
            break;
        case 'fuel-empty':
            showFuelEmptyPopup();
            break;
        case 'control-active':
            switch (event.controlType) {
                case 'thrust':
                    gameState.fuel = Math.max(0, gameState.fuel - FUEL_CONSUMPTION_THRUST);
                    break;
                case 'turn':
                    gameState.fuel = Math.max(0, gameState.fuel - FUEL_CONSUMPTION_TURN);
                    break;
            }
            gameState.temperature = Math.min(100, gameState.temperature + HEAT_RATE);

            if (gameState.fuel <= 0 && !gameState.isFuelEmpty) {
                onGameEvent({
                    type: 'fuel-empty'
                });
            }
            break;
    }
}

// --- PONTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', () => {
    setupHeaderListeners();
    checkAuthState(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            currentUser = user;
            updateHeaderUI(user);
            loadGameState();
        }
    });
});
