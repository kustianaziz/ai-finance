import { useNavigate } from 'react-router-dom';

export default function UpgradePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden">
      
      {/* Background Effect */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-brand-600 to-gray-900 opacity-50 z-0"></div>
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-yellow-500 rounded-full blur-[100px] opacity-20"></div>

      {/* Header */}
      <div className="relative z-10 p-6">
        <button onClick={() => navigate('/dashboard')} className="text-gray-300 hover:text-white">✕ Tutup</button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center px-6 text-center">
        <span className="text-5xl mb-4 animate-bounce">👑</span>
        <h1 className="text-3xl font-bold mb-2">Upgrade ke Sultan</h1>
        <p className="text-gray-400 mb-8 max-w-xs mx-auto">
          Kelola keuangan bisnis tanpa batas. Jadilah juragan sejati!
        </p>

        {/* Card Comparison */}
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-6 mb-8">
          <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-4">
             <span className="text-gray-400">Fitur</span>
             <div className="flex gap-4">
                <span className="text-xs font-bold text-gray-400">FREE</span>
                <span className="text-xs font-bold text-yellow-400">PRO</span>
             </div>
          </div>
          
          <FeatureRow label="Voice Input" free="3x/hari" pro="∞ Unlimited" />
          <FeatureRow label="Scan Struk AI" free="3x/hari" pro="∞ Unlimited" />
          <FeatureRow label="AI Advisor" free="Mingguan" pro="Harian" />
          <FeatureRow label="Grafik Bisnis" free="❌" pro="✅ Lengkap" />
          <FeatureRow label="Export Excel" free="❌" pro="✅ Bisa" />
        </div>

        {/* Pricing Button */}
        <div className="w-full max-w-md">
           <div className="flex items-end justify-center gap-1 mb-6">
              <span className="text-sm text-gray-400 line-through">Rp 49.000</span>
              <span className="text-4xl font-bold text-white">Rp 19.000</span>
              <span className="text-gray-400">/bulan</span>
           </div>

           <button 
             onClick={() => alert("Fitur Payment Gateway (Midtrans) akan dipasang disini!")}
             className="w-full py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold text-lg rounded-xl shadow-lg shadow-yellow-500/20 hover:scale-105 transition transform"
           >
             🔥 Aktifkan PRO Sekarang
           </button>
           <p className="text-xs text-gray-500 mt-4">Garansi uang kembali 7 hari.</p>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ label, free, pro }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-sm text-gray-300 text-left w-1/3">{label}</span>
      <div className="flex gap-4 w-2/3 justify-end">
         <span className="text-xs text-gray-500 font-medium w-16 text-right">{free}</span>
         <span className="text-xs text-yellow-400 font-bold w-16 text-right">{pro}</span>
      </div>
    </div>
  );
}