// Importa os serviços já inicializados do arquivo de configuração
import { auth, db, googleProvider } from "./firebase_config.js";

// Importa apenas as funções necessárias do SDK do Firebase (versão 12.3.0)
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// O restante do código de lógica da UI permanece o mesmo...

// Elementos da UI - serão inicializados quando o DOM estiver pronto
let loadingScreen, loginContainer, welcomeContainer, userNameDisplay, logoutButton;

// --- TEMPLATES HTML ---
const loginTemplate = `
    <div id="modal-close">x</div>
    <h1 class="text-2xl font-bold text-center text-gray-800">Login</h1>
    <form id="login-form" class="space-y-4">
        <div>
            <label for="login-email" class="text-sm font-medium text-gray-700">Email</label>
            <input id="login-email" name="email" type="email" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="seu@email.com">
        </div>
        <div>
            <label for="login-password" class="text-sm font-medium text-gray-700">Senha</label>
            <input id="login-password" name="password" type="password" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="********">
        </div>
        <button type="submit" class="w-full px-4 py-2 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-300">Entrar</button>
    </form>
    <div class="relative flex items-center justify-center my-4">
        <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300"></div>
        </div>
        <div class="relative px-2 bg-white text-sm text-gray-500">ou</div>
    </div>
    <button id="google-signin-button" class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-300">
        <svg class="w-5 h-5 mr-2" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A543" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
        Entrar com Google
    </button>
    <p id="auth-error" class="text-sm text-center text-red-500 mt-2 h-4"></p>
    <p class="mt-6 text-sm text-center text-gray-600">
        Não tem uma conta? <a href="#" id="show-register" class="font-medium text-indigo-600 hover:underline">Cadastre-se</a>
    </p>
`;

const registerTemplate = `
    <div id="modal-close">x</div>
    <h1 class="text-2xl font-bold text-center text-gray-800">Cadastro</h1>
    <form id="register-form" class="space-y-4">
        <div>
            <label for="register-name" class="text-sm font-medium text-gray-700">Nome Completo</label>
            <input id="register-name" name="name" type="text" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Seu Nome">
        </div>
        <div>
            <label for="register-email" class="text-sm font-medium text-gray-700">Email</label>
            <input id="register-email" name="email" type="email" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="seu@email.com">
        </div>
        <div>
            <label for="register-password" class="text-sm font-medium text-gray-700">Senha (mín. 6 caracteres)</label>
            <input id="register-password" name="password" type="password" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="********">
        </div>
        <button type="submit" class="w-full px-4 py-2 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-300">Criar Conta</button>
    </form>
    <p id="auth-error" class="text-sm text-center text-red-500 mt-2 h-4"></p>
    <p class="mt-6 text-sm text-center text-gray-600">
        Já tem uma conta? <a href="#" id="show-login" class="font-medium text-indigo-600 hover:underline">Faça o login</a>
    </p>
`;

function showLoginScreen() {
    loginContainer.innerHTML = loginTemplate;
    welcomeContainer.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    loginContainer.classList.remove('hidden');

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('google-signin-button').addEventListener('click', handleGoogleSignIn);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterScreen();
    });
    document.getElementById("modal-close").addEventListener('pointerup', (e) => {
        document.getElementById('profile-stats').style.display = 'none';
        document.getElementById('modal-background').style.display = 'none';
    });
}

function showRegisterScreen() {
    loginContainer.innerHTML = registerTemplate;
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginScreen();
    });
    document.getElementById("modal-close").addEventListener('pointerup', (e) => {
        document.getElementById('profile-stats').style.display = 'none';
        document.getElementById('modal-background').style.display = 'none';
    });
}

function showWelcomeScreen(user) {
    userNameDisplay.textContent = user.displayName || user.email;
    loginContainer.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    welcomeContainer.classList.remove('hidden');
    document.getElementById("modal-close").addEventListener('pointerup', (e) => {
        document.getElementById('profile-stats').style.display = 'none';
        document.getElementById('modal-background').style.display = 'none';
    });
}

function displayError(message) {
    const errorElement = document.getElementById('auth-error');
    if (errorElement) errorElement.textContent = message;
}

async function createUserDocument(user, additionalData) {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
        const { displayName, email } = user;
        await setDoc(userRef, {
            name: displayName,
            email: email,
            createdAt: new Date(),
            ...additionalData
        });
    }
}

