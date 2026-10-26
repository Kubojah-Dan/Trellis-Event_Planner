import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
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

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  switchDemoUser: (uid: string, name: string, email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_ACCOUNTS = [
  { uid: 'user-maya', name: 'Maya Lin', email: 'maya@example.com' },
  { uid: 'user-leo', name: 'Leo Rivera', email: 'leo@example.com' },
  { uid: 'user-alex', name: 'Alex Chen', email: 'alex@example.com' },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [demoUser, setDemoUser] = useState<UserProfile | null>(() => {
    // Default to the first demo account if offline/in development
    const saved = localStorage.getItem('trellis_demo_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return {
      uid: DEMO_ACCOUNTS[0]!.uid,
      displayName: DEMO_ACCOUNTS[0]!.name,
      email: DEMO_ACCOUNTS[0]!.email,
      photoURL: null,
      isDemoUser: true,
    };
  });
  const [loading, setLoading] = useState<boolean>(true);

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
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.warn('Google sign-in popup failed or was cancelled:', err);
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
        signOut,
        getIdToken,
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
