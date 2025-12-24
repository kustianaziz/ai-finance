import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processImageInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic'; // <-- IMPORT SATPAM

export default function ScanSim() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [status, setStatus] = useState('idle'); 
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [fileType, setFileType] = useState(null);
  
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // 1. Handle User Pilih Foto (DENGAN PENGECEKAN KUOTA)
  const handleFileChange = async (e) => {
    // --- CEK KUOTA DULU DISINI ---
    const limitCheck = await checkUsageLimit(user.id, 'SCAN');
    
    if (!limitCheck.allowed) {
      // Reset input file biar bisa diklik ulang nanti
      if(fileInputRef.current) fileInputRef.current.value = "";
      
      const confirmUpgrade = window.confirm(limitCheck.message + "\n\nMau upgrade ke Sultan sekarang?");
      if (confirmUpgrade) {
          navigate('/upgrade');
      }
      return; // Stop proses, jangan lanjut scan
    }
    // ----------------------------

    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setFileType(file.type);
      setStatus('preview');

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        setImageBase64(base64String);
      };
    }
  };

  // 2. Kirim ke AI
  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setStatus('processing');

    try {
      const result = await processImageInput(imageBase64, fileType);
      setAiResult(result);
      setStatus('success');
    } catch (error) {
      alert("Gagal baca struk: " + error.message);
      setStatus('preview');
    }
  };

  // 3. Simpan ke Database
  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    
    try {
      // Simpan Header
      const { data: headerData, error: headerError } = await supabase
        .from('transaction_headers')
        .insert([
          {
            user_id: user.id,
            merchant: aiResult.merchant,
            total_amount: aiResult.amount,
            type: aiResult.type,
            category: aiResult.category,
            // Kasih tanda kalau ini hasil SCAN (buat hitung kuota nanti)
            receipt_url: "Scan Struk V2", 
            is_ai_generated: true
          }
        ])
        .select()
        .single();

      if (headerError) throw headerError;
      
      const newHeaderId = headerData.id;

      // Simpan Items
      if (aiResult.items && aiResult.items.length > 0) {
        const itemsToInsert = aiResult.items.map(item => ({
          header_id: newHeaderId,
          name: item.name,
          price: item.price,
          qty: 1
        }));

        const { error: itemsError } = await supabase
          .from('transaction_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      navigate('/dashboard');

    } catch (error) {
      alert('Gagal simpan: ' + error.message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      
      {/* HEADER */}
      <div className="p-6 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-gray-800 rounded-full">
          ❌
        </button>
        <h1 className="font-bold">Scan Struk v2</h1>
        <div className="w-8"></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        
        {/* AREA FOTO/PREVIEW */}
        <div className="relative w-full aspect-[3/4] bg-gray-800 rounded-3xl overflow-hidden border-2 border-dashed border-gray-600 flex flex-col items-center justify-center mb-6">
          
          {/* Kalau belum ada foto */}
          {status === 'idle' && (
            <div onClick={() => fileInputRef.current.click()} className="text-center cursor-pointer p-10 w-full h-full flex flex-col items-center justify-center hover:bg-gray-700 transition">
              <span className="text-6xl mb-4">📸</span>
              <p className="font-bold text-gray-300">Tap untuk Foto / Upload</p>
              <p className="text-xs text-gray-500 mt-2">Pastikan foto terang & jelas</p>
            </div>
          )}

          {/* Kalau sudah ada foto */}
          {(status === 'preview' || status === 'processing' || status === 'success') && imagePreview && (
            <img src={imagePreview} className="w-full h-full object-contain" alt="Preview" />
          )}

          {/* Loading AI */}
          {status === 'processing' && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-bold text-brand-400 animate-pulse">Scanning AI...</p>
            </div>
          )}

          {/* Hidden Input File */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* TOMBOL ACTION (Saat Preview) */}
        {status === 'preview' && (
          <div className="flex gap-4 w-full animate-fade-in-up">
            <button onClick={() => setStatus('idle')} className="flex-1 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition">
              Ulang
            </button>
            <button onClick={handleAnalyze} className="flex-1 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition">
              Analisa ⚡
            </button>
          </div>
        )}

        {/* HASIL AI DENGAN RINCIAN ITEM */}
        {status === 'success' && aiResult && (
          <div className="w-full bg-white text-gray-800 rounded-2xl p-5 animate-slide-up max-h-[60vh] overflow-y-auto">
            {/* Header Struk */}
            <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-2 border-dashed">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Toko / Merchant</p>
                <h3 className="text-lg font-bold text-gray-800">{aiResult.merchant}</h3>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold mt-1 inline-block">
                  {aiResult.category}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-bold">Total Bayar</p>
                <h3 className="text-xl font-bold text-brand-600">Rp {aiResult.amount.toLocaleString()}</h3>
              </div>
            </div>

            {/* List Item Belanjaan */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase font-bold mb-2">Rincian Barang (AI)</p>
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                {aiResult.items && aiResult.items.length > 0 ? (
                  aiResult.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-700 truncate w-2/3">{item.name}</span>
                      <span className="text-gray-500 font-medium">
                        {item.price > 0 ? item.price.toLocaleString() : '-'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic">Tidak ada rincian item terdeteksi.</p>
                )}
              </div>
            </div>

            <button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-bold shadow-lg hover:bg-brand-600 transition"
            >
              {saving ? 'Menyimpan... (V2)' : 'Simpan Semua ✅'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}