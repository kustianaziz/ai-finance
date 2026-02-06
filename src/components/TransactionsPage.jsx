import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import TransactionDetailModal from './TransactionDetailModal';
import { 
  ArrowLeft, Filter, AlertTriangle, ArrowUpRight, 
  ArrowDownLeft, ChevronDown, ArrowRightLeft 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateBudgetPeriod } from '../utils/budgetUtils'; 

export default function TransactionsPage() {
  const navigate = useNavigate();
  const location = useLocation(); 
  const { user } = useAuth();

  // --- STATE DATA ---
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- STATE MODE ---
  const [activeMode, setActiveMode] = useState(() => localStorage.getItem('app_mode') || 'PERSONAL');

  // --- STATE FILTER ---
  const [filterType, setFilterType] = useState(() => {
      return location.state?.filterType || 'all'; 
  });

  const [filterDate, setFilterDate] = useState(() => {
      return location.state?.dateRange ? 'custom' : 'bulanini';
  });

  const [customStartDate, setCustomStartDate] = useState(() => {
      return location.state?.dateRange?.startStr || '';
  });

  const [customEndDate, setCustomEndDate] = useState(() => {
      return location.state?.dateRange?.endStr || '';
  });

  const [showCustomDate, setShowCustomDate] = useState(false);
  const [filterWallet, setFilterWallet] = useState('ALL'); 
  const [walletList, setWalletList] = useState([]); 

  // --- STATE MODAL DETAIL ---
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // --- NOTIFIKASI CUSTOM ---
  const [notif, setNotif] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null });

  useEffect(() => {
    if (user) fetchWallets();
  }, [user, activeMode]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, filterType, filterDate, customStartDate, customEndDate, activeMode, filterWallet]);

  const fetchWallets = async () => {
      const { data } = await supabase.from('wallets').select('id, name').eq('user_id', user.id).eq('allocation_type', activeMode);
      setWalletList(data || []);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      let allocationFilter = activeMode === 'PERSONAL' ? ['PERSONAL', 'PRIVE'] : ['BUSINESS', 'SALARY'];

      let query = supabase
        .from('transaction_headers')
        .select('*') 
        .eq('user_id', user.id)
        .in('allocation_type', allocationFilter)
        .order('date', { ascending: false });

      // --- LOGIC FILTER TIPE YANG LEBIH KETAT (MIRIP DASHBOARD) ---
      if (filterType === 'income') {
          // Hanya Income Murni (Bukan Mutasi)
          query = query.eq('type', 'income').neq('category', 'Mutasi Saldo');
      } else if (filterType === 'expense') {
          // Hanya Expense Murni (Bukan Mutasi)
          query = query.eq('type', 'expense').neq('category', 'Mutasi Saldo');
      } else if (filterType === 'transfer') {
          // Khusus Mutasi (Bisa type transfer atau kategori Mutasi Saldo)
          // Karena Supabase query builder agak terbatas untuk OR kompleks di client,
          // kita filter kategori Mutasi Saldo secara eksplisit jika type belum konsisten.
          // Tapi cara paling aman: Ambil semua yg type='transfer' ATAU category='Mutasi Saldo'
          // Sederhananya kita pakai filter category 'Mutasi Saldo' sebagai penanda utama Mutasi.
          query = query.eq('category', 'Mutasi Saldo');
      }
      
      // Filter Wallet
      if (filterWallet !== 'ALL') query = query.eq('wallet_id', filterWallet);

      // Filter Tanggal
      const now = new Date();
      if (filterDate === '7hari') {
        const dateLimit = new Date(now); dateLimit.setDate(dateLimit.getDate() - 7);
        query = query.gte('date', dateLimit.toISOString());
      } else if (filterDate === '30hari') {
        const dateLimit = new Date(now); dateLimit.setDate(dateLimit.getDate() - 30);
        query = query.gte('date', dateLimit.toISOString());
      } else if (filterDate === 'bulanini') {
        const cachedProfile = JSON.parse(localStorage.getItem('user_profile_cache'));
        const cycle = cachedProfile?.start_date_cycle || 1;
        const { startStr, endStr } = calculateBudgetPeriod(now, cycle);
        query = query.gte('date', startStr).lte('date', endStr);
      } else if (filterDate === 'custom' && customStartDate && customEndDate) {
        query = query.gte('date', customStartDate).lte('date', customEndDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data || []);

    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Hitung Total Nominal (Hanya menjumlahkan yang tampil di layar)
  const totalNominal = transactions.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);

  // ... (Sisa fungsi handleTransactionClick, delete, dll tetap sama) ...
  const handleTransactionClick = async (transaction) => {
    const walletName = walletList.find(w => w.id === transaction.wallet_id)?.name || 'Unknown';
    const txnWithWallet = { ...transaction, wallets: { name: walletName } };

    setSelectedTxn(txnWithWallet);
    setLoadingDetail(true);
    try {
      const { data, error } = await supabase.from('transaction_items').select('*').eq('header_id', transaction.id);
      if (error) throw error;
      setDetailItems(data || []);
    } catch (error) {
      setDetailItems([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => { setSelectedTxn(null); setDetailItems([]); };
  const handleUpdateSuccess = () => { fetchData(); closeModal(); };

  const confirmDelete = (id) => {
      setNotif({
          show: true,
          type: 'confirm',
          title: 'Hapus Transaksi?',
          message: 'Transaksi ini akan dihapus permanen dan saldo dompet akan dikembalikan.',
          onConfirm: () => executeDelete(id)
      });
  };

  const executeDelete = async (id) => {
    try {
      const { error } = await supabase.from('transaction_headers').delete().eq('id', id);
      if (error) throw error;
      setTransactions(transactions.filter(t => t.id !== id));
      setNotif({ show: false });
      closeModal();
    } catch (error) { 
        alert("Gagal hapus: " + error.message); 
    }
  };

  const getThemeColor = () => {
      if (activeMode === 'BUSINESS') return 'text-blue-600 bg-blue-50 border-blue-200';
      if (activeMode === 'ORGANIZATION') return 'text-teal-600 bg-teal-50 border-teal-200';
      return 'text-indigo-600 bg-indigo-50 border-indigo-200'; 
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const getWalletName = (id) => walletList.find(item => item.id === id)?.name || 'Terhapus';

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      
      {/* Header Sticky */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/dashboard')} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition active:scale-95 text-slate-600"><ArrowLeft size={20}/></button>
                <div>
                    <h2 className="font-bold text-lg text-slate-800 leading-tight">Riwayat</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode {activeMode === 'PERSONAL' ? 'Pribadi' : activeMode === 'BUSINESS' ? 'Bisnis' : 'Organisasi'}</p>
                </div>
            </div>
            <button onClick={() => setShowCustomDate(!showCustomDate)} className={`p-2 rounded-xl border transition ${showCustomDate ? getThemeColor() : 'bg-white border-slate-200 text-slate-500'}`}>
                <Filter size={18}/>
            </button>
        </div>
        
        {/* SUMMARY CARD KECIL */}
        {transactions.length > 0 && (
            <div className="mb-3 px-1 flex justify-between items-end">
                <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total {filterType === 'income' ? 'Pemasukan' : filterType === 'expense' ? 'Pengeluaran' : filterType === 'transfer' ? 'Mutasi' : 'Transaksi'}</p>
                    <p className="text-xl font-extrabold text-slate-800">{formatIDR(totalNominal)}</p>
                </div>
                <div className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-1 rounded-lg">
                    {transactions.length} Data
                </div>
            </div>
        )}

        {/* Filter Area */}
        <div className="flex flex-col gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['7hari', '30hari', 'bulanini', 'custom'].map(f => (
                    <button key={f} onClick={() => {setFilterDate(f); setShowCustomDate(f === 'custom');}} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${filterDate === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                        {f === '7hari' ? '7 Hari' : f === '30hari' ? '30 Hari' : f === 'bulanini' ? 'Periode Ini' : 'Custom'}
                    </button>
                ))}
            </div>

            {showCustomDate && (
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 animate-slide-down">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 pl-1 block mb-1">Dari</label>
                        <input type="date" value={customStartDate} onChange={(e) => {setCustomStartDate(e.target.value); setFilterDate('custom');}} className="w-full text-xs font-bold bg-white p-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500"/>
                    </div>
                    <div className="text-slate-300 pt-4">-</div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 pl-1 block mb-1">Sampai</label>
                        <input type="date" value={customEndDate} onChange={(e) => {setCustomEndDate(e.target.value); setFilterDate('custom');}} className="w-full text-xs font-bold bg-white p-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500"/>
                    </div>
                </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1 items-center">
                <div className="relative shrink-0">
                    <select value={filterWallet} onChange={(e) => setFilterWallet(e.target.value)} className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 outline-none focus:border-indigo-500">
                        <option value="ALL">Semua Dompet</option>
                        {walletList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                </div>
                <div className="h-4 w-px bg-slate-200 mx-1"></div>
                
                {/* TOMBOL FILTER TIPE (FIXED LOGIC) */}
                <button onClick={() => setFilterType('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${filterType === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>Semua</button>
                <button onClick={() => setFilterType('income')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${filterType === 'income' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>Masuk</button>
                <button onClick={() => setFilterType('expense')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${filterType === 'expense' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>Keluar</button>
                <button onClick={() => setFilterType('transfer')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${filterType === 'transfer' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>Mutasi</button>
            </div>
        </div>
      </div>

      {/* List Transaksi */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        {loading ? (
           <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-slate-200 rounded-2xl animate-pulse"></div>)}</div>
        ) : transactions.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 opacity-50">
               <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-3xl">🍃</div>
               <p className="text-sm font-bold text-slate-400">Tidak ada transaksi ditemukan.</p>
           </div>
        ) : (
          transactions.map((t) => {
            // DETEKSI MUTASI
            const isMutasi = t.category === 'Mutasi Saldo' || t.type === 'transfer';
            const isIncome = t.type === 'income' && !isMutasi;
            const isExpense = t.type === 'expense' && !isMutasi;

            let iconColor = 'bg-blue-50 text-blue-600';
            let Icon = ArrowRightLeft; 
            let amountColor = 'text-blue-600';
            let sign = '';

            if (isIncome) {
                iconColor = 'bg-green-50 text-green-600';
                Icon = ArrowDownLeft;
                amountColor = 'text-green-600';
                sign = '+';
            } else if (isExpense) {
                iconColor = 'bg-red-50 text-red-600';
                Icon = ArrowUpRight;
                amountColor = 'text-slate-800';
                sign = '-';
            }

            return (
                <div key={t.id} onClick={() => handleTransactionClick(t)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:bg-slate-50 transition cursor-pointer active:scale-[0.98]">
                   <div className="flex gap-4 items-center overflow-hidden">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm shrink-0 ${iconColor}`}>
                        <Icon size={20}/>
                     </div>
                     <div className="min-w-0">
                       <p className="font-bold text-slate-800 text-sm truncate">{t.merchant || 'Tanpa Nama'}</p>
                       <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                           <span className="text-slate-400">{formatDate(t.date)}</span>
                           <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                           <span className="font-bold text-indigo-500 bg-indigo-50 px-1.5 rounded truncate max-w-[80px]">{getWalletName(t.wallet_id)}</span>
                       </div>
                     </div>
                   </div>
                   <div className="text-right shrink-0 ml-2">
                     <span className={`font-bold text-sm block ${amountColor}`}>
                       {sign} {formatIDR(t.total_amount)}
                     </span>
                     <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{t.category}</p>
                   </div>
                </div>
            );
          })
        )}
      </div>

      {/* Render Modal Detail & Konfirmasi Hapus (Tetap Sama) */}
      {selectedTxn && (
        <TransactionDetailModal 
           transaction={selectedTxn} 
           items={detailItems} 
           loading={loadingDetail}
           onClose={closeModal} 
           onUpdate={handleUpdateSuccess}
           onDelete={() => confirmDelete(selectedTxn.id)} 
        />
      )}

      <AnimatePresence>
        {notif.show && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={32}/></div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2">{notif.title}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">{notif.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setNotif({ show: false })} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Batal</button>
                        <button onClick={notif.onConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg">Ya, Hapus</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
}