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
import { i18n } from './i18n.js';


const FUEL_CONSUMPTION_THRUST = 0.01;
const FUEL_CONSUMPTION_TURN = 0.005;
const HEAT_RATE = 0.4;
const HEAT_RENEW = 4;
const SHIELD_RECHARGE_LEVEL_INTERVAL = 5;
const SHIELD_RECHARGE_DURATION = 5;


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
            // Check if in guest mode - redirect to login page instead of showing modal
            if (!currentUser) {
                window.location.href = 'index.html';
                return;
            }

            const modal = document.getElementById('modal-background');
            if (modal) modal.style.display = 'flex';
        }
        if (e.target.closest('.home')) {
            // Return to main page (with guest mode if applicable)
            const returnUrl = new URL('index.html', window.location.origin);
            if (!currentUser) {
                returnUrl.searchParams.set('guest', 'true');
            }
            window.location.href = returnUrl.toString();
        }
    });

    document.addEventListener('authStateChange', (e) => {
        updateHeaderUI(e.detail.user);
    });

    // Setup language switcher for game page
    setupLanguageSwitcher();
}

function setupLanguageSwitcher() {
    const langButtons = document.querySelectorAll('.lang-btn');
    langButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetLang = e.target.getAttribute('data-lang');
            if (targetLang && i18n.setLanguage(targetLang)) {
                // Update active button
                langButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                // CORREÇÃO: Força a atualização de todos os textos da UI do jogo
                i18n.applyCurrentLanguage();
                // Atualiza textos que são montados dinamicamente
                showStartScreen();
            }
        });
    });
}
// --- FIM DA LÓGICA DO HEADER ---

let currentUser = null;

let gameState = {
    level: 1,
    deaths: 0,
    fuel: 100,
    temperature: 0,
    shields: 3,
    shieldPercentage: 100,
    isOverheated: false,
    isFuelEmpty: false,
    gameStatus: 'loading',
    isGeneratingPlanets: false,
    rechargeInProgress: false,
    rechargeCountdown: SHIELD_RECHARGE_DURATION
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
    mobileAdContainer: document.getElementById('ads-mobile-container'),
    rechargeCountdown: document.getElementById('rechargeCountdown')
};

let physicsEngine;
let isMobileAdInitialized = false;
let loadingTimeout;

// --- FUNÇÃO HELPER PARA VERIFICAR SE É MOBILE ---
const isMobile = () => window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);


// --- FUNÇÕES DE DADOS (FIRESTORE) ---
async function saveGameState(options = {}) {
    const {
        isGameOver = false, isNewRun = false
    } = options;

    // Skip saving in guest mode
    if (!currentUser) {
        console.log('Guest mode: Progress not saved');
        return;
    }

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
    // Skip loading in guest mode - start fresh
    if (!currentUser) {
        console.log('Guest mode: Starting with default game state');
        gameState = {
            level: 1,
            deaths: 0,
            fuel: 100,
            temperature: 0,
            shields: 3,
            shieldPercentage: 100,
            rechargeInProgress: false,
            rechargeCountdown: SHIELD_RECHARGE_DURATION
        };
        initGame();
        return;
    }

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
                gameState.shields = activeSession.shields !== undefined ? activeSession.shields : 3;
                gameState.shieldPercentage = activeSession.shieldPercentage !== undefined ? activeSession.shieldPercentage : 100;
                gameState.temperature = 0;
                gameState.gameStatus = 'loading_planets';
                gameState.isGeneratingPlanets = true;
                initGame();
                return;
            }
        }
        gameState = {
            level: 1,
            deaths: 0,
            fuel: 100,
            temperature: 0,
            shields: 3,
            shieldPercentage: 100,
            rechargeInProgress: false,
            rechargeCountdown: SHIELD_RECHARGE_DURATION
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

async function fetchAndDisplayRanking(stage) {
    if (elements.mobileAdContainer.style.display === 'block') {
        document.getElementById('adsterra').style.display = "block";
    }
}


// --- LÓGICA DO JOGO ---

function initGame() {
    physicsEngine = new PhysicsEngine(elements.gameCanvas, gameState, {
        SHIELD_RECHARGE_LEVEL_INTERVAL,
        SHIELD_RECHARGE_DURATION
    });

    setupEventListeners();
    showLoadingPlanetsScreen();

    if (isMobile) {
        physicsEngine.init(10, 30, 20, 10, 100);
    } else {
        physicsEngine.init(30, 90, 200, 18, 150);
    }
    updateDisplays();
    updateProgressBars();

    // CORREÇÃO: Aplica a tradução inicial a todos os elementos da UI
    i18n.applyCurrentLanguage();
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
    if (loadingTimeout) clearTimeout(loadingTimeout);

    // Proposta
    const stageTextTemplate = i18n.t('game.stage'); // Busca o texto modelo, ex: "Fase {{stage}}"
    elements.stageTitle.textContent = stageTextTemplate.replace('{{stage}}', String(gameState.level).padStart(2, '0'));
    elements.startScreen.style.display = 'flex';
    elements.startButton.style.display = 'block';
    gameState.gameStatus = 'ready';
    document.getElementById("restartButton").style.display = 'block';
}

function showLoadingPlanetsScreen() {
    // CORREÇÃO: Garante que o texto de carregamento seja traduzido
    elements.stageTitle.textContent = i18n.t('game.loading_planets');
    elements.startButton.style.display = 'none';
    elements.startScreen.style.display = 'flex';
    gameState.gameStatus = 'loading_planets';
    gameState.isGeneratingPlanets = true;

    if (loadingTimeout) clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
        console.warn("Timeout de carregamento atingido. Forçando exibição da tela de início.");
        if (gameState.gameStatus === 'loading_planets') {
            showStartScreen();
        }
    }, 5000);
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

    // Only save game state if not in guest mode
    if (currentUser) {
        await saveGameState({
            isGameOver: true
        });
    }
}

