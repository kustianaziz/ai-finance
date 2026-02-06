import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import AuthProvider, { useAuth } from './context/AuthProvider';

// ... (IMPORT SEMUA HALAMAN TETAP SAMA) ...
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
// ... (Import Akuntansi dll tetap sama) ...
import AccountingPage from './components/AccountingPage';
import JournalProcessPage from './components/JournalProcessPage';
import ReportsMenuPage from './components/ReportsMenuPage';
import ProfitLossPage from './components/ProfitLossPage';
import BalanceSheetPage from './components/BalanceSheetPage';
import CashFlowPage from './components/CashFlowPage';
import JournalReportPage from './components/JournalReportPage';
import LedgerPage from './components/LedgerPage';
import ManualInputPage from './components/ManualInputPage';
import BudgetPage from './pages/BudgetPage';
import GoalsPage from './pages/GoalsPage';
import BillsPage from './pages/BillsPage';
import NotFoundPage from "./components/NotFoundPage"; 
import EventsPage from './pages/EventsPage';
import PrivateRoute from './components/PrivateRoute';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';

// --- CONFIG EMAIL ADMIN ---
const ADMIN_EMAIL = 'kustianaziz6@gmail.com'; 

// --- ROUTE GUARDS ---

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const PublicRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
};

// --- NEW: SATPAM ADMIN KHUSUS ---
const AdminRoute = () => {
  const { user, loading } = useAuth();
  
  if (loading) return null; // Tunggu loading
  
  // 1. Cek Login
  if (!user) return <Navigate to="/login" replace />;
  
  // 2. Cek Email (Hardcode Security)
  if (user.email !== ADMIN_EMAIL) {
      // Kalau bukan Kustian, tendang balik ke dashboard
      return <Navigate to="/dashboard" replace />;
  }

  // Lolos Sensor
  return <Outlet />;
};

// --- LAYOUTS ---

const FullLayout = () => {
  return (
    <div className="w-full min-h-screen bg-white">
      <Outlet />
    </div>
  );
};

const AppLayout = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className={isAdmin 
      ? "w-full min-h-screen bg-slate-50 font-sans" // Admin: Full Width
      : "max-w-[420px] mx-auto bg-white min-h-screen relative shadow-2xl overflow-hidden border-x border-gray-100 font-sans" // User: Mobile
    }>
      <Outlet />
    </div>
  );
};

function App() {
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
            <Route path="/wallets" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
            
            {/* PUBLIC */}
            <Route element={<PublicRoute />}>
                <Route element={<FullLayout />}>
                    <Route path="/" element={<LandingPage />} />
                </Route>
                <Route element={<AppLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                </Route>
            </Route>

            {/* PROTECTED (USER BIASA) */}
            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    {/* ... ROUTE LAINNYA TETAP SAMA ... */}
                    <Route path="/voice" element={<VoiceSim />} />
                    <Route path="/scan" element={<ScanSim />} />
                    <Route path="/upgrade" element={<UpgradePage />} />
                    <Route path="/accounting" element={<AccountingPage />} />
                    <Route path="/journal-process" element={<JournalProcessPage />} />
                    <Route path="/reports-menu" element={<ReportsMenuPage />} />
                    <Route path="/report-profit-loss" element={<ProfitLossPage />} />
                    <Route path="/report-balance-sheet" element={<BalanceSheetPage />} />
                    <Route path="/report-cash-flow" element={<CashFlowPage />} />
                    <Route path="/report-journal" element={<JournalReportPage />} />
                    <Route path="/report-ledger" element={<LedgerPage />} />
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
                    <Route path="/goals" element={<GoalsPage />} />
                    <Route path="/bills" element={<BillsPage />} />
                    <Route path="/invest" element={<NotFoundPage />} />
                    <Route path="/budget" element={<BudgetPage />} />
                    <Route path="/events" element={<EventsPage />} />
                </Route>
            </Route>

            {/* --- KHUSUS ADMIN (HANYA KUSTIAN) --- */}
            <Route element={<AdminRoute />}>
                <Route element={<AppLayout />}>
                    {/* Daftar Halaman Admin di sini */}
                    <Route path="/admin" element={<AdminUsersPage />} />
                </Route>
            </Route>

            {/* 404 */}
            <Route path="*" element={<AppLayout><NotFoundPage /></AppLayout>} />

          </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;