import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { useToastContext } from './context/useToastContext';
import { ApiHealthProvider } from './context/ApiHealthContext';
import { ToastContainer } from './components/ToastContainer';
import Home from './pages/Home';
import ListDetail from './pages/ListDetail';
import SharedList from './pages/SharedList';
import Login from './pages/Login';
import Register from './pages/Register';
import './index.css';

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="page page-center">
        <div className="loading">{t('common.loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// App routes
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lists/:id"
        element={
          <ProtectedRoute>
            <ListDetail />
          </ProtectedRoute>
        }
      />
      <Route path="/shared/:shareCode" element={<SharedList />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ToastContainer wrapper to access context
const ToastContainerWrapper: React.FC = () => {
  const { toasts, dismissToast } = useToastContext();
  return <ToastContainer toasts={toasts} dismissToast={dismissToast} />;
};

// Main App component
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <ApiHealthProvider>
              <Suspense fallback={<div className="page page-center"><div className="loading">Loading...</div></div>}>
                <AppRoutes />
              </Suspense>
              <ToastContainerWrapper />
            </ApiHealthProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;