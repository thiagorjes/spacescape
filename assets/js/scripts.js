// assets/js/scripts.js

import { getCurrentUser, checkAuthState } from './auth-utils.js';
import { db } from './firebase_config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


/**
 * Busca e processa todos os dados de ranking do Firestore.
 * @returns {Promise<Array>} Uma lista ordenada de todas as melhores tentativas dos jogadores.
 */
async function fetchRankingData() {
    try {
        const querySnapshot = await getDocs(collection(db, "game_state"));
        if (querySnapshot.empty) return [];

        let allGameOverSessions = [];
        querySnapshot.forEach(doc => {
            const sessions = doc.data().sessions || [];
            const userGameOverSessions = sessions.filter(s => s.gameover === true);
            
            if (userGameOverSessions.length > 0) {
                const bestSession = userGameOverSessions.sort((a, b) => {
                     if (b.level !== a.level) return b.level - a.level;
                     return a.deaths - b.deaths;
                })[0];
                allGameOverSessions.push(bestSession);
            }
        });

        if (allGameOverSessions.length === 0) return [];
        
        allGameOverSessions.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return a.deaths - b.deaths;
        });
        
        return allGameOverSessions;
    } catch (error) {
        console.error("Erro ao buscar o ranking:", error);
        return [];
    }
}

/**
 * Renderiza o HTML para os painéis de ranking.
 * @param {Array} rankingData - A lista de dados do ranking.
 */
function renderRanking(rankingData) {
    const currentUser = getCurrentUser();
    
    const previewContainer = document.getElementById('desktop-ranking-preview');
    const fullListContainer = document.getElementById('ranking-list');
    const playerRankContainer = document.getElementById('player-rank-container');

    previewContainer.innerHTML = '';
    fullListContainer.innerHTML = '';
    playerRankContainer.innerHTML = '';

    if (rankingData.length === 0) {
        previewContainer.innerHTML = '<h3>Ranking</h3><p>Nenhum dado disponível.</p>';
        return;
    }

    let playerRank = -1;
    let playerBestSession = null;

    if (currentUser) {
        const playerIndex = rankingData.findIndex(s => s.userId === currentUser.uid);
        if (playerIndex !== -1) {
            playerRank = playerIndex + 1;
            playerBestSession = rankingData[playerIndex];
        }
    }

    const top3 = rankingData.slice(0, 3);
    let previewHTML = '<h3>TOP 3</h3><ol>';
    previewHTML += `<li class="ranking-header"><span>#</span><span>Nome</span><span>Fase</span><span>Mortes</span></li>`;
    top3.forEach((session, index) => {
        const isPlayer = currentUser && session.userId === currentUser.uid;
        previewHTML += `<li class="${isPlayer ? 'player-highlight' : ''}">
            <span>${index + 1}</span>
            <span>${session.username}</span>
            <span>${session.level}</span>
            <span>${session.deaths}</span>
        </li>`;
    });
    previewHTML += '</ol>';
    previewContainer.innerHTML = previewHTML;

    const top10 = rankingData.slice(0, 10);
    let fullListHTML = `<li class="ranking-header"><span>#</span><span>Nome</span><span>Fase</span><span>Mortes</span></li>`;
    top10.forEach((session, index) => {
        const isPlayer = currentUser && session.userId === currentUser.uid;
        fullListHTML += `<li class="${isPlayer ? 'player-highlight' : ''}">
            <span>${index + 1}</span>
            <span>${session.username}</span>
            <span>${session.level}</span>
            <span>${session.deaths}</span>
        </li>`;
    });
    fullListContainer.innerHTML = fullListHTML;

    if (playerRank > 10 && playerBestSession) {
        let playerRankHTML = `<li class="player-highlight">
            <span>${playerRank}</span>
            <span>${playerBestSession.username}</span>
            <span>${playerBestSession.level}</span>
            <span>${playerBestSession.deaths}</span>
        </li>`;
        playerRankContainer.innerHTML = playerRankHTML;
    }
}


