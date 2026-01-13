import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAccounts } from '../utils/accountingService';
import { getAccountLedger } from '../utils/reportService';
import { useAuth } from '../context/AuthProvider';
import ModalInfo from './ModalInfo';

export default function LedgerPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // MODE: 'LIST' (Pilih Akun) atau 'DETAIL' (Lihat Tabel)
  const [viewMode, setViewMode] = useState('LIST'); 
  
  // DATA MASTER
  const [accounts, setAccounts] = useState([]);
  const [groupedAccounts, setGroupedAccounts] = useState({});
  const [selectedAccount, setSelectedAccount] = useState(null);

  // FILTER DETAIL
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyword, setKeyword] = useState('');
  
  // DATA DETAIL
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', confirmText: 'Oke' });

  // INIT
  useEffect(() => {
    loadAccounts();
    // Default Tanggal (Bulan Ini)
    const date = new Date();
    setStartDate(new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]);
    setEndDate(new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]);
  }, []);

  // 1. LOAD DAFTAR AKUN & GROUPING
  const loadAccounts = async () => {
      try {
          const data = await getAllAccounts(user.id);
          setAccounts(data);
          
          // Grouping by Type (Harta, Kewajiban, dll)
          const groups = { 'Asset': [], 'Liability': [], 'Equity': [], 'Revenue': [], 'Expense': [] };
          data.forEach(acc => {
              if(groups[acc.type]) groups[acc.type].push(acc);
          });
          setGroupedAccounts(groups);
      } catch (err) {
          console.error(err);
      }
  };

  // 2. LOAD DETAIL TRANSAKSI
  const handleLoadDetail = async (account) => {
      setSelectedAccount(account);
      setViewMode('DETAIL');
      fetchLedger(account.id);
  };

  const fetchLedger = async (accId = selectedAccount?.id) => {
      setLoading(true);
      try {
          const data = await getAccountLedger(user.id, accId, startDate, endDate, keyword);
          setLedgerData(data);
      } catch (error) {
          setModal({ isOpen: true, type: 'error', title: 'Gagal', message: error.message, confirmText: 'Tutup' });
      } finally {
          setLoading(false);
      }
  };

  // Helper: Format Rupiah
  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num);

  // Helper: Terjemahan Tipe Akun
  const translateType = (type) => {
      const map = { 'Asset': 'Harta / Aset', 'Liability': 'Kewajiban / Utang', 'Equity': 'Modal', 'Revenue': 'Pendapatan', 'Expense': 'Beban / Biaya' };
      return map[type] || type;
  };

  // --- RENDER VIEW 1: LIST AKUN ---
  const renderListView = () => (
    <div className="space-y-6 animate-fade-in">
        {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(type => {
            const list = groupedAccounts[type] || [];
            if(list.length === 0) return null;

            return (
                <div key={type} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                        <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">{translateType(type)}</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {list.map(acc => (
                            <button 
                                key={acc.id}
                                onClick={() => handleLoadDetail(acc)}
                                className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition flex justify-between items-center group"
                            >
                                <div>
                                    <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1 rounded mr-2 group-hover:bg-indigo-200 group-hover:text-indigo-700 transition">{acc.code}</span>
                                    <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-900">{acc.name}</span>
                                </div>
                                <span className="text-gray-400 text-xs">Lihat Detail →</span>
                            </button>
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
  );

  // --- RENDER VIEW 2: DETAIL TRANSAKSI ---
  const renderDetailView = () => {
    if(!selectedAccount || !ledgerData) return <div className="p-10 text-center">Loading...</div>;

    // HITUNG RUNNING BALANCE (Saldo Berjalan)
    let currentBalance = ledgerData.beginningBalance;
    // Tentukan Faktor Pengali berdasarkan Tipe Akun
    // Asset/Expense: Debit menambah (+), Kredit mengurangi (-)
    // Liab/Equity/Revenue: Kredit menambah (+), Debit mengurangi (-)
    const isNormalDebit = ['Asset', 'Expense'].includes(selectedAccount.type);
    
    // Namun untuk konsistensi DB (Balance = Debit - Kredit), kita pakai raw math dulu, 
    // baru di display kita absolutkan atau kurung kalau minus.
    
    // Tapi user awam bingung minus. Jadi kita tampilkan saldo sesuai "Saldo Normal".
    // Jika Asset: Saldo 1000 = Asset ada 1000.
    // Jika Hutang: Saldo -1000 (karena kredit) = Hutang ada 1000.
    
    // Helper Saldo Display
    const getDisplayBalance = (rawBal) => {
        if(isNormalDebit) return rawBal; // Asset positif
        return -rawBal; // Liability/Equity dibalik biar jadi positif di mata user
    };

    const rows = ledgerData.transactions.map(trx => {
        const netChange = trx.debit - trx.credit;
        currentBalance += netChange;
        
        return {
            ...trx,
            balanceAfter: currentBalance
        };
    });

    return (
        <div className="animate-fade-in-up">
            {/* FILTER BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 space-y-3">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Dari</label>
                        <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold"/>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Sampai</label>
                        <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold"/>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Cari referensi / deskripsi..." 
                        value={keyword}
                        onChange={e=>setKeyword(e.target.value)}
                        className="flex-1 p-2 border rounded-lg text-xs"
                    />
                    <button onClick={() => fetchLedger()} disabled={loading} className="bg-indigo-600 text-white px-4 rounded-lg font-bold text-xs shadow-md active:scale-95">
                        {loading ? '...' : 'Filter'}
                    </button>
                </div>
            </div>

            {/* TABEL BUKU BESAR */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 text-center">
                    <h2 className="font-bold text-gray-800 text-lg">{selectedAccount.name}</h2>
                    <p className="text-xs text-gray-500 font-mono">{selectedAccount.code} • {translateType(selectedAccount.type)}</p>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                        <thead className="bg-gray-100 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-200">
                            <tr>
                                <th className="py-3 px-3 text-left w-24">Tanggal</th>
                                <th className="py-3 px-3 text-left">Ref & Deskripsi</th>
                                <th className="py-3 px-3 text-right text-gray-400">Debit</th>
                                <th className="py-3 px-3 text-right text-gray-400">Kredit</th>
                                <th className="py-3 px-3 text-right text-indigo-600">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-xs">
                            {/* SALDO AWAL */}
                            <tr className="bg-yellow-50 font-bold text-yellow-800">
                                <td className="py-3 px-3">{new Date(startDate).toLocaleDateString('id-ID')}</td>
                                <td className="py-3 px-3 uppercase">SALDO AWAL</td>
                                <td className="py-3 px-3 text-right">-</td>
                                <td className="py-3 px-3 text-right">-</td>
                                <td className="py-3 px-3 text-right">{formatIDR(getDisplayBalance(ledgerData.beginningBalance))}</td>
                            </tr>

                            {/* TRANSAKSI */}
                            {rows.map(row => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-3 align-top">
                                        {new Date(row.journal_headers.transaction_date).toLocaleDateString('id-ID')}
                                    </td>
                                    <td className="py-3 px-3 align-top">
                                        <div className="font-bold text-gray-600 text-[10px] mb-0.5">{row.journal_headers.reference_no}</div>
                                        <div className="text-gray-800">{row.journal_headers.description}</div>
                                    </td>
                                    <td className="py-3 px-3 text-right align-top text-gray-600">
                                        {row.debit > 0 ? formatIDR(row.debit) : '-'}
                                    </td>
                                    <td className="py-3 px-3 text-right align-top text-gray-600">
                                        {row.credit > 0 ? formatIDR(row.credit) : '-'}
                                    </td>
                                    <td className="py-3 px-3 text-right align-top font-bold text-gray-700">
                                        {formatIDR(getDisplayBalance(row.balanceAfter))}
                                    </td>
                                </tr>
                            ))}

                            {/* JIKA KOSONG */}
                            {rows.length === 0 && (
                                <tr><td colSpan={5} className="py-6 text-center text-gray-400 italic">Tidak ada transaksi di periode ini.</td></tr>
                            )}

                            {/* SALDO AKHIR */}
                            <tr className="bg-indigo-600 text-white font-bold text-sm">
                                <td colSpan={2} className="py-4 px-3 text-right uppercase">Saldo Akhir</td>
                                <td colSpan={2} className="py-4 px-3 text-right text-xs opacity-50 font-normal">
                                    (Per {new Date(endDate).toLocaleDateString('id-ID')})
                                </td>
                                <td className="py-4 px-3 text-right">
                                    {formatIDR(getDisplayBalance(currentBalance))}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 font-sans">
      <ModalInfo {...modal} onClose={() => setModal({...modal, isOpen: false})} />

      {/* HEADER UTAMA */}
      <div className="flex items-center gap-4 mb-6">
        <button 
            onClick={() => viewMode === 'DETAIL' ? setViewMode('LIST') : navigate('/reports-menu')} 
            className="p-2 bg-white rounded-full shadow-sm text-gray-600 active:scale-95 transition"
        >
            ←
        </button>
        <div>
            <h1 className="text-xl font-bold text-gray-800">Buku Besar</h1>
            <p className="text-xs text-gray-500">
                {viewMode === 'LIST' ? 'Pilih Akun (General Ledger)' : 'Detail Mutasi Akun'}
            </p>
        </div>
      </div>

      {/* CONTENT SWITCHER */}
      {viewMode === 'LIST' ? renderListView() : renderDetailView()}

    </div>
  );
}