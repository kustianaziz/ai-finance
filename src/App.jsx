import { useEffect } from 'react'; 
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app'; 
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

import AccountingPage from './components/AccountingPage';
import JournalProcessPage from './components/JournalProcessPage';
import ReportsMenuPage from './components/ReportsMenuPage';
import ProfitLossPage from './components/ProfitLossPage';
import BalanceSheetPage from './components/BalanceSheetPage';
import CashFlowPage from './components/CashFlowPage';
import JournalReportPage from './components/JournalReportPage';
import LedgerPage from './components/LedgerPage';

// Komponen Satpam (Cek Tiket)
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/" />;
  }
  return children;
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

            {/* --- 2. MASUKKAN KE DALAM PROTECTED ROUTE BIAR AMAN --- */}
            <Route path="/journal-process" element={<ProtectedRoute><JournalProcessPage /></ProtectedRoute>} />
            <Route path="/reports-menu" element={<ProtectedRoute><ReportsMenuPage /></ProtectedRoute>} />
            <Route path="/report-profit-loss" element={<ProtectedRoute><ProfitLossPage /></ProtectedRoute>} />
            <Route path="/report-balance-sheet" element={<ProtectedRoute><BalanceSheetPage /></ProtectedRoute>} />
            <Route path="/report-cash-flow" element={<ProtectedRoute><CashFlowPage /></ProtectedRoute>} />
            <Route path="/report-journal" element={<ProtectedRoute><JournalReportPage /></ProtectedRoute>} />
            <Route path="/report-ledger" element={<ProtectedRoute><LedgerPage /></ProtectedRoute>} />
            
            {/* Catch-all: Kalau nyasar, lempar ke Login */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;