// assets/js/scripts.js

import { getCurrentUser, checkAuthState } from './auth-utils.js';
import { db } from './firebase_config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { i18n } from './i18n.js';


/**
 * Busca e processa todos os dados de ranking do Firestore.
 * @returns {Promise<Array>} Uma lista ordenada de todas as melhores tentativas dos jogadores.
 */
async function fetchRankingData() {
    try {
        const querySnapshot = await getDocs(collection(db, "game_state"));
        if (querySnapshot.empty) return [];

        let allPlayersBestSessions = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            
            // Process PC sessions
            const pcSessions = data.sessions_pc || [];
            if (data.sessions) { // Migration for old data
                data.sessions.forEach(s => {
                    if (s.level > 17) pcSessions.push({ ...s, platform: 'pc' });
                });
            }
            if (pcSessions.length > 0) {
                const bestPcSession = pcSessions.sort((a, b) => b.level - a.level || a.deaths - b.deaths)[0];
                allPlayersBestSessions.push(bestPcSession);
            }

            // Process Mobile sessions
            const mobileSessions = data.sessions_mobile || [];
            if (data.sessions) { // Migration for old data
                data.sessions.forEach(s => {
                    if (s.level <= 17) mobileSessions.push({ ...s, platform: 'mobile' });
                });
            }
            if (mobileSessions.length > 0) {
                const bestMobileSession = mobileSessions.sort((a, b) => b.level - a.level || a.deaths - b.deaths)[0];
                allPlayersBestSessions.push(bestMobileSession);
            }
        });

        if (allPlayersBestSessions.length === 0) return [];

        allPlayersBestSessions.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            if (a.platform === 'mobile' && b.platform !== 'mobile') return -1;
            if (b.platform === 'mobile' && a.platform !== 'mobile') return 1;
            return a.deaths - b.deaths;
        });

        return allPlayersBestSessions;
    } catch (error) {
        console.error("Erro ao buscar o ranking:", error);
        return [];
    }
}


/**
 * Renderiza os dados do ranking nos containers HTML existentes.
 * @param {Array} rankingData - A lista de dados do ranking.
 */
