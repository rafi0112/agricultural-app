import React, { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from 'firebase/auth';

const AuthContext = createContext<{
  currentUser: import('firebase/auth').User | null;
  login: (email: string, password: string) => Promise<import('firebase/auth').UserCredential>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}>({
  currentUser: null,
  login: async () => Promise.reject(),
  register: async () => Promise.reject(),
  logout: async () => Promise.reject(),
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<import('firebase/auth').User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<import('firebase/auth').UserCredential> => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, name: string): Promise<void> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update the user's profile with their name
    await updateProfile(user, { displayName: name });
    setCurrentUser({ ...user, displayName: name }); // Update the local state with the name
  };

  const logout = async () => {
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);