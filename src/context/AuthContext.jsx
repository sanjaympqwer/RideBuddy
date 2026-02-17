import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
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
        // Only create/read Firestore profile after email is verified
        try {
          if (user.emailVerified) {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
              setUserProfile(userDoc.data());
            } else {
              // If profile doesn't exist yet, migrate from pending_users (created at signup)
              const pendingRef = doc(db, 'pending_users', user.uid);
              const pendingDoc = await getDoc(pendingRef);

              const pendingData = pendingDoc.exists() ? pendingDoc.data() : {};
              const newProfile = {
                ...pendingData,
                // email is only written after verification
                email: user.email || '',
                createdAt: pendingData.createdAt || new Date().toISOString(),
              };

              await setDoc(userRef, newProfile, { merge: true });

              if (pendingDoc.exists()) {
                await deleteDoc(pendingRef);
              }

              setUserProfile(newProfile);
            }
          } else {
            setUserProfile(null);
          }
        } catch (e) {
          console.error('[Auth] Failed loading/creating profile:', e);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signup = async (email, password, name, gender, age, phone, profilePicture, idType, idFile) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    let photoUrl = user.photoURL || '';
    let idProofUrl = '';
    
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

    // Upload government ID proof if provided
    if (idFile && idType) {
      try {
        const idRef = ref(storage, `id_proofs/${user.uid}/${idType}_${Date.now()}`);
        await uploadBytes(idRef, idFile);
        idProofUrl = await getDownloadURL(idRef);
      } catch (error) {
        console.error('Error uploading ID proof:', error);
        // Continue with signup even if ID upload fails, but don't mark as verified
      }
    }
    
    // Stage profile data in pending_users (DO NOT store email in Firestore until email is verified)
    await setDoc(doc(db, 'pending_users', user.uid), {
      name,
      phone: phone || '',
      photoUrl,
      gender,
      age,
      idType: idType || null,
      idProofUrl: idProofUrl || '',
      idVerified: false,
      phoneVerified: false,
      createdAt: new Date().toISOString()
    });

    try {
      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}/verify-email`
          : 'https://rider-7ad2b.firebaseapp.com/__/auth/action';
      await sendEmailVerification(user, { url });
    } catch (error) {
      console.error('Error sending email verification:', error);
      // Surface the real error to the UI so setup issues (like unauthorized domain) are visible.
      // Common fix: Firebase Console → Authentication → Settings → Authorized domains → add your domain.
      throw error;
    }

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

