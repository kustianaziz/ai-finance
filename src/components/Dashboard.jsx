import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../supabaseClient';
import { generateFinancialInsights } from '../utils/aiLogic'; 

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  
  // State Data
  const [transactions, setTransactions] = useState([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // State Notifikasi AI (Advisor)
  const [showNotif, setShowNotif] = useState(false);
  const [aiTips, setAiTips] = useState([]);
  const [loadingTips, setLoadingTips] = useState(false);
  const [loadingText, setLoadingText] = useState("Memanggil Juragan...");

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // --- QUERY 1: LIST TRANSAKSI (5 Terakhir) ---
      const { data: listData, error: listError } = await supabase
        .from('transaction_headers')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(5);

      if (listError) throw listError;
      setTransactions(listData || []);

      // --- QUERY 2: TOTAL PENGELUARAN BULAN INI ---
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: expenseData, error: expenseError } = await supabase
        .from('transaction_headers')
        .select('total_amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', startOfMonth);

      if (expenseError) throw expenseError;

      const total = expenseData.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      setTotalExpense(total);

    } catch (error) {
      console.error('Error loading dashboard:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNGSI KLIK LONCENG (GENERATE AI JURAGAN) ---
  const handleBellClick = async () => {
    // Toggle tampilan
    setShowNotif(!showNotif);

    // Kalau mau nutup atau data sudah ada, jangan load lagi
    if (showNotif || aiTips.length > 0) return;

    setLoadingTips(true);
    
    // Gacha teks loading biar gak bosen
    const messages = [
        "Sedang memanggil Juragan...", 
        "Juragan lagi ngitung boncosmu...", 
        "Menganalisa kebiasaan jajan...", 
        "Siap-siap kena semprot..."
    ];
    setLoadingText(messages[Math.floor(Math.random() * messages.length)]);

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString();

      // Ambil data lebih banyak (50) biar analisa "Kategori Terboros" akurat
      // Tenang, aiLogic kita sekarang ngitungnya di JS dulu, jadi enteng!
      const { data: historyData } = await supabase
        .from('transaction_headers')
        .select('merchant, category, type, total_amount')
        .eq('user_id', user.id)
        .gte('date', thirtyDaysAgo)
        .limit(50); 

      if (!historyData || historyData.length < 3) {
        setAiTips(["Data transaksi masih dikit banget nih. Pakai dulu aplikasinya buat catat pengeluaran ya!"]);
        setLoadingTips(false);
        return;
      }

      // Kirim ke AI Logic (Yang sudah dioptimasi)
      const insights = await generateFinancialInsights(historyData);
      setAiTips(insights);

    } catch (error) {
      console.error("Gagal generate tips:", error);
      setAiTips(["Maaf Juragan lagi sibuk ngurusin bisnis lain. Coba nanti ya!"]);
    } finally {
      setLoadingTips(false);
    }
  };

  const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      
      {/* --- OVERLAY NOTIFIKASI (SMART ADVISOR) --- */}
      {showNotif && (
        <div className="absolute top-16 right-4 left-4 z-50 animate-fade-in-up">
           {/* Backdrop buat nutup kalau diklik luar */}
           <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)}></div>
           
           <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 relative z-50">
              {/* Panah kecil ke atas */}
              <div className="absolute -top-2 right-6 w-4 h-4 bg-white transform rotate-45 border-t border-l border-gray-100"></div>
              
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  🤖 Kata Juragan
                </h3>
                <button onClick={() => { setAiTips([]); handleBellClick(); }} className="text-xs text-brand-600 font-bold hover:underline bg-brand-50 px-2 py-1 rounded-lg">
                  Refresh ↻
                </button>
              </div>

              {loadingTips ? (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm font-medium text-gray-600 animate-pulse">{loadingText}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {aiTips.map((tip, idx) => (
                    <div key={idx} className={`p-3 rounded-xl border flex gap-3 items-start ${idx === 0 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="text-lg mt-0.5 select-none">
                          {idx === 0 ? '🧐' : idx === 1 ? '💡' : '🚀'}
                      </div>
                      <p className="text-sm text-gray-700 leading-snug font-medium">{tip}</p>
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400 text-center mt-2 italic">
                    *Juragan menganalisa 30 hari terakhir.
                  </p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* --- HEADER DASHBOARD --- */}
      <div className="bg-white p-6 rounded-b-3xl shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-gray-400 text-sm">Selamat Pagi,</p>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800 truncate max-w-[150px]">
                {user?.user_metadata?.full_name || 'Juragan'} 👋
              </h1>
              {/* TOMBOL UPGRADE */}
              <button 
                onClick={() => navigate('/upgrade')}
                className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-300 flex items-center gap-1 active:scale-95 transition"
              >
                👑 PRO
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* TOMBOL LONCENG */}
            <button 
              onClick={handleBellClick} 
              className={`relative p-2 rounded-full transition ${showNotif ? 'bg-brand-100 text-brand-600' : 'bg-gray-50 hover:bg-gray-100'}`}
            >
              <span className="text-xl">🔔</span>
              {/* Dot merah kalau belum dibuka */}
              {aiTips.length === 0 && !loadingTips && !showNotif && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white animate-ping"></span>
              )}
            </button>

            <button onClick={signOut} className="text-xs text-red-500 font-bold ml-1 border border-red-100 px-3 py-1.5 rounded-full hover:bg-red-50 transition">
              Keluar
            </button>
          </div>
        </div>

        {/* Card Resume Keuangan */}
        <div className="bg-gray-900 text-white p-6 rounded-2xl shadow-xl shadow-gray-200 mb-4 relative overflow-hidden">
          <div className="absolute -right-5 -top-5 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
          <div className="absolute -left-5 -bottom-5 w-24 h-24 bg-brand-500 opacity-20 rounded-full blur-xl"></div>
          
          <p className="text-gray-400 text-xs mb-1 font-medium tracking-wide">PENGELUARAN BULAN INI</p>
          
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            {loading ? '...' : formatIDR(totalExpense)}
          </h2>
          
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <span className="text-xs font-semibold inline-block text-red-300">Penggunaan</span>
              <span className="text-xs font-semibold inline-block text-gray-400">Hemat Pangkal Kaya!</span>
            </div>
            <div className="overflow-hidden h-1.5 mb-1 text-xs flex rounded bg-gray-700">
              <div style={{ width: "35%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-green-400 to-brand-500"></div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => navigate('/analytics')}
          className="w-full py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-100 transition active:scale-[0.98]"
        >
          📊 Lihat Detail Analisa
          <span className="text-gray-400">→</span>
        </button>
      </div>

      {/* --- MENU AKSES FITUR --- */}
      <div className="p-6">
        <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider">Aksi Cepat</h3>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => navigate('/voice')} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center hover:bg-brand-50 hover:border-brand-200 transition group active:scale-95">
            <span className="text-4xl mb-3 group-hover:scale-110 transition">🎙️</span>
            <span className="font-bold text-gray-800">Voice Input</span>
            <span className="text-xs text-gray-400 mt-1">Ngomong aja</span>
          </button>
          
          <button onClick={() => navigate('/scan')} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center hover:bg-brand-50 hover:border-brand-200 transition group active:scale-95">
            <span className="text-4xl mb-3 group-hover:scale-110 transition">📸</span>
            <span className="font-bold text-gray-800">Scan Struk</span>
            <span className="text-xs text-gray-400 mt-1">Foto bon belanja</span>
          </button>
        </div>
      </div>

      {/* --- LIST TRANSAKSI REAL --- */}
      <div className="px-6">
        <div className="flex justify-between items-end mb-4">
           <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Riwayat Terbaru</h3>
           <span onClick={() => navigate('/transactions')} className="text-xs text-brand-600 font-bold cursor-pointer hover:underline bg-brand-50 px-2 py-1 rounded">
             Lihat Semua
           </span>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 min-h-[100px] mb-6">
          {loading ? (
            <div className="p-6 text-center text-gray-400 text-sm animate-pulse">Sedang memuat data...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center">
                <span className="text-4xl mb-2">🍃</span>
                <p className="text-gray-400 text-sm">Belum ada transaksi bulan ini.</p>
            </div>
          ) : (
            transactions.map((t) => (
              <div key={t.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition">
                <div className="flex gap-4 items-center overflow-hidden">
                  <div className={`p-3 rounded-xl text-xl flex-shrink-0 ${t.type === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
                    {t.type === 'income' ? '💰' : '🛒'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 text-sm truncate">{t.merchant || 'Tanpa Nama'}</p>
                    <p className="text-xs text-gray-400 capitalize truncate">{t.category} • {new Date(t.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</p>
                  </div>
                </div>
                <span className={`font-bold text-sm whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatIDR(t.total_amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}