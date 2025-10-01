// Importa funções de autenticação, motor de física e serviços do Firebase
import { checkAuthState } from './auth-utils.js';
import { PhysicsEngine } from './physics.js';
import { db } from './firebase_config.js'; // Importa o Firestore DB
import { doc, setDoc, getDoc, collection, getDocs, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


const FUEL_CONSUMPTION_THRUST = 0.1; 
const FUEL_CONSUMPTION_TURN = 0.02;
const HEAT_RATE = 0.5;

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
    gameArea: document.getElementById('gameArea')
};

let physicsEngine;

// --- FUNÇÕES DE DADOS (FIRESTORE) ---

/**
 * Salva o estado do jogo no Firestore.
 * Pode atualizar a sessão ativa, ou finalizar a atual e criar uma nova.
 * @param {object} options - Opções como { isGameOver: boolean, isNewRun: boolean }.
 */
async function saveGameState(options = {}) {
    const { isGameOver = false, isNewRun = false } = options;
    if (!currentUser) return;

    const gameStateRef = doc(db, "game_state", currentUser.uid);

    try {
        const docSnap = await getDoc(gameStateRef);
        let sessions = docSnap.exists() ? docSnap.data().sessions || [] : [];

        // Se for uma nova "run" (ex: reiniciou o jogo), finaliza a sessão ativa anterior.
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

        // Se for uma nova "run" ou se nenhuma sessão ativa for encontrada, cria uma nova.
        if (isNewRun || activeSessionIndex === -1) {
            sessions.push(sessionData);
            console.log("Nova sessão de jogo iniciada:", sessionData);
        } else {
            // Caso contrário, apenas atualiza a sessão ativa existente.
            sessions[activeSessionIndex] = sessionData;
            console.log("Sessão de jogo atualizada:", sessionData);
        }

        await setDoc(gameStateRef, { sessions });

    } catch (error) {
        console.error("Erro ao salvar o progresso: ", error);
    }
}

/**
 * Carrega a sessão ativa (`gameover: false`) do Firestore.
 */
async function loadGameState() {
    if (!currentUser) return;

    const gameStateRef = doc(db, "game_state", currentUser.uid);
    try {
        const docSnap = await getDoc(gameStateRef);
        if (docSnap.exists() && docSnap.data().sessions) {
            const sessions = docSnap.data().sessions;
            const activeSession = sessions.find(s => s.gameover === false);

            if (activeSession) {
                // Carrega o progresso da sessão ativa
                gameState.level = activeSession.level || 1;
                gameState.deaths = activeSession.deaths || 0;
                gameState.fuel = activeSession.fuel !== undefined ? activeSession.fuel : 100;
                gameState.temperature = 0;
                console.log("Sessão ativa carregada:", gameState);
                initGame();
                return;
            }
        }

        // Se não houver sessão ativa, inicia um novo jogo
        console.log("Nenhuma sessão ativa encontrada. Iniciando novo jogo.");
        gameState = { level: 1, deaths: 0, fuel: 100, temperature: 0, gameStatus: 'ready' };
        // Salva a primeira sessão como uma nova "run" ativa
        await saveGameState({ isGameOver: false, isNewRun: true });
        initGame();

    } catch (error) {
        console.error("Erro ao carregar o progresso: ", error);
        initGame(); // Inicia o jogo mesmo se houver erro
    }
}

/**
 * Busca todas as sessões de "game over" e exibe um ranking.
 */
async function fetchAndDisplayRanking() {
    console.log("Buscando o ranking de jogadores...");
    try {
        const querySnapshot = await getDocs(collection(db, "game_state"));
        if (querySnapshot.empty) {
            console.log("Nenhum dado de jogo encontrado.");
            return;
        }

        let allGameOverSessions = [];
        querySnapshot.forEach(doc => {
            const sessions = doc.data().sessions || [];
            const gameOverSessions = sessions.filter(s => s.gameover === true);
            allGameOverSessions.push(...gameOverSessions);
        });

        if (allGameOverSessions.length === 0) {
            console.log("Nenhum registro de 'Game Over' encontrado para o ranking.");
            return;
        }

        // Ordena o ranking
        allGameOverSessions.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;       // Maior level
            if (b.fuel !== a.fuel) return b.fuel - a.fuel;           // Maior fuel
            return a.deaths - b.deaths;                              // Menor deaths
        });

        const ranking = allGameOverSessions.map(s => ({
            username: s.username,
            level: s.level,
            fuel: s.fuel.toFixed(2),
            deaths: s.deaths
        }));

        console.log("--- RANKING GERAL (Melhores Tentativas) ---");
        console.table(ranking);
        console.log("------------------------------------------");

    } catch (error) {
        console.error("Erro ao buscar o ranking:", error);
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

    // Atualiza a sessão ativa, marcando-a como 'game over'.
    await saveGameState({ isGameOver: true });

    fetchAndDisplayRanking(); // Mostra ranking no game over

    // Redireciona para a home após um tempo
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 4000); // Espera 4 segundos antes de redirecionar
}

