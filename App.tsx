import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebaseConfig';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import DashboardScreen from './screens/DashboardScreen';
import DueDateCalculatorScreen from './screens/DueDateCalculatorScreen';
import ScoreConverterScreen from './screens/ScoreConverterScreen';
import BellCurveGraphScreen, { GraphParams } from './screens/BellCurveGraphScreen';
import StudentDetailScreen, { StudentRef } from './screens/StudentDetailScreen';
import EvaluationScreen from './screens/EvaluationScreen';

type ScreenName =
  | 'dashboard'
  | 'dueDateCalculator'
  | 'scoreConverter'
  | 'bellCurveGraph'
  | 'studentDetail'
  | 'evaluation'
  | 'evalGraph';

interface NavState {
  screen: ScreenName;
  student?: StudentRef;
  evalId?: string;
  graphParams?: GraphParams;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState<NavState>({ screen: 'dashboard' });

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
    if (nav.screen === 'dueDateCalculator') {
      return <DueDateCalculatorScreen onBack={() => setNav({ screen: 'dashboard' })} />;
    }

    if (nav.screen === 'scoreConverter') {
      return <ScoreConverterScreen onBack={() => setNav({ screen: 'dashboard' })} />;
    }

    if (nav.screen === 'bellCurveGraph') {
      return <BellCurveGraphScreen onBack={() => setNav({ screen: 'dashboard' })} />;
    }

    if (nav.screen === 'studentDetail' && nav.student) {
      const student = nav.student;
      return (
        <StudentDetailScreen
          student={student}
          onBack={() => setNav({ screen: 'dashboard' })}
          onViewEval={(evalId) =>
            setNav({ screen: 'evaluation', student, evalId })
          }
        />
      );
    }

    if (nav.screen === 'evaluation' && nav.student && nav.evalId) {
      const student = nav.student;
      const evalId = nav.evalId;
      const studentName = student.lastName + ', ' + student.firstName;
      return (
        <EvaluationScreen
          studentId={student.id}
          evalId={evalId}
          studentName={studentName}
          onBack={() => setNav({ screen: 'studentDetail', student })}
          onViewGraph={(measures, sName, evalType, evalDate) =>
            setNav({
              screen: 'evalGraph',
              student,
              evalId,
              graphParams: { measures, studentName: sName, evalType, evalDate },
            })
          }
        />
      );
    }

    if (nav.screen === 'evalGraph' && nav.graphParams) {
      const { student, evalId, graphParams } = nav;
      return (
        <BellCurveGraphScreen
          onBack={() => setNav({ screen: 'evaluation', student, evalId })}
          params={graphParams}
        />
      );
    }

    return (
      <DashboardScreen
        onNavigate={(screen) => setNav({ screen })}
        onSelectStudent={(student) => setNav({ screen: 'studentDetail', student })}
      />
    );
  }

  if (showSignUp) {
    return <SignUpScreen onSwitch={() => setShowSignUp(false)} />;
  }

  return <LoginScreen onSwitch={() => setShowSignUp(true)} />;
}
