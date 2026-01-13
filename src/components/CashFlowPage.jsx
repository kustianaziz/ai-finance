import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCashFlowReport, getMonthlyCashFlowTrend } from '../utils/reportService';
import { useAuth } from '../context/AuthProvider';
import ModalInfo from './ModalInfo';

export default function CashFlowPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE FILTER
  const [showFilter, setShowFilter] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [compareMethod, setCompareMethod] = useState('NONE'); 
  const [compareMonth, setCompareMonth] = useState(new Date().getMonth()); 
  
  const [dodStartA, setDodStartA] = useState('');
  const [dodEndA, setDodEndA] = useState('');
  const [dodStartB, setDodStartB] = useState('');
  const [dodEndB, setDodEndB] = useState('');

  const [activeFilter, setActiveFilter] = useState({ 
    mode: 'NORMAL', 
    rangeA: { start: '', end: '', label: '' },
    rangeB: null,
    year: ''
  });

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', confirmText: 'Oke' });

  useEffect(() => { applyFilter(); }, []);

  const applyFilter = () => {
    setReportData(null); setShowFilter(false);
    const y = parseInt(selectedYear); const m = parseInt(selectedMonth) - 1; 

    // MODE TREND
    if (compareMethod === 'TREND') {
        setActiveFilter({ mode: 'TREND', rangeA: { label: `Trend Arus Kas ${y}` }, rangeB: null, year: y });
        loadTrendReport(y);
        return;
    }

    let startA, endA, startB, endB, labelA, labelB;
    const makeDateStr = (year, month, day) => `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const getMonthName = (idx) => new Date(2000, idx, 1).toLocaleDateString('id-ID', { month: 'long' });

    if (compareMethod === 'DOD') {
        if(!dodStartA || !dodEndA) { setModal({isOpen:true, type:'error', title:'Error', message:'Range A Wajib Diisi', confirmText:'Ok'}); return; }
        startA = dodStartA; endA = dodEndA;
        labelA = `${new Date(startA).toLocaleDateString('id-ID')} - ${new Date(endA).toLocaleDateString('id-ID')}`;
        
        if(dodStartB && dodEndB) {
            startB = dodStartB; endB = dodEndB;
            labelB = `${new Date(startB).toLocaleDateString('id-ID')} - ${new Date(endB).toLocaleDateString('id-ID')}`;
        }
    } else {
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        startA = makeDateStr(y, m, 1); endA = makeDateStr(y, m, daysInMonth);
        labelA = `${getMonthName(m)} ${y}`;

        if (compareMethod === 'YOY') {
            startB = makeDateStr(y - 1, m, 1); endB = makeDateStr(y - 1, m, new Date(y-1, m+1, 0).getDate());
            labelB = `${getMonthName(m)} ${y - 1}`;
        } else if (compareMethod === 'MOM') {
            const m2 = parseInt(compareMonth) - 1;
            startB = makeDateStr(y, m2, 1); endB = makeDateStr(y, m2, new Date(y, m2+1, 0).getDate());
            labelB = `${getMonthName(m2)} ${y}`;
        }
    }

    const rA = { start: startA, end: endA, label: labelA };
    const rB = (compareMethod !== 'NONE' && startB) ? { start: startB, end: endB, label: labelB } : null;

    setActiveFilter({ mode: 'NORMAL', rangeA: rA, rangeB: rB });
    loadReport(rA, rB);
  };

  const loadReport = async (rA, rB) => {
    setLoading(true);
    try {
        const data = await getCashFlowReport(user.id, rA, rB);
        setReportData(data);
    } catch (error) {
        setModal({ isOpen: true, type: 'error', title: 'Gagal', message: error.message, confirmText: 'Tutup' });
    } finally { setLoading(false); }
  };

  const loadTrendReport = async (year) => {
    setLoading(true);
    try {
        const data = await getMonthlyCashFlowTrend(user.id, year);
        setReportData(data);
    } catch (error) {
        setModal({ isOpen: true, type: 'error', title: 'Gagal', message: error.message, confirmText: 'Tutup' });
    } finally { setLoading(false); }
  };

  const formatIDR = (num) => {
      if (!num && num !== 0) return '-';
      if (num < 0) return `(${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(num))})`;
      return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num);
  };

  // --- ROW COMPONENTS ---
  const CFRow = ({ name, valA, valB, isHeader, isTotal, isSubTotal }) => {
    if (isHeader) return (<tr className="bg-gray-100"><td colSpan={activeFilter.rangeB ? 3 : 2} className="py-2 px-3 font-bold text-gray-700 text-xs uppercase">{name}</td></tr>);
    return (
        <tr className={`border-b border-gray-50 hover:bg-gray-50 ${isTotal?'bg-emerald-600 text-white font-bold':isSubTotal?'bg-indigo-50 font-bold text-indigo-900':''}`}>
            <td className="py-3 px-3 text-sm">{name}</td>
            <td className="py-3 px-3 text-sm text-right">{formatIDR(valA)}</td>
            {activeFilter.rangeB && <td className="py-3 px-3 text-sm text-right opacity-70">{formatIDR(valB)}</td>}
        </tr>
    );
  };

  const TrendRow = ({ name, dataArray, isHeader, isTotal, isGrandTotal }) => {
     if(isHeader) return (<tr className="bg-gray-100"><td className="sticky left-0 bg-gray-100 z-10 py-2 px-3 font-bold text-xs uppercase">{name}</td><td colSpan={12} className="bg-gray-100"></td></tr>);
     return (
        <tr className={`border-b border-gray-50 hover:bg-gray-50 ${isTotal?'bg-indigo-50 font-bold':isGrandTotal?'bg-emerald-600 text-white font-bold':''}`}>
           <td className={`sticky left-0 py-3 px-3 text-sm min-w-[150px] border-r ${isGrandTotal?'bg-emerald-600':'bg-white'}`}>{name}</td>
           {dataArray.map((v,i)=><td key={i} className="py-3 px-3 text-xs text-right min-w-[100px] border-r">{formatIDR(v)}</td>)}
        </tr>
     )
  };

  const renderItems = (itemsA, itemsB) => {
      const keys = new Set([...Object.keys(itemsA||{}), ...Object.keys(itemsB||{})]);
      return Array.from(keys).map(k => <CFRow key={k} name={k} valA={itemsA?.[k]} valB={itemsB?.[k]} />);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 font-sans">
      <ModalInfo {...modal} onClose={() => setModal({...modal, isOpen: false})} />

      {/* HEADER & FILTER BUTTON */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/reports-menu')} className="p-2 bg-white rounded-full shadow-sm text-gray-600 active:scale-95">←</button>
            <div><h1 className="text-xl font-bold text-gray-800">Arus Kas</h1><p className="text-xs text-gray-500">Cash Flow Statement</p></div>
        </div>
        <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-200">
            <div className="text-xs"><span className="text-gray-400 block mb-1">Filter Aktif</span><span className="font-bold text-gray-800 text-sm">{activeFilter.rangeA.label}</span></div>
            <button onClick={() => setShowFilter(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-emerald-600 transition active:scale-95 flex items-center gap-2"><span>⚙️ Filter</span></button>
        </div>
      </div>

      {/* FILTER MODAL */}
      {showFilter && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-scale-up p-5 space-y-4 overflow-y-auto max-h-[90vh]">
                <h3 className="font-bold text-gray-800 border-b pb-2">Filter Arus Kas</h3>
                <div><label className="text-xs font-bold text-gray-500">Mode</label><select value={compareMethod} onChange={(e) => setCompareMethod(e.target.value)} className="w-full p-2 border rounded-lg font-bold"><option value="NONE">📅 Standar</option><option value="YOY">🔄 YoY</option><option value="MOM">🌓 MoM</option><option value="DOD">📆 Date-Date</option><option value="TREND">📈 Trend 12 Bulan</option></select></div>
                
                {compareMethod === 'DOD' ? (
                   <div className="space-y-2">
                      <div><label className="text-[10px] text-gray-400">Periode A</label><div className="flex gap-1"><input type="date" value={dodStartA} onChange={e=>setDodStartA(e.target.value)} className="w-full p-1 border rounded"/><input type="date" value={dodEndA} onChange={e=>setDodEndA(e.target.value)} className="w-full p-1 border rounded"/></div></div>
                      <div><label className="text-[10px] text-gray-400">Periode B</label><div className="flex gap-1"><input type="date" value={dodStartB} onChange={e=>setDodStartB(e.target.value)} className="w-full p-1 border rounded"/><input type="date" value={dodEndB} onChange={e=>setDodEndB(e.target.value)} className="w-full p-1 border rounded"/></div></div>
                   </div>
                ) : (
                   <div className="flex gap-2"><select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} className="w-full p-2 border rounded font-bold">{Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}</select>{compareMethod !== 'TREND' && <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="w-full p-2 border rounded font-bold">{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(0,i).toLocaleDateString('id-ID',{month:'long'})}</option>)}</select>}</div>
                )}
                {compareMethod === 'MOM' && <div className="p-2 bg-blue-50 rounded"><label className="text-xs text-blue-600">Bandingkan dgn:</label><select value={compareMonth} onChange={e=>setCompareMonth(e.target.value)} className="w-full p-1 border rounded">{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(0,i).toLocaleDateString('id-ID',{month:'long'})}</option>)}</select></div>}
                
                <div className="flex gap-3"><button onClick={()=>setShowFilter(false)} className="flex-1 py-2 bg-gray-100 rounded font-bold">Batal</button><button onClick={applyFilter} className="flex-1 py-2 bg-emerald-500 text-white rounded font-bold">Terapkan</button></div>
            </div>
         </div>
      )}

      {/* REPORT CONTENT */}
      {reportData && (
         <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in-up mb-10">
            <div className="p-4 text-center border-b border-gray-100 bg-gray-50"><h2 className="text-lg font-bold text-gray-800 uppercase">{activeFilter.mode === 'TREND' ? 'Trend Arus Kas' : 'Laporan Arus Kas'}</h2><div className="mt-1 text-xs text-gray-500">{activeFilter.rangeA.label} {activeFilter.rangeB && `🆚 ${activeFilter.rangeB.label}`}</div></div>
            
            <div className="overflow-x-auto">
                {activeFilter.mode === 'NORMAL' ? (
                    <table className="w-full min-w-[350px]">
                        <thead className="bg-gray-100 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-200"><tr><th className="py-3 px-3 text-left">Uraian</th><th className="py-3 px-3 text-right">Periode A</th>{activeFilter.rangeB && <th className="py-3 px-3 text-right">Periode B</th>}</tr></thead>
                        <tbody>
                            <CFRow name="AKTIVITAS OPERASIONAL" isHeader />
                            {renderItems(reportData.current.operating.items, reportData.prev?.operating.items)}
                            <CFRow name="Kas Bersih Operasional" valA={reportData.current.netOp} valB={reportData.prev?.netOp} isSubTotal />
                            
                            <tr className="h-4 bg-gray-50/50"><td colSpan={3}></td></tr>
                            <CFRow name="AKTIVITAS INVESTASI" isHeader />
                            {renderItems(reportData.current.investing.items, reportData.prev?.investing.items)}
                            <CFRow name="Kas Bersih Investasi" valA={reportData.current.netInv} valB={reportData.prev?.netInv} isSubTotal />

                            <tr className="h-4 bg-gray-50/50"><td colSpan={3}></td></tr>
                            <CFRow name="AKTIVITAS PENDANAAN" isHeader />
                            {renderItems(reportData.current.financing.items, reportData.prev?.financing.items)}
                            <CFRow name="Kas Bersih Pendanaan" valA={reportData.current.netFin} valB={reportData.prev?.netFin} isSubTotal />

                            <tr className="h-4 bg-gray-50/50"><td colSpan={3}></td></tr>
                            <CFRow name="KENAIKAN (PENURUNAN) KAS" valA={reportData.current.netChange} valB={reportData.prev?.netChange} isSubTotal />
                            <CFRow name="Kas Awal Periode" valA={reportData.current.beginningCash} valB={reportData.prev?.beginningCash} />
                            <CFRow name="KAS AKHIR PERIODE" valA={reportData.current.endingCash} valB={reportData.prev?.endingCash} isTotal />
                        </tbody>
                    </table>
                ) : (
                    <table className="min-w-[800px] w-full">
                        <thead className="bg-gray-100 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-200">
                            <tr>
                                <th className="sticky left-0 bg-gray-100 py-3 px-3 text-left z-20 border-r min-w-[200px]">Uraian</th>
                                {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map(m=><th key={m} className="py-3 px-3 text-right min-w-[100px] border-r">{m}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {/* OPERATING */}
                            <tr className="bg-gray-50 font-bold text-xs text-gray-500 uppercase"><td className="sticky left-0 bg-gray-50 py-2 px-3 border-r z-10">Aktivitas Operasional</td><td colSpan={12}></td></tr>
                            {reportData.operating.map((item, idx) => <TrendRow key={idx} name={item.name} dataArray={item.months} />)}
                            <TrendRow name="Arus Kas Operasional" dataArray={reportData.totals.operating} isTotal />

                            {/* INVESTING */}
                            <tr className="bg-gray-50 font-bold text-xs text-gray-500 uppercase"><td className="sticky left-0 bg-gray-50 py-2 px-3 border-r z-10">Aktivitas Investasi</td><td colSpan={12}></td></tr>
                            {reportData.investing.map((item, idx) => <TrendRow key={idx} name={item.name} dataArray={item.months} />)}
                            <TrendRow name="Arus Kas Investasi" dataArray={reportData.totals.investing} isTotal />

                            {/* FINANCING */}
                            <tr className="bg-gray-50 font-bold text-xs text-gray-500 uppercase"><td className="sticky left-0 bg-gray-50 py-2 px-3 border-r z-10">Aktivitas Pendanaan</td><td colSpan={12}></td></tr>
                            {reportData.financing.map((item, idx) => <TrendRow key={idx} name={item.name} dataArray={item.months} />)}
                            <TrendRow name="Arus Kas Pendanaan" dataArray={reportData.totals.financing} isTotal />

                            {/* SUMMARY */}
                            <tr><td colSpan={13} className="h-6 bg-gray-50 border-t border-gray-200"></td></tr>
                            
                            <TrendRow name="Kenaikan/Penurunan Kas" dataArray={reportData.totals.netChange} isTotal />
                            <TrendRow name="Kas Awal Periode" dataArray={reportData.totals.beginning} />
                            
                            {/* KAS AKHIR (FIX HOVER WARNA PUTIH) */}
                            <tr className="bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors">
                                <td className="sticky left-0 bg-emerald-600 border-r border-emerald-500 py-3 px-3 text-sm z-10 uppercase">KAS AKHIR PERIODE</td>
                                {reportData.totals.ending.map((v,i)=>(
                                    <td key={i} className="py-3 px-3 text-xs text-right border-r border-emerald-500">
                                        {formatIDR(v)}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>
         </div>
      )}
    </div>
  );
}