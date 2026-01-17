import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processImageInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ArrowLeft, Repeat, Check, X, Building2, User } from 'lucide-react';

export default function ScanSim() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE UTAMA
  const [status, setStatus] = useState('idle'); // idle, preview, processing, success
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // STATE MODE (Otomatis dari Profil User)
  const [activeMode, setActiveMode] = useState('PERSONAL'); // Default Personal
  const [entityName, setEntityName] = useState('');

  // STATE TRANSAKSI
  const [trxType, setTrxType] = useState('expense'); // expense / income
  const [allocation, setAllocation] = useState('PERSONAL'); 

  // 1. CEK MODE SAAT LOAD (DARI DATABASE/SESSION)
  useEffect(() => {
    fetchUserMode();
  }, []);

  const fetchUserMode = async () => {
    if (!user) return;
    
    // Ambil data profil untuk tahu dia lagi mode apa
    // (Nanti di dashboard kita buat fitur ganti mode yang simpan ke DB/LocalStorage)
    // Untuk sekarang kita simulasi ambil dari LocalStorage 'app_mode'
    // Kalau tidak ada, fallback ke account_type user
    
    const savedMode = localStorage.getItem('app_mode'); 
    
    if (savedMode) {
        setActiveMode(savedMode); // 'BUSINESS', 'ORGANIZATION', 'PERSONAL'
    } else {
        // Fallback: Cek tipe akun asli user
        const { data } = await supabase.from('profiles').select('account_type, entity_name').eq('id', user.id).single();
        if (data) {
            const defaultMode = data.account_type === 'business' ? 'BUSINESS' : 
                                data.account_type === 'organization' ? 'ORGANIZATION' : 'PERSONAL';
            setActiveMode(defaultMode);
            setEntityName(data.entity_name);
        }
    }
  };

  // --- KAMERA ---
  const handleNativeCamera = async (sourceMode) => {
    // Cek Limit dulu
    const limitCheck = await checkUsageLimit(user.id, 'SCAN');
    if (!limitCheck.allowed) {
      if (window.confirm(limitCheck.message + "\nMau upgrade?")) navigate('/upgrade');
      return; 
    }

    try {
      const image = await Camera.getPhoto({
        quality: 50, 
        allowEditing: false, 
        resultType: CameraResultType.Base64, 
        width: 800, // Sedikit lebih besar biar AI jelas baca teksnya
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

      // --- SMART DEFAULT LOGIC ---
      setTrxType(result.type || 'expense');

      // OTOMATIS SESUAI MODE AKTIF (Gak perlu user milih lagi)
      if (activeMode === 'BUSINESS' || activeMode === 'ORGANIZATION') {
          setAllocation('BUSINESS'); // Masuk Laporan Bisnis
      } else {
          setAllocation('PERSONAL'); // Masuk Arsip Pribadi
      }
      
      setStatus('success');
    } catch (error) {
      alert("Gagal analisa: " + error.message);
      setStatus('preview');
    }
  };

  // --- SIMPAN KE SUPABASE ---
  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    
    try {
      // Siapkan Data
      const payload = {
            user_id: user.id,
            merchant: aiResult.merchant,
            total_amount: aiResult.amount,
            type: trxType,
            
            // PENTING: Allocation Type menentukan masuk buku mana
            allocation_type: allocation, 
            
            category: aiResult.category,
            receipt_url: "Scan V10 (Global Mode)", 
            is_ai_generated: true,
            is_journalized: false,
            created_at: new Date().toISOString()
      };

      const { data: headerData, error: headerError } = await supabase
        .from('transaction_headers')
        .insert([payload])
        .select()
        .single();

      if (headerError) throw headerError;
      
      // Simpan Item Detail (jika ada)
      if (aiResult.items && aiResult.items.length > 0) {
        const itemsToInsert = aiResult.items.map(item => ({
          header_id: headerData.id,
          name: item.name,
          price: item.price,
          qty: 1
        }));
        await supabase.from('transaction_items').insert(itemsToInsert);
      }

      navigate('/dashboard'); // Balik ke Dashboard
    } catch (error) {
      alert('Gagal simpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // --- UI COMPONENT ---
  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white relative font-sans">
      
      {/* HEADER (Sticky) */}
      <div className="p-4 flex items-center justify-between bg-slate-900/90 backdrop-blur-md z-20 border-b border-white/10">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white transition">
            <X size={20} />
        </button>
        
        {/* Indikator Mode (Bukan Tombol Ganti) */}
        <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg">Scan Struk</h1>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                activeMode === 'PERSONAL' ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
            }`}>
                {activeMode === 'PERSONAL' ? <User size={10} /> : <Building2 size={10} />}
                <span>Mode {activeMode === 'PERSONAL' ? 'Pribadi' : activeMode === 'BUSINESS' ? 'Bisnis' : 'Organisasi'}</span>
            </div>
        </div>
        
        <div className="w-9"></div> {/* Spacer kanan biar tengah */}
      </div>

      {/* KONTEN UTAMA */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        
        {/* FRAME KAMERA */}
        <div className={`relative w-full aspect-[3/4] max-h-[60vh] rounded-3xl overflow-hidden border-2 flex flex-col items-center justify-center transition-all shadow-2xl ${
            activeMode === 'PERSONAL' ? 'bg-slate-800 border-pink-500/30 shadow-pink-900/20' : 'bg-slate-800 border-blue-500/30 shadow-blue-900/20'
        }`}>
          
          {/* STATE: IDLE (Belum ada foto) */}
          {status === 'idle' && (
            <div className="flex flex-col gap-4 w-full px-8 animate-fade-in-up">
               <button onClick={() => handleNativeCamera('camera')} className={`w-full py-5 rounded-2xl flex flex-col items-center justify-center gap-2 transition active:scale-95 hover:brightness-110 ${
                   activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-blue-600'
               }`}>
                  <span className="text-3xl">📸</span>
                  <span className="font-bold text-white text-lg">Ambil Foto</span>
               </button>
               
               <button onClick={() => handleNativeCamera('photos')} className="w-full py-4 bg-slate-700/50 border border-slate-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-700 transition active:scale-95">
                  <span className="text-xl">🖼️</span>
                  <span className="font-bold text-slate-300">Pilih Galeri</span>
               </button>
            </div>
          )}

          {/* STATE: PREVIEW (Sudah ada foto) */}
          {(status === 'preview' || status === 'processing' || status === 'success') && imagePreview && (
            <img src={imagePreview} className="w-full h-full object-contain bg-black" alt="Struk Preview" />
          )}

          {/* LOADING OVERLAY */}
          {status === 'processing' && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
              <div className={`w-14 h-14 border-4 border-t-transparent rounded-full animate-spin mb-4 ${
                  activeMode === 'PERSONAL' ? 'border-pink-500' : 'border-blue-500'
              }`}></div>
              <p className="font-bold text-white animate-pulse">AI Sedang Membaca...</p>
            </div>
          )}
        </div>

        {/* TOMBOL AKSI (Bawah Frame) */}
        {status === 'preview' && (
          <div className="flex gap-3 w-full mt-6 max-w-sm animate-slide-up">
            <button onClick={() => setStatus('idle')} className="flex-1 py-3.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700">
                <Repeat size={18}/> Ulang
            </button>
            <button onClick={handleAnalyze} className={`flex-[2] py-3.5 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 ${
                 activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-blue-600'
            }`}>
                Analisa Struk <ArrowLeft className="rotate-180" size={20}/>
            </button>
          </div>
        )}
      </div>

      {/* --- MODAL HASIL ANALISA (POPUP DARI BAWAH) --- */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-md h-[80vh] rounded-t-[2.5rem] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
                
                {/* Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-1 bg-white cursor-grab">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                </div>

                {/* Header Modal */}
                <div className="px-6 pb-4 border-b border-slate-100 bg-white">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">MERCHANT</p>
                            <h2 className="text-2xl font-extrabold text-slate-900 truncate max-w-[200px]">{aiResult.merchant}</h2>
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${
                            activeMode === 'PERSONAL' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                            {activeMode === 'PERSONAL' ? 'Pribadi' : 'Bisnis'}
                        </div>
                    </div>
                    
                    {/* Amount & Type Switcher */}
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button 
                                onClick={() => setTrxType('expense')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${trxType === 'expense' ? 'bg-red-500 text-white shadow-md' : 'text-slate-500'}`}
                            >
                                Keluar
                            </button>
                            <button 
                                onClick={() => setTrxType('income')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${trxType === 'income' ? 'bg-green-500 text-white shadow-md' : 'text-slate-500'}`}
                            >
                                Masuk
                            </button>
                        </div>
                        <span className={`text-2xl font-mono font-bold ${trxType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            Rp {aiResult.amount?.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Body Modal (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    
                    {/* INFO ALOKASI (Read Only / Simple Switch) */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                            Alokasi Dana
                        </label>
                        
                        {/* Jika Bisnis, User masih bisa milih: Operasional Toko ATAU Gaji Diri Sendiri */}
                        {activeMode === 'BUSINESS' ? (
                            <select 
                                value={allocation} 
                                onChange={(e) => setAllocation(e.target.value)}
                                className="w-full p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 font-bold text-sm outline-none"
                            >
                                <option value="BUSINESS">🏢 Operasional Toko</option>
                                <option value="SALARY">💰 Ambil Gaji Owner</option>
                            </select>
                        ) : (
                            // Jika Pribadi, User bisa milih: Pribadi Murni ATAU Prive (Ambil Modal Toko)
                            <select 
                                value={allocation} 
                                onChange={(e) => setAllocation(e.target.value)}
                                className="w-full p-2 bg-pink-50 border border-pink-100 rounded-lg text-pink-700 font-bold text-sm outline-none"
                            >
                                <option value="PERSONAL">🏠 Belanja Pribadi</option>
                                <option value="PRIVE">💸 Prive (Ambil Kas Toko)</option>
                            </select>
                        )}
                        <p className="text-[10px] text-slate-400 mt-2 italic">
                            *Otomatis terpilih berdasarkan mode aplikasi Anda.
                        </p>
                    </div>

                    {/* ITEM LIST */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detail Item</p>
                        {aiResult.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100">
                                <span className="text-sm font-medium text-slate-700 truncate w-[60%]">{item.name}</span>
                                <span className="text-sm font-bold text-slate-900">{item.price?.toLocaleString()}</span>
                            </div>
                        ))}
                        {(!aiResult.items || aiResult.items.length === 0) && (
                            <p className="text-center text-xs text-slate-400 py-4 italic">Tidak ada detail item terdeteksi.</p>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
                     <button onClick={() => { setStatus('idle'); setAiResult(null); }} className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">
                        Batal
                     </button>
                     <button onClick={handleSave} disabled={saving} className={`flex-[2] py-3.5 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition active:scale-95 ${
                        trxType === 'income' ? 'bg-green-600' : 'bg-slate-900'
                     }`}>
                        {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Check size={20}/>}
                        {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
                     </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}