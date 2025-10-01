// Importa os serviços já inicializados do arquivo de configuração
import { auth, db } from "./firebase_config.js";

// Importa apenas as funções necessárias do SDK do Firebase (versão 12.3.0)
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// O restante do código de lógica da UI permanece o mesmo...

const loadingScreen = document.getElementById('loading-screen');
const loginPrompt = document.getElementById('login-prompt');
const gameContainer = document.getElementById('game-container');
const welcomeMessage = document.getElementById('welcome-message');
const levelDisplay = document.getElementById('current-level');
const fuelDisplay = document.getElementById('current-fuel');
const deathsDisplay = document.getElementById('current-deaths');
const statusMessage = document.getElementById('status-message');

const simulateLevelEndBtn = document.getElementById('simulate-level-end-btn');
const simulateNoFuelBtn = document.getElementById('simulate-no-fuel-btn');
const saveProgressBtn = document.getElementById('save-progress-btn');
const loadProgressBtn = document.getElementById('load-progress-btn');
const logoutButtonGame = document.getElementById('logout-button-game');

let currentUser = null;
let gameState = { level: 1, fuel: 100, deaths: 0 };

function getDeviceInfo() {
    return {
        hostOrDevice: navigator.userAgent.includes("Mobi") ? "Mobile" : "PC",
        platform: navigator.platform,
        userAgent: navigator.userAgent
    };
}

function updateUI() {
    levelDisplay.textContent = gameState.level;
    fuelDisplay.textContent = `${gameState.fuel}%`;
    deathsDisplay.textContent = gameState.deaths;
}

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `text-center text-sm mt-4 h-5 ${isError ? 'text-red-600' : 'text-green-600'}`;
    setTimeout(() => { statusMessage.textContent = ''; }, 3000);
}

async function saveGameStateToFirestore() {
    if (!currentUser) {
        showStatus("Erro: Usuário não está logado.", true);
        return;
    }
    const gameStateRef = doc(db, "game_state", currentUser.uid);
    const dataToSave = {
        ...gameState,
        lastUpdate: new Date(),
        deviceInfo: getDeviceInfo()
    };
    try {
        await setDoc(gameStateRef, dataToSave, { merge: true });
        showStatus("Progresso salvo com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar dados: ", error);
        showStatus("Falha ao salvar o progresso.", true);
    }
}

async function loadGameStateFromFirestore() {
    if (!currentUser) return;
    const gameStateRef = doc(db, "game_state", currentUser.uid);
    try {
        const docSnap = await getDoc(gameStateRef);
        if (docSnap.exists()) {
            const loadedData = docSnap.data();
            gameState = {
                level: loadedData.level || 1,
                fuel: loadedData.fuel || 100,
                deaths: loadedData.deaths || 0,
            };
            showStatus("Progresso carregado!");
        } else {
            showStatus("Bem-vindo(a)! Iniciando novo jogo.");
            saveGameStateToFirestore(); 
        }
        updateUI();
    } catch (error) {
        console.error("Erro ao carregar dados: ", error);
        showStatus("Falha ao carregar progresso.", true);
    }
}

simulateLevelEndBtn.addEventListener('click', () => {
    gameState.level++;
    gameState.fuel = Math.max(0, gameState.fuel - 15);
    updateUI();
    saveGameStateToFirestore();
});

simulateNoFuelBtn.addEventListener('click', () => {
    gameState.level = 1;
    gameState.fuel = 100;
    gameState.deaths++;
    updateUI();
    saveGameStateToFirestore();
});

saveProgressBtn.addEventListener('click', saveGameStateToFirestore);
loadProgressBtn.addEventListener('click', loadGameStateFromFirestore);
logoutButtonGame.addEventListener('click', () => signOut(auth).catch(console.error));

onAuthStateChanged(auth, user => {
    loadingScreen.classList.add('hidden');
    if (user) {
        currentUser = user;
        welcomeMessage.textContent = `Bem-vindo(a), ${user.displayName || user.email}!`;
        gameContainer.classList.remove('hidden');
        loginPrompt.classList.add('hidden');
        loadGameStateFromFirestore();
    } else {
        currentUser = null;
        gameContainer.classList.add('hidden');
        loginPrompt.classList.remove('hidden');
    }
});
