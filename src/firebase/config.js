import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC4kDiXgczczNztcFiHrK93c32VR9S5TJY",
  authDomain: "rider-7ad2b.firebaseapp.com",
  projectId: "rider-7ad2b",
  storageBucket: "rider-7ad2b.firebasestorage.app",
  messagingSenderId: "487231397502",
  appId: "1:487231397502:web:2e791a9789281dc1adc22f",
  measurementId: "G-4K9H6ZQNTL"
};

// Validate Firebase configuration
const isConfigValid = firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== "YOUR_PROJECT_ID";

if (!isConfigValid) {
  console.error(`
    ⚠️ Firebase Configuration Error!
    
    Please set up your Firebase credentials:
    
    1. Go to: https://console.firebase.google.com/
    2. Create/Select a project
    3. Go to Project Settings > General
    4. Scroll to "Your apps" and click Web icon (</>)
    5. Copy the config values
    
    Then either:
    - Create a .env file with VITE_FIREBASE_* variables, OR
    - Update src/firebase/config.js directly
    
    See FIREBASE_SETUP.md for detailed instructions.
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

