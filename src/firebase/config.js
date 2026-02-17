import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Firebase Web API key — MUST be from Firebase Console (starts with "AIza"), NOT from Google Cloud Credentials.
// Get it: Firebase Console → Project Settings → General → Your apps → Web app → apiKey
const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';

const firebaseConfig = {
  apiKey: "AIzaSyC-PFIHRg6A0DqaSIRE6tN4ogkU3JQlMt8",
  authDomain: "rider-7ad2b.firebaseapp.com",
  projectId: "rider-7ad2b",
  storageBucket: "rider-7ad2b.firebasestorage.app",
  messagingSenderId: "487231397502",
  appId: "1:487231397502:web:2ae9fbfad38cc193adc22f",
  measurementId: "G-QF911MRZLY"
};

// Firebase Auth only accepts Web API keys that start with "AIza". Keys in "AQ...." format are not supported and cause auth errors.
const isValidFirebaseKey = firebaseConfig.apiKey && firebaseConfig.apiKey.startsWith('AIza');
if (!isValidFirebaseKey) {
  console.error(`
⚠️ Firebase API key is missing or invalid.

Use a key that STARTS WITH "AIza..." (the one that works with Firebase Auth in the browser).

Where to get it:
• Google Cloud Console: https://console.cloud.google.com/apis/credentials
  → Select project "rider-7ad2b" → Under "API keys" use or create a key (it will start with AIza).
• Or Firebase Console → Project settings → Your apps → Web app config. If the apiKey shown is "AQ....", add a NEW web app to get an AIza key.

Then set it:
• Locally: create .env in project root with:  VITE_FIREBASE_API_KEY=AIza...your_key
• On Render: add env var VITE_FIREBASE_API_KEY, then redeploy.
• Restart dev server: npm run dev
`);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

export default app;

