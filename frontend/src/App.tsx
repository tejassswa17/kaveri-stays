import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { PropertiesPage } from './pages/properties/PropertiesPage';
import { PropertyDetailPage } from './pages/properties/PropertyDetailPage';
import { AvailabilityPage } from './pages/availability/AvailabilityPage';
import { BookingsPage } from './pages/bookings/BookingsPage';
import { NewBookingPage } from './pages/bookings/NewBookingPage';
import { BookingDetailPage } from './pages/bookings/BookingDetailPage';
import { GuestsPage } from './pages/guests/GuestsPage';
import { GuestDetailPage } from './pages/guests/GuestDetailPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user?.role === 'guest') {
    return <Navigate to="/properties" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected App Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RootRedirect />} />

              <Route
                path="dashboard"
                element={
                  <ProtectedRoute allowedRoles={['staff', 'manager', 'owner']}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route path="properties" element={<PropertiesPage />} />
              <Route path="properties/:id" element={<PropertyDetailPage />} />

              <Route path="availability" element={<AvailabilityPage />} />

              <Route path="bookings" element={<BookingsPage />} />
              <Route path="bookings/new" element={<NewBookingPage />} />
              <Route path="bookings/:id" element={<BookingDetailPage />} />

              <Route
                path="guests"
                element={
                  <ProtectedRoute allowedRoles={['staff', 'manager', 'owner']}>
                    <GuestsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="guests/:id"
                element={
                  <ProtectedRoute allowedRoles={['staff', 'manager', 'owner']}>
                    <GuestDetailPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="reports"
                element={
                  <ProtectedRoute allowedRoles={['manager', 'owner']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />

              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
