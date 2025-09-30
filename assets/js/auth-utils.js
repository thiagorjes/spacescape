// Authentication utilities for cross-page access
import { auth } from "./firebase_config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

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
    const cachedUser = getAuthStateFromCache();

    if (cachedUser) {
        // Verify with Firebase if needed
        onAuthStateChanged(auth, user => {
            if (user && user.uid === cachedUser.uid) {
                callback(user);
            } else {
                clearAuthCache();
                callback(null);
            }
        });
    } else {
        onAuthStateChanged(auth, user => {
            callback(user);
        });
    }
}

// Export functions for use in other modules
export {
    isUserLoggedIn,
    getCurrentUser,
    clearAuthCache,
    checkAuthState,
    getAuthStateFromCache
};
