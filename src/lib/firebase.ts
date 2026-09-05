import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged as fbOnAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore,
  doc,
  getDocFromServer,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

// Initialize Firestore with long-polling auto-detection for robust iframe connectivity
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true
  }, databaseId);
} catch {
  // If already initialized, retrieve existing instance
  firestoreInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export const db = firestoreInstance;

// Test Firestore backend connection probe asynchronously without blocking UI
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.info("Firestore connection: Client is operating in offline mode until network backend syncs.");
    }
  }
}
testConnection();

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const code = error?.code || '';
    const isUserCancellation = 
      code === 'auth/user-cancelled' || 
      code === 'auth/popup-closed-by-user' || 
      code === 'auth/cancelled-popup-request';

    if (isUserCancellation) {
      console.info('Google Sign-In dismissed/cancelled by user.');
    } else {
      console.error('Firebase Auth Error:', error);
    }
    throw error;
  }
}

/**
 * Sign out of current session
 */
export async function logOut(): Promise<void> {
  await fbSignOut(auth);
}

/**
 * Retrieve the current ID token for server-side verification
 */
export async function getCurrentUserToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken(false);
  } catch (err) {
    console.error('Failed to get user ID token:', err);
    return null;
  }
}

/**
 * Auth state listener helper
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return fbOnAuthStateChanged(auth, callback);
}