function showWinOverlay(level) {
    elements.winOverlay.style.display = 'flex';
    gameState.gameStatus = 'paused';
    physicsEngine.stop();

    // Only save game state if not in guest mode
    if (currentUser) {
        saveGameState({
            isGameOver: false
        });
    }

    elements.mobileAdContainer.style.display = 'block';
    fetchAndDisplayRanking(level);
}

function handleStart() {
    hidePopups();
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
        temperature: 0,
        shields: 3,
        shieldPercentage: 100,
        rechargeInProgress: false,
        rechargeCountdown: SHIELD_RECHARGE_DURATION
    };
    physicsEngine.reset();
    updateDisplays();
    updateProgressBars();

    // Only save game state if not in guest mode
    if (currentUser) {
        saveGameState({
            isGameOver: false,
            isNewRun: true
        });
    }

    // Return to main page (with guest mode if applicable)
    const returnUrl = new URL('index.html', window.location.origin);
    if (!currentUser) {
        returnUrl.searchParams.set('guest', 'true');
    }
    window.location.href = returnUrl.toString();
}

function handleNextLevel() {
    hidePopups();
    gameState.level++;
    gameState.temperature = 0;

    showLoadingPlanetsScreen();
    physicsEngine.reset();

    updateDisplays();
    updateProgressBars();

    // Only save game state if not in guest mode
    if (currentUser) {
        saveGameState(false);
    }
}

function handleControl(direction, isPressed) {
    if (gameState.gameStatus !== 'playing') return;
    physicsEngine.setInput(direction, isPressed);
}

function setupEventListeners() {
    elements.startButton.addEventListener('click', handleStart);
    elements.restartButton.addEventListener('click', handleRestart);
    elements.nextLevelButton.addEventListener('click', handleNextLevel);
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
    if (gameState.gameStatus === 'playing' && !physicsEngine.keyMap['up'] && !physicsEngine.keyMap['down']) {
        gameState.temperature = Math.max(0, gameState.temperature - HEAT_RENEW);
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
    switch (event.type) {
        case 'planets-generated':
            gameState.isGeneratingPlanets = false;
            showStartScreen();
            break;
        case 'level-win':
            showWinOverlay(event.level);
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

            showLoadingPlanetsScreen();
            physicsEngine.reset();
            updateDisplays();
            updateProgressBars();

            // Only save game state if not in guest mode
            if (currentUser) {
                saveGameState({
                    isGameOver: false
                });
            }
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
        case 'recharge-started':
            gameState.rechargeInProgress = true;
            elements.rechargeCountdown.style.display = 'block';
            break;
        case 'recharge-progress':
            gameState.rechargeCountdown = event.countdown;
            elements.rechargeCountdown.textContent = Math.ceil(event.countdown);
            break;
        case 'recharge-complete':
            gameState.shields = 3;
            gameState.shieldPercentage = 100;
            // Fall through to cancelled
        case 'recharge-cancelled':
            gameState.rechargeInProgress = false;
            gameState.rechargeCountdown = SHIELD_RECHARGE_DURATION;
            elements.rechargeCountdown.style.display = 'none';
            break;
    }
}

// --- PONTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', () => {
    i18n.ready.then(() => { // Espera o i18n carregar antes de tudo
        setupHeaderListeners();

        // Check if we're in guest mode
        const urlParams = new URLSearchParams(window.location.search);
        const isGuestMode = urlParams.get('guest') === 'true';

        if (isGuestMode) {
            // Run in guest mode - no authentication required
            currentUser = null;
            updateHeaderUI(null);
            initGame();
        } else {
            // Normal authenticated mode
            checkAuthState(user => {
                if (!user) {
                    window.location.href = 'index.html';
                } else {
                    currentUser = user;
                    updateHeaderUI(user);
                    loadGameState();
                }
            });
        }
    });
});