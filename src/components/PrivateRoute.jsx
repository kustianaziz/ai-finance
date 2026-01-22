import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Tampilkan loading screen kalau status auth belum siap
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Kalau user ada, lanjut ke halaman tujuan. Kalau tidak, tendang ke login.
  return user ? children : <Navigate to="/login" />;
};

export default PrivateRoute;