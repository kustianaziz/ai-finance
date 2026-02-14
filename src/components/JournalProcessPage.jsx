import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { fetchUnpostedTransactions, processSingleTransaction } from '../utils/journalWorker';
import { ensureUserHasCOA } from '../utils/accountingService';
import { useAuth } from '../context/AuthProvider';
import ModalInfo from '../components/ModalInfo';
import { 
  ArrowLeft, CheckCircle2, XCircle, AlertCircle, Play, 
  Loader2, Search, FileText, ShoppingBag, Truck, CreditCard, PackageOpen,
  Clock
} from 'lucide-react';

const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function JournalProcessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [candidates, setCandidates] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [progress, setProgress] = useState(0);

  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const showModal = (type, title, message) => setModal({ isOpen: true, type, title, message });


  useEffect(() => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 30); // Default 30 hari terakhir
    setStartDate(lastWeek.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const handleSearch = async () => {
    setCandidates([]);
    setIsProcessing(true);
    try {
        const data = await fetchUnpostedTransactions(user.id, startDate, endDate);
        
        const formattedData = data.map(item => ({ 
            ...item, 
            status: 'idle', 
            errorMsg: '' 
        }));
        
        setCandidates(formattedData);
        setProgress(0);
        
        if (formattedData.length === 0) {
            showModal('info', 'Data Kosong', 'Tidak ada transaksi pending (belum dijurnal) pada periode ini.');
        }
    } catch (error) {
        showModal('error', 'Gagal', error.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleStartProcess = async () => {
    // --- GEMBOK INSTAN (Pakai Ref) ---
    // Cek apakah Ref sedang true? Kalau ya, langsung tendang.
    if (isProcessingRef.current || candidates.length === 0) return;
    
    // Cek apakah semua sudah sukses
    const allSuccess = candidates.every(c => c.status === 'success');
    if (allSuccess) return;

    // --- KUNCI PINTU ---
    isProcessingRef.current = true; // <--- Kunci Instan (Sync)
    setIsProcessing(true);          // <--- Kunci UI (Async)
    
    try {
        // Pastikan COA ready
        try { await ensureUserHasCOA(user.id); } catch(e) {}

        let successCount = 0;
        let failCount = 0;
        let queue = [...candidates]; 

        for (let i = 0; i < queue.length; i++) {
            // ... (Kode looping SAMA PERSIS seperti sebelumnya) ...
            // Copy paste aja logic looping yang lama di sini
            
            const item = queue[i];
            if (item.status === 'success') { successCount++; continue; }

            // Update UI Status jadi processing
            setCandidates(prev => {
                const newData = [...prev];
                newData[i].status = 'processing';
                return newData;
            });

            // Process
            const result = await processSingleTransaction(user.id, item);

            // Update Result
            setCandidates(prev => {
                const newData = [...prev];
                newData[i].status = result.success ? 'success' : 'error';
                newData[i].errorMsg = result.error || '';
                return newData;
            });

            if (result.success) successCount++; else failCount++;
            setProgress(Math.round(((i + 1) / queue.length) * 100));
            
            if (i % 5 === 0) await new Promise(r => setTimeout(r, 100));
        }

        setTimeout(() => {
            if (failCount === 0) showModal('success', 'Selesai', `${successCount} transaksi berhasil diposting.`);
            else showModal('error', 'Selesai Sebagian', `${successCount} Sukses, ${failCount} Gagal. Cek list.`);
        }, 500);

    } catch (error) {
        showModal('error', 'Error Sistem', error.message);
    } finally {
        // --- BUKA KUNCI (WAJIB DI FINALLY) ---
        isProcessingRef.current = false; // Buka Gembok Logic
        setIsProcessing(false);          // Buka Gembok UI
    }
  };

  // --- REVISI ICON: Biar ikonnya beda untuk Stok Awal ---
  const getIcon = (item) => {
      // Khusus Inventory
      if (item.source === 'inventory_transactions') {
          if (item.raw?.type === 'opening_stock') {
              return <PackageOpen size={16} className="text-purple-500"/>;
          }
          return <Truck size={16} className="text-orange-500"/>;
      }

      switch(item.source) {
          case 'invoices': return <FileText size={16} className="text-blue-500"/>;
          case 'debt_payments': return <CreditCard size={16} className="text-teal-500"/>;
          case 'debts': return <Clock size={16} className="text-amber-500"/>; // <--- TAMBAH INI
          default: return <ShoppingBag size={16} className="text-green-500"/>;
      }
  };

  // --- REVISI LABEL: Logika Pembeda Modal vs Beli ---
  const getLabel = (item) => {
        // 1. Cek Inventory
        if (item.type === 'stock_in') {
            if (item.raw?.type === 'opening_stock') return 'Modal Stok Awal';
            return 'Beli Stok';
        }
        if (item.type === 'stock_out') return 'Pakai Stok';

        // 2. Cek Income (Pemasukan)
        if (item.type === 'income') {
            // Cek Kategori dari RAW data atau item category
            const cat = item.category || '';
            if (cat === 'Saldo Awal' || cat === 'Modal') return 'Modal';
            if (cat === 'Hibah') return 'Pendapatan Lain';
            return 'Penjualan'; // Default
        }

        /// 3. Mapping Lainnya
        const map = {
            'expense': 'Pengeluaran',
            'invoice_issued': 'Tagihan',
            'pay_debt': 'Bayar Hutang',
            'receive_receivable': 'Terima Piutang',
            'transfer': 'Mutasi',
            'new_debt': 'Hutang Baru',       
            'new_receivable': 'Piutang Baru' 
        };
        return map[item.type] || item.type;
    };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <ModalInfo {...modal} onClose={() => setModal({...modal, isOpen: false})} />

      {/* HEADER */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate('/journal')} className="p-2 rounded-full hover:bg-slate-100 text-slate-600">
            <ArrowLeft size={20} />
        </button>
        <div>
            <h1 className="text-lg font-bold text-slate-800">Posting Jurnal</h1>
            <p className="text-xs text-slate-500">Integrasi 4 Sumber Data</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* FILTER CARD */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex gap-2 mb-3">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-lg text-xs font-bold"/>
                <span className="self-center">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-lg text-xs font-bold"/>
            </div>
            <button onClick={handleSearch} disabled={isProcessing} className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg text-sm shadow-md active:scale-95 transition flex justify-center items-center gap-2">
                {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <Search size={16}/>} Cari Data Pending
            </button>
        </div>

        {/* LIST */}
        {candidates.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col max-h-[60vh]">
                <div className="p-3 bg-slate-50 border-b flex justify-between items-center text-xs font-bold text-slate-600">
                    <span>{candidates.length} Item Ditemukan</span>
                    {progress > 0 && <span>{progress}%</span>}
                </div>
                {/* Progress Bar */}
                <div className="h-1 bg-slate-100 w-full"><div className="h-full bg-green-500 transition-all duration-300" style={{width: `${progress}%`}}></div></div>

                <div className="overflow-y-auto p-2 space-y-2 flex-1">
                    {candidates.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                            {/* UPDATE: Gunakan item, bukan item.source saja */}
                            <div className="bg-slate-50 p-2 rounded-lg">{getIcon(item)}</div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    {/* UPDATE: Panggil getLabel dengan item full object */}
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                        item.raw?.type === 'opening_stock' || item.category === 'Saldo Awal'
                                            ? 'bg-purple-100 text-purple-600' // Warna Modal (Ungu)
                                            : item.type === 'income' 
                                                ? 'bg-green-100 text-green-600' // Warna Penjualan (Hijau)
                                                : 'bg-slate-100 text-slate-500' // Default (Abu)
                                    }`}>
                                        {getLabel(item)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{new Date(item.date).toLocaleDateString('id-ID')}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-800 truncate">{item.description}</p>
                                <p className="text-[10px] text-slate-500 truncate">{item.category}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-indigo-600">{formatIDR(item.amount)}</p>
                                <div className="flex justify-end mt-1">
                                    {item.status === 'idle' && <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 rounded">Pending</span>}
                                    {item.status === 'processing' && <Loader2 size={12} className="animate-spin text-indigo-500"/>}
                                    {item.status === 'success' && <CheckCircle2 size={14} className="text-green-500"/>}
                                    {item.status === 'error' && <XCircle size={14} className="text-red-500"/>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-3 border-t bg-white">
                    <button 
                        onClick={handleStartProcess} 
                        // Logic Disabled: Sedang proses ATAU Semua sudah sukses ATAU Data kosong
                        disabled={isProcessing || candidates.every(c => c.status === 'success') || candidates.length === 0} 
                        className={`
                            w-full py-3 font-bold rounded-lg text-sm shadow transition flex justify-center items-center gap-2
                            ${isProcessing || candidates.every(c => c.status === 'success') || candidates.length === 0
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' // Style saat Disabled
                                : 'bg-green-600 hover:bg-green-700 text-white active:scale-95' // Style saat Aktif
                            }
                        `}
                    >
                        {isProcessing ? 'Memproses...' : 'Posting Ke Jurnal'} 
                        {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Play size={16} fill="currentColor"/>}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}