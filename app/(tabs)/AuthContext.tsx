import React, { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  // AsyncStorage keys
  const STORAGE_KEYS = {
    USER: '@auth_user',
    USER_DATA: '@auth_user_data',
  };

  // Save user data to AsyncStorage
  const saveUserToStorage = async (user: any, userData: any) => {
    try {
      const userToSave = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        isFarmer: userData?.isFarmer || false,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userToSave));
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      console.log('User data saved to AsyncStorage');
    } catch (error) {
      console.error('Failed to save user to storage:', error);
    }
  };

  // Load user data from AsyncStorage
  const loadUserFromStorage = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      const storedUserData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      
      if (storedUser && storedUserData) {
        const parsedUser = JSON.parse(storedUser);
        const parsedUserData = JSON.parse(storedUserData);
        
        // Only restore if user is a farmer
        if (parsedUser.isFarmer || parsedUserData?.isFarmer) {
          console.log('Restored user from AsyncStorage');
          return { user: parsedUser, userData: parsedUserData };
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to load user from storage:', error);
      return null;
    }
  };

  // Clear user data from AsyncStorage
  const clearUserFromStorage = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      console.log('User data cleared from AsyncStorage');
    } catch (error) {
      console.error('Failed to clear user from storage:', error);
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    const initializeAuth = async () => {
      try {
        // First, try to load user from AsyncStorage for immediate UI update
        const storedData = await loadUserFromStorage();
        if (storedData && isSubscribed) {
          setCurrentUser(storedData.user);
          setLoading(false); // Show UI immediately with stored data
        }

        // Set up Firebase auth state listener
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isSubscribed) return;

          if (firebaseUser) {
            try {
              // Check if the user is a farmer
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists() && userDoc.data()?.isFarmer) {
                const userData = userDoc.data();
                const userWithFarmerFlag = { ...firebaseUser, isFarmer: true };
                
                setCurrentUser(userWithFarmerFlag);
                // Save to AsyncStorage for persistence
                await saveUserToStorage(firebaseUser, userData);
              } else {
                // If not a farmer, log them out automatically
                await signOut(auth);
                setCurrentUser(null);
                await clearUserFromStorage();
              }
            } catch (error) {
              console.error('Error fetching user data:', error);
              setCurrentUser(null);
              await clearUserFromStorage();
            }
          } else {
            // User is signed out of Firebase
            setCurrentUser(null);
            await clearUserFromStorage();
          }
          
          if (!storedData) {
            setLoading(false);
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('Auth initialization error:', error);
        setLoading(false);
      }
    };

    const cleanup = initializeAuth();
    
    return () => {
      isSubscribed = false;
      cleanup.then(unsubscribeFn => {
        if (unsubscribeFn) unsubscribeFn();
      });
    };
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
      
      const userData = userDoc.data();
      const userWithFarmerFlag = { ...user, isFarmer: true };
      
      setCurrentUser(userWithFarmerFlag);
      // Save to AsyncStorage for persistence
      await saveUserToStorage(user, userData);
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
      const userWithFarmerFlag = { ...user, displayName: name, isFarmer: true };
      setCurrentUser(userWithFarmerFlag);
      
      // Save to AsyncStorage for persistence
      await saveUserToStorage({ ...user, displayName: name }, userData);
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
      // Clear AsyncStorage on logout
      await clearUserFromStorage();
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);