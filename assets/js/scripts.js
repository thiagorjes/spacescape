// Space Scape - JavaScript functionality
import { isUserLoggedIn, getCurrentUser, checkAuthState } from './auth-utils.js';

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
        console.log("entrou");
        this.setupEventListeners();
        console.log("events");
        this.createStarfield();
        console.log("starfield");
        this.animate();
        console.log("animate");
        this.checkAuthenticationStatus();
        console.log("checkaut");
        this.setupAuthStateListener();
        console.log("auth events");
    }

    setupEventListeners() {
        const launchBtnMobile = document.getElementById('launch-btn-mobile');
        const launchBtnDesktop = document.getElementById('launch-btn-desktop');

        if (launchBtnMobile) {
            launchBtnMobile.addEventListener('click', () => this.handleLaunch('mobile'));
        }

        if (launchBtnDesktop) {
            launchBtnDesktop.addEventListener('click', () => this.handleLaunch('desktop'));
        }

        // Add click listeners for user name and profile icon to open modal
        const userNameElement = document.querySelector('.user-name');
        const profileElement = document.querySelector('.profile');

        if (userNameElement) {
            userNameElement.addEventListener('click', () => this.openProfileModal());
        }

        if (profileElement) {
            profileElement.addEventListener('click', () => this.openProfileModal());
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth < 768;
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
        const rocket = document.getElementById('rocket-mobile');
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
            // Faz o foguete começar a se mover depois das estrelas (delay de 0.2s)
            const rocketDelay = 0.3; // 20% da animação
            const adjustedRocketProgress = Math.max(0, (progress - rocketDelay) / (1 - rocketDelay));

            if (adjustedRocketProgress > 0) {
                // Aplica easing para movimento com inércia (começa lento, acelera)
                const easedProgress = adjustedRocketProgress * adjustedRocketProgress; // Curva quadrática
                const translateY = -easedProgress * window.innerHeight;
                rocket.style.transform = `translateY(${translateY}px)`;
            }

            // Show flame when rocket starts moving
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
        const rocket = document.getElementById('rocket-desktop');
        const flame = rocket ? rocket.querySelector('#flame') : null;
        const button = document.getElementById('launch-btn-desktop');
        const desktopContent = document.querySelector('.desktop-content');

        if (title) {
            const opacity = Math.max(0, 1 - (progress * 2));
            title.style.opacity = opacity;
        }

        if (button) {
            const opacity = Math.max(0, 1 - (progress * 2));
            button.style.opacity = opacity;
        }

        if (rocket) {
            // Faz o foguete começar a se mover depois das estrelas (delay de 0.2s)
            const rocketDelay = 0.3; // 30% da animação
            const adjustedRocketProgress = Math.max(0, (progress - rocketDelay) / (1 - rocketDelay));

            if (adjustedRocketProgress > 0) {
                // Aplica easing para movimento com inércia (começa lento, acelera)
                const easedProgress = adjustedRocketProgress * adjustedRocketProgress; // Curva quadrática
                const translateY = -easedProgress * 1212; // Desktop container height
                rocket.style.transform = `translateY(${translateY}px)`;
            }

            // Show flame when rocket starts moving
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
        }
        else {
            this.isMobile = viewType === 'mobile';
            this.animationInProgress = true;
            this.progress = 0;

            // Add loading state to button
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
        document.getElementById('profile-stats').style.display = 'flex';
        document.getElementById('modal-background').style.display = 'flex';
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
        // Update header with user name
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = user.displayName || user.email;
        }

        // Update button text for logged in users
        this.updateButtonText('Start Game');
    }

    updateUIForLoggedOutUser() {
        // Update header to show login
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = 'Login';
        }

        // Update button text for logged out users
        this.updateButtonText('Identify yourself');
    }

    updateButtonText(text) {
        const mobileButton = document.getElementById('launch-btn-mobile');
        const desktopButton = document.getElementById('launch-btn-desktop');

        if (mobileButton) {
            mobileButton.textContent = text;
        }

        if (desktopButton) {
            desktopButton.textContent = text;
        }
    }

    setupAuthStateListener() {
        // Listen for custom events from the login modal
        document.addEventListener('authStateChange', (event) => {
            const { user } = event.detail;
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

    onAnimationComplete() {
        // Reset button state
        const button = this.isMobile ?
            document.getElementById('launch-btn-mobile') :
            document.getElementById('launch-btn-desktop');

        if (button) {
            button.classList.remove('loading');
            button.textContent = this.loggedIn ? 'Start Game' : 'Identify yourself';
        }

        // Reset flame opacity for external SVG
        const rocket = this.isMobile ?
            document.getElementById('rocket-mobile') :
            document.getElementById('rocket-desktop');

        const flame = rocket ? rocket.querySelector('#flame') : null;

        if (flame) {
            flame.style.opacity = '0';
            flame.classList.remove('flame-flicker');
        }

        // Reset rocket position
        if (rocket) {
            rocket.style.transform = 'translateY(0)';
        }

        // Reset title and button opacity
        const title = this.isMobile ?
            document.querySelector('.game-title') :
            document.querySelector('.game-title-desktop');

        if (title) {
            title.style.opacity = '1';
        }

        if (button) {
            button.style.opacity = '1';
        }

        // Navigate to game.html after animation completes
        window.location.href = 'game.html';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SpaceScape();
});

// Handle window resize
window.addEventListener('resize', () => {
    const spaceScape = window.spaceScapeInstance;
    if (spaceScape) {
        spaceScape.createStarfield();
    }
});
