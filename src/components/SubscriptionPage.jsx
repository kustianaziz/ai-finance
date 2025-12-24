import { useNavigate } from 'react-router-dom';

export default function SubscriptionPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/dashboard')} className="text-gray-500">← Kembali</button>
        <h2 className="font-bold text-lg">Upgrade Paket 💎</h2>
      </div>

      <div className="space-y-4">
        {/* Paket Free */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <h3 className="font-bold text-gray-800">Starter (Gratis)</h3>
          <p className="text-2xl font-bold mt-2">Rp 0</p>
          <ul className="text-sm text-gray-500 mt-3 space-y-2">
            <li>✅ Catat Manual Unlimited</li>
            <li>❌ AI Voice (Terbatas 3x/hari)</li>
            <li>❌ Scan Struk (Tidak Ada)</li>
          </ul>
          <button className="w-full mt-4 py-2 border border-gray-300 rounded-lg text-gray-600 font-medium">Paket Sekarang</button>
        </div>

        {/* Paket PRO */}
        <div className="bg-gradient-to-br from-brand-500 to-green-700 p-5 rounded-2xl text-white shadow-xl transform scale-105 border-2 border-green-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-yellow-400 text-xs font-bold px-3 py-1 rounded-bl-lg text-black">POPULAR</div>
          <h3 className="font-bold text-lg">AI Pro Personal</h3>
          <p className="text-3xl font-bold mt-2">Rp 29.000<span className="text-sm font-normal opacity-80">/bln</span></p>
          <ul className="text-sm opacity-90 mt-4 space-y-2">
            <li>✅ AI Voice Unlimited</li>
            <li>✅ Scan Struk Unlimited</li>
            <li>✅ Laporan PDF</li>
            <li>✅ AI Advisor Insight</li>
          </ul>
          <button className="w-full mt-6 py-3 bg-white text-brand-600 rounded-lg font-bold shadow-sm">Pilih Pro 🔥</button>
        </div>
      </div>
    </div>
  );
}