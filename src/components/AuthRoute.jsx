import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

// 1. PROTECTED ROUTE (Satpam Dashboard)
// Kalau belum login, tendang ke Login. Kalau sudah, silakan masuk.
export const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  
  // Kalau tidak ada user, lempar ke login
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

// 2. PUBLIC ROUTE (Satpam Halaman Login/Register)
// Kalau SUDAH login, dilarang masuk ke halaman Login/Register/Landing (tendang ke Dashboard).
export const PublicRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  // Kalau sudah ada user, lempar ke dashboard
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
};