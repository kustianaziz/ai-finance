import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUnpostedTransactions, processSingleTransaction } from '../utils/journalWorker';
import { ensureUserHasCOA } from '../utils/accountingService';
import { useAuth } from '../context/AuthProvider';
import ModalInfo from './ModalInfo';

export default function JournalProcessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Modal State
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', confirmText: 'Oke' });
  const showModal = (type, title, message, confirmText) => setModal({ isOpen: true, type, title, message, confirmText });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // Init Tanggal (Default 1 Minggu)
  useEffect(() => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    setStartDate(lastWeek.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  // Handle Tanggal Otomatis (+7 Hari)
  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    
    if (newStart) {
        const dateObj = new Date(newStart);
        dateObj.setDate(dateObj.getDate() + 7);
        setEndDate(dateObj.toISOString().split('T')[0]);
    }
  };

  // Logic Fetch Data
  const handleSearch = async () => {
    setCandidates([]); 
    setIsProcessing(true);
    try {
        const data = await fetchUnpostedTransactions(user.id, startDate, endDate);
        
        // Cek ulang client side & format awal
        const cleanData = data.filter(d => d.is_journalized === false);
        const formattedData = cleanData.map(item => ({ ...item, status: 'idle', msg: '' }));
        
        setCandidates(formattedData);
        setProgress(0);
        
        if (formattedData.length === 0) {
            showModal('info', 'Semua Beres! ☕', 'Tidak ada transaksi pending di periode ini.');
        }
    } catch (error) {
        showModal('error', 'Error', error.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- LOGIC EKSEKUSI UTAMA ---
  const handleStartProcess = async () => {
    if (candidates.length === 0) return;
    await ensureUserHasCOA(user.id);
    setIsProcessing(true);
    
    let queue = [...candidates];
    let successCount = 0;

    for (let i = 0; i < queue.length; i++) {
        // 1. JEDA 2 DETIK (Agar AI tidak Overload/Error 503)
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. Update Status UI -> Processing
        queue[i].status = 'processing';
        setCandidates([...queue]); 
        
        // 3. Proses Transaksi
        const result = await processSingleTransaction(user.id, queue[i]);
        
        // 4. Update Hasil
        if (result.success) {
            successCount++;
            // Cek apakah statusnya 'skipped' (Pribadi) atau 'journalized' (Bisnis)
            const finalStatus = result.status === 'skipped' ? 'skipped' : 'success';
            queue[i].status = finalStatus;
        } else {
            queue[i].status = 'error';
            queue[i].msg = result.error; // Simpan pesan error
        }
        
        // 5. Update Progress Bar
        const percent = Math.round(((i + 1) / queue.length) * 100);
        setProgress(percent);
        setCandidates([...queue]);
    }

    setIsProcessing(false);
    
    // Tampilkan Modal Hasil setelah jeda dikit
    setTimeout(() => {
        if (successCount === 0) showModal('error', 'Gagal Total', 'Silakan coba lagi nanti.', 'Siap');
        else if (successCount < queue.length) showModal('info', 'Selesai Sebagian', `Sukses: ${successCount}, Gagal: ${queue.length - successCount}`, 'Ok');
        else showModal('success', 'Selesai Sempurna! 🎉', `Berhasil memproses ${successCount} transaksi.`, 'Mantap');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 relative">
      <ModalInfo {...modal} onClose={closeModal} />

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-white rounded-full shadow-sm text-gray-600 active:scale-95">←</button>
        <div>
            <h1 className="text-xl font-bold text-gray-800">Proses Jurnal</h1>
            <p className="text-xs text-gray-500">Posting transaksi ke Buku Besar</p>
        </div>
      </div>

      {/* CARD 1: FILTER */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 mb-6">
        <div className="flex gap-3 mb-4">
            <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Dari</label>
                <input type="date" value={startDate} onChange={handleStartDateChange} className="w-full p-2 border rounded-lg text-sm font-bold bg-gray-50"/>
            </div>
            <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Sampai</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold bg-gray-50"/>
            </div>
        </div>
        <button onClick={handleSearch} disabled={isProcessing} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition">
            🔍 Cari Transaksi Pending
        </button>
      </div>

      {/* CARD 2: LIST & EKSEKUSI */}
      {candidates.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <span className="font-bold text-gray-700 text-sm">{candidates.length} Antrian</span>
                {progress > 0 && <span className="font-bold text-indigo-600 text-sm transition-all duration-300">{progress}%</span>}
            </div>
            
            {/* PROGRESS BAR */}
            <div className="h-1 bg-gray-100 w-full">
                <div className="h-full bg-green-500 transition-all duration-500 ease-out" style={{width: `${progress}%`}}></div>
            </div>
            
            {/* LIST ANTRIAN (TAMPILAN BARU) */}
            <div className="max-h-[500px] overflow-y-auto p-2 space-y-2">
                {candidates.map((item) => (
                    <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm hover:shadow-md transition">
                        
                        {/* KIRI: Info Transaksi */}
                        <div>
                            <div className="font-bold text-gray-800 text-sm">{item.merchant}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                <span>{item.category}</span>
                                <span>•</span>
                                <span>{new Date(item.date).toLocaleDateString('id-ID')}</span>
                                
                                {/* BADGE TIPE ALOKASI */}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                    item.allocation_type === 'PERSONAL' ? 'bg-gray-200 text-gray-600' :
                                    item.allocation_type === 'PRIVE' ? 'bg-orange-100 text-orange-600' :
                                    item.allocation_type === 'SALARY' ? 'bg-purple-100 text-purple-600' :
                                    'bg-blue-50 text-blue-600'
                                }`}>
                                    {item.allocation_type === 'PERSONAL' ? 'SKIP' : item.allocation_type || 'BISNIS'}
                                </span>
                            </div>
                        </div>

                        {/* KANAN: Nominal & Status */}
                        <div className="text-right">
                            <div className="font-bold text-sm mb-1 text-gray-800">
                                {new Intl.NumberFormat('id-ID').format(item.total_amount)}
                            </div>

                            {/* STATUS LOGIC */}
                            {item.status === 'idle' && <span className="text-gray-300 text-xs italic">Menunggu...</span>}
                            
                            {item.status === 'processing' && (
                                <div className="flex items-center justify-end gap-1 text-indigo-600">
                                    <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs font-bold">Proses...</span>
                                </div>
                            )}
                            
                            {item.status === 'success' && (
                                <div className="flex items-center justify-end gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                    <span className="text-xs font-bold">Sukses</span>
                                    <span>✅</span>
                                </div>
                            )}

                            {/* STATUS SKIPPED (PRIBADI) */}
                            {item.status === 'skipped' && (
                                <div className="flex items-center justify-end gap-1 text-gray-500 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">
                                    <span className="text-[10px] font-bold uppercase">Diabaikan</span>
                                    <span>🚫</span>
                                </div>
                            )}
                            
                            {item.status === 'error' && (
                                <div className="text-red-500 text-xs text-right">
                                    <div className="flex items-center justify-end gap-1 font-bold bg-red-50 px-2 py-1 rounded-lg">
                                        <span>Gagal</span> ❌
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* TOMBOL EKSEKUSI */}
            <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0 z-10">
                <button 
                    onClick={handleStartProcess} 
                    disabled={isProcessing || candidates.every(c => c.status === 'success' || c.status === 'skipped')}
                    className={`w-full py-3 font-bold rounded-xl shadow-lg transition active:scale-95 ${isProcessing || candidates.every(c => c.status === 'success' || c.status === 'skipped') ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white'}`}
                >
                    {isProcessing ? 'Sedang Memproses...' : '⚡ Eksekusi Jurnal'}
                </button>
            </div>
        </div>
      )}
    </div>
  );
}