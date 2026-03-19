import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { HomePage } from './pages/HomePage';
import { TimetablePage } from './pages/TimetablePage';
import { SubjectsPage } from './pages/SubjectsPage';
import { StatsPage } from './pages/StatsPage';
import { SettingsPage } from './pages/SettingsPage';

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg dark:bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path d="M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <path d="M8 11h8M8 15h5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

// Inner routes — only rendered after auth is resolved and user is set
function AuthenticatedApp() {
  const { profile, plan, dataLoading } = useApp();
  if (dataLoading) return <LoadingScreen />;
  const hasOnboarded = !!(profile && plan);

  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/home" element={hasOnboarded ? <HomePage /> : <Navigate to="/onboarding" replace />} />
      <Route path="/timetable" element={hasOnboarded ? <TimetablePage /> : <Navigate to="/onboarding" replace />} />
      <Route path="/subjects" element={hasOnboarded ? <SubjectsPage /> : <Navigate to="/onboarding" replace />} />
      <Route path="/stats" element={hasOnboarded ? <StatsPage /> : <Navigate to="/onboarding" replace />} />
      <Route path="/settings" element={hasOnboarded ? <SettingsPage /> : <Navigate to="/onboarding" replace />} />
      <Route path="*" element={<Navigate to={hasOnboarded ? '/home' : '/onboarding'} replace />} />
    </Routes>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppProvider userId={user.id}>
      <AuthenticatedApp />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}
