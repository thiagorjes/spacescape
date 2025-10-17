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
            const sessions = doc.data().sessions || [];
            // const userGameOverSessions = sessions.filter(s => s.gameover === true);

            if (sessions.length > 0) {
                const bestSession = sessions.sort((a, b) => {
                    if (b.level !== a.level) return b.level - a.level;
                    return a.deaths - b.deaths;
                })[0];
                allPlayersBestSessions.push(bestSession);
            }
        });

        if (allPlayersBestSessions.length === 0) return [];

        allPlayersBestSessions.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
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
            listItem.className = isPlayer ? 'player-highlight' : '';
            listItem.innerHTML = `
                <span>${index + 1}</span>
                <span>${session.username}</span>
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

        const launchBtnMobile = document.getElementById('launch-btn-mobile');
        const launchBtnDesktop = document.getElementById('launch-btn-desktop');
        if (launchBtnMobile) launchBtnMobile.addEventListener('click', () => this.handleLaunch('mobile'));
        if (launchBtnDesktop) launchBtnDesktop.addEventListener('click', () => this.handleLaunch('desktop'));
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
                button.textContent = i18n.t('home.launching');
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
        if (userNameElement) {
            // Use the username if available, otherwise display name, otherwise email
            const displayName = user.username || user.displayName || user.email;
            userNameElement.textContent = displayName;
        }
        this.updateButtonText(i18n.t('home.start_game'));
    }

    updateUIForLoggedOutUser() {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) userNameElement.textContent = i18n.t('header.login');
        this.updateButtonText(i18n.t('home.identify_yourself'));
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

    onAnimationComplete() {
        window.location.href = 'game.html';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Agora é seguro inicializar a aplicação principal
    window.spaceScapeInstance = new SpaceScape();

    // Espera o gerenciador i18n estar totalmente inicializado (traduções carregadas)
    
});

window.addEventListener('resize', () => {
    if (window.spaceScapeInstance) {
        window.spaceScapeInstance.createStarfield();
    }
});
