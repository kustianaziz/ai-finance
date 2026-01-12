import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processImageInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic';

// IMPORT PLUGIN KAMERA ASLI
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export default function ScanSim() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState('idle'); 
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // --- FUNGSI AMBIL FOTO (ULTRA FAST SETTINGS) ---
  const handleNativeCamera = async (sourceMode) => {
    // 1. Cek Kuota
    const limitCheck = await checkUsageLimit(user.id, 'SCAN');
    if (!limitCheck.allowed) {
      if (window.confirm(limitCheck.message + "\nMau upgrade sekarang?")) navigate('/upgrade');
      return; 
    }

    try {
      // 2. Settingan Kamera
      // Kita pakai width 500px (tengah-tengah) biar imbang antara speed & akurasi
      const image = await Camera.getPhoto({
        quality: 40,       // Kualitas 40% (Cukup)
        allowEditing: false, 
        resultType: CameraResultType.Base64, 
        width: 500,        
        source: sourceMode === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      });

      // 3. Simpan data
      // image.base64String sudah murni tanpa header 'data:image...'
      setImageBase64(image.base64String);
      setImagePreview(`data:image/jpeg;base64,${image.base64String}`);
      
      setStatus('preview');

    } catch (error) {
      console.log("User cancel:", error);
    }
  };

  // --- KIRIM KE AI ---
  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setStatus('processing');

    try {
      // Kirim raw base64. MimeType kita hardcode jpeg karena hasil kompresi kamera pasti jpeg
      const result = await processImageInput(imageBase64, 'image/jpeg');
      setAiResult(result);
      setStatus('success');
    } catch (error) {
      alert("Error: " + error.message);
      setStatus('preview');
    }
  };

  // --- SIMPAN DATA ---
  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    
    try {
      const { data: headerData, error: headerError } = await supabase
        .from('transaction_headers')
        .insert([{
            user_id: user.id,
            merchant: aiResult.merchant,
            total_amount: aiResult.amount,
            type: aiResult.type,
            category: aiResult.category,
            receipt_url: "Scan V5 Native", 
            is_ai_generated: true
        }])
        .select().single();

      if (headerError) throw headerError;
      
      if (aiResult.items && aiResult.items.length > 0) {
        const itemsToInsert = aiResult.items.map(item => ({
          header_id: headerData.id,
          name: item.name,
          price: item.price,
          qty: 1
        }));
        await supabase.from('transaction_items').insert(itemsToInsert);
      }

      navigate('/dashboard');
    } catch (error) {
      alert('Gagal simpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white relative overflow-hidden">
      
      {/* HEADER */}
      <div className="p-4 flex items-center justify-between z-10 bg-gray-900 shadow-md">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-gray-800 rounded-full text-sm">
          ❌ Batal
        </button>
        <h1 className="font-bold text-lg">Scan Transaksi</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        
        {/* AREA FOTO */}
        <div className="relative w-full h-full bg-gray-800 rounded-2xl overflow-hidden border-2 border-dashed border-gray-700 flex flex-col items-center justify-center">
          
          {status === 'idle' && (
            <div className="flex flex-col gap-6 w-full px-10">
               <button 
                 onClick={() => handleNativeCamera('camera')}
                 className="flex flex-col items-center justify-center bg-brand-600 p-6 rounded-2xl shadow-lg hover:scale-105 transition active:bg-brand-700"
               >
                  <span className="text-4xl mb-2">📸</span>
                  <span className="font-bold text-white text-lg">Kamera</span>
               </button>

               <button 
                 onClick={() => handleNativeCamera('photos')}
                 className="flex flex-col items-center justify-center bg-gray-700 p-6 rounded-2xl shadow-lg hover:bg-gray-600 transition"
               >
                  <span className="text-4xl mb-2">🖼️</span>
                  <span className="font-bold text-gray-300">Galeri</span>
               </button>
            </div>
          )}

          {(status === 'preview' || status === 'processing' || status === 'success') && imagePreview && (
            <img src={imagePreview} className="w-full h-full object-contain bg-black" alt="Preview" />
          )}

          {/* Overlay Loading AI */}
          {status === 'processing' && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
              <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-bold text-brand-400 animate-pulse text-sm">Sedang Membaca Struk...</p>
            </div>
          )}
        </div>

        {/* BUTTON ACTION (Saat Preview) */}
        {status === 'preview' && (
          <div className="flex gap-3 w-full mt-4 animate-fade-in-up">
            <button onClick={() => setStatus('idle')} className="flex-1 py-3 bg-gray-700 rounded-xl font-bold">
              Ulang
            </button>
            <button onClick={handleAnalyze} className="flex-[2] py-3 bg-white text-black rounded-xl font-bold shadow-lg">
              Analisa 🚀
            </button>
          </div>
        )}
      </div>

      {/* --- MODAL HASIL (STICKY) --- */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full rounded-t-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                
                {/* Header Modal */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Hasil Scan</p>
                        <h2 className="text-xl font-bold text-gray-800 truncate max-w-[200px]">{aiResult.merchant}</h2>
                    </div>
                    <div className="text-right">
                        <span className="block text-xs text-gray-400">Total</span>
                        <span className="text-lg font-bold text-brand-600">Rp {aiResult.amount?.toLocaleString()}</span>
                    </div>
                </div>

                {/* Isi Scrollable */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
                    <div className="flex gap-2 mb-4">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold uppercase">
                            {aiResult.category || 'Umum'}
                        </span>
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${aiResult.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {aiResult.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 uppercase font-bold mb-2">Rincian Item</p>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {aiResult.items && aiResult.items.length > 0 ? (
                            aiResult.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 border-b border-gray-50 last:border-0 text-sm">
                                    <span className="text-gray-700 font-medium truncate w-[60%]">{item.name}</span>
                                    <span className="text-gray-900 font-bold">{item.price?.toLocaleString()}</span>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-gray-400 italic text-sm">
                                Tidak ada rincian item.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Sticky */}
                <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex gap-3">
                         <button 
                            onClick={() => { setStatus('idle'); setAiResult(null); }}
                            className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50"
                        >
                            Batal
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="flex-[2] py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 transition flex justify-center items-center gap-2"
                        >
                            {saving ? 'Menyimpan...' : 'Simpan Data ✅'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
      )}
    </div>
  );
}