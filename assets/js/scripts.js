// ... (início do seu scripts.js)
import { isUserLoggedIn, getCurrentUser, checkAuthState } from './auth-utils.js';
// Importações adicionais do Firestore
import { db } from './firebase_config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


/**
 * Busca todas as sessões de "game over" e exibe um ranking.
 */
async function fetchAndDisplayRanking() {
    console.log("Buscando o ranking de jogadores na página inicial...");
    try {
        const querySnapshot = await getDocs(collection(db, "game_state"));
        if (querySnapshot.empty) {
            console.log("Nenhum dado de jogo encontrado.");
            return;
        }

        let allGameOverSessions = [];
        querySnapshot.forEach(doc => {
            const sessions = doc.data().sessions || [];
            // Filtra apenas as sessões que terminaram em game over
            const gameOverSessions = sessions.filter(s => s.gameover === true);
            allGameOverSessions.push(...gameOverSessions);
        });

        if (allGameOverSessions.length === 0) {
            console.log("Nenhum registro de 'Game Over' encontrado para o ranking.");
            return;
        }
        
        // Ordena o ranking pelos critérios definidos
        allGameOverSessions.sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;       // 1. Maior level
            if (b.fuel !== a.fuel) return b.fuel - a.fuel;           // 2. Maior fuel
            return a.deaths - b.deaths;                              // 3. Menor deaths
        });
        
        // Mapeia para um formato amigável para exibição
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

    init() {
        this.setupEventListeners();
        this.createStarfield();
        this.animate();
        this.checkAuthenticationStatus();
        this.setupAuthStateListener();
        fetchAndDisplayRanking(); // Chama a função de ranking na inicialização
    }

    // ... O RESTANTE DO SEU ARQUIVO scripts.js CONTINUA IGUAL ...
    // ... (Cole todo o restante do seu código original aqui)
    setupEventListeners() {
        // Set up launch button listeners
        this.setupLaunchButtonListeners();

        // Set up header element listeners (for dynamically loaded components)
        this.setupHeaderListeners();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth < 768;
        });
    }

    setupLaunchButtonListeners() {
        const launchBtnMobile = document.getElementById('launch-btn-mobile');
        const launchBtnDesktop = document.getElementById('launch-btn-desktop');

        if (launchBtnMobile) {
            launchBtnMobile.addEventListener('click', () => this.handleLaunch('mobile'));
        }

        if (launchBtnDesktop) {
            launchBtnDesktop.addEventListener('click', () => this.handleLaunch('desktop'));
        }
    }

    setupHeaderListeners() {
        // Try to find and set up header elements immediately
        this.attachHeaderEventListeners();

        // Also set up event delegation for dynamically loaded elements
        document.addEventListener('click', (e) => {
            if (e.target.closest('.user-name') || e.target.closest('.profile')) {
                this.openProfileModal();
            }
        });

        // Listen for components being loaded and reattach listeners
        document.addEventListener('componentsLoaded', () => {
            this.attachHeaderEventListeners();
        });
    }

    attachHeaderEventListeners() {
        // Add click listeners for user name and profile icon to open modal
        const userNameElement = document.querySelector('.user-name');
        const profileElement = document.querySelector('.profile');

        if (userNameElement) {
            userNameElement.addEventListener('click', () => this.openProfileModal());
        }

        if (profileElement) {
            profileElement.addEventListener('click', () => this.openProfileModal());
        }
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

            // Se a animação estiver em progresso, desenha as estrelas como linhas esticadas
            if (this.animationInProgress) {
                const progress = Math.min(this.progress / 60, 1);
                const stretchFactor = 1 + (progress * 40); // Multiplicador de estiramento
                const lineLength = star.speed * stretchFactor;

                // Desenha como linha vertical (efeito de velocidade)
                ctx.beginPath();
                ctx.moveTo(star.x, star.y);
                ctx.lineTo(star.x, star.y - lineLength);
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'white';
                ctx.stroke();
            } else {
                // Desenha como ponto normal
                ctx.beginPath();
                ctx.arc(star.x, star.y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.globalAlpha = 1;
    }

    animate() {
        if (this.animationInProgress) {
            this.updateAnimation();
        }

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

        // Aumenta a velocidade das estrelas durante a animação
        let speedMultiplier = 1;
        if (this.animationInProgress) {
            const progress = Math.min(this.progress / 60, 1);
            speedMultiplier = 1 + (progress * 20); // Velocidade até 6x maior
        }

        this.stars.forEach(star => {
            star.y += star.speed * speedMultiplier;

            // Reset star position when it goes off screen
            if (star.y > container.height) {
                star.y = 0;
                star.x = Math.random() * container.width;
            }
        });
    }

    updateAnimation() {
        const progress = Math.min(this.progress / 60, 1); // 60 FPS for 1 second

        if (this.isMobile) {
            this.updateMobileAnimation(progress);
        } else {
            this.updateDesktopAnimation(progress);
        }

        this.progress++;

        // Animation complete
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

        if (title) {
            const opacity = Math.max(0, 1 - (progress * 2));
            title.style.opacity = opacity;
        }

        if (button) {
            const opacity = Math.max(0, 1 - (progress * 2));
            button.style.opacity = opacity;
        }

        if (rocket) {
            const rocketDelay = 0.3;
            const adjustedRocketProgress = Math.max(0, (progress - rocketDelay) / (1 - rocketDelay));

            if (adjustedRocketProgress > 0) {
                const easedProgress = adjustedRocketProgress * adjustedRocketProgress;
                const translateY = -easedProgress * window.innerHeight;
                rocket.style.transform = `translateY(${translateY}px)`;
            }

            if (flame) {
                flame.style.opacity = '1';
                if (adjustedRocketProgress > 0) {
                    flame.classList.add('flame-flicker');
                }
            }
        }
    }

    updateDesktopAnimation(progress) {
        const title = document.querySelector('.game-title-desktop');
        const rocket = document.querySelector('.rocket-container-desktop .rocket-svg');
        const flame = rocket ? rocket.querySelector('#flame') : null;
        const button = document.getElementById('launch-btn-desktop');

        if (title) {
            const opacity = Math.max(0, 1 - (progress * 2));
            title.style.opacity = opacity;
        }

        if (button) {
            const opacity = Math.max(0, 1 - (progress * 2));
            button.style.opacity = opacity;
        }

        if (rocket) {
            const rocketDelay = 0.3;
            const adjustedRocketProgress = Math.max(0, (progress - rocketDelay) / (1 - rocketDelay));

            if (adjustedRocketProgress > 0) {
                const easedProgress = adjustedRocketProgress * adjustedRocketProgress;
                const translateY = -easedProgress * 1212;
                rocket.style.transform = `translateY(${translateY}px)`;
            }

            if (flame) {
                flame.style.opacity = '1';
                if (adjustedRocketProgress > 0) {
                    flame.classList.add('flame-flicker');
                }
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

            const button = this.isMobile ?
                document.getElementById('launch-btn-mobile') :
                document.getElementById('launch-btn-desktop');

            if (button) {
                button.classList.add('loading');
                button.textContent = 'Launching...';
            }
        }
    }

    openProfileModal() {
        const modalBackground = document.getElementById('modal-background');
        if (modalBackground) {
            modalBackground.style.display = 'flex';
        } else {
            console.error('Modal background not found');
        }
    }

    checkAuthenticationStatus() {
        checkAuthState((user) => {
            if (user) {
                this.loggedIn = true;
                this.currentUser = user;
                this.updateUIForLoggedInUser(user);
            } else {
                this.loggedIn = false;
                this.currentUser = null;
                this.updateUIForLoggedOutUser();
            }
        });
    }

    updateUIForLoggedInUser(user) {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = user.username || user.displayName || user.email;
        }
        this.updateButtonText('Start Game');
    }

    updateUIForLoggedOutUser() {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = 'Login';
        }
        this.updateButtonText('Identify yourself');
    }

    updateButtonText(text) {
        const mobileButton = document.getElementById('launch-btn-mobile');
        const desktopButton = document.getElementById('launch-btn-desktop');

        if (mobileButton) mobileButton.textContent = text;
        if (desktopButton) desktopButton.textContent = text;
    }

    setupAuthStateListener() {
        document.addEventListener('authStateChange', () => {
            // Quando o estado de autenticação muda (ex: login, logout, ou criação de username),
            // nós re-executamos a verificação completa para garantir que temos os dados mais recentes.
            this.checkAuthenticationStatus();
        });
    }

    onAnimationComplete() {
        const button = this.isMobile ?
            document.getElementById('launch-btn-mobile') :
            document.getElementById('launch-btn-desktop');

        if (button) {
            button.classList.remove('loading');
            button.textContent = this.loggedIn ? 'Start Game' : 'Identify yourself';
        }

        const rocket = this.isMobile ?
            document.querySelector('.rocket-container .rocket-svg') :
            document.querySelector('.rocket-container-desktop .rocket-svg');

        const flame = rocket ? rocket.querySelector('#flame') : null;
        if (flame) {
            flame.style.opacity = '0';
            flame.classList.remove('flame-flicker');
        }

        if (rocket) rocket.style.transform = 'translateY(0)';

        const title = this.isMobile ?
            document.querySelector('.game-title') :
            document.querySelector('.game-title-desktop');

        if (title) title.style.opacity = '1';
        if (button) button.style.opacity = '1';

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