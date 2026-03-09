import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp, useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import LandingPage from './components/LandingPage';
import MainDashboard from './components/MainDashboard';
import AdminPanel from './components/admin/AdminPanel';
import AuthSync from './components/auth/AuthSync';

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [isRoleLoading, setIsRoleLoading] = useState(requireAdmin);
  const [hasAdminAccess, setHasAdminAccess] = useState(!requireAdmin);

  useEffect(() => {
    if (!requireAdmin) {
      setHasAdminAccess(true);
      setIsRoleLoading(false);
      return;
    }

    if (!isLoaded || !isSignedIn) {
      return;
    }

    const loadRole = async () => {
      try {
        const token = await getToken();
        const response = await fetch('/api/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setHasAdminAccess(false);
          return;
        }

        const payload = await response.json();
        const role = payload?.profile?.role;
        setHasAdminAccess(role === 'admin' || role === 'owner');
      } catch {
        setHasAdminAccess(false);
      } finally {
        setIsRoleLoading(false);
      }
    };

    loadRole();
  }, [getToken, isLoaded, isSignedIn, requireAdmin]);

  if (!isLoaded) {
    return (
      <div className="h-screen w-screen bg-[#0A0E14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && isRoleLoading) {
    return (
      <div className="h-screen w-screen bg-[#0A0E14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (requireAdmin && !hasAdminAccess) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthSync />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/sign-in/*"
          element={
            <div className="min-h-screen bg-[#0A0E14] flex items-center justify-center p-6">
              <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/app" />
            </div>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <div className="min-h-screen bg-[#0A0E14] flex items-center justify-center p-6">
              <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/app" />
            </div>
          }
        />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <MainDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        {/* Redirect old dashboard path if exists or default to landing */}
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
