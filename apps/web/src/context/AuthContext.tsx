import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../infrastructure/firebase';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemoUser?: boolean;
}

export type AuthModalMode = 'login' | 'signup' | 'forgot';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  // Auth modal management
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  // Optional local testing switcher
  switchDemoUser: (uid: string, name: string, email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [demoUser, setDemoUser] = useState<UserProfile | null>(() => {
    // Only load saved demo user if explicitly stored in local storage
    const saved = localStorage.getItem('trellis_demo_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        setDemoUser(null);
        localStorage.removeItem('trellis_demo_user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const activeUser = useMemo<UserProfile | null>(() => {
    if (firebaseUser) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        isDemoUser: false,
      };
    }
    return demoUser;
  }, [firebaseUser, demoUser]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.warn('Google sign-in popup failed or was cancelled:', err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.warn('Email sign-in failed:', err);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user && displayName.trim()) {
        await updateProfile(cred.user, {
          displayName: displayName.trim(),
        });
        // Force state update to reflect new display name
        setFirebaseUser({ ...cred.user, displayName: displayName.trim() } as FirebaseUser);
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.warn('Email sign-up failed:', err);
      throw err;
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      console.warn('Password reset failed:', err);
      throw err;
    }
  };

  const signOut = async () => {
    if (firebaseUser) {
      await firebaseSignOut(auth);
    }
    setDemoUser(null);
    localStorage.removeItem('trellis_demo_user');
  };

  const openAuthModal = (mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const switchDemoUser = (uid: string, name: string, email: string) => {
    const profile: UserProfile = {
      uid,
      displayName: name,
      email,
      photoURL: null,
      isDemoUser: true,
    };
    setDemoUser(profile);
    localStorage.setItem('trellis_demo_user', JSON.stringify(profile));
  };

  const getIdToken = async (): Promise<string | null> => {
    if (firebaseUser) {
      return firebaseUser.getIdToken();
    }
    if (demoUser) {
      return `test-token-${demoUser.uid}`;
    }
    return null;
  };

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        signOut,
        getIdToken,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