function showWinOverlay() {
    elements.winOverlay.style.display = 'flex';
    gameState.gameStatus = 'paused';
    physicsEngine.stop();
    // Apenas atualiza a sessão, não a finaliza.
    saveGameState({ isGameOver: false });
    fetchAndDisplayRanking();
}

function handleStart() {
    hidePopups();
    gameState.gameStatus = 'playing';
    physicsEngine.start();
    // O estado já foi salvo como "ativo" ao carregar ou passar de fase
}

function handleRestart() {
    hidePopups();
    gameState = { level: 1, deaths: 0, fuel: 100, temperature: 0 };
    physicsEngine.reset();
    updateDisplays();
    updateProgressBars();
    showStartScreen();
    // Finaliza a run antiga e salva o estado reiniciado como uma nova sessão ativa.
    saveGameState({ isGameOver: false, isNewRun: true });
}

function handleNextLevel() {
    hidePopups();
    gameState.level++;
    gameState.temperature = 0;
    physicsEngine.reset();
    updateDisplays();
    updateProgressBars();
    showStartScreen();
    saveGameState(false); // Salva o início da nova fase como a sessão ativa
}

function handleControl(direction, isPressed) {
    if (gameState.gameStatus !== 'playing') return;
    physicsEngine.setInput(direction, isPressed);
}

function setupEventListeners() {
    elements.startButton.addEventListener('click', handleStart);
    elements.restartButton.addEventListener('click', handleRestart);
    elements.nextLevelButton.addEventListener('click', handleNextLevel);

    const controls = { left: 'left', right: 'right', up: 'up', down: 'down' };
    Object.values(controls).forEach(dir => {
        const btn = document.getElementById(`${dir}Button`);
        btn.addEventListener('mousedown', () => handleControl(dir, true));
        btn.addEventListener('mouseup', () => handleControl(dir, false));
        btn.addEventListener('mouseleave', () => handleControl(dir, false));
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleControl(dir, true); });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); handleControl(dir, false); });
    });

    const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    document.addEventListener('keydown', (e) => { if (keyMap[e.key]) { e.preventDefault(); handleControl(keyMap[e.key], true); } });
    document.addEventListener('keyup', (e) => { if (keyMap[e.key]) { e.preventDefault(); handleControl(keyMap[e.key], false); } });

    document.addEventListener('gameEvent', (e) => onGameEvent(e.detail));
    setInterval(updateUIState, 100);
}

function updateUIState() {
    // Lógica de resfriamento
    if (gameState.gameStatus === 'playing' && !physicsEngine.keyMap['up'] && !physicsEngine.keyMap['down']) {
        gameState.temperature = Math.max(0, gameState.temperature - 0.5);
    }

    // MUDANÇA 1: Lógica de SUPERAAQUECIMENTO
    // Trava o motor ao atingir 100%
    if (gameState.temperature >= 100) {
        gameState.isOverheated = true;
    }
    // Destrava o motor somente ao atingir 20%
    else if (gameState.temperature <= 20) {
        gameState.isOverheated = false;
    }

    // MUDANÇA 2: O alerta visual agora reflete o estado de superaquecimento
    if (gameState.isOverheated) {
        elements.overheatAlert.style.display = 'block';
    } else {
        elements.overheatAlert.style.display = 'none';
    }

    updateProgressBars();
}

// game.js

function onGameEvent(event) {
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
            saveGameState({ isGameOver: false });
            break;
        case 'fuel-empty':
            showFuelEmptyPopup();
            break;
        case 'control-active':
            // MUDANÇA PRINCIPAL: Consumo de combustível diferenciado
            switch (event.controlType) {
                case 'thrust':
                    gameState.fuel = Math.max(0, gameState.fuel - FUEL_CONSUMPTION_THRUST);
                    break;
                case 'turn':
                    gameState.fuel = Math.max(0, gameState.fuel - FUEL_CONSUMPTION_TURN);
                    break;
            }

            // A temperatura ainda aumenta com qualquer controle ativo
            gameState.temperature = Math.min(100, gameState.temperature + HEAT_RATE);

            if (gameState.fuel <= 0 && !gameState.isFuelEmpty) {
                onGameEvent({ type: 'fuel-empty' });
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