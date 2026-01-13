import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBalanceSheetReport, getMonthlyBalanceSheetTrend } from '../utils/reportService';
import { useAuth } from '../context/AuthProvider';
import ModalInfo from './ModalInfo';

export default function BalanceSheetPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- STATE FILTER ---
  const [showFilter, setShowFilter] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [compareMethod, setCompareMethod] = useState('NONE'); 
  
  // State Tambahan untuk Filter Lengkap
  const [compareMonth, setCompareMonth] = useState(new Date().getMonth()); // MoM
  const [dateA, setDateA] = useState(''); // DoD A
  const [dateB, setDateB] = useState(''); // DoD B

  const [activeFilter, setActiveFilter] = useState({ 
    mode: 'NORMAL', 
    rangeA: { end: '', label: '' },
    rangeB: null
  });

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', confirmText: 'Oke' });

  useEffect(() => { applyFilter(); }, []);

  // --- LOGIKA FILTER ---
  const applyFilter = () => {
    setReportData(null);
    setShowFilter(false);

    const y = parseInt(selectedYear);
    const m = parseInt(selectedMonth) - 1; 

    // KASUS 1: TREND 12 BULAN
    if (compareMethod === 'TREND') {
        setActiveFilter({
            mode: 'TREND',
            rangeA: { label: `Trend Neraca ${y}` },
            rangeB: null,
            year: y
        });
        loadTrendReport(y);
        return;
    }

    // Helper Date String
    const makeDateStr = (year, month, day) => {
        return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    };
    const getMonthName = (idx) => new Date(2000, idx, 1).toLocaleDateString('id-ID', { month: 'long' });

    let endA, endB, labelA, labelB;

    // KASUS 2: DATE ON DATE (DoD)
    if (compareMethod === 'DOD') {
        if (!dateA || !dateB) {
            setModal({ isOpen: true, type: 'error', title: 'Data Kurang', message: 'Harap isi kedua tanggal.', confirmText: 'Oke' });
            return;
        }
        endA = dateA;
        labelA = `Per ${new Date(dateA).toLocaleDateString('id-ID')}`;
        endB = dateB;
        labelB = `Per ${new Date(dateB).toLocaleDateString('id-ID')}`;
    } 
    // KASUS 3: NORMAL / YOY / MOM
    else {
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        endA = makeDateStr(y, m, daysInMonth);
        labelA = `Per ${daysInMonth} ${getMonthName(m)} ${y}`;

        if (compareMethod === 'YOY') {
            const prevY = y - 1;
            const daysPrev = new Date(prevY, 12, 0).getDate(); // Akhir Tahun Lalu
            endB = makeDateStr(prevY, 11, 31);
            labelB = `Per 31 Des ${prevY}`;
        } else if (compareMethod === 'MOM') {
            const m2 = parseInt(compareMonth) - 1;
            const daysM2 = new Date(y, m2 + 1, 0).getDate();
            endB = makeDateStr(y, m2, daysM2);
            labelB = `Per ${daysM2} ${getMonthName(m2)} ${y}`;
        }
    }

    const rA = { end: endA, label: labelA };
    const rB = (compareMethod !== 'NONE') ? { end: endB, label: labelB } : null;

    setActiveFilter({ mode: 'NORMAL', rangeA: rA, rangeB: rB });
    loadReport(rA, rB);
  };

  const loadReport = async (rA, rB) => {
    setLoading(true);
    try {
        const data = await getBalanceSheetReport(user.id, rA, rB);
        setReportData(data);
    } catch (error) {
        setModal({ isOpen: true, type: 'error', title: 'Gagal', message: error.message, confirmText: 'Tutup' });
    } finally { setLoading(false); }
  };

  const loadTrendReport = async (year) => {
    setLoading(true);
    try {
        const data = await getMonthlyBalanceSheetTrend(user.id, year);
        setReportData(data);
    } catch (error) {
        setModal({ isOpen: true, type: 'error', title: 'Gagal', message: error.message, confirmText: 'Tutup' });
    } finally { setLoading(false); }
  };

  const formatIDR = (num) => {
      if (num === 0 || num === undefined) return '-';
      return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num);
  };

  // --- ROW COMPONENT (NORMAL) ---
  const SheetRow = ({ code, name, current, prev, isHeader = false, isTotal = false, isSubTotal = false }) => {
    const displayCurrent = current < 0 ? `(${formatIDR(Math.abs(current))})` : formatIDR(current);
    let displayPrev = '-';
    let growth = 0; let growthColor = 'text-gray-400';

    if (activeFilter.rangeB && prev !== undefined) {
        displayPrev = prev < 0 ? `(${formatIDR(Math.abs(prev))})` : formatIDR(prev);
        if (prev !== 0) growth = ((current - prev) / prev) * 100;
        growthColor = growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-500' : 'text-gray-400';
    }

    if (isHeader) return (
        <tr className="bg-gray-100"><td colSpan={activeFilter.rangeB ? 5 : 3} className="py-2 px-3 font-bold text-gray-700 text-xs uppercase tracking-wider">{name}</td></tr>
    );

    // FIX ISSUE 1: CSS HOVER PADA TOTAL
    // Jika isTotal, kita force hover backgroundnya tetap gelap biar text putih kebaca
    const rowClass = isTotal 
        ? 'bg-indigo-600 text-white font-bold hover:bg-indigo-700' // <-- Fix Hover Gelap
        : isSubTotal 
            ? 'bg-indigo-50 font-bold text-indigo-900 hover:bg-indigo-100'
            : 'border-b border-gray-50 last:border-0 hover:bg-gray-50 text-gray-700';

    return (
        <tr className={`transition ${rowClass}`}>
            <td className={`py-3 px-3 text-xs ${isTotal ? 'text-white/50' : 'text-gray-500 font-mono'}`}>{code}</td>
            <td className={`py-3 px-3 text-sm ${isTotal ? 'uppercase' : ''}`}>{name}</td>
            <td className="py-3 px-3 text-sm text-right">{displayCurrent}</td>
            
            {activeFilter.rangeB && (
                <>
                    <td className={`py-3 px-3 text-sm text-right ${isTotal ? 'text-white/70' : 'text-gray-400'}`}>{displayPrev}</td>
                    <td className={`py-3 px-3 text-xs text-right font-bold ${isTotal ? 'text-white' : growthColor}`}>
                        {prev !== 0 ? `${growth.toFixed(1)}%` : '-'}
                    </td>
                </>
            )}
        </tr>
    );
  };

  // --- ROW COMPONENT (TREND 12 BULAN) ---
  const TrendSheetRow = ({ code, name, months, isHeader = false }) => {
     if (isHeader) return (
        <tr className="bg-gray-100 border-b border-gray-200">
            <td colSpan={2} className="py-2 px-3 font-bold text-gray-700 text-xs uppercase sticky left-0 z-20 bg-gray-100 border-r border-gray-200 text-left">{name}</td>
            <td colSpan={12} className="bg-gray-100"></td>
        </tr>
     );

     return (
        <tr className="border-b border-gray-50 hover:bg-gray-50">
            <td className="py-3 px-3 text-xs text-gray-500 font-mono sticky left-0 bg-white/95 z-10 border-r border-gray-100 min-w-[80px]">{code}</td>
            <td className="py-3 px-3 text-sm whitespace-nowrap sticky left-[80px] bg-white/95 z-10 border-r border-gray-100 min-w-[150px] text-gray-700">{name}</td>
            {months.map((val, idx) => (
                <td key={idx} className="py-3 px-3 text-xs text-right min-w-[100px] border-r border-gray-50">{formatIDR(val)}</td>
            ))}
        </tr>
     );
  };

  // Row Khusus Total Trend (Biar Beda Warna)
  const TrendTotalRow = ({ name, months, isGrandTotal = false }) => (
      <tr className={`${isGrandTotal ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-900'} font-bold`}>
        <td className={`sticky left-0 z-10 border-r ${isGrandTotal ? 'bg-indigo-600 border-indigo-500' : 'bg-indigo-50 border-indigo-100'}`}></td>
        <td className={`py-3 px-3 text-sm uppercase sticky left-[80px] z-10 border-r ${isGrandTotal ? 'bg-indigo-600 border-indigo-500' : 'bg-indigo-50 border-indigo-100'}`}>{name}</td>
        {months.map((val, idx) => (
            <td key={idx} className={`py-3 px-3 text-xs text-right border-r ${isGrandTotal ? 'border-indigo-500' : 'border-indigo-100'}`}>{formatIDR(val)}</td>
        ))}
      </tr>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 font-sans">
      <ModalInfo {...modal} onClose={() => setModal({...modal, isOpen: false})} />

      {/* HEADER */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/reports-menu')} className="p-2 bg-white rounded-full shadow-sm text-gray-600 active:scale-95">←</button>
            <div>
                <h1 className="text-xl font-bold text-gray-800">Neraca</h1>
                <p className="text-xs text-gray-500">Posisi Keuangan (Balance Sheet)</p>
            </div>
        </div>
        
        <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-200">
            <div className="text-xs">
                <span className="text-gray-400 block mb-1">Filter Aktif</span>
                <span className="font-bold text-gray-800 text-sm">{activeFilter.rangeA.label}</span>
            </div>
            <button onClick={() => setShowFilter(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-emerald-600 transition active:scale-95 flex items-center gap-2">
                <span>⚙️ Filter</span>
            </button>
        </div>
      </div>

      {/* --- MODAL FILTER LENGKAP --- */}
      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-scale-up overflow-y-auto max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Filter Neraca</h3>
                    <button onClick={() => setShowFilter(false)} className="text-gray-400 hover:text-red-500">✕</button>
                </div>
                <div className="p-5 space-y-4">
                    
                    {/* MODE */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Mode Laporan</label>
                        <select value={compareMethod} onChange={(e) => setCompareMethod(e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 shadow-sm">
                            <option value="NONE">📅 Standar (Posisi Per Tanggal)</option>
                            <option value="YOY">🔄 Year On Year (Tahun Lalu)</option>
                            <option value="MOM">🌓 Month On Month (Bulan Lain)</option>
                            <option value="DOD">📆 Date On Date (Antar Tanggal)</option>
                            <option value="TREND">📈 Trend Pergerakan (12 Bulan)</option>
                        </select>
                    </div>

                    {/* FORM: TREND (TAHUN SAJA) */}
                    {compareMethod === 'TREND' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Tahun</label>
                            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold">
                                {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    )}

                    {/* FORM: DATE ON DATE (DUA TANGGAL) */}
                    {compareMethod === 'DOD' && (
                        <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                             <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1">Tanggal Posisi A (Utama)</label>
                                <input type="date" value={dateA} onChange={(e)=>setDateA(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-xs font-bold"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 mb-1">Tanggal Posisi B (Pembanding)</label>
                                <input type="date" value={dateB} onChange={(e)=>setDateB(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-xs font-bold"/>
                            </div>
                        </div>
                    )}

                    {/* FORM: STANDARD / YOY / MOM */}
                    {['NONE', 'YOY', 'MOM'].includes(compareMethod) && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Tahun</label>
                                    <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold">
                                        {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Bulan</label>
                                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold">
                                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month:'long'})}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            {/* FIX ISSUE 2: MOM INPUT */}
                            {compareMethod === 'MOM' && (
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <label className="block text-xs font-bold text-blue-600 mb-1">Bandingkan dengan Posisi Akhir:</label>
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
                    <button onClick={applyFilter} className="flex-[2] py-3 bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg active:scale-95">Terapkan</button>
                </div>
            </div>
        </div>
      )}

      {/* --- CONTENT TABLE --- */}
      {reportData && (
         <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in-up mb-10">
            <div className="p-4 text-center border-b border-gray-100 bg-gray-50">
                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
                    {activeFilter.mode === 'TREND' ? `Pergerakan Neraca ${activeFilter.year}` : 'Neraca Keuangan'}
                </h2>
                {activeFilter.mode === 'NORMAL' && (
                    <div className="flex flex-col gap-1 mt-2 text-xs items-center">
                        <span className="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm font-bold text-gray-700">{activeFilter.rangeA.label}</span>
                        {activeFilter.rangeB && <span className="bg-white px-2 py-1 rounded border border-gray-200 shadow-sm text-gray-500">🆚 {activeFilter.rangeB.label}</span>}
                    </div>
                )}
            </div>

            {/* KONDISI 1: NORMAL VIEW */}
            {activeFilter.mode === 'NORMAL' && (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[350px]">
                        <thead className="bg-gray-100 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-200">
                            <tr>
                                <th className="py-3 px-3 text-left w-16">Kode</th>
                                <th className="py-3 px-3 text-left">Nama Akun</th>
                                <th className="py-3 px-3 text-right">{activeFilter.rangeA.label.length > 20 ? 'Posisi A' : activeFilter.rangeA.label}</th>
                                {activeFilter.rangeB && <><th className="py-3 px-3 text-right text-gray-400">{activeFilter.rangeB.label.length > 20 ? 'Posisi B' : activeFilter.rangeB.label}</th><th className="py-3 px-3 text-right text-indigo-400">%</th></>}
                            </tr>
                        </thead>
                        <tbody>
                            <SheetRow name="AKTIVA / ASET" isHeader />
                            {reportData.assets.map(item => <SheetRow key={item.code} {...item} />)}
                            <SheetRow name="TOTAL ASET" current={reportData.totalAssets.current} prev={reportData.totalAssets.prev} isTotal />
                            
                            <tr><td colSpan={activeFilter.rangeB?5:3} className="h-6 bg-gray-100/50"></td></tr>

                            <SheetRow name="KEWAJIBAN & MODAL" isHeader />
                            <tr className="bg-gray-50"><td colSpan={activeFilter.rangeB?5:3} className="py-1 px-3 text-[10px] font-bold text-gray-400 uppercase">Kewajiban</td></tr>
                            {reportData.liabilities.map(item => <SheetRow key={item.code} {...item} />)}
                            <SheetRow name="Total Kewajiban" current={reportData.totalLiabilities.current} prev={reportData.totalLiabilities.prev} isSubTotal />
                            
                            <tr className="bg-gray-50"><td colSpan={activeFilter.rangeB?5:3} className="py-1 px-3 text-[10px] font-bold text-gray-400 uppercase mt-2">Modal</td></tr>
                            {reportData.equity.map(item => <SheetRow key={item.code} {...item} />)}
                            
                            <SheetRow code="3-999" name="Laba (Rugi) Periode Berjalan" current={reportData.currentEarnings.current} prev={reportData.currentEarnings.prev} />
                            <SheetRow name="Total Modal" current={reportData.totalEquity.current} prev={reportData.totalEquity.prev} isSubTotal />

                            <SheetRow name="TOTAL KEWAJIBAN & MODAL" current={reportData.totalLiabilities.current + reportData.totalEquity.current} prev={reportData.totalLiabilities.prev + reportData.totalEquity.prev} isTotal />
                        </tbody>
                    </table>
                </div>
            )}

            {/* KONDISI 2: TREND VIEW (12 BULAN) */}
            {activeFilter.mode === 'TREND' && (
                <div className="overflow-x-auto">
                    <table className="min-w-[800px] w-full">
                         <thead className="bg-gray-100 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-200">
                            <tr>
                                <th className="py-3 px-3 text-left sticky left-0 bg-gray-100 z-20 border-r border-gray-200">Kode</th>
                                <th className="py-3 px-3 text-left sticky left-[80px] bg-gray-100 z-20 border-r border-gray-200">Nama Akun</th>
                                {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map(m => (
                                    <th key={m} className="py-3 px-3 text-right min-w-[100px] border-r border-gray-200">{m}</th>
                                ))}
                            </tr>
                         </thead>
                         <tbody>
                            <TrendSheetRow name="ASET" isHeader />
                            {reportData.assets.map(item => <TrendSheetRow key={item.code} {...item} />)}
                            <TrendTotalRow name="TOTAL ASET" months={reportData.totals.assets} isGrandTotal />

                            <tr><td colSpan={14} className="h-4 bg-gray-50/50"></td></tr>

                            <TrendSheetRow name="KEWAJIBAN" isHeader />
                            {reportData.liabilities.map(item => <TrendSheetRow key={item.code} {...item} />)}
                            <TrendTotalRow name="TOTAL KEWAJIBAN" months={reportData.totals.liabilities} />

                            <TrendSheetRow name="MODAL" isHeader />
                            {reportData.equity.map(item => <TrendSheetRow key={item.code} {...item} />)}
                            <TrendSheetRow code="3-999" name="Laba (Rugi) Berjalan" months={reportData.currentEarnings} />
                            <TrendTotalRow name="TOTAL MODAL" months={reportData.totals.equity} />

                            <tr><td colSpan={14} className="h-4 bg-gray-50/50"></td></tr>
                            
                            {/* TOTAL KEWAJIBAN + MODAL (HARUS SAMA DENGAN ASET) */}
                            <tr className="bg-emerald-600 text-white font-bold">
                                <td className="sticky left-0 bg-emerald-600 z-10 border-r border-emerald-500"></td>
                                <td className="py-3 px-3 text-sm uppercase sticky left-[80px] bg-emerald-600 z-10 border-r border-emerald-500">TOTAL PASIVA</td>
                                {reportData.totals.assets.map((_, idx) => (
                                    <td key={idx} className="py-3 px-3 text-xs text-right border-r border-emerald-500">
                                        {formatIDR(reportData.totals.liabilities[idx] + reportData.totals.equity[idx])}
                                    </td>
                                ))}
                            </tr>
                         </tbody>
                    </table>
                </div>
            )}
         </div>
      )}
    </div>
  );
}