// Authentication utilities for cross-page access
import { auth, db } from "./firebase_config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


// Cache management functions
function getAuthStateFromCache() {
    const cached = localStorage.getItem('spacescape_user');
    return cached ? JSON.parse(cached) : null;
}

function isUserLoggedIn() {
    const cachedUser = getAuthStateFromCache();
    return cachedUser !== null;
}

function getCurrentUser() {
    return getAuthStateFromCache();
}

function clearAuthCache() {
    localStorage.removeItem('spacescape_user');
}

// Function to check auth state and execute callback
function checkAuthState(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is authenticated, now get profile from Firestore
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                // Combine auth data with firestore data
                const userProfile = { ...user, ...userDoc.data() };
                callback(userProfile);
            } else {
                // No profile doc yet, just return auth user
                callback(user);
            }
        } else {
            // No user, clear cache and callback null
            clearAuthCache();
            callback(null);
        }
    });
}

// Export functions for use in other modules
export {
    isUserLoggedIn,
    getCurrentUser,
    clearAuthCache,
    checkAuthState,
    getAuthStateFromCache
};
