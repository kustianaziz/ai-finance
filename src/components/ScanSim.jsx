import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processImageInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export default function ScanSim() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE UMUM
  const [status, setStatus] = useState('idle'); 
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // STATE MODE (Depan)
  const [mode, setMode] = useState('BUSINESS'); 

  // STATE EDITABLE (Belakang/Modal)
  const [trxType, setTrxType] = useState('expense'); // expense / income
  const [allocation, setAllocation] = useState('BUSINESS'); 

  // 1. CEK MEMORY SAAT LOAD
  useEffect(() => {
    const savedMode = localStorage.getItem('scan_mode');
    if (savedMode) setMode(savedMode);
  }, []);

  // 2. TOGGLE MODE DEPAN
  const toggleMode = (newMode) => {
      setMode(newMode);
      localStorage.setItem('scan_mode', newMode);
  };

  // --- KAMERA ---
  const handleNativeCamera = async (sourceMode) => {
    const limitCheck = await checkUsageLimit(user.id, 'SCAN');
    if (!limitCheck.allowed) {
      if (window.confirm(limitCheck.message + "\nMau upgrade?")) navigate('/upgrade');
      return; 
    }

    try {
      const image = await Camera.getPhoto({
        quality: 40, allowEditing: false, resultType: CameraResultType.Base64, width: 500,
        source: sourceMode === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      });
      setImageBase64(image.base64String);
      setImagePreview(`data:image/jpeg;base64,${image.base64String}`);
      setStatus('preview');
    } catch (error) {
      console.log("User cancel:", error);
    }
  };

  // --- ANALISA AI ---
  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setStatus('processing');

    try {
      const result = await processImageInput(imageBase64, 'image/jpeg');
      setAiResult(result);

      // --- LOGIC PENENTUAN DEFAULT (SMART DEFAULT) ---
      setTrxType(result.type || 'expense');

      // Default Allocation sesuai Mode Depan
      if (mode === 'BUSINESS') {
          setAllocation('BUSINESS'); // Default ke Operasional
      } else {
          setAllocation('PERSONAL'); // Default ke Skip (Aman)
      }
      
      setStatus('success');
    } catch (error) {
      alert("Error: " + error.message);
      setStatus('preview');
    }
  };

  // --- SIMPAN ---
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
            
            type: trxType, 
            allocation_type: allocation, // Ini yang dikirim ke DB
            
            category: aiResult.category,
            receipt_url: "Scan V9 (Simplified UX)", 
            is_ai_generated: true,
            is_journalized: false 
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
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-gray-800 rounded-full text-sm">❌</button>
        <h1 className="font-bold text-lg">Scan Transaksi</h1>
        <div className="w-8"></div>
      </div>

      {/* --- TOGGLE SWITCH MODE (DEPAN) --- */}
      {status === 'idle' && (
        <div className="px-6 pb-2 pt-4 bg-gray-900 z-10">
            <div className="bg-gray-800 p-1 rounded-xl flex">
                <button 
                    onClick={() => toggleMode('BUSINESS')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        mode === 'BUSINESS' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                    }`}
                >
                    🏢 Bisnis
                </button>
                <button 
                    onClick={() => toggleMode('PERSONAL')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        mode === 'PERSONAL' ? 'bg-gray-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                    }`}
                >
                    👤 Pribadi
                </button>
            </div>
            <p className="text-center text-[10px] text-gray-500 mt-2">
                {mode === 'BUSINESS' ? 'Pengeluaran untuk Toko/Usaha' : 'Pengeluaran Pribadi/Rumah Tangga'}
            </p>
        </div>
      )}

      {/* KONTEN UTAMA */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto pb-24 relative">
        <div className={`relative w-full flex-1 rounded-2xl overflow-hidden border-2 flex flex-col items-center justify-center min-h-[300px] transition-colors ${
            mode === 'BUSINESS' ? 'bg-gray-800 border-blue-900/50' : 'bg-gray-800 border-gray-600'
        }`}>
          
          {status === 'idle' && (
            <div className="flex flex-col gap-6 w-full px-10 my-auto">
               <button onClick={() => handleNativeCamera('camera')} className={`flex flex-col items-center justify-center p-6 rounded-2xl shadow-lg hover:scale-105 transition active:scale-95 ${
                   mode === 'BUSINESS' ? 'bg-blue-600 active:bg-blue-700' : 'bg-gray-600 active:bg-gray-700'
               }`}>
                  <span className="text-4xl mb-2">📸</span>
                  <span className="font-bold text-white text-lg">Scan Struk</span>
               </button>
               <button onClick={() => handleNativeCamera('photos')} className="flex flex-col items-center justify-center bg-gray-700 p-6 rounded-2xl shadow-lg active:scale-95">
                  <span className="text-4xl mb-2">🖼️</span>
                  <span className="font-bold text-gray-300">Ambil Galeri</span>
               </button>
            </div>
          )}

          {(status === 'preview' || status === 'processing' || status === 'success') && imagePreview && (
            <div className="w-full h-full bg-black flex items-center justify-center">
                 <img src={imagePreview} className="w-full h-auto object-contain" alt="Preview" />
            </div>
          )}

          {status === 'processing' && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-bold text-white animate-pulse text-sm">AI Sedang Bekerja...</p>
            </div>
          )}
        </div>

        {status === 'preview' && (
          <div className="flex gap-3 w-full mt-4 animate-fade-in-up flex-shrink-0">
            <button onClick={() => setStatus('idle')} className="flex-1 py-3 bg-gray-700 rounded-xl font-bold">Ulang</button>
            <button onClick={handleAnalyze} className="flex-[2] py-3 bg-white text-black rounded-xl font-bold shadow-lg">Analisa 🚀</button>
          </div>
        )}
      </div>

      {/* --- MODAL HASIL (TEMPAT EDIT DETAIL) --- */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full rounded-t-3xl h-[85vh] flex flex-col shadow-2xl">
                
                {/* Header Modal */}
                <div className="p-5 border-b bg-white rounded-t-3xl z-10">
                    <h2 className="text-xl font-bold text-gray-800 truncate">{aiResult.merchant}</h2>
                    <div className="flex justify-between items-end mt-2">
                         {/* SWITCH PENGELUARAN / PEMASUKAN */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button 
                                onClick={() => setTrxType('expense')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition ${trxType === 'expense' ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}
                            >
                                💸 Keluar
                            </button>
                            <button 
                                onClick={() => setTrxType('income')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition ${trxType === 'income' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}
                            >
                                💰 Masuk
                            </button>
                        </div>
                        <span className={`text-xl font-bold ${trxType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            Rp {aiResult.amount?.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Isi Modal */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
                    
                    {/* --- DYNAMIC DROPDOWN (FITUR BARU) --- */}
                    <div className="mb-4">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                            {mode === 'BUSINESS' ? 'Jenis Transaksi Bisnis' : 'Sumber Dana Pribadi'}
                        </label>
                        
                        <select 
                            value={allocation}
                            onChange={(e) => setAllocation(e.target.value)}
                            className={`w-full p-3 rounded-xl border-2 font-bold text-sm outline-none appearance-none ${
                                mode === 'BUSINESS' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-300 bg-gray-100 text-gray-600'
                            }`}
                        >
                            {/* PILIHAN JIKA MODE = BISNIS */}
                            {mode === 'BUSINESS' ? (
                                <>
                                    <option value="BUSINESS">🏢 Operasional (Masuk Laporan)</option>
                                    <option value="SALARY">💰 Gaji (Ambil Gaji Owner)</option>
                                </>
                            ) : (
                            /* PILIHAN JIKA MODE = PRIBADI */
                                <>
                                    <option value="PERSONAL">⛔ Pribadi (Skip / Arsip Saja)</option>
                                    <option value="PRIVE">👨‍👩‍👧 Prive (Ambil Kas Toko)</option>
                                </>
                            )}
                        </select>

                        <p className="text-[10px] text-gray-400 mt-1 ml-1">
                            {allocation === 'BUSINESS' && "Dicatat sebagai Beban Operasional Toko."}
                            {allocation === 'SALARY' && "Dicatat sebagai Beban Gaji Direktur."}
                            {allocation === 'PERSONAL' && "Hanya arsip, TIDAK memotong Kas Toko."}
                            {allocation === 'PRIVE' && "Mengurangi Modal & Kas Toko."}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                         <div className="flex justify-between mb-2">
                             <span className="text-xs font-bold text-gray-400">KATEGORI DETEKSI</span>
                             <span className="text-xs font-bold text-blue-600">{aiResult.category}</span>
                         </div>
                         <hr className="border-gray-100 mb-2"/>
                         {aiResult.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between py-1 text-sm text-gray-600">
                                <span className="truncate w-[60%]">{item.name}</span>
                                <span>{item.price?.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-white flex gap-3">
                     <button onClick={() => { setStatus('idle'); setAiResult(null); }} className="flex-1 py-3 border text-gray-600 rounded-xl font-bold">Batal</button>
                     <button onClick={handleSave} disabled={saving} className={`flex-[2] py-3 text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 ${
                         trxType === 'income' ? 'bg-green-600' : 'bg-brand-600'
                     }`}>
                        {saving ? 'Menyimpan...' : 'Simpan ✅'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}