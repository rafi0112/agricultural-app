import React, { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { db } from './firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface UserData {
  isFarmer: boolean;
  name: string;
  email: string;
  createdAt: Date;
}

interface AuthContextType {
  currentUser: import('firebase/auth').User & { isFarmer?: boolean } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  login: async () => Promise.reject(),
  register: async () => Promise.reject(),
  logout: async () => Promise.reject(),
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<(import('firebase/auth').User & { isFarmer?: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if the user is a farmer
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data()?.isFarmer) {
          setCurrentUser({ ...user, isFarmer: true });
        } else {
          // If not a farmer, log them out automatically
          await signOut(auth);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Verify the user is a farmer
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || !userDoc.data()?.isFarmer) {
        await signOut(auth);
        throw new Error('Only registered farmers can access this application');
      }
      
      setCurrentUser({ ...user, isFarmer: true });
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string): Promise<void> => {
    setLoading(true);
    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update the user's profile with their name
      await updateProfile(user, { displayName: name });

      // Create user document in Firestore with isFarmer=true
      const userData: UserData = {
        isFarmer: true, // Force all registered users to be farmers
        name,
        email,
        createdAt: new Date(),
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      // Update local state
      setCurrentUser({ ...user, displayName: name, isFarmer: true });
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setCurrentUser(null);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);