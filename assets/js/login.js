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
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// O restante do código de lógica da UI permanece o mesmo...

// Elementos da UI - serão inicializados quando o DOM estiver pronto
let loadingScreen, loginContainer, welcomeContainer, userNameDisplay, logoutButton;

// --- TEMPLATES HTML ---
const loginTemplate = `
    <div id="modal-close" class="close-button">x</div>
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
    <div id="modal-close" class="close-button">x</div>
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

const createUsernameTemplate = `
    <div id="modal-close" class="close-button">x</div>
    <h1 class="text-2xl font-bold text-center text-gray-800">Crie seu Username</h1>
    <p class="text-sm text-center text-gray-600 mb-4">Este nome será exibido para outros jogadores.</p>
    <form id="username-form" class="space-y-4">
        <div>
            <label for="username-input" class="text-sm font-medium text-gray-700">Username</label>
            <input id="username-input" name="username" type="text" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="SeuUsername123" minlength="3" maxlength="15" pattern="[a-zA-Z0-9_]+">
            <p class="text-xs text-gray-500 mt-1">3-15 caracteres, apenas letras, números e _.</p>
        </div>
        <button type="submit" class="w-full px-4 py-2 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Salvar e Continuar</button>
    </form>
    <p id="auth-error" class="text-sm text-center text-red-500 mt-2 h-4"></p>
`;

const closeModal = () => {
    const modalBackground = document.getElementById('modal-background');
    if (modalBackground) {
        modalBackground.style.display = 'none';
    }
};

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
    document.getElementById('modal-close').addEventListener('pointerup', closeModal);
}

function showRegisterScreen() {
    loginContainer.innerHTML = registerTemplate;
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginScreen();
    });
    document.getElementById('modal-close').addEventListener('pointerup', closeModal);
}

function showCreateUsernameScreen(user) {
    loginContainer.innerHTML = createUsernameTemplate;
    welcomeContainer.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    loginContainer.classList.remove('hidden');

    document.getElementById('username-form').addEventListener('submit', (e) => handleCreateUsername(e, user));
    document.getElementById("modal-close").addEventListener('pointerup', closeModal);
}


async function handleCreateUsername(e, user) {
    e.preventDefault();
    const usernameInput = e.target.username;
    const newUsername = usernameInput.value.trim();
    displayError('');

    if (!newUsername || newUsername.length < 3 || newUsername.length > 15 || !/^[a-zA-Z0-9_]+$/.test(newUsername)) {
        displayError('Username inválido. Verifique as regras.');
        return;
    }

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", newUsername));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            displayError('Este username já está em uso.');
            return;
        }

        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { username: newUsername }, { merge: true });

        checkUserSetup(user);

    } catch (error) {
        console.error("Erro ao criar username:", error);
        displayError('Não foi possível salvar o username.');
    }
}


function showWelcomeScreen(user, userData) {
    userNameDisplay.textContent = userData.username || user.displayName || user.email;
    loginContainer.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    welcomeContainer.classList.remove('hidden');
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
        try {
            await setDoc(userRef, {
                name: displayName,
                email: email,
                createdAt: new Date(),
                ...additionalData
            });
        } catch (error) {
            console.error("Error creating user document:", error);
        }
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
             // A verificação de username e criação do doc será feita pelo onAuthStateChanged
        })
        .catch(error => {
            console.error("Erro com login Google:", error);
            displayError("Não foi possível logar com o Google.");
        });
};

setPersistence(auth, browserLocalPersistence).catch(error => {
    console.error("Erro ao configurar persistência:", error);
});

function saveAuthStateToCache(userProfile) {
    if (userProfile) {
        localStorage.setItem('spacescape_user', JSON.stringify({
            uid: userProfile.uid,
            displayName: userProfile.displayName,
            email: userProfile.email,
            username: userProfile.username, // Adiciona username ao cache
            lastLogin: new Date().toISOString()
        }));
    } else {
        localStorage.removeItem('spacescape_user');
    }
}

function clearAuthCache() {
    localStorage.removeItem('spacescape_user');
}

function initializeDOM() {
    const findElements = () => {
        loadingScreen = document.getElementById('loading-screen');
        loginContainer = document.getElementById('login-container');
        welcomeContainer = document.getElementById('welcome-container');
        userNameDisplay = welcomeContainer ? welcomeContainer.querySelector('#user-name') : null;
        logoutButton = document.getElementById('logout-button');

        if (loadingScreen && loginContainer && welcomeContainer && userNameDisplay && logoutButton) {
            logoutButton.addEventListener('click', () => {
                clearAuthCache();
                signOut(auth);
            });
            const closeButton = welcomeContainer.querySelector('#modal-close');
            if(closeButton) closeButton.addEventListener('pointerup', closeModal);
            return true;
        }
        return false;
    };

    if (!findElements()) {
        let attempts = 0;
        const retryInterval = setInterval(() => {
            attempts++;
            if (findElements() || attempts >= 10) {
                clearInterval(retryInterval);
                if (attempts >= 10) console.warn('Could not find all DOM elements for login modal');
            }
        }, 200);
    }
}

async function checkUserSetup(user) {
    if (!user) {
        showLoginScreen();
        document.dispatchEvent(new CustomEvent('authStateChange', { detail: { user: null } }));
        return;
    }

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists() && userDoc.data().username) {
        const userData = userDoc.data();
        const fullUserProfile = { ...user, ...userData };

        saveAuthStateToCache(fullUserProfile);
        showWelcomeScreen(user, userData);
        document.dispatchEvent(new CustomEvent('authStateChange', { detail: { user: fullUserProfile } }));
    } else {
        if (!userDoc.exists()) {
            await createUserDocument(user);
        }
        showCreateUsernameScreen(user);
    }
}


onAuthStateChanged(auth, user => {
    const waitForDOM = (retryCount = 0) => {
        if (loadingScreen && loginContainer && welcomeContainer) {
             checkUserSetup(user);
        } else if (retryCount < 50) {
            setTimeout(() => waitForDOM(retryCount + 1), 100);
        } else {
            console.error('Login modal DOM elements not found after timeout.');
        }
    };
    waitForDOM();
});

document.addEventListener('DOMContentLoaded', initializeDOM);
document.addEventListener('componentsLoaded', initializeDOM);
