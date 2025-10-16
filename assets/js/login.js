// Importa os serviços já inicializados do arquivo de configuração
import {
    auth,
    db,
    googleProvider
} from "./firebase_config.js";

// Importa apenas as funções necessárias do SDK do Firebase (versão 12.3.0)
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    setPersistence,
    browserLocalPersistence,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
    doc,
    writeBatch,
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
            <label for="login-password" class="text-sm font-medium text-gray-700">Password</label>
            <input id="login-password" name="password" type="password" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="********">
        </div>
        <button type="submit" class="w-full px-4 py-2 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-300">Enter</button>
    </form>
   <p id="auth-error" class="text-sm text-center text-red-500 mt-2 h-4"></p>
    <p class="mt-6 text-sm text-center text-gray-600">
        Don't have an account? <a href="#" id="show-register" class="font-medium text-indigo-600 hover:underline">Register</a>
    </p>
`;

const registerTemplate = `
    <div id="modal-close" class="close-button">x</div>
    <h1 class="text-2xl font-bold text-center text-gray-800">Register</h1>
    <form id="register-form" class="space-y-4">
        <div>
            <label for="register-name" class="text-sm font-medium text-gray-700">Full Name</label>
            <input id="register-name" name="name" type="text" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Your name">
        </div>
        <div>
            <label for="register-email" class="text-sm font-medium text-gray-700">Email</label>
            <input id="register-email" name="email" type="email" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="seu@email.com">
        </div>
        <div>
            <label for="register-password" class="text-sm font-medium text-gray-700">Password (mín. 6 chars)</label>
            <input id="register-password" name="password" type="password" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="********">
        </div>
        <button type="submit" class="w-full px-4 py-2 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-300">Create account</button>
    </form>
    <p id="auth-error" class="text-sm text-center text-red-500 mt-2 h-4"></p>
    <p class="mt-6 text-sm text-center text-gray-600">
        Already have an account? <a href="#" id="show-login" class="font-medium text-indigo-600 hover:underline">Log in</a>
    </p>
`;

const createUsernameTemplate = `
    <div id="modal-close" class="close-button">x</div>
    <h1 class="text-2xl font-bold text-center text-gray-800">Crie seu Username</h1>
    <p class="text-sm text-center text-gray-600 mb-4">This name will be displayed to other players.</p>
    <form id="username-form" class="space-y-4">
        <div>
            <label for="username-input" class="text-sm font-medium text-gray-700">Username</label>
            <input id="username-input" name="username" type="text" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="SeuUsername123" minlength="3" maxlength="15" pattern="[a-zA-Z0-9_]+">
            <p class="text-xs text-gray-500 mt-1">3-15 characters, only letters, numbers and _.</p>
        </div>
        <button type="submit" class="w-full px-4 py-2 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Salvar e Continuar</button>
    </form>
    <p id="auth-error" class="text-sm text-center text-red-500 mt-2 h-4"></p>
`;

// NOVO: Template para a tela de verificação de e-mail
const verifyEmailTemplate = `
    <div id="modal-close" class="close-button">x</div>
    <h1 class="text-2xl font-bold text-center text-gray-800">Verifique seu E-mail</h1>
    <p class="text-sm text-center text-gray-600 my-4">
        Um link de verificação foi enviado para o seu e-mail. Por favor, verifique sua caixa de entrada (e a pasta de spam) para continuar.
    </p>
    <button id="resend-verification-button" class="w-full px-4 py-2 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors duration-300">Reenviar E-mail</button>
    <p id="auth-error" class="text-sm text-center text-red-500 mt-2 h-4"></p>
    <p class="mt-6 text-sm text-center text-gray-600">
        <a href="#" id="logout-from-verify" class="font-medium text-indigo-600 hover:underline">Logout</a>
    </p>
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
    // document.getElementById('google-signin-button').addEventListener('click', handleGoogleSignIn); // Removido
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

