import { useNavigate } from 'react-router-dom';

export default function ReportsMenuPage() {
  const navigate = useNavigate();

  const reports = [
    { id: 'profit-loss', title: 'Laba Rugi', desc: 'Pendapatan vs Beban', icon: '📊', route: '/report-profit-loss', active: true },
    { id: 'balance-sheet', title: 'Neraca', desc: 'Aset, Hutang, Modal', icon: '⚖️', route: '/report-balance-sheet', active: true },
    { id: 'cash-flow', title: 'Arus Kas', desc: 'Aliran Uang Masuk/Keluar', icon: '💸', route: '/report-cash-flow', active: true },
    { id: 'journal', title: 'Jurnal Harian', desc: 'Detail Debit & Kredit', icon: '📝', route: '/report-journal', active: true },
    { id: 'ledger', title: 'Buku Besar', desc: 'Mutasi per Akun', icon: '📚', route: '/report-ledger', active: true },
    { id: 'equity', title: 'Perubahan Modal', desc: 'Aset Neto', icon: '📈', route: '/report-equity', active: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 relative">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-white rounded-full shadow-sm text-gray-600 active:scale-95">←</button>
        <div>
            <h1 className="text-xl font-bold text-gray-800">Laporan Keuangan</h1>
            <p className="text-xs text-gray-500">Pilih laporan yang ingin ditampilkan</p>
        </div>
      </div>

      {/* GRID MENU */}
      <div className="grid grid-cols-2 gap-4">
        {reports.map((rpt) => (
            <button 
                key={rpt.id}
                onClick={() => {
                    if(rpt.active) navigate(rpt.route);
                    else alert("Fitur ini akan segera hadir di update berikutnya! 🚀");
                }}
                className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-32 transition active:scale-95 relative overflow-hidden ${rpt.active ? 'bg-white border-gray-200 shadow-sm hover:border-indigo-300' : 'bg-gray-100 border-gray-200 opacity-70 cursor-not-allowed'}`}
            >
                <div className="text-3xl mb-2">{rpt.icon}</div>
                <div>
                    <h3 className="font-bold text-gray-800 text-sm">{rpt.title}</h3>
                    <p className="text-[10px] text-gray-500 leading-tight mt-1">{rpt.desc}</p>
                </div>
                {!rpt.active && <div className="absolute top-2 right-2 text-[8px] bg-gray-200 px-1 rounded text-gray-500">SOON</div>}
            </button>
        ))}
      </div>
    </div>
  );
}