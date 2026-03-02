import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebaseConfig';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import DashboardScreen from './screens/DashboardScreen';
import DueDateCalculatorScreen from './screens/DueDateCalculatorScreen';

type AppScreen = 'dashboard' | 'dueDateCalculator';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appScreen, setAppScreen] = useState<AppScreen>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (resolvedUser) => {
      setUser(resolvedUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return null;
  }

  if (user) {
    if (appScreen === 'dueDateCalculator') {
      return <DueDateCalculatorScreen onBack={() => setAppScreen('dashboard')} />;
    }
    return <DashboardScreen onNavigate={(screen) => setAppScreen(screen)} />;
  }

  if (showSignUp) {
    return <SignUpScreen onSwitch={() => setShowSignUp(false)} />;
  }

  return <LoginScreen onSwitch={() => setShowSignUp(true)} />;
}