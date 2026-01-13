import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUnpostedTransactions, processSingleTransaction } from '../utils/journalWorker';
import { ensureUserHasCOA } from '../utils/accountingService';
import { getComparativeProfitLoss } from '../utils/reportService'; // Updated Import
import { useAuth } from '../context/AuthProvider';
import ModalInfo from './ModalInfo';

export default function AccountingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // STATE UI
  const [activeTab, setActiveTab] = useState('report'); // Default langsung ke Laporan biar cepet ngecek

  // State Filter Laporan
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useYoY, setUseYoY] = useState(false); // Toggle Bandingkan Tahun Lalu

  // State Data
  const [candidates, setCandidates] = useState([]); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Modal
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', confirmText: 'Oke' });
  const showModal = (type, title, message, confirmText) => setModal({ isOpen: true, type, title, message, confirmText });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // INIT TANGGAL (Awal Bulan - Akhir Bulan Ini)
  useEffect(() => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  // --- LOGIC PROSES JURNAL (Sama Kayak Kemarin) ---
  const handleSearchCandidates = async () => {
    setIsProcessing(true);
    try {
        const data = await fetchUnpostedTransactions(user.id, startDate, endDate);
        const formattedData = data.map(item => ({ ...item, status: 'idle', msg: '' }));
        setCandidates(formattedData);
        setProgress(0);
        if (formattedData.length === 0) showModal('info', 'Beres!', 'Tidak ada transaksi pending.');
    } catch (error) { showModal('error', 'Error', error.message); } 
    finally { setIsProcessing(false); }
  };

  const handleStartProcess = async () => {
    if (candidates.length === 0) return;
    await ensureUserHasCOA(user.id);
    setIsProcessing(true);
    let queue = [...candidates];
    let successCount = 0;
    for (let i = 0; i < queue.length; i++) {
        queue[i].status = 'processing';
        setCandidates([...queue]); 
        const result = await processSingleTransaction(user.id, queue[i]);
        if (result.success) { queue[i].status = 'success'; successCount++; } 
        else { queue[i].status = 'error'; queue[i].msg = result.error; }
        setProgress(Math.round(((i + 1) / queue.length) * 100));
        setCandidates([...queue]);
    }
    setIsProcessing(false);
    showModal('success', 'Selesai!', `Berhasil menjurnal ${successCount} transaksi.`);
  };

  // --- LOGIC LOAD LAPORAN (BARU) ---
  const handleLoadReport = async () => {
    setLoadingReport(true);
    try {
        // Panggil fungsi baru yang support YoY
        const data = await getComparativeProfitLoss(user.id, startDate, endDate, useYoY);
        setReportData(data);
    } catch (error) {
        showModal('error', 'Gagal', 'Gagal memuat laporan: ' + error.message);
    } finally {
        setLoadingReport(false);
    }
  };

  const formatIDR = (num) => {
      if (num === 0) return '-';
      return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num);
  };

  // Komponen Baris Tabel Biar Rapi
  const TableRow = ({ code, name, current, prev, isHeader = false, isTotal = false }) => {
    const isNegative = current < 0;
    const displayCurrent = isNegative ? `(${formatIDR(Math.abs(current))})` : formatIDR(current);
    const displayPrev = prev < 0 ? `(${formatIDR(Math.abs(prev))})` : formatIDR(prev);
    
    // Hitung % Pertumbuhan
    let growth = 0;
    let growthColor = 'text-gray-400';
    if (useYoY && prev !== 0) {
        growth = ((current - prev) / prev) * 100;
        growthColor = growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-500' : 'text-gray-400';
    }

    if (isHeader) return (
        <tr className="bg-gray-100">
            <td colSpan={useYoY ? 5 : 3} className="py-2 px-3 font-bold text-gray-700 text-xs uppercase tracking-wider">{name}</td>
        </tr>
    );

    return (
        <tr className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 transition ${isTotal ? 'bg-indigo-50 font-bold' : ''}`}>
            <td className={`py-3 px-3 text-xs ${isTotal ? 'text-transparent' : 'text-gray-500 font-mono'}`}>{code}</td>
            <td className={`py-3 px-3 text-sm ${isTotal ? 'text-indigo-900' : 'text-gray-700'}`}>{name}</td>
            <td className={`py-3 px-3 text-sm text-right ${isTotal ? 'text-indigo-900' : 'text-gray-800'}`}>{displayCurrent}</td>
            
            {useYoY && (
                <>
                    <td className="py-3 px-3 text-sm text-right text-gray-400">{displayPrev}</td>
                    <td className={`py-3 px-3 text-xs text-right font-bold ${growthColor}`}>
                        {prev !== 0 ? `${growth.toFixed(1)}%` : '-'}
                    </td>
                </>
            )}
        </tr>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 relative font-sans">
      <ModalInfo {...modal} onClose={closeModal} />

      {/* HEADER */}
      <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-white rounded-full shadow-sm text-gray-600">←</button>
            <h1 className="text-xl font-bold text-gray-800">Laporan Keuangan</h1>
      </div>

      {/* TAB SWITCHER */}
      <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex mb-6">
        <button onClick={() => setActiveTab('report')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'report' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500'}`}>📊 Laporan Laba Rugi</button>
        <button onClick={() => setActiveTab('process')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'process' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500'}`}>⚙️ Proses Jurnal</button>
      </div>

      {/* FILTER AREA (Khusus Tab Laporan) */}
      {activeTab === 'report' && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-4 animate-fade-in">
             <div className="flex gap-3 mb-4">
                <div className="flex-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">Periode Awal</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 font-bold text-gray-700"/>
                </div>
                <div className="flex-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">Periode Akhir</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 font-bold text-gray-700"/>
                </div>
            </div>
            
            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${useYoY ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${useYoY ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <input type="checkbox" checked={useYoY} onChange={(e) => setUseYoY(e.target.checked)} className="hidden" />
                    <span className="text-xs font-bold text-gray-600">Bandingkan Tahun Lalu</span>
                </label>

                <button 
                    onClick={handleLoadReport}
                    disabled={loadingReport}
                    className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg text-sm shadow-md active:scale-95 transition"
                >
                    {loadingReport ? 'Loading...' : 'Tampilkan'}
                </button>
            </div>
        </div>
      )}

      {/* === KONTEN TAB LAPORAN === */}
      {activeTab === 'report' && reportData && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in-up mb-10">
            {/* Kop Laporan */}
            <div className="p-6 text-center border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Laporan Laba Rugi</h2>
                <p className="text-xs text-gray-500 mt-1">Periode: {new Date(startDate).toLocaleDateString('id-ID', {month: 'long', year: 'numeric'})} s/d {new Date(endDate).toLocaleDateString('id-ID', {month: 'long', year: 'numeric'})}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 italic">Disajikan dalam Rupiah (IDR)</p>
            </div>

            {/* TABEL DATA */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[350px]">
                    <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-200">
                        <tr>
                            <th className="py-3 px-3 text-left w-16">Kode</th>
                            <th className="py-3 px-3 text-left">Nama Akun</th>
                            <th className="py-3 px-3 text-right">Tahun Ini</th>
                            {useYoY && (
                                <>
                                    <th className="py-3 px-3 text-right text-gray-400">Tahun Lalu</th>
                                    <th className="py-3 px-3 text-right text-indigo-400">%</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {/* BAGIAN PENDAPATAN */}
                        <TableRow name="PENDAPATAN USAHA" isHeader />
                        {reportData.revenue.map(item => (
                            <TableRow key={item.code} {...item} />
                        ))}
                        <TableRow 
                            name="TOTAL PENDAPATAN" 
                            current={reportData.totalRevenue.current} 
                            prev={reportData.totalRevenue.prev} 
                            isTotal 
                        />

                        {/* SPASI KOSONG */}
                        <tr><td colSpan={useYoY?5:3} className="h-4 bg-gray-50/50"></td></tr>

                        {/* BAGIAN BEBAN */}
                        <TableRow name="BEBAN OPERASIONAL" isHeader />
                        {reportData.expense.map(item => (
                            <TableRow key={item.code} {...item} />
                        ))}
                        <TableRow 
                            name="TOTAL BEBAN" 
                            current={reportData.totalExpense.current} 
                            prev={reportData.totalExpense.prev} 
                            isTotal 
                        />

                        {/* SPASI KOSONG */}
                        <tr><td colSpan={useYoY?5:3} className="h-4 bg-gray-50/50"></td></tr>

                        {/* LABA BERSIH */}
                        <tr className="bg-indigo-600 text-white">
                            <td className="py-4 px-3 font-mono text-xs opacity-50"></td>
                            <td className="py-4 px-3 font-bold text-sm uppercase">Laba Bersih</td>
                            <td className="py-4 px-3 font-bold text-lg text-right">
                                {formatIDR(reportData.netIncome.current)}
                            </td>
                            {useYoY && (
                                <>
                                    <td className="py-4 px-3 text-sm text-right opacity-70">
                                        {formatIDR(reportData.netIncome.prev)}
                                    </td>
                                    <td className="py-4 px-3 text-xs text-right font-bold">
                                         {reportData.netIncome.prev !== 0 ? 
                                            `${(((reportData.netIncome.current - reportData.netIncome.prev)/reportData.netIncome.prev)*100).toFixed(1)}%` 
                                            : '-'}
                                    </td>
                                </>
                            )}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* KONTEN TAB PROSES JURNAL (JANGAN DIHAPUS, BIAR TETAP ADA) */}
      {activeTab === 'process' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center animate-fade-in">
             <div className="mb-4 text-4xl">⚙️</div>
             <h3 className="font-bold text-gray-800 mb-2">Proses Jurnal Harian</h3>
             <p className="text-gray-500 text-sm mb-6">Pastikan semua transaksi harian sudah masuk buku besar sebelum melihat laporan.</p>
             
             {/* Re-use logic filter tanggal dari state atas */}
             <button 
                onClick={handleSearchCandidates} 
                disabled={isProcessing}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg active:scale-95 mb-4"
             >
                🔍 Cari & Proses Transaksi
             </button>

             {/* LIST STATUS PROSES (Copy Logic Lama Kesini jika mau ditampilkan) */}
             {candidates.length > 0 && (
                 <div className="text-left bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <p className="font-bold text-sm text-gray-700 mb-2">Antrian: {candidates.length}</p>
                    <div className="h-2 bg-gray-200 rounded-full mb-2 overflow-hidden">
                        <div className="h-full bg-green-500 transition-all" style={{width: `${progress}%`}}></div>
                    </div>
                    <button onClick={handleStartProcess} disabled={isProcessing} className="text-xs text-indigo-600 font-bold underline">Mulai Eksekusi</button>
                 </div>
             )}
        </div>
      )}

    </div>
  );
}