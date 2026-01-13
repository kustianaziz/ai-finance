import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDailyJournalReport } from '../utils/reportService';
import { getAllAccounts } from '../utils/accountingService'; // Import Helper Akun
import { useAuth } from '../context/AuthProvider';
import ModalInfo from './ModalInfo';

export default function JournalReportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE FILTER
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(''); // Filter COA
  
  // STATE DATA
  const [journals, setJournals] = useState([]);
  const [accountList, setAccountList] = useState([]); // List Dropdown
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null); // ID Jurnal yang sedang dibuka
  
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', confirmText: 'Oke' });

  // INIT
  useEffect(() => {
    // Set Default Tanggal (Bulan Ini)
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setStartDate(firstDay);
    setEndDate(lastDay);

    // Load Daftar Akun untuk Dropdown
    loadAccounts();
  }, []);

  // LOAD ACCOUNT LIST
  const loadAccounts = async () => {
      try {
          const list = await getAllAccounts(user.id);
          setAccountList(list);
      } catch (err) {
          console.error("Gagal load akun", err);
      }
  };

  // LOAD JOURNAL REPORT
  const handleSearch = async () => {
    setLoading(true);
    setExpandedId(null); // Tutup semua detail pas search baru
    try {
        const data = await getDailyJournalReport(user.id, startDate, endDate, keyword, selectedAccount);
        setJournals(data);
        if(data.length === 0) {
            setModal({isOpen:true, type:'info', title:'Kosong', message:'Tidak ditemukan jurnal dengan filter ini.', confirmText:'Oke'});
        }
    } catch (error) {
        setModal({isOpen:true, type:'error', title:'Gagal', message:error.message, confirmText:'Tutup'});
    } finally {
        setLoading(false);
    }
  };

  // Helper Format Rupiah
  const formatIDR = (num) => new Intl.NumberFormat('id-ID').format(num);

  // Toggle Accordion
  const toggleExpand = (id) => {
      setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 font-sans">
      <ModalInfo {...modal} onClose={() => setModal({...modal, isOpen: false})} />

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/reports-menu')} className="p-2 bg-white rounded-full shadow-sm text-gray-600 active:scale-95">←</button>
        <div>
            <h1 className="text-xl font-bold text-gray-800">Jurnal Harian</h1>
            <p className="text-xs text-gray-500">General Journal Entries</p>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 space-y-3">
        {/* Row 1: Tanggal */}
        <div className="flex gap-2">
            <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-bold block mb-1">Dari</label>
                <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold bg-gray-50"/>
            </div>
            <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-bold block mb-1">Sampai</label>
                <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold bg-gray-50"/>
            </div>
        </div>

        {/* Row 2: Keyword Search */}
        <div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">Cari Transaksi</label>
            <input 
                type="text" 
                placeholder="Contoh: Beli Pulsa, TRX-123..." 
                value={keyword}
                onChange={e=>setKeyword(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm bg-gray-50"
            />
        </div>

        {/* Row 3: Filter Akun & Tombol */}
        <div className="flex gap-2 items-end">
            <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-bold block mb-1">Filter Akun (Opsional)</label>
                <select 
                    value={selectedAccount} 
                    onChange={e=>setSelectedAccount(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs font-bold bg-white text-gray-700 h-[38px]"
                >
                    <option value="">-- Semua Akun --</option>
                    {accountList.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                </select>
            </div>
            <button 
                onClick={handleSearch} 
                disabled={loading}
                className="px-4 h-[38px] bg-indigo-600 text-white font-bold rounded-lg text-xs shadow-md active:scale-95 transition flex items-center gap-1"
            >
                {loading ? '...' : '🔍 Cari'}
            </button>
        </div>
      </div>

      {/* LIST JURNAL */}
      <div className="space-y-3">
        {journals.map((trx) => {
            const isExpanded = expandedId === trx.id;
            const totalDebit = trx.journal_details.reduce((sum, d) => sum + d.debit, 0);
            const totalCredit = trx.journal_details.reduce((sum, d) => sum + d.credit, 0);
            const isBalanced = totalDebit === totalCredit;

            return (
                <div key={trx.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                    
                    {/* CARD HEADER (Clickable) */}
                    <div 
                        onClick={() => toggleExpand(trx.id)}
                        className={`p-4 flex justify-between items-center cursor-pointer ${isExpanded ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    >
                        <div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                                {new Date(trx.transaction_date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})} • {trx.reference_no}
                            </div>
                            <h3 className="font-bold text-gray-800 text-sm line-clamp-1">{trx.description}</h3>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-indigo-600 text-sm">Rp {formatIDR(totalDebit)}</div>
                            <div className="text-[10px] text-gray-400">{isExpanded ? 'Tutup ▲' : 'Detail ▼'}</div>
                        </div>
                    </div>

                    {/* CARD DETAIL (Expandable) */}
                    {isExpanded && (
                        <div className="border-t border-indigo-100 animate-fade-in">
                            <table className="w-full text-xs">
                                <thead className="bg-white text-gray-500 font-bold border-b border-gray-100">
                                    <tr>
                                        <th className="py-2 px-4 text-left">Akun</th>
                                        <th className="py-2 px-4 text-right">Debit</th>
                                        <th className="py-2 px-4 text-right">Kredit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {trx.journal_details.map(det => (
                                        <tr key={det.id} className="hover:bg-gray-50">
                                            <td className="py-2 px-4">
                                                <div className="font-mono text-gray-400 text-[10px]">{det.chart_of_accounts.code}</div>
                                                <div className="font-medium text-gray-700">{det.chart_of_accounts.name}</div>
                                            </td>
                                            <td className="py-2 px-4 text-right text-gray-600">
                                                {det.debit > 0 ? formatIDR(det.debit) : '-'}
                                            </td>
                                            <td className="py-2 px-4 text-right text-gray-600">
                                                {det.credit > 0 ? formatIDR(det.credit) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    
                                    {/* FOOTER BALANCE CHECK */}
                                    <tr className={`font-bold border-t border-gray-200 ${isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        <td className="py-2 px-4 text-right uppercase text-[10px]">Total Balance</td>
                                        <td className="py-2 px-4 text-right">{formatIDR(totalDebit)}</td>
                                        <td className="py-2 px-4 text-right">{formatIDR(totalCredit)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            );
        })}

        {/* Empty State */}
        {!loading && journals.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
                Belum ada data jurnal yang ditampilkan.
            </div>
        )}
      </div>
    </div>
  );
}