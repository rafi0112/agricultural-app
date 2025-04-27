// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
// import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyB47OaMfeEJ_qLy17PZGFzbUolQyq5jyvc",
  authDomain: "krishi-connect-255fb.firebaseapp.com",
  projectId: "krishi-connect-255fb",
  storageBucket: "krishi-connect-255fb.firebasestorage.app",
  messagingSenderId: "966110607430",
  appId: "1:966110607430:web:73b7ac48de3fc8299a3247"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Needed for Expo
});

// Initialize Auth with persistence
const auth = getAuth(app);
export const firestore = getFirestore(app);

// Collections
export const productsCol = collection(db, "products");
export const shopsCol = collection(db, "shops");
export const ordersCol = collection(db, "orders");
export const blogsCol = collection(db, "blogs");

export { db, auth };