// NOVA FUNÇÃO: Exibe a tela de verificação
function showVerifyEmailScreen(user) {
    loginContainer.innerHTML = verifyEmailTemplate;
    welcomeContainer.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    loginContainer.classList.remove('hidden');

    document.getElementById('resend-verification-button').addEventListener('click', async () => {
        try {
            await sendEmailVerification(user);
            displayError('E-mail de verificação reenviado!');
        } catch (error) {
            displayError('Erro ao reenviar e-mail. Tente mais tarde.');
        }
    });

    document.getElementById('logout-from-verify').addEventListener('click', () => {
        signOut(auth);
    });

    document.getElementById('modal-close').addEventListener('pointerup', closeModal);
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

    const batch = writeBatch(db);
    const userRef = doc(db, "users", user.uid);
    const newUsernameRef = doc(db, "usernames", newUsername);

    try {
        const newUsernameSnap = await getDoc(newUsernameRef);
        if (newUsernameSnap.exists()) {
            throw new Error(`Username '${newUsername}' is already in use.`);
        }

        batch.set(newUsernameRef, {
            uid: user.uid
        });
        batch.update(userRef, {
            username: newUsername
        });

        const userDoc = await getDoc(userRef);
        const oldUsername = userDoc.data()?.username;
        if (oldUsername && oldUsername !== newUsername) {
            batch.delete(doc(db, "usernames", oldUsername));
        }

        await batch.commit();

        const updatedUserDoc = await getDoc(userRef);
        const userData = updatedUserDoc.data();

        if (userData && userData.username) {
            const fullUserProfile = { ...user,
                ...userData
            };
            saveAuthStateToCache(fullUserProfile);
            showWelcomeScreen(user, userData);
            document.dispatchEvent(new CustomEvent('authStateChange', {
                detail: {
                    user: fullUserProfile
                }
            }));
        } else {
            displayError('Erro ao salvar username. Tente novamente.');
        }
    } catch (error) {
        displayError(error.message);
        console.error("Erro ao definir username:", error);
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
        const {
            displayName,
            email
        } = user;
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
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => {
            let message = "Ocorreu um erro.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                message = 'Email/Password invalid.';
            }
            displayError(message);
        });
};

// ATUALIZADO: handleRegister agora envia o e-mail de verificação
const handleRegister = async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    displayError('');

    if (password.length < 6) {
        displayError("password must be at least 6 characters long.");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
            displayName: name
        });
        await createUserDocument(userCredential.user, {
            score: 0
        });

        // Envia o e-mail de verificação
        await sendEmailVerification(userCredential.user);

        // Mostra a tela de verificação
        showVerifyEmailScreen(userCredential.user);

    } catch (error) {
        let message = "An error occurred.";
        if (error.code === 'auth/email-already-in-use') {
            message = 'This email is already in use.';
        } else if (error.code === 'auth/weak-password') {
            message = 'Password weak.';
        }
        displayError(message);
    }
};

const handleGoogleSignIn = () => {
    displayError('');
    signInWithPopup(auth, googleProvider)
        .catch(error => {
            console.error("Erro com login Google:", error);
            displayError("Unable to log in with Google.");
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
            username: userProfile.username,
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
            if (closeButton) closeButton.addEventListener('pointerup', closeModal);
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

// ATUALIZADO: checkUserSetup agora verifica o status do e-mail
async function checkUserSetup(user) {
    if (!user) {
        showLoginScreen();
        document.dispatchEvent(new CustomEvent('authStateChange', {
            detail: {
                user: null
            }
        }));
        return;
    }

    // Recarrega o estado do usuário para obter o status de verificação mais recente
    await user.reload();
    
    // Se o e-mail não foi verificado, mostra a tela de verificação
    if (!user.emailVerified) {
        showVerifyEmailScreen(user);
        return;
    }

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists() && userDoc.data().username) {
        const userData = userDoc.data();
        const fullUserProfile = { ...user,
            ...userData
        };

        saveAuthStateToCache(fullUserProfile);
        showWelcomeScreen(user, userData);
        document.dispatchEvent(new CustomEvent('authStateChange', {
            detail: {
                user: fullUserProfile
            }
        }));
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