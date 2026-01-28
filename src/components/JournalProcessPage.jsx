import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUnpostedTransactions, processSingleTransaction } from '../utils/journalWorker';
import { ensureUserHasCOA } from '../utils/accountingService';
import { useAuth } from '../context/AuthProvider';
import ModalInfo from '../components/ModalInfo'; // Pastikan path import benar
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, Play, Loader2, Search } from 'lucide-react';

export default function JournalProcessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State Filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [onlyBusiness, setOnlyBusiness] = useState(true); // Filter Default: Bisnis Only

  // State Data & Proses
  const [candidates, setCandidates] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]); // Log detail eksekusi

  // Modal State
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', confirmText: 'Oke' });
  const showModal = (type, title, message, confirmText) => setModal({ isOpen: true, type, title, message, confirmText });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // Init Tanggal (Default 1 Minggu Terakhir)
  useEffect(() => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    setStartDate(lastWeek.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  // Handle Perubahan Tanggal (Auto Set EndDate +7 hari jika StartDate berubah)
  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    if (newStart) {
        const dateObj = new Date(newStart);
        dateObj.setDate(dateObj.getDate() + 7);
        setEndDate(dateObj.toISOString().split('T')[0]);
    }
  };

  // --- 1. CARI TRANSAKSI ---
  const handleSearch = async () => {
    setCandidates([]);
    setLogs([]);
    setIsProcessing(true);
    
    try {
        const data = await fetchUnpostedTransactions(user.id, startDate, endDate);
        
        // Filter awal: Hanya yang belum dijurnal
        let cleanData = data.filter(d => d.is_journalized === false);

        // Filter Opsi: Hanya Bisnis?
        if (onlyBusiness) {
            cleanData = cleanData.filter(d => 
                ['BUSINESS', 'ORGANIZATION', 'SALARY'].includes(d.allocation_type)
            );
        }

        // Siapkan format data antrian
        const formattedData = cleanData.map(item => ({ 
            ...item, 
            status: 'idle', // idle, processing, success, error, skipped
            errorMsg: '' 
        }));
        
        setCandidates(formattedData);
        setProgress(0);
        
        if (formattedData.length === 0) {
            showModal('info', 'Semua Beres! ☕', onlyBusiness ? 'Tidak ada transaksi BISNIS yang pending.' : 'Tidak ada transaksi apapun yang pending.');
        }
    } catch (error) {
        showModal('error', 'Gagal Mengambil Data', error.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- 2. EKSEKUSI JURNAL ---
  const handleStartProcess = async () => {
    if (candidates.length === 0) return;
    
    try {
        await ensureUserHasCOA(user.id); // Pastikan COA ada dulu
    } catch (e) {
        showModal('error', 'COA Error', 'Gagal memuat Chart of Accounts. Hubungi admin.');
        return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;
    
    // Copy array state ke variabel lokal agar tidak mutate state langsung
    let queue = [...candidates]; 

    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];

        // Skip jika sudah sukses sebelumnya (misal user klik proses ulang untuk yang gagal)
        if (item.status === 'success' || item.status === 'skipped') {
            successCount++;
            continue;
        }

        // Update status UI -> Processing
        updateCandidateStatus(i, 'processing');

        // Jeda buatan (Throttle) agar API tidak tersedak (opsional, sesuaikan kebutuhan)
        if (i > 0) await new Promise(r => setTimeout(r, 1500)); 

        try {
            // PROSES INTI
            const result = await processSingleTransaction(user.id, item);

            if (result.success) {
                // Sukses Jurnal atau Sengaja di-Skip (misal Personal)
                const finalStatus = result.status === 'skipped' ? 'skipped' : 'success';
                updateCandidateStatus(i, finalStatus);
                successCount++;
            } else {
                // Gagal Logic (misal AI bingung atau validasi gagal)
                updateCandidateStatus(i, 'error', result.error || 'Gagal memproses jurnal.');
                failCount++;
            }
        } catch (err) {
            // Gagal Teknis (Network error, dsb)
            console.error("Critical Process Error:", err);
            updateCandidateStatus(i, 'error', err.message || 'Terjadi kesalahan sistem.');
            failCount++;
        }

        // Update Progress Bar
        const percent = Math.round(((i + 1) / queue.length) * 100);
        setProgress(percent);
    }

    setIsProcessing(false);

    // Report Akhir
    setTimeout(() => {
        if (failCount === 0) {
            showModal('success', 'Selesai Sempurna! 🎉', `Berhasil memproses ${successCount} transaksi. Buku besar telah diperbarui.`, 'Mantap');
        } else {
            showModal('error', 'Selesai dengan Catatan ⚠️', `${successCount} Sukses, ${failCount} Gagal. Silakan cek item yang merah dan coba lagi.`, 'Cek Data');
        }
    }, 500);
  };

  // Helper update state item spesifik
  const updateCandidateStatus = (index, status, msg = '') => {
      setCandidates(prev => {
          const newData = [...prev];
          newData[index] = { ...newData[index], status: status, errorMsg: msg };
          return newData;
      });
  };

  // Helper Reset
  const handleReset = () => {
      setCandidates([]);
      setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <ModalInfo {...modal} onClose={closeModal} />

      {/* HEADER */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
            <ArrowLeft size={20} />
        </button>
        <div>
            <h1 className="text-lg font-bold text-gray-800">Proses Jurnal Otomatis</h1>
            <p className="text-xs text-gray-500">Posting transaksi ke Buku Besar dengan AI</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* CARD 1: FILTER & PENCARIAN */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex gap-3 mb-4">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block ml-1">Dari Tanggal</label>
                    <input type="date" value={startDate} onChange={handleStartDateChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-indigo-500"/>
                </div>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block ml-1">Sampai</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-indigo-500"/>
                </div>
            </div>

            {/* Opsi Filter Bisnis */}
            <div className="flex items-center gap-2 mb-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100 cursor-pointer" onClick={() => setOnlyBusiness(!onlyBusiness)}>
                <div className={`w-5 h-5 rounded flex items-center justify-center border ${onlyBusiness ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                    {onlyBusiness && <CheckCircle2 size={14} className="text-white"/>}
                </div>
                <span className="text-xs font-bold text-indigo-800">Hanya Transaksi Bisnis (Rekomendasi)</span>
            </div>

            <button 
                onClick={handleSearch} 
                disabled={isProcessing} 
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:shadow-none"
            >
                {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <Search size={20}/>}
                {isProcessing ? 'Sedang Mencari...' : 'Cari Transaksi Pending'}
            </button>
        </div>

        {/* CARD 2: LIST ANTRIAN & PROGRESS */}
        {candidates.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col max-h-[60vh]">
                {/* Header List */}
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                        <span className="font-bold text-gray-700 text-sm">{candidates.length} Transaksi Ditemukan</span>
                    </div>
                    {progress > 0 && <span className="font-bold text-indigo-600 text-sm">{progress}%</span>}
                </div>

                {/* Progress Line */}
                <div className="h-1 bg-gray-100 w-full shrink-0">
                    <div className="h-full bg-green-500 transition-all duration-300 ease-out" style={{width: `${progress}%`}}></div>
                </div>

                {/* Scrollable List */}
                <div className="overflow-y-auto p-2 space-y-2 flex-1 bg-gray-50/50">
                    {candidates.map((item) => (
                        <div key={item.id} className={`p-3 rounded-xl border flex flex-col gap-2 transition ${item.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                            
                            <div className="flex justify-between items-start">
                                {/* Kiri */}
                                <div>
                                    <p className="font-bold text-gray-800 text-sm line-clamp-1">{item.merchant || item.name || 'Transaksi Tanpa Nama'}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{new Date(item.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${item.allocation_type === 'BUSINESS' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {item.allocation_type}
                                        </span>
                                    </div>
                                </div>

                                {/* Kanan */}
                                <div className="text-right">
                                    <p className={`font-bold text-sm ${item.type === 'income' ? 'text-green-600' : 'text-gray-800'}`}>
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits:0 }).format(item.total_amount)}
                                    </p>
                                    
                                    {/* Status Badge */}
                                    <div className="mt-1 flex justify-end">
                                        {item.status === 'idle' && <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Menunggu</span>}
                                        {item.status === 'processing' && <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Proses</span>}
                                        {item.status === 'success' && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10}/> Sukses</span>}
                                        {item.status === 'skipped' && <span className="text-[10px] text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">Dilewati</span>}
                                        {item.status === 'error' && <span className="text-[10px] text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle size={10}/> Gagal</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Pesan Error (Jika Ada) */}
                            {item.status === 'error' && item.errorMsg && (
                                <div className="bg-red-100 text-red-700 text-[10px] p-2 rounded-lg flex items-start gap-2">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0"/>
                                    {item.errorMsg}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-gray-100 bg-white shrink-0">
                    {/* Jika ada yang error, tombol berubah jadi "Coba Lagi yang Gagal" */}
                    {candidates.some(c => c.status === 'error') ? (
                        <button 
                            onClick={handleStartProcess} 
                            disabled={isProcessing} 
                            className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg active:scale-95 transition flex items-center justify-center gap-2 hover:bg-orange-600"
                        >
                            <Play size={20} fill="currentColor"/> Proses Ulang Yang Gagal
                        </button>
                    ) : (
                        // Normal Button
                        <button 
                            onClick={handleStartProcess} 
                            disabled={isProcessing || candidates.every(c => c.status === 'success' || c.status === 'skipped')} 
                            className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
                        >
                            {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <Play size={20} fill="currentColor"/>}
                            {isProcessing ? 'AI Sedang Bekerja...' : 'Mulai Posting Jurnal'}
                        </button>
                    )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}