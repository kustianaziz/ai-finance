import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import TransactionDetailModal from './TransactionDetailModal';
import { ArrowLeft, Calendar, Filter, Trash2, X } from 'lucide-react';

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- STATE DATA ---
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- STATE MODE ---
  const [activeMode, setActiveMode] = useState(() => {
      return localStorage.getItem('app_mode') || 'PERSONAL';
  });

  // --- STATE FILTER ---
  const [filterType, setFilterType] = useState('all'); // all, income, expense
  const [filterDate, setFilterDate] = useState('30hari'); // 7hari, 30hari, bulanini, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  // --- STATE MODAL DETAIL ---
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, filterType, filterDate, customStartDate, customEndDate, activeMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Tentukan Allocation Type berdasarkan Mode Aktif
      let allocationFilter = [];
      if (activeMode === 'PERSONAL') {
          allocationFilter = ['PERSONAL', 'PRIVE'];
      } else {
          allocationFilter = ['BUSINESS', 'SALARY'];
      }

      // 2. Query Dasar
      let query = supabase
        .from('transaction_headers')
        .select('*')
        .eq('user_id', user.id)
        .in('allocation_type', allocationFilter) // Filter Mode
        .order('date', { ascending: false });

      // 3. Filter Tipe (Pemasukan/Pengeluaran)
      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      // 4. Filter Tanggal
      const now = new Date();
      if (filterDate === '7hari') {
        const dateLimit = new Date(now);
        dateLimit.setDate(dateLimit.getDate() - 7);
        query = query.gte('date', dateLimit.toISOString());
      } else if (filterDate === '30hari') {
        const dateLimit = new Date(now);
        dateLimit.setDate(dateLimit.getDate() - 30);
        query = query.gte('date', dateLimit.toISOString());
      } else if (filterDate === 'bulanini') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('date', startOfMonth);
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

  // --- FUNGSI DETAIL ---
  const handleTransactionClick = async (transaction) => {
    setSelectedTxn(transaction);
    setLoadingDetail(true);
    try {
      const { data, error } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('header_id', transaction.id);

      if (error) throw error;
      setDetailItems(data || []);
    } catch (error) {
      console.error("Gagal ambil detail:", error);
      setDetailItems([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setSelectedTxn(null);
    setDetailItems([]);
  };

  // --- FUNGSI HAPUS ---
  const handleDelete = async (id) => {
    if (!window.confirm("Yakin mau hapus transaksi ini selamanya?")) return;
    try {
      const { error } = await supabase.from('transaction_headers').delete().eq('id', id);
      if (error) throw error;
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (error) {
      alert("Gagal hapus: " + error.message);
    }
  };

  // --- UI HELPERS ---
  const getThemeColor = () => {
      if (activeMode === 'BUSINESS') return 'text-blue-600 bg-blue-50 border-blue-200';
      if (activeMode === 'ORGANIZATION') return 'text-teal-600 bg-teal-50 border-teal-200';
      return 'text-indigo-600 bg-indigo-50 border-indigo-200'; 
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      
      {/* 1. Header Sticky */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/dashboard')} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition active:scale-95 text-slate-600"><ArrowLeft size={20}/></button>
                <div>
                    <h2 className="font-bold text-lg text-slate-800 leading-tight">Riwayat</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode {activeMode === 'PERSONAL' ? 'Pribadi' : activeMode === 'BUSINESS' ? 'Bisnis' : 'Organisasi'}</p>
                </div>
            </div>
            {/* Filter Toggle (Mobile Friendly) */}
            <button onClick={() => setShowCustomDate(!showCustomDate)} className={`p-2 rounded-xl border transition ${showCustomDate ? getThemeColor() : 'bg-white border-slate-200 text-slate-500'}`}>
                <Filter size={18}/>
            </button>
        </div>
        
        {/* Filter Chips Container */}
        <div className="flex flex-col gap-3">
            {/* Row 1: Date Presets */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button onClick={() => {setFilterDate('7hari'); setShowCustomDate(false)}} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${filterDate === '7hari' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>7 Hari</button>
                <button onClick={() => {setFilterDate('30hari'); setShowCustomDate(false)}} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${filterDate === '30hari' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>30 Hari</button>
                <button onClick={() => {setFilterDate('bulanini'); setShowCustomDate(false)}} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${filterDate === 'bulanini' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>Bulan Ini</button>
                <button onClick={() => {setFilterDate('custom'); setShowCustomDate(true)}} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${filterDate === 'custom' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>Pilih Tanggal</button>
            </div>

            {/* Row 2: Custom Date Inputs (Conditional) */}
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

            {/* Row 3: Type Filter */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setFilterType('all')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Semua</button>
                <button onClick={() => setFilterType('income')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'income' ? 'bg-white shadow text-green-600' : 'text-slate-400'}`}>Pemasukan</button>
                <button onClick={() => setFilterType('expense')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'expense' ? 'bg-white shadow text-red-600' : 'text-slate-400'}`}>Pengeluaran</button>
            </div>
        </div>
      </div>

      {/* 2. List Transaksi */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        {loading ? (
           <div className="space-y-3">
               {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-slate-200 rounded-2xl animate-pulse"></div>)}
           </div>
        ) : transactions.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 opacity-50">
               <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-3xl">🍃</div>
               <p className="text-sm font-bold text-slate-400">Tidak ada transaksi ditemukan.</p>
               <p className="text-xs text-slate-400 mt-1">Coba ubah filter tanggal atau mode.</p>
           </div>
        ) : (
          transactions.map((t) => (
            <div 
              key={t.id} 
              onClick={() => handleTransactionClick(t)} 
              className="group bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:bg-slate-50 transition relative overflow-hidden cursor-pointer active:scale-[0.98]"
            >
               <div className="flex gap-4 items-center z-10">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {t.type === 'income' ? '📥' : '🛒'}
                 </div>
                 <div>
                   <p className="font-bold text-slate-800 text-sm line-clamp-1">{t.merchant || 'Tanpa Nama'}</p>
                   <div className="flex items-center gap-2 mt-0.5">
                       <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold capitalize">{t.category}</span>
                       <span className="text-[10px] text-slate-400">{formatDate(t.date)}</span>
                   </div>
                 </div>
               </div>
               
               <div className="text-right z-10">
                 <span className={`font-bold text-sm block ${t.type === 'income' ? 'text-green-600' : 'text-slate-800'}`}>
                   {t.type === 'income' ? '+' : '-'}{formatIDR(t.total_amount)}
                 </span>
                 <button 
                   onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                   className="text-[10px] text-slate-300 mt-1 hover:text-red-500 flex items-center justify-end gap-1 ml-auto px-2 py-1 hover:bg-red-50 rounded-lg transition"
                 >
                   <Trash2 size={12}/> Hapus
                 </button>
               </div>
            </div>
          ))
        )}
        
        {!loading && transactions.length > 0 && (
           <div className="text-center py-6 text-slate-300 text-xs font-bold uppercase tracking-widest">-- Akhir Data --</div>
        )}
      </div>

      {/* 3. Render Modal Detail */}
      {selectedTxn && (
        <TransactionDetailModal 
           transaction={selectedTxn} 
           items={detailItems} 
           loading={loadingDetail}
           onClose={closeModal} 
        />
      )}

    </div>
  );
}