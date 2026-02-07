import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import LoadingSpinner from "./components/UI/LoadingSpinner";
import TodayPage from "./pages/App/TodayPage";
import HealthPage from "./pages/App/HealthPage";
import FitnessPage from "./pages/App/FitnessPage";
import DietPage from "./pages/App/DietPage";
import ResourcesPage from "./pages/App/ResourcesPage";
import AppShell from "./components/Layout/AppShell";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-neutral-900 to-black">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppContent />
            </ProtectedRoute>
          }
        >
          <Route path="today" element={<TodayPage />} />
          <Route path="calendar" element={<Navigate to="/app/today" replace />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="fitness" element={<FitnessPage />} />
          <Route path="fitness/session/:date" element={<FitnessPage />} />
          <Route path="diet" element={<DietPage />} />
          <Route path="diet/session/:date" element={<DietPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route index element={<Navigate to="/app/today" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/app/today" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