// --- LÓGICA DA PÁGINA (CLASSE SpaceScape) ---
class SpaceScape {
    constructor() {
        this.isMobile = window.innerWidth < 768;
        this.animationInProgress = false;
        this.stars = [];
        this.animationId = null;
        this.progress = 0;
        this.loggedIn = false;
        this.currentUser = null;

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.createStarfield();
        this.animate();
        this.checkAuthenticationStatus();
        this.setupAuthStateListener();

        const rankingData = await fetchRankingData();
        renderRanking(rankingData);
    }

    setupEventListeners() {
        this.setupLaunchButtonListeners();
        // A função setupHeaderListeners foi mesclada na nova setupRankingModalListeners
        // para centralizar a delegação de eventos.
        this.setupRankingModalListeners();

        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth < 768;
        });
    }

    /**
     * CORREÇÃO: Esta função agora usa delegação de eventos para funcionar com
     * componentes carregados dinamicamente.
     */
    setupRankingModalListeners() {
        const modal = document.getElementById('full-ranking-modal');
        
        // Adiciona um único ouvinte ao 'document' que está sempre presente.
        document.addEventListener('click', (e) => {
            // Verifica se o clique foi no ícone de ranking (ou em um elemento dentro dele)
            if (e.target.closest('#ranking-toggle')) {
                modal.classList.remove('hidden');
            }
            
            // Verifica se o clique foi no preview do ranking no desktop
            if (e.target.closest('#desktop-ranking-preview')) {
                modal.classList.remove('hidden');
            }

            // Verifica se o clique foi no botão de fechar o modal
            if (e.target.closest('#close-ranking-modal')) {
                modal.classList.add('hidden');
            }

            // A lógica anterior de abrir o modal de perfil também pode ser centralizada aqui
            if (e.target.closest('.user-name') || e.target.closest('#account')) {
                this.openProfileModal();
            }
        });
    }

    setupLaunchButtonListeners() {
        const launchBtnMobile = document.getElementById('launch-btn-mobile');
        const launchBtnDesktop = document.getElementById('launch-btn-desktop');
        if (launchBtnMobile) launchBtnMobile.addEventListener('click', () => this.handleLaunch('mobile'));
        if (launchBtnDesktop) launchBtnDesktop.addEventListener('click', () => this.handleLaunch('desktop'));
    }

    createStarfield() {
        const starCount = 100;
        const container = this.isMobile ?
            document.getElementById('starfield-mobile') :
            document.getElementById('starfield-desktop');
        if (!container) return;
        const ctx = container.getContext('2d');
        const rect = container.getBoundingClientRect();
        container.width = rect.width;
        container.height = rect.height;
        this.stars = [];
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * container.width,
                y: Math.random() * container.height,
                speed: Math.random() * 2 + 1,
                opacity: Math.random() * 0.7 + 0.3
            });
        }
        this.drawStars(ctx);
    }

    drawStars(ctx) {
        const container = this.isMobile ?
            document.getElementById('starfield-mobile') :
            document.getElementById('starfield-desktop');
        if (!container) return;
        ctx.clearRect(0, 0, container.width, container.height);
        ctx.fillStyle = 'white';
        this.stars.forEach(star => {
            ctx.globalAlpha = star.opacity;
            if (this.animationInProgress) {
                const progress = Math.min(this.progress / 60, 1);
                const stretchFactor = 1 + (progress * 40);
                const lineLength = star.speed * stretchFactor;
                ctx.beginPath();
                ctx.moveTo(star.x, star.y);
                ctx.lineTo(star.x, star.y - lineLength);
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'white';
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(star.x, star.y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;
    }

    animate() {
        if (this.animationInProgress) this.updateAnimation();
        const container = this.isMobile ?
            document.getElementById('starfield-mobile') :
            document.getElementById('starfield-desktop');
        if (container) {
            const ctx = container.getContext('2d');
            this.updateStars(ctx);
            this.drawStars(ctx);
        }
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateStars(ctx) {
        const container = this.isMobile ?
            document.getElementById('starfield-mobile') :
            document.getElementById('starfield-desktop');
        if (!container) return;
        let speedMultiplier = 1;
        if (this.animationInProgress) {
            const progress = Math.min(this.progress / 60, 1);
            speedMultiplier = 1 + (progress * 20);
        }
        this.stars.forEach(star => {
            star.y += star.speed * speedMultiplier;
            if (star.y > container.height) {
                star.y = 0;
                star.x = Math.random() * container.width;
            }
        });
    }

    updateAnimation() {
        const progress = Math.min(this.progress / 60, 1);
        if (this.isMobile) this.updateMobileAnimation(progress);
        else this.updateDesktopAnimation(progress);
        this.progress++;
        if (progress >= 1) {
            this.animationInProgress = false;
            this.onAnimationComplete();
        }
    }

    updateMobileAnimation(progress) {
        const title = document.querySelector('.game-title');
        const rocket = document.querySelector('.rocket-container .rocket-svg');
        const flame = rocket ? rocket.querySelector('#flame') : null;
        const button = document.getElementById('launch-btn-mobile');
        if (title) title.style.opacity = Math.max(0, 1 - (progress * 2));
        if (button) button.style.opacity = Math.max(0, 1 - (progress * 2));
        if (rocket) {
            const rocketDelay = 0.3;
            const adjustedRocketProgress = Math.max(0, (progress - rocketDelay) / (1 - rocketDelay));
            if (adjustedRocketProgress > 0) rocket.style.transform = `translateY(${-adjustedRocketProgress * adjustedRocketProgress * window.innerHeight}px)`;
            if (flame) {
                flame.style.opacity = '1';
                if (adjustedRocketProgress > 0) flame.classList.add('flame-flicker');
            }
        }
    }

    updateDesktopAnimation(progress) {
        const title = document.querySelector('.game-title-desktop');
        const rocket = document.querySelector('.rocket-container-desktop .rocket-svg');
        const flame = rocket ? rocket.querySelector('#flame') : null;
        const button = document.getElementById('launch-btn-desktop');
        if (title) title.style.opacity = Math.max(0, 1 - (progress * 2));
        if (button) button.style.opacity = Math.max(0, 1 - (progress * 2));
        if (rocket) {
            const rocketDelay = 0.3;
            const adjustedRocketProgress = Math.max(0, (progress - rocketDelay) / (1 - rocketDelay));
            if (adjustedRocketProgress > 0) rocket.style.transform = `translateY(${-adjustedRocketProgress * adjustedRocketProgress * 1212}px)`;
            if (flame) {
                flame.style.opacity = '1';
                if (adjustedRocketProgress > 0) flame.classList.add('flame-flicker');
            }
        }
    }

    handleLaunch(viewType) {
        if (this.animationInProgress) return;
        if (!this.loggedIn) {
            this.openProfileModal();
        } else {
            this.isMobile = viewType === 'mobile';
            this.animationInProgress = true;
            this.progress = 0;
            const button = this.isMobile ? document.getElementById('launch-btn-mobile') : document.getElementById('launch-btn-desktop');
            if (button) {
                button.classList.add('loading');
                button.textContent = 'Launching...';
            }
        }
    }

    openProfileModal() {
        const modalBackground = document.getElementById('modal-background');
        if (modalBackground) modalBackground.style.display = 'flex';
        else console.error('Modal background not found');
    }

    checkAuthenticationStatus() {
        checkAuthState((user) => {
            this.loggedIn = !!user;
            this.currentUser = user;
            if (user) this.updateUIForLoggedInUser(user);
            else this.updateUIForLoggedOutUser();
        });
    }

    updateUIForLoggedInUser(user) {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) userNameElement.textContent = user.username || user.displayName || user.email;
        this.updateButtonText('Start Game');
    }

    updateUIForLoggedOutUser() {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) userNameElement.textContent = 'Login';
        this.updateButtonText('Identify yourself');
    }

    updateButtonText(text) {
        const mobileButton = document.getElementById('launch-btn-mobile');
        const desktopButton = document.getElementById('launch-btn-desktop');
        if (mobileButton) mobileButton.textContent = text;
        if (desktopButton) desktopButton.textContent = text;
    }

    setupAuthStateListener() {
        document.addEventListener('authStateChange', async () => {
            this.checkAuthenticationStatus();
            const rankingData = await fetchRankingData();
            renderRanking(rankingData);
        });
    }

    onAnimationComplete() {
        window.location.href = 'game.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.spaceScapeInstance = new SpaceScape();
});

window.addEventListener('resize', () => {
    if (window.spaceScapeInstance) {
        window.spaceScapeInstance.createStarfield();
    }
});