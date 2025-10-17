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

// Import internationalization manager
import { i18n } from "./i18n.js";

// O restante do código de lógica da UI permanece o mesmo...

// Elementos da UI - serão inicializados quando o DOM estiver pronto
let loadingScreen, loginContainer, welcomeContainer, userNameDisplay, logoutButton;

// --- TEMPLATE LOADING FUNCTIONS ---
async function loadTemplate(templatePath) {
    try {
        const response = await fetch(templatePath);
        if (!response.ok) {
            throw new Error(`Failed to load template: ${templatePath}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Error loading template ${templatePath}:`, error);
        return '';
    }
}

// Load all templates
let loginTemplate, registerTemplate, createUsernameTemplate, verifyEmailTemplate;

async function loadAllTemplates() {
    try {
        [loginTemplate, registerTemplate, createUsernameTemplate, verifyEmailTemplate] = await Promise.all([
            loadTemplate('./assets/components/login-template.html'),
            loadTemplate('./assets/components/register-template.html'),
            loadTemplate('./assets/components/create-username-template.html'),
            loadTemplate('./assets/components/verify-email-template.html')
        ]);
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}


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

    // CORREÇÃO: Usa o novo método para aplicar as traduções
    i18n.applyCurrentLanguage();

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterScreen();
    });
    document.getElementById('modal-close').addEventListener('pointerup', closeModal);
}

function showRegisterScreen() {
    loginContainer.innerHTML = registerTemplate;

    // CORREÇÃO: Usa o novo método para aplicar as traduções
    i18n.applyCurrentLanguage();

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

    // CORREÇÃO: Usa o novo método para aplicar as traduções
    i18n.applyCurrentLanguage();

    document.getElementById('username-form').addEventListener('submit', (e) => handleCreateUsername(e, user));
    document.getElementById("modal-close").addEventListener('pointerup', closeModal);
}

// NOVA FUNÇÃO: Exibe a tela de verificação
function showVerifyEmailScreen(user) {
    loginContainer.innerHTML = verifyEmailTemplate;
    welcomeContainer.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    loginContainer.classList.remove('hidden');

    // CORREÇÃO: Usa o novo método para aplicar as traduções
    i18n.applyCurrentLanguage();

    document.getElementById('resend-verification-button').addEventListener('click', async () => {
        try {
            await sendEmailVerification(user);
            displayError(i18n.t('email_verification.success.resent'));
        } catch (error) {
            displayError(i18n.t('email_verification.error.resend'));
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
        displayError(i18n.t('username.error.invalid'));
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
            displayError(i18n.t('username.error.generic'));
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
            let message = i18n.t('login.error.generic');
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                message = i18n.t('login.error.invalid_credentials');
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
        displayError(i18n.t('register.error.weak_password'));
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
        let message = i18n.t('register.error.generic');
        if (error.code === 'auth/email-already-in-use') {
            message = i18n.t('register.error.email_in_use');
        } else if (error.code === 'auth/weak-password') {
            message = i18n.t('register.error.weak_password');
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

async function initializeDOM() {
    // Load templates first
    await loadAllTemplates();

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