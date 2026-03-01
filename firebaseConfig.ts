import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC3rIL6HBljP3qY0RooLmKFX6YWtqCZdZk",
  authDomain: "psychgraphs-mvp.firebaseapp.com",
  projectId: "psychgraphs-mvp",
  storageBucket: "psychgraphs-mvp.firebasestorage.app",
  messagingSenderId: "904721007763",
  appId: "1:904721007763:web:732e3198688f71f574b966"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);