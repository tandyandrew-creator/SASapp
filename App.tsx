import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebaseConfig';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return unsubscribe;
  }, []);

  if (user) {
    return null; // We'll replace this with the main app screen soon
  }

  if (showSignUp) {
    return <SignUpScreen onSwitch={() => setShowSignUp(false)} />;
  }

  return <LoginScreen onSwitch={() => setShowSignUp(true)} />;
}