function renderRanking(rankingData) {
    const currentUser = getCurrentUser();

    const loadingScreen = document.getElementById('ranking-loading-screen');
    const rankingContainer = document.getElementById('ranking-container');
    const rankingList = document.getElementById('ranking-list');

    // Esconde a tela de loading e mostra o conteúdo do ranking
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (rankingContainer) rankingContainer.classList.remove('hidden');

    // Limpa o conteúdo existente
    if (rankingList) {
        // Remove itens existentes (exceto header)
        const existingItems = rankingList.querySelectorAll('li:not(.ranking-header)');
        existingItems.forEach(item => item.remove());
    }

    if (rankingData.length === 0) {
        if (rankingList) {
            const noDataItem = document.createElement('li');
            noDataItem.innerHTML = `<p>${i18n.t('ranking.no_data')}</p>`;
            noDataItem.style.textAlign = 'center';
            noDataItem.style.padding = '20px';
            rankingList.appendChild(noDataItem);
        }
        return;
    }

    // Preenche a lista com top 10
    if (rankingList) {
        const top10 = rankingData.slice(0, 10);

        // Adiciona novos itens
        top10.forEach((session, index) => {
            const isPlayer = currentUser && session.userId === currentUser.uid;
            const listItem = document.createElement('li');
            const platformIcon = session.platform === 'mobile' ? '📱' : '💻';
            listItem.className = isPlayer ? 'player-highlight' : '';
            listItem.innerHTML = `
                <span>${index + 1}</span>
                <span>${session.username}</span>
                <span>${platformIcon}</span>
                <span>${session.level}</span>
                <span>${session.deaths}</span>
            `;
            rankingList.appendChild(listItem);
        });
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
        this.isGuestMode = false;
        this.pendingGameMode = null; // Track if user was trying to play ranked mode

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

        // Setup language switcher after components are loaded
        this.setupComponentsLoadedListener();
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
        // Adiciona um único ouvinte ao 'document' que está sempre presente.
        document.addEventListener('click', (e) => {
            // Verifica se o clique foi no ícone de ranking
            if (e.target.closest('#ranking-toggle')) {
                this.showRankingModal();
            }

            // Verifica se o clique foi em QUALQUER botão de fechar do modal
            if (e.target.closest('.close-button')) {
                // Encontra o modal pai mais próximo (seja de ranking ou de login)
                const modal = e.target.closest('.ranking-overlay, .modal-overlay');
                // Se encontrar o modal, o esconde
                if (modal) {
                    modal.style.display = 'none';
                }
            }

            // Lógica para abrir o modal de perfil
            if (e.target.closest('.user-name') || e.target.closest('#account')) {
                this.openProfileModal();
            }
        });
    }

    /**
     * Mostra o modal de ranking
     */
    showRankingModal() {
        const modal = document.getElementById('ranking-modal');
        if (modal) {
            modal.style.display = 'flex';
            // Remove hidden class if it exists
            modal.classList.remove('hidden');
        } else {
            console.error('Ranking modal not found');
        }
    }

    /**
     * Esconde o modal de ranking
     */
    hideRankingModal() {
        const modal = document.getElementById('ranking-modal');
        if (modal) {
            modal.style.display = 'none';
            // Add hidden class for consistency
            modal.classList.add('hidden');
        } else {
            console.error('Ranking modal not found');
        }
    }

    setupLaunchButtonListeners() {
        // Mobile buttons
        const casualBtnMobile = document.getElementById('casual-btn-mobile');
        const rankedBtnMobile = document.getElementById('ranked-btn-mobile');

        // Desktop buttons
        const casualBtnDesktop = document.getElementById('casual-btn-desktop');
        const rankedBtnDesktop = document.getElementById('ranked-btn-desktop');

        // Mobile event listeners
        if (casualBtnMobile) casualBtnMobile.addEventListener('click', () => this.handleGameMode('casual', 'mobile'));
        if (rankedBtnMobile) rankedBtnMobile.addEventListener('click', () => this.handleGameMode('ranked', 'mobile'));

        // Desktop event listeners
        if (casualBtnDesktop) casualBtnDesktop.addEventListener('click', () => this.handleGameMode('casual', 'desktop'));
        if (rankedBtnDesktop) rankedBtnDesktop.addEventListener('click', () => this.handleGameMode('ranked', 'desktop'));
    }

    setupLanguageSwitcher() {
        console.log("carregou script de mudar language");
        const langButtons = document.querySelectorAll('.lang-btn');
        console.log(langButtons);
        langButtons.forEach(button => {
            console.log("cada botao");
            button.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("trocou idioma por ");
                const targetLang = e.target.getAttribute('data-lang');
                console.log(targetLang);
                if (targetLang && i18n.setLanguage(targetLang)) {
                    // Update active button
                    langButtons.forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');

                    // After language change, verify user login status and update name display
                    this.checkAuthenticationStatus();
                }
            });
        });
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
        const buttonContainer = document.querySelector('.dual-button-container');
        if (title) title.style.opacity = Math.max(0, 1 - (progress * 2));
        if (buttonContainer) buttonContainer.style.opacity = Math.max(0, 1 - (progress * 2));
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
        const buttonContainer = document.querySelector('.dual-button-container-desktop');
        if (title) title.style.opacity = Math.max(0, 1 - (progress * 2));
        if (buttonContainer) buttonContainer.style.opacity = Math.max(0, 1 - (progress * 2));
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

    handleGameMode(gameMode, viewType) {
        if (this.animationInProgress) return;

        this.isMobile = viewType === 'mobile';

        if (gameMode === 'casual') {
            // Casual mode - start immediately as guest
            this.startGameAsGuest();
        } else if (gameMode === 'ranked') {
            // Ranked mode - require login first
            if (this.loggedIn) {
                // User is already logged in, start the game
                this.startGameAsRanked();
            } else {
                // User needs to login first, store the pending game mode
                this.pendingGameMode = 'ranked';
                this.showLoginModal();
            }
        }
    }

    startGameAsGuest() {
        this.isGuestMode = true;
        this.isMobile = this.isMobile;
        this.animationInProgress = true;
        this.progress = 0;

        const button = this.isMobile ? document.getElementById('casual-btn-mobile') : document.getElementById('casual-btn-desktop');
        if (button) {
            button.classList.add('loading');
            button.textContent = i18n.t('home.launching');
        }

        console.log('Starting game in guest mode - no progress will be saved');
    }

    startGameAsRanked() {
        this.isGuestMode = false;
        this.isMobile = this.isMobile;
        this.animationInProgress = true;
        this.progress = 0;

        const button = this.isMobile ? document.getElementById('ranked-btn-mobile') : document.getElementById('ranked-btn-desktop');
        if (button) {
            button.classList.add('loading');
            button.textContent = i18n.t('home.launching');
        }

        console.log('Starting game in ranked mode - progress will be saved');
    }

    showLoginModal() {
        const modalBackground = document.getElementById('modal-background');
        if (modalBackground) {
            modalBackground.style.display = 'flex';
        } else {
            console.error('Login modal not found');
        }
    }

    handleLaunch(viewType) {
        if (this.animationInProgress) return;

        // Allow game launch for both logged in users and guests
        this.isMobile = viewType === 'mobile';
        this.animationInProgress = true;
        this.progress = 0;

        const button = this.isMobile ? document.getElementById('launch-btn-mobile') : document.getElementById('launch-btn-desktop');
        if (button) {
            button.classList.add('loading');
            button.textContent = i18n.t('home.launching');
        }

        // Set guest mode if user is not logged in
        if (!this.loggedIn) {
            this.setGuestMode();
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
        if (userNameElement) {
            // Use the username if available, otherwise display name, otherwise email
            const displayName = user.username || user.displayName || user.email;
            userNameElement.textContent = displayName;
        }
        this.updateButtonText(i18n.t('home.start_game'));
        this.updateGameModeButtons();
    }

    updateUIForLoggedOutUser() {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) userNameElement.textContent = i18n.t('header.login');
        this.updateButtonText(i18n.t('home.identify_yourself'));
        this.updateGameModeButtons();
    }

    updateGameModeButtons() {
        // Get all game mode buttons
        const casualBtnMobile = document.getElementById('casual-btn-mobile');
        const rankedBtnMobile = document.getElementById('ranked-btn-mobile');
        const casualBtnDesktop = document.getElementById('casual-btn-desktop');
        const rankedBtnDesktop = document.getElementById('ranked-btn-desktop');

        if (this.loggedIn) {
            // User is logged in - show only ranked buttons, hide casual buttons
            if (casualBtnMobile) casualBtnMobile.style.display = 'none';
            if (casualBtnDesktop) casualBtnDesktop.style.display = 'none';
            if (rankedBtnMobile) rankedBtnMobile.style.display = 'block';
            if (rankedBtnDesktop) rankedBtnDesktop.style.display = 'block';
        } else {
            // User is not logged in - show only casual buttons, hide ranked buttons
            if (casualBtnMobile) casualBtnMobile.style.display = 'block';
            if (casualBtnDesktop) casualBtnDesktop.style.display = 'block';
            if (rankedBtnMobile) rankedBtnMobile.style.display = 'none';
            if (rankedBtnDesktop) rankedBtnDesktop.style.display = 'none';
        }
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

            // If user just logged in and was trying to play ranked mode, start the game
            if (this.loggedIn && this.pendingGameMode === 'ranked') {
                this.pendingGameMode = null; // Reset pending mode
                this.startGameAsRanked();
            }
        });
    }

    setupComponentsLoadedListener() {
        // Check if components are already loaded
        if (document.querySelector('.lang-btn')) {
            this.setupLanguageSwitcher();
            this.updateActiveLanguageButton();
            return;
        }

        // Wait for components to be loaded
        document.addEventListener('componentsLoaded', () => {
            this.setupLanguageSwitcher();
            this.updateActiveLanguageButton();
        });
    }

    updateActiveLanguageButton() {
        const currentLang = i18n.getCurrentLanguage();
        const langButtons = document.querySelectorAll('.lang-btn');

        // Remove active class from all buttons
        langButtons.forEach(btn => btn.classList.remove('active'));

        // Add active class to the button that matches current language
        const activeButton = document.querySelector(`[data-lang="${currentLang}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    setGuestMode() {
        this.isGuestMode = true;
        console.log('Guest mode activated - no progress will be saved');
    }

    onAnimationComplete() {
        // Pass guest mode information to the game page
        const gameUrl = new URL('game.html', window.location.origin);
        if (this.isGuestMode) {
            gameUrl.searchParams.set('guest', 'true');
        }
        window.location.href = gameUrl.toString();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Agora é seguro inicializar a aplicação principal
    window.spaceScapeInstance = new SpaceScape();
   
});

window.addEventListener('resize', () => {
    if (window.spaceScapeInstance) {
        window.spaceScapeInstance.createStarfield();
    }
});


if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    console.log('Service Worker registrado:', reg);

    reg.onupdatefound = () => {
      const newWorker = reg.installing;
      newWorker.onstatechange = () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('Nova versão detectada. Atualizando...');
          window.location.reload();
        }
      };
    };
  }).catch(err => {
    console.error('Erro ao registrar Service Worker:', err);
  });
}