import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import TransactionDetailModal from './TransactionDetailModal'; // Import Modal

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('30hari');

  // --- STATE MODAL DETAIL ---
  const [selectedTxn, setSelectedTxn] = useState(null); // Transaksi yg diklik
  const [detailItems, setDetailItems] = useState([]);   // List barangnya
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, filterType, filterDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('transaction_headers')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      const now = new Date();
      if (filterDate === '7hari') {
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
        query = query.gte('date', sevenDaysAgo);
      } else if (filterDate === '30hari') {
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString();
        query = query.gte('date', thirtyDaysAgo);
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

  // --- FUNGSI KLIK TRANSAKSI (BUKA MODAL) ---
  const handleTransactionClick = async (transaction) => {
    setSelectedTxn(transaction); // Buka modal dulu (tapi item masih kosong)
    setLoadingDetail(true);
    
    try {
      // Ambil detail item dari tabel 'transaction_items'
      const { data, error } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('header_id', transaction.id); // Kuncinya disini: header_id

      if (error) throw error;
      setDetailItems(data || []);
      
    } catch (error) {
      console.error("Gagal ambil detail:", error);
      setDetailItems([]); // Kosongkan kalau error
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setSelectedTxn(null);
    setDetailItems([]);
  };

  // Fitur Hapus
  const handleDelete = async (id) => {
    if (!window.confirm("Yakin mau hapus transaksi ini?")) return;
    try {
      const { error } = await supabase.from('transaction_headers').delete().eq('id', id);
      if (error) throw error;
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (error) {
      alert("Gagal hapus: " + error.message);
    }
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      
      {/* 1. Header Sticky */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/dashboard')} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200">←</button>
          <h2 className="font-bold text-lg">Riwayat Transaksi</h2>
        </div>
        
        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <div className="flex bg-gray-100 rounded-lg p-1 mr-2 shrink-0">
                <button onClick={() => setFilterDate('7hari')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${filterDate === '7hari' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>7 Hari</button>
                <button onClick={() => setFilterDate('30hari')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${filterDate === '30hari' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>30 Hari</button>
                <button onClick={() => setFilterDate('semua')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${filterDate === 'semua' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Semua</button>
            </div>
            <button onClick={() => setFilterType('all')} className={`px-4 py-1.5 rounded-full text-xs font-bold border shrink-0 transition ${filterType === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>Semua</button>
            <button onClick={() => setFilterType('income')} className={`px-4 py-1.5 rounded-full text-xs font-bold border shrink-0 transition ${filterType === 'income' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-200'}`}>Pemasukan</button>
            <button onClick={() => setFilterType('expense')} className={`px-4 py-1.5 rounded-full text-xs font-bold border shrink-0 transition ${filterType === 'expense' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-600 border-gray-200'}`}>Pengeluaran</button>
        </div>
      </div>

      {/* 2. List Transaksi */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
           <div className="text-center py-10 text-gray-400">Memuat data...</div>
        ) : transactions.length === 0 ? (
           <div className="text-center py-10 text-gray-400">Belum ada transaksi.</div>
        ) : (
          transactions.map((t) => (
            <div 
              key={t.id} 
              onClick={() => handleTransactionClick(t)} // <-- KLIK DISINI
              className="group bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:bg-blue-50 hover:border-blue-200 transition relative overflow-hidden cursor-pointer"
            >
               <div className="flex gap-4 items-center z-10">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${t.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {t.type === 'income' ? '📥' : '🛒'}
                 </div>
                 <div>
                   <p className="font-bold text-gray-800 text-sm line-clamp-1">{t.merchant || 'Tanpa Toko'}</p>
                   <p className="text-xs text-gray-400">{t.category} • {formatDate(t.date)}</p>
                 </div>
               </div>
               
               <div className="text-right z-10">
                 <span className={`font-bold text-sm block ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                   {t.type === 'income' ? '+' : '-'}{formatIDR(t.total_amount)}
                 </span>
                 <button 
                   onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                   className="text-[10px] text-red-400 mt-1 hover:text-red-600 hover:underline px-2 py-1"
                 >
                   Hapus
                 </button>
               </div>
            </div>
          ))
        )}
        
        {!loading && transactions.length > 0 && (
           <div className="text-center py-8 text-gray-400 text-xs">-- Akhir dari Data --</div>
        )}
      </div>

      {/* 3. Render Modal */}
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