const handleLogin = (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    displayError('');
    signInWithEmailAndPassword(auth, email, password).catch(error => {
        let message = "Ocorreu um erro.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = 'Email ou senha inválidos.';
        }
        displayError(message);
    });
};

const handleRegister = async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    displayError('');

    if (password.length < 6) {
        displayError("A senha deve ter no mínimo 6 caracteres.");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await createUserDocument(userCredential.user, { score: 0 });
    } catch (error) {
        let message = "Ocorreu um erro.";
        if (error.code === 'auth/email-already-in-use') {
            message = 'Este email já está em uso.';
        } else if (error.code === 'auth/weak-password') {
            message = 'A senha é muito fraca.';
        }
        displayError(message);
    }
};

const handleGoogleSignIn = () => {
    displayError('');
    signInWithPopup(auth, googleProvider)
        .then(result => {
            createUserDocument(result.user, { score: 0 });
        })
        .catch(error => {
            console.error("Erro com login Google:", error);
            displayError("Não foi possível logar com o Google.");
        });
};

// Initialize authentication persistence
setPersistence(auth, browserLocalPersistence).catch(error => {
    console.error("Erro ao configurar persistência:", error);
});

// Cache management functions
function saveAuthStateToCache(user) {
    if (user) {
        localStorage.setItem('spacescape_user', JSON.stringify({
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            lastLogin: new Date().toISOString()
        }));
    } else {
        localStorage.removeItem('spacescape_user');
    }
}

function getAuthStateFromCache() {
    const cached = localStorage.getItem('spacescape_user');
    return cached ? JSON.parse(cached) : null;
}

function clearAuthCache() {
    localStorage.removeItem('spacescape_user');
}

// Initialize DOM elements and event listeners
function initializeDOM() {
    console.log('Initializing DOM elements...');

    // Keep trying to find elements until they exist
    const findElements = () => {
        loadingScreen = document.getElementById('loading-screen');
        loginContainer = document.getElementById('login-container');
        welcomeContainer = document.getElementById('welcome-container');
        userNameDisplay = document.getElementById('user-name');
        logoutButton = document.getElementById('logout-button');

        if (loadingScreen && loginContainer && welcomeContainer && userNameDisplay) {
            console.log('All DOM elements found, setting up logout button');
            if (logoutButton) {
                logoutButton.addEventListener('click', () => {
                    clearAuthCache();
                    signOut(auth);
                });
            }
            return true;
        }
        return false;
    };

    // Try immediately, then retry a few times
    if (!findElements()) {
        let attempts = 0;
        const retryInterval = setInterval(() => {
            attempts++;
            if (findElements() || attempts >= 10) {
                clearInterval(retryInterval);
                if (attempts >= 10) {
                    console.warn('Could not find all DOM elements after 10 attempts');
                }
            }
        }, 200);
    }
}

onAuthStateChanged(auth, user => {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
    saveAuthStateToCache(user);

    // Wait for DOM elements to be available with timeout
    const waitForDOM = (retryCount = 0) => {
        if (loadingScreen && loginContainer && welcomeContainer && userNameDisplay) {
            console.log('DOM elements found, showing appropriate screen');
            if (user) {
                showWelcomeScreen(user);
                // Dispatch custom event to notify other scripts
                document.dispatchEvent(new CustomEvent('authStateChange', {
                    detail: { user: user }
                }));
            } else {
                showLoginScreen();
                // Dispatch custom event to notify other scripts
                document.dispatchEvent(new CustomEvent('authStateChange', {
                    detail: { user: null }
                }));
            }
        } else if (retryCount < 50) { // Max 5 seconds retry
            // Retry after a short delay
            setTimeout(() => waitForDOM(retryCount + 1), 100);
        } else {
            console.error('DOM elements not found after timeout, forcing login screen');
            // Fallback: force show login screen even if DOM elements are missing
            if (document.getElementById('login-container')) {
                showLoginScreen();
            }
        }
    };

    waitForDOM();
});

// Initialize DOM when components are loaded
document.addEventListener('DOMContentLoaded', () => {
    // Delay initialization to ensure components are loaded
    setTimeout(() => {
        initializeDOM();
        // Force check for auth state after components should be loaded
        if (loadingScreen && loginContainer && welcomeContainer && userNameDisplay) {
            console.log('Components loaded, triggering auth state check');
            // Manually trigger auth state check if needed
        }
    }, 500);
});

// Also listen for component loading events
document.addEventListener('componentsLoaded', () => {
    console.log('Components loaded event received');
    setTimeout(() => {
        initializeDOM();
    }, 100);
});
