// Importações dos módulos do Firebase (versão 12.3.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";

// =================================================================================
// Suas configurações do Firebase. Este é o único lugar para editá-las.
// =================================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBTkb531VznWPdP4-H6koUsaaqfclk4IhE",
    authDomain: "ultimateforce-6dad4.firebaseapp.com",
    projectId: "ultimateforce-6dad4",
    storageBucket: "ultimateforce-6dad4.firebasestorage.app",
    messagingSenderId: "350709553465",
    appId: "1:350709553465:web:627e79ddbfabf8c7df30e8",
    measurementId: "G-QVR6FNGS1W"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa e exporta os serviços do Firebase que serão usados no app
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Inicializa o Analytics com tratamento de erro para não bloquear a aplicação
let analytics;
try {
    analytics = getAnalytics(app);
} catch (error) {
    console.warn("Analytics initialization failed:", error);
    analytics = null; // Define como null se falhar
}

export { auth, db, googleProvider, analytics };
