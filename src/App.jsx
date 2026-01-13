import { useEffect } from 'react'; 
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app'; 
import AuthProvider, { useAuth } from './context/AuthProvider';

// --- IMPORT SEMUA HALAMAN (Sesuai kode Abang) ---
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
import LandingPage from './components/LandingPage';

// --- KOMPONEN SATPAM (Cek Login) ---
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" />; // Lempar ke Login kalau belum masuk
  }
  return children;
};

// --- LAYOUT 1: FULL WIDTH (Untuk Landing Page) ---
// Bebas lebar, tidak dikotak-kotakkan
const FullLayout = () => {
  return (
    <div className="w-full min-h-screen bg-white">
      <Outlet />
    </div>
  );
};

// --- LAYOUT 2: MOBILE APP VIEW (Untuk Dashboard dkk) ---
// Ini yang bikin tampilan kayak Aplikasi HP (Lebar maks 420px)
const AppLayout = () => {
  return (
    <div className="max-w-[420px] mx-auto bg-white min-h-screen relative shadow-2xl overflow-hidden border-x border-gray-100 font-sans">
      <Outlet />
    </div>
  );
};

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
            
            {/* GRUP 1: HALAMAN FULL LAYAR (Landing Page) */}
            <Route element={<FullLayout />}>
               <Route path="/" element={<LandingPage />} />
            </Route>

            {/* GRUP 2: HALAMAN TAMPILAN HP (App Utama) */}
            <Route element={<AppLayout />}>
               
               {/* Auth */}
               <Route path="/login" element={<LoginPage />} />
               <Route path="/register" element={<RegisterPage />} />
               
               {/* Halaman Private (Protected) */}
               <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
               <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
               <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
               <Route path="/admin" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
               
               {/* Fitur AI */}
               <Route path="/voice" element={<ProtectedRoute><VoiceSim /></ProtectedRoute>} />
               <Route path="/scan" element={<ProtectedRoute><ScanSim /></ProtectedRoute>} />
               
               {/* Upgrade */}
               <Route path="/upgrade" element={<ProtectedRoute><UpgradePage /></ProtectedRoute>} />

               {/* Akuntansi & Laporan */}
               <Route path="/accounting" element={<ProtectedRoute><AccountingPage /></ProtectedRoute>} />
               <Route path="/journal-process" element={<ProtectedRoute><JournalProcessPage /></ProtectedRoute>} />
               <Route path="/reports-menu" element={<ProtectedRoute><ReportsMenuPage /></ProtectedRoute>} />
               <Route path="/report-profit-loss" element={<ProtectedRoute><ProfitLossPage /></ProtectedRoute>} />
               <Route path="/report-balance-sheet" element={<ProtectedRoute><BalanceSheetPage /></ProtectedRoute>} />
               <Route path="/report-cash-flow" element={<ProtectedRoute><CashFlowPage /></ProtectedRoute>} />
               <Route path="/report-journal" element={<ProtectedRoute><JournalReportPage /></ProtectedRoute>} />
               <Route path="/report-ledger" element={<ProtectedRoute><LedgerPage /></ProtectedRoute>} />
               
               {/* Catch-all: Kalau nyasar, lempar ke Landing Page */}
               <Route path="*" element={<Navigate to="/" />} />

            </Route>

          </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;