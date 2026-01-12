import { useEffect } from 'react'; // 1. Tambah useEffect
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app'; // 2. Tambah Import Capacitor
import AuthProvider, { useAuth } from './context/AuthProvider';

import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import Dashboard from './components/Dashboard';
import AnalyticsPage from './components/AnalyticsPage';
import TransactionsPage from './components/TransactionsPage';
import VoiceSim from './components/VoiceSim';
import ScanSim from './components/ScanSim';
import UpgradePage from './components/UpgradePage'; 
import AdminUsersPage from './components/AdminUsersPage';

// Komponen Satpam (Cek Tiket)
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/" />;
  }
  return children;
};

function App() {
  
  // 3. LOGIKA TOMBOL BACK ANDROID
  useEffect(() => {
    // Fungsi ini akan dijalankan saat aplikasi dibuka
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        // Kalau ada history halaman sebelumnya, mundur satu langkah
        window.history.back();
      } else {
        // Kalau sudah di halaman paling depan (Login/Dashboard), keluar aplikasi
        CapacitorApp.exitApp();
      }
    });
  }, []); // [] artinya cuma dijalankan sekali pas start

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="max-w-[420px] mx-auto bg-white min-h-screen relative shadow-2xl overflow-hidden">
          <Routes>
            {/* Halaman Publik (Bebas Akses) */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Halaman Private (Harus Login) */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
            
            <Route path="/voice" element={<ProtectedRoute><VoiceSim /></ProtectedRoute>} />
            <Route path="/scan" element={<ProtectedRoute><ScanSim /></ProtectedRoute>} />
            
            <Route path="/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />
            
            {/* Catch-all: Kalau nyasar, lempar ke Login */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;