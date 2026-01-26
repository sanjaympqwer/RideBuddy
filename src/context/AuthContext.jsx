import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase/config';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for redirect result (Google sign-in redirect)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result) {
          const user = result.user;
          // Check if user profile exists, if not create it
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              name: user.displayName || '',
              email: user.email,
              phone: '',
              photoUrl: user.photoURL || '',
              gender: '',
              age: null,
              createdAt: new Date().toISOString()
            });
          }
        }
      })
      .catch((error) => {
        console.error('Redirect result error:', error);
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signup = async (email, password, name, gender, age, phone, profilePicture) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    let photoUrl = user.photoURL || '';
    
    // Upload profile picture if provided
    if (profilePicture) {
      try {
        const storageRef = ref(storage, `profile_pictures/${user.uid}`);
        await uploadBytes(storageRef, profilePicture);
        photoUrl = await getDownloadURL(storageRef);
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        // Continue with signup even if photo upload fails
      }
    }
    
    // Create user profile in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name,
      email,
      phone: phone || '',
      photoUrl,
      gender,
      age,
      createdAt: new Date().toISOString()
    });

    return userCredential;
  };

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async (useRedirect = true) => {
    const provider = new GoogleAuthProvider();
    
    // Use redirect method by default (more reliable, doesn't get blocked)
    // If useRedirect is false, try popup method
    if (useRedirect) {
      // Redirect method - user will be redirected to Google and back
      await signInWithRedirect(auth, provider);
      // Note: User will be redirected, so we don't return here
      // The redirect result is handled in useEffect
      return null;
    } else {
      // Popup method - try popup first, fallback to redirect if blocked
      try {
        const userCredential = await signInWithPopup(auth, provider);
        const user = userCredential.user;

        // Check if user profile exists, if not create it
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', user.uid), {
            name: user.displayName || '',
            email: user.email,
            phone: '',
            photoUrl: user.photoURL || '',
            gender: '',
            age: null,
            createdAt: new Date().toISOString()
          });
        }

        return userCredential;
      } catch (error) {
        // If popup is blocked, fallback to redirect
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
          console.log('Popup blocked, using redirect method instead...');
          await signInWithRedirect(auth, provider);
          return null;
        }
        throw error;
      }
    }
  };

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    loginWithGoogle,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

