import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getComparativeProfitLoss, getMonthlyTrendReport } from '../utils/reportService';
import { useAuth } from '../context/AuthProvider';
import ModalInfo from './ModalInfo';

export default function ProfitLossPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- STATE FILTER ---
  const [showFilter, setShowFilter] = useState(false);
  
  // Konfigurasi Filter
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [compareMethod, setCompareMethod] = useState('NONE'); // NONE, YOY, MOM, DOD, TREND
  
  // Khusus MoM Manual Selection
  const [compareMonth, setCompareMonth] = useState(new Date().getMonth()); 

  // Khusus Date on Date (Manual Range)
  const [dodStartA, setDodStartA] = useState('');
  const [dodEndA, setDodEndA] = useState('');
  const [dodStartB, setDodStartB] = useState('');
  const [dodEndB, setDodEndB] = useState('');

  // Hasil Filter yang dipakai untuk Query
  const [activeFilter, setActiveFilter] = useState({ 
    mode: 'NORMAL', 
    rangeA: { start: '', end: '', label: '' },
    rangeB: null
  });

  // State Data
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', confirmText: 'Oke' });

  // Init Data Default
  useEffect(() => {
    applyFilter(); // Load default (Bulan Ini)
  }, []);

  // --- HELPER: FORMAT TANGGAL YANG AMAN ---
  // Mencegah bug timezone (H-1)
  const formatDateLabel = (dateStr) => {
      if(!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getMonthName = (monthIndex) => {
      return new Date(2000, monthIndex, 1).toLocaleDateString('id-ID', { month: 'long' });
  };

  // --- LOGIKA SMART CALCULATOR TANGGAL ---
  const applyFilter = () => {
    // 1. RESET DATA DULU (PENTING BIAR GAK CRASH) 🚨
    setReportData(null);
    setShowFilter(false);

    const y = parseInt(selectedYear);
    const m = parseInt(selectedMonth) - 1; 

    let startA, endA, startB, endB;
    let labelA = '', labelB = '';

    // --- KASUS 1: TREND BULANAN (12 Bulan) ---
    if (compareMethod === 'TREND') {
        const filterTrend = {
            mode: 'TREND',
            rangeA: { label: `Trend Bulanan ${y}` },
            rangeB: null,
            year: y
        };
        setActiveFilter(filterTrend);
        loadTrendReport(y);
        return;
    }

    // --- KASUS 2: DATE ON DATE (Manual Tanggal) ---
    if (compareMethod === 'DOD') {
        if(!dodStartA || !dodEndA || !dodStartB || !dodEndB) {
            setModal({ isOpen: true, type: 'error', title: 'Data Kurang', message: 'Harap isi semua tanggal untuk mode Date on Date.', confirmText: 'Oke' });
            return;
        }
        
        // PENTING: Pakai string langsung dari input (YYYY-MM-DD)
        // Jangan di-new Date() dulu biar gak kena Timezone Shift
        startA = dodStartA; 
        endA = dodEndA;
        startB = dodStartB; 
        endB = dodEndB;
        
        labelA = `${formatDateLabel(startA)} - ${formatDateLabel(endA)}`;
        labelB = `${formatDateLabel(startB)} - ${formatDateLabel(endB)}`;
    } 
    
    // --- KASUS 3: NORMAL / YOY / MOM (Otomatis) ---
    else {
        // Helper buat bikin YYYY-MM-DD lokal tanpa geser jam
        const makeDateStr = (year, month, day) => {
            const mm = String(month + 1).padStart(2, '0'); // JS Month 0-based
            const dd = String(day).padStart(2, '0');
            return `${year}-${mm}-${dd}`;
        };

        const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

        // Range A
        startA = makeDateStr(y, m, 1);
        endA = makeDateStr(y, m, daysInMonth(y, m));
        labelA = `${getMonthName(m)} ${y}`;

        if (compareMethod === 'YOY') {
            startB = makeDateStr(y - 1, m, 1);
            endB = makeDateStr(y - 1, m, daysInMonth(y - 1, m));
            labelB = `${getMonthName(m)} ${y - 1}`;
        } else if (compareMethod === 'MOM') {
            const m2 = parseInt(compareMonth) - 1;
            // Handle beda tahun sederhana (asumsi tahun sama utk UI simple)
            startB = makeDateStr(y, m2, 1);
            endB = makeDateStr(y, m2, daysInMonth(y, m2));
            labelB = `${getMonthName(m2)} ${y}`;
        }
    }

    const rA = { start: startA, end: endA, label: labelA };
    const rB = (compareMethod !== 'NONE') ? { start: startB, end: endB, label: labelB } : null;

    setActiveFilter({ mode: 'NORMAL', rangeA: rA, rangeB: rB });
    loadComparativeReport(rA, rB);
  };

  // --- LOADER ---
  const loadComparativeReport = async (rA, rB) => {
    setLoading(true);
    try {
        const data = await getComparativeProfitLoss(user.id, rA, rB);
        setReportData(data);
    } catch (error) {
        setModal({ isOpen: true, type: 'error', title: 'Gagal', message: error.message, confirmText: 'Tutup' });
    } finally { setLoading(false); }
  };

  const loadTrendReport = async (year) => {
    setLoading(true);
    try {
        const data = await getMonthlyTrendReport(user.id, year);
        setReportData(data);
    } catch (error) {
        setModal({ isOpen: true, type: 'error', title: 'Gagal', message: error.message, confirmText: 'Tutup' });
    } finally { setLoading(false); }
  };

  const formatIDR = (num) => {
      if (num === 0 || num === undefined) return '-';
      return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num);
  };

  // --- KOMPONEN BARIS TABEL (NORMAL) ---
  const NormalRow = ({ code, name, current, prev, isHeader = false, isTotal = false }) => {
    const displayCurrent = current < 0 ? `(${formatIDR(Math.abs(current))})` : formatIDR(current);
    let growth = 0, growthColor = 'text-gray-400', displayPrev = '-';

    if (activeFilter.rangeB && prev !== undefined) {
        displayPrev = prev < 0 ? `(${formatIDR(Math.abs(prev))})` : formatIDR(prev);
        if (prev !== 0) {
            growth = ((current - prev) / prev) * 100;
            growthColor = growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-500' : 'text-gray-400';
        }
    }

    if (isHeader) return <tr className="bg-gray-100"><td colSpan={activeFilter.rangeB ? 5 : 3} className="py-2 px-3 font-bold text-gray-700 text-xs uppercase">{name}</td></tr>;

    return (
        <tr className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${isTotal ? 'bg-indigo-50 font-bold' : ''}`}>
            <td className={`py-3 px-3 text-xs ${isTotal ? 'text-transparent' : 'text-gray-500 font-mono'}`}>{code}</td>
            <td className={`py-3 px-3 text-sm ${isTotal ? 'text-indigo-900' : 'text-gray-700'}`}>{name}</td>
            <td className={`py-3 px-3 text-sm text-right ${isTotal ? 'text-indigo-900' : 'text-gray-800'}`}>{displayCurrent}</td>
            {activeFilter.rangeB && (
                <>
                    <td className="py-3 px-3 text-sm text-right text-gray-400">{displayPrev}</td>
                    <td className={`py-3 px-3 text-xs text-right font-bold ${growthColor}`}>{prev !== 0 ? `${growth.toFixed(1)}%` : '-'}</td>
                </>
            )}
        </tr>
    );
  };

  // --- KOMPONEN BARIS TABEL (TREND / 12 BULAN) ---
  const TrendRow = ({ code, name, months, total, isHeader = false, isTotal = false }) => {
     
     // FIX: HEADER KATEGORI (PENDAPATAN / BEBAN)
     // Kita pecah jadi 2 Cell: 
     // 1. Cell Sticky (Gabungan Kode + Nama) -> Diam di kiri
     // 2. Cell Sisa (Bulan2) -> Ikut scroll
     if (isHeader) return (
        <tr className="bg-gray-100 border-b border-gray-200">
            {/* BAGIAN KIRI: DIAM (STICKY) */}
            <td 
                colSpan={2} 
                className="py-2 px-3 font-bold text-gray-700 text-xs uppercase sticky left-0 z-20 bg-gray-100 border-r border-gray-200 text-left"
            >
                {name}
            </td>
            {/* BAGIAN KANAN: SCROLLABLE (Background Filler) */}
            {/* colSpan 13 = 12 Bulan + 1 Total */}
            <td colSpan={13} className="bg-gray-100"></td>
        </tr>
     );
     
     // FIX: BARIS DATA & TOTAL
     return (
        <tr className={`border-b border-gray-50 hover:bg-gray-50 ${isTotal ? 'bg-indigo-50 font-bold' : ''}`}>
            
            {/* KOLOM 1: KODE (Sticky Left 0) */}
            <td className={`py-3 px-3 text-xs font-mono sticky left-0 z-10 border-r border-gray-100 min-w-[80px] 
                ${isTotal ? 'bg-indigo-50 text-transparent' : 'bg-white/95 text-gray-500'}`}>
                {code}
            </td>
            
            {/* KOLOM 2: NAMA AKUN (Sticky Left 80px) */}
            {/* Kita kasih bg-white/95 biar gak transparan pas discroll */}
            <td className={`py-3 px-3 text-sm whitespace-nowrap sticky left-[80px] z-10 border-r border-gray-100 min-w-[150px] 
                ${isTotal ? 'bg-indigo-50 text-indigo-900 uppercase' : 'bg-white/95 text-gray-700'}`}>
                {name}
            </td>

            {/* KOLOM 3-14: DATA BULANAN (Scrollable) */}
            {months.map((val, idx) => (
                <td key={idx} className="py-3 px-3 text-xs text-right min-w-[100px] border-r border-gray-50">
                    {formatIDR(val)}
                </td>
            ))}

            {/* KOLOM 15: TOTAL TAHUNAN */}
            <td className={`py-3 px-3 text-sm text-right font-bold min-w-[120px] 
                ${isTotal ? 'text-indigo-900 bg-indigo-100' : 'bg-gray-50'}`}>
                {formatIDR(total)}
            </td>
        </tr>
     );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 font-sans">
       <ModalInfo {...modal} onClose={() => setModal({...modal, isOpen: false})} />
       
       {/* HEADER & FILTER BUTTON */}
       <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/reports-menu')} className="p-2 bg-white rounded-full shadow-sm text-gray-600 active:scale-95">←</button>
                <div>
                    <h1 className="text-xl font-bold text-gray-800">Laba Rugi</h1>
                    <p className="text-xs text-gray-500">Profit & Loss Statement</p>
                </div>
            </div>
            
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                <div className="text-xs">
                    <span className="text-gray-400 block mb-1">Filter Aktif</span>
                    <span className="font-bold text-gray-800 text-sm truncate max-w-[200px]">{activeFilter.rangeA.label}</span>
                </div>
                <button onClick={() => setShowFilter(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-emerald-600 transition active:scale-95 flex items-center gap-2">
                    <span>⚙️ Filter</span>
                </button>
            </div>
       </div>

      {/* --- MODAL FILTER --- */}
      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] animate-scale-up">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Filter Laporan</h3>
                    <button onClick={() => setShowFilter(false)} className="text-gray-400 hover:text-red-500">✕</button>
                </div>

                <div className="p-5 space-y-4">
                    {/* METODE PERBANDINGAN */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Mode Laporan</label>
                        <select value={compareMethod} onChange={(e) => setCompareMethod(e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-indigo-500 shadow-sm">
                            <option value="NONE">📅 Standar (1 Periode)</option>
                            <option value="YOY">🔄 Year On Year (Tahun Lalu)</option>
                            <option value="MOM">🌓 Month On Month (Bandingkan Bulan)</option>
                            <option value="DOD">📆 Date On Date (Antar Tanggal)</option>
                            <option value="TREND">📈 Trend Pergerakan (12 Bulan)</option>
                        </select>
                    </div>

                    {/* FORM: TREND */}
                    {compareMethod === 'TREND' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Tahun</label>
                            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold">
                                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* FORM: DATE ON DATE (DoD) */}
                    {compareMethod === 'DOD' && (
                        <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1">Range A (Utama)</label>
                                <div className="flex gap-2">
                                    <input type="date" value={dodStartA} onChange={(e)=>setDodStartA(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-xs font-bold"/>
                                    <input type="date" value={dodEndA} onChange={(e)=>setDodEndA(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-xs font-bold"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1">Range B (Pembanding)</label>
                                <div className="flex gap-2">
                                    <input type="date" value={dodStartB} onChange={(e)=>setDodStartB(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-xs font-bold"/>
                                    <input type="date" value={dodEndB} onChange={(e)=>setDodEndB(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-xs font-bold"/>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FORM: STANDAR / YOY / MOM */}
                    {['NONE', 'YOY', 'MOM'].includes(compareMethod) && (
                        <div className="space-y-3">
                             <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Tahun</label>
                                    <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold">
                                        {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Bulan Utama</label>
                                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold">
                                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month:'long'})}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Opsi Khusus MOM */}
                            {compareMethod === 'MOM' && (
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <label className="block text-xs font-bold text-blue-600 mb-1">Bandingkan dengan Bulan:</label>
                                    <select value={compareMonth} onChange={(e) => setCompareMonth(e.target.value)} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm font-bold text-gray-700">
                                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month:'long'})}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 flex gap-3">
                    <button onClick={() => setShowFilter(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm">Batal</button>
                    <button onClick={applyFilter} className="flex-[2] py-3 bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg active:scale-95">Terapkan Filter</button>
                </div>
            </div>
        </div>
      )}

      {/* --- REPORT TABLE CONTENT --- */}
      {/* SAFE RENDER: Cek reportData DAN mode */}
      {reportData && activeFilter.mode === 'NORMAL' && (
         <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in-up mb-10">
            <div className="p-4 text-center border-b border-gray-100 bg-gray-50">
                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Laba Rugi</h2>
                <div className="flex flex-col gap-1 mt-2 text-xs items-center">
                    <span className="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm font-bold text-gray-700">{activeFilter.rangeA.label}</span>
                    {activeFilter.rangeB && <span className="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm text-gray-500">🆚 {activeFilter.rangeB.label}</span>}
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[350px]">
                    <thead className="bg-gray-100 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-200">
                        <tr>
                            <th className="py-3 px-3 text-left w-16">Kode</th>
                            <th className="py-3 px-3 text-left">Nama Akun</th>
                            <th className="py-3 px-3 text-right">{activeFilter.rangeA.label.length > 20 ? 'Periode A' : activeFilter.rangeA.label}</th>
                            {activeFilter.rangeB && <><th className="py-3 px-3 text-right text-gray-400">{activeFilter.rangeB.label.length > 20 ? 'Periode B' : activeFilter.rangeB.label}</th><th className="py-3 px-3 text-right text-indigo-400">%</th></>}
                        </tr>
                    </thead>
                    <tbody>
                        <NormalRow name="PENDAPATAN USAHA" isHeader />
                        {reportData.revenue.map(item => <NormalRow key={item.code} {...item} />)}
                        <NormalRow name="TOTAL PENDAPATAN" current={reportData.totalRevenue.current} prev={reportData.totalRevenue.prev} isTotal />
                        <tr><td colSpan={activeFilter.rangeB?5:3} className="h-4 bg-gray-50/50"></td></tr>
                        <NormalRow name="BEBAN OPERASIONAL" isHeader />
                        {reportData.expense.map(item => <NormalRow key={item.code} {...item} />)}
                        <NormalRow name="TOTAL BEBAN" current={reportData.totalExpense.current} prev={reportData.totalExpense.prev} isTotal />
                        <tr><td colSpan={activeFilter.rangeB?5:3} className="h-4 bg-gray-50/50"></td></tr>
                        <tr className="bg-emerald-600 text-white">
                            <td className="py-4 px-3"></td>
                            <td className="py-4 px-3 font-bold text-sm uppercase">Laba Bersih</td>
                            <td className="py-4 px-3 font-bold text-lg text-right">{formatIDR(reportData.netIncome.current)}</td>
                            {activeFilter.rangeB && <><td className="py-4 px-3 text-sm text-right opacity-70">{formatIDR(reportData.netIncome.prev)}</td><td className="py-4 px-3"></td></>}
                        </tr>
                    </tbody>
                </table>
            </div>
         </div>
      )}

      {/* SAFE RENDER: Cek reportData DAN mode TREND dan TOTALS ada */}
      {reportData && activeFilter.mode === 'TREND' && reportData.totals && (
         <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in-up mb-10">
            <div className="p-4 text-center border-b border-gray-100 bg-gray-50">
                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Pergerakan 12 Bulan</h2>
                <div className="mt-2 text-xs"><span className="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm font-bold text-gray-700">Tahun {activeFilter.year}</span></div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full">
                     <thead className="bg-gray-100 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-200">
                        <tr>
                            <th className="py-3 px-3 text-left sticky left-0 bg-gray-100 z-20 border-r border-gray-200">Kode</th>
                            <th className="py-3 px-3 text-left sticky left-[80px] bg-gray-100 z-20 border-r border-gray-200">Nama Akun</th>
                            {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map(m => (
                                <th key={m} className="py-3 px-3 text-right min-w-[100px] border-r border-gray-200">{m}</th>
                            ))}
                            <th className="py-3 px-3 text-right bg-indigo-50 min-w-[120px]">TOTAL</th>
                        </tr>
                     </thead>
                     <tbody>
                        <TrendRow name="PENDAPATAN" isHeader />
                        {reportData.revenue.map(item => <TrendRow key={item.code} {...item} />)}
                        <TrendRow name="TOTAL PENDAPATAN" months={reportData.totals.revenue} total={reportData.totals.revenue.reduce((a,b)=>a+b,0)} isTotal />
                        
                        <tr><td colSpan={14} className="h-4 bg-gray-50/50"></td></tr>
                        
                        <TrendRow name="BEBAN" isHeader />
                        {reportData.expense.map(item => <TrendRow key={item.code} {...item} />)}
                        <TrendRow name="TOTAL BEBAN" months={reportData.totals.expense} total={reportData.totals.expense.reduce((a,b)=>a+b,0)} isTotal />
                        
                        <tr><td colSpan={14} className="h-4 bg-gray-50/50"></td></tr>
                        
                        <tr className="bg-emerald-600 text-white font-bold">
                            <td className="sticky left-0 bg-emerald-600 z-10"></td>
                            <td className="py-4 px-3 text-sm uppercase sticky left-[80px] bg-emerald-600 z-10 border-r border-emerald-500">LABA BERSIH</td>
                            {reportData.totals.netIncome.map((val, idx) => (
                                <td key={idx} className="py-4 px-3 text-xs text-right border-r border-emerald-500">{formatIDR(val)}</td>
                            ))}
                            <td className="py-4 px-3 text-right bg-emerald-700">{formatIDR(reportData.totals.netIncome.reduce((a,b)=>a+b,0))}</td>
                        </tr>
                     </tbody>
                </table>
            </div>
         </div>
      )}
    </div>
  );
}