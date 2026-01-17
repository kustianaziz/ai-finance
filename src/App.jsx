import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import AuthProvider, { useAuth } from './context/AuthProvider';

// --- IMPORT SEMUA HALAMAN ---
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import Dashboard from './components/Dashboard';

import AnalyticsPage from './components/AnalyticsPage';
import TransactionsPage from './components/TransactionsPage';
import VoiceSim from './components/VoiceSim';
import ScanSim from './components/ScanSim';
import UpgradePage from './components/UpgradePage';
import AdminUsersPage from './components/AdminUsersPage';

import AccountingPage from './components/AccountingPage';
import JournalProcessPage from './components/JournalProcessPage';
import ReportsMenuPage from './components/ReportsMenuPage';
import ProfitLossPage from './components/ProfitLossPage';
import BalanceSheetPage from './components/BalanceSheetPage';
import CashFlowPage from './components/CashFlowPage';
import JournalReportPage from './components/JournalReportPage';
import LedgerPage from './components/LedgerPage';
import ManualInputPage from './components/ManualInputPage';

// Import Halaman Penampung (Biar link kosong gak error)
import NotFoundPage from "./components/NotFoundPage"; 

// --- KOMPONEN SATPAM (ROUTE GUARD) ---

// 1. PROTECTED ROUTE (Satpam Dashboard)
// Hanya boleh masuk kalau SUDAH login. Kalau belum, tendang ke /login.
const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null; // Tunggu loading selesai
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

// 2. PUBLIC ROUTE (Satpam Login/Register)
// Hanya boleh masuk kalau BELUM login. Kalau sudah login, tendang ke /dashboard.
// (Ini yang bikin tombol Back browser gak balik ke login lagi)
const PublicRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
};


// --- LAYOUTS ---

// Layout 1: Full Screen (Landing Page)
const FullLayout = () => {
  return (
    <div className="w-full min-h-screen bg-white">
      <Outlet />
    </div>
  );
};

// Layout 2: Mobile App View (Dashboard dkk)
const AppLayout = () => {
  return (
    <div className="max-w-[420px] mx-auto bg-white min-h-screen relative shadow-2xl overflow-hidden border-x border-gray-100 font-sans">
      <Outlet />
    </div>
  );
};


// --- MAIN APP COMPONENT ---
function App() {

  // LOGIKA TOMBOL BACK ANDROID
  useEffect(() => {
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    });
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
          <Routes>
            
            {/* === GROUP 1: PUBLIC ONLY (Belum Login) === */}
            {/* Pakai PublicRoute biar user login gak bisa akses ini lagi */}
            <Route element={<PublicRoute />}>
                <Route element={<FullLayout />}>
                    <Route path="/" element={<LandingPage />} />
                </Route>
                
                <Route element={<AppLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                </Route>
            </Route>


            {/* === GROUP 2: PROTECTED ONLY (Sudah Login) === */}
            {/* Pakai ProtectedRoute biar user luar gak bisa nyelonong masuk */}
            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/admin" element={<AdminUsersPage />} />
                    
                    {/* Fitur AI */}
                    <Route path="/voice" element={<VoiceSim />} />
                    <Route path="/scan" element={<ScanSim />} />
                    
                    {/* Upgrade */}
                    <Route path="/upgrade" element={<UpgradePage />} />

                    {/* Akuntansi & Laporan */}
                    <Route path="/accounting" element={<AccountingPage />} />
                    <Route path="/journal-process" element={<JournalProcessPage />} />
                    <Route path="/reports-menu" element={<ReportsMenuPage />} />
                    <Route path="/report-profit-loss" element={<ProfitLossPage />} />
                    <Route path="/report-balance-sheet" element={<BalanceSheetPage />} />
                    <Route path="/report-cash-flow" element={<CashFlowPage />} />
                    <Route path="/report-journal" element={<JournalReportPage />} />
                    <Route path="/report-ledger" element={<LedgerPage />} />
                    
                    {/* RUTE SEMENTARA (Fitur yang belum ada filenya) */}
                    {/* Biar tidak error 404 browser, kita arahkan ke halaman 'Coming Soon' */}
                    <Route path="/manual-input" element={<ManualInputPage />} />
                    <Route path="/invoice" element={<NotFoundPage />} />
                    <Route path="/stock" element={<NotFoundPage />} />
                    <Route path="/debt" element={<NotFoundPage />} />
                    <Route path="/employees" element={<NotFoundPage />} />
                    <Route path="/tax" element={<NotFoundPage />} />
                    <Route path="/warehouse" element={<NotFoundPage />} />
                    <Route path="/targets" element={<NotFoundPage />} />
                    <Route path="/members" element={<NotFoundPage />} />
                    <Route path="/dues" element={<NotFoundPage />} />
                    <Route path="/proposals" element={<NotFoundPage />} />
                    <Route path="/programs" element={<NotFoundPage />} />
                    <Route path="/inventory" element={<NotFoundPage />} />
                    <Route path="/goals" element={<NotFoundPage />} />
                    <Route path="/bills" element={<NotFoundPage />} />
                    <Route path="/invest" element={<NotFoundPage />} />
                    <Route path="/budget" element={<NotFoundPage />} />

                </Route>
            </Route>

            {/* === CATCH ALL (404) === */}
            {/* Kalau akses link ngawur, tampilkan Not Found Page, JANGAN Logout */}
            <Route path="*" element={<AppLayout><NotFoundPage /></AppLayout>} />

          </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;