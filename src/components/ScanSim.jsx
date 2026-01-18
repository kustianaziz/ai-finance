import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processImageInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ArrowLeft, Repeat, Check, X, Building2, User, Pencil, List, Link } from 'lucide-react';
import { findMatchingBill, markBillAsPaid } from '../utils/billMatcher'; // <-- IMPORT BARU

export default function ScanSim() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE UTAMA
  const [status, setStatus] = useState('idle'); 
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // STATE DETEKSI TAGIHAN (NEW)
  const [matchedBill, setMatchedBill] = useState(null); 
  const [linkToBill, setLinkToBill] = useState(true);

  // STATE MODE & AKUN
  const [activeMode, setActiveMode] = useState('PERSONAL'); 
  const [userAccountType, setUserAccountType] = useState('personal'); 
  const [entityName, setEntityName] = useState('');

  // STATE FORMULIR GLOBAL
  const [trxType, setTrxType] = useState('expense'); 

  // KATEGORI DINAMIS
  const DEFAULT_CATEGORIES = [
      'Makanan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lainnya'
  ];
  const [categoryList, setCategoryList] = useState(DEFAULT_CATEGORIES);

  useEffect(() => {
    if (user) {
        fetchUserModeAndProfile();
        fetchUserBudgets();
    }
  }, [user]);

  const fetchUserModeAndProfile = async () => {
    const { data } = await supabase.from('profiles').select('account_type, entity_name').eq('id', user.id).single();
    if (data) {
        setUserAccountType(data.account_type); 
        setEntityName(data.entity_name);
        const savedMode = localStorage.getItem('app_mode'); 
        if (savedMode) setActiveMode(savedMode);
        else {
            const defaultMode = data.account_type === 'business' ? 'BUSINESS' : 
                                data.account_type === 'organization' ? 'ORGANIZATION' : 'PERSONAL';
            setActiveMode(defaultMode);
        }
    }
  };

  const fetchUserBudgets = async () => {
      try {
          const { data } = await supabase.from('budgets').select('category').eq('user_id', user.id);
          if (data && data.length > 0) {
              const userCustomCats = data.map(b => b.category);
              const merged = [...new Set([...DEFAULT_CATEGORIES, ...userCustomCats])].map(
                  s => s.charAt(0).toUpperCase() + s.slice(1)
              );
              setCategoryList(merged);
          }
      } catch (error) {
          console.error("Gagal load kategori budget", error);
      }
  };

  // --- KAMERA ---
  const handleNativeCamera = async (sourceMode) => {
    // LOGIC LIMIT AKUN (TETAP AMAN)
    const isVip = ['business', 'organization', 'personal_pro'].includes(userAccountType);
    if (!isVip) {
        const limitCheck = await checkUsageLimit(user.id, 'SCAN');
        if (!limitCheck.allowed) {
          if (window.confirm(limitCheck.message + "\nMau upgrade?")) navigate('/upgrade');
          return; 
        }
    }

    try {
      const image = await Camera.getPhoto({
        quality: 50, allowEditing: false, resultType: CameraResultType.Base64, width: 800, 
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
    setMatchedBill(null); // Reset

    try {
      // Pass categoryList ke AI
      const result = await processImageInput(imageBase64, 'image/jpeg', categoryList);
      
      setTrxType(result.type || 'expense');
      
      let detectedCat = result.category || 'Lainnya';
      detectedCat = detectedCat.charAt(0).toUpperCase() + detectedCat.slice(1).toLowerCase();
      const isStandard = categoryList.includes(detectedCat);

      const enrichedResult = {
          ...result,
          category: isStandard ? detectedCat : (detectedCat || 'Lainnya'),
          isManualCategory: !isStandard, 
          allocation_type: (activeMode === 'BUSINESS' || activeMode === 'ORGANIZATION') ? 'BUSINESS' : 'PERSONAL'
      };

      setAiResult(enrichedResult);
      setStatus('success');

      // --- DETEKSI TAGIHAN (NEW) ---
      // Untuk scan, hasilnya biasanya 1 object (bukan array), jadi langsung cek
      const bill = await findMatchingBill(user.id, enrichedResult);
      if (bill) {
          setMatchedBill(bill);
          setLinkToBill(true);
      }

    } catch (error) {
      alert("Gagal analisa: " + error.message);
      setStatus('preview');
    }
  };

  // --- HELPER UPDATE DATA ---
  const updateAiResult = (field, value) => {
      setAiResult(prev => ({ ...prev, [field]: value }));
  };

  const updateItem = (index, field, value) => {
      const newItems = [...aiResult.items];
      newItems[index][field] = value;
      setAiResult(prev => ({ ...prev, items: newItems }));
  };

  const toggleCategoryMode = () => {
      setAiResult(prev => ({
          ...prev,
          isManualCategory: !prev.isManualCategory,
          category: !prev.isManualCategory ? prev.category : (categoryList.includes(prev.category) ? prev.category : 'Lainnya')
      }));
  };

  // --- SIMPAN KE SUPABASE (OPTIMIZED: PARALLEL) ---
  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    
    try {
      // 1. Simpan Transaksi Header
      const payload = {
            user_id: user.id, merchant: aiResult.merchant, total_amount: aiResult.amount, 
            type: trxType, allocation_type: aiResult.allocation_type, category: aiResult.category, 
            date: aiResult.date || new Date().toISOString(), receipt_url: "Scan V12 (Fast Mode & Bill Sync)", 
            is_ai_generated: true, is_journalized: false, created_at: new Date().toISOString()
      };

      const { data: headerData, error: headerError } = await supabase.from('transaction_headers').insert([payload]).select().single();
      if (headerError) throw headerError;
      
      // 2. Simpan Item Detail
      if (aiResult.items && aiResult.items.length > 0) {
        const itemsToInsert = aiResult.items.map(item => ({
          header_id: headerData.id, name: item.name, price: item.price, qty: 1
        }));
        await supabase.from('transaction_items').insert(itemsToInsert);
      }

      // --- UPDATE STATUS TAGIHAN JIKA DICENTANG (NEW) ---
      if (matchedBill && linkToBill) {
          await markBillAsPaid(matchedBill.id);
      }

      navigate('/dashboard'); 
    } catch (error) {
      alert('Gagal simpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white relative font-sans">
      {/* HEADER */}
      <div className="p-4 flex items-center justify-between bg-slate-900/90 backdrop-blur-md z-20 border-b border-white/10">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white transition"><X size={20} /></button>
        <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg">Scan Struk</h1>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${activeMode === 'PERSONAL' ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-blue-500/20 border-blue-500/50 text-blue-300'}`}>
                {activeMode === 'PERSONAL' ? <User size={10} /> : <Building2 size={10} />}
                <span>Mode {activeMode === 'PERSONAL' ? 'Pribadi' : activeMode === 'BUSINESS' ? 'Bisnis' : 'Organisasi'}</span>
            </div>
        </div>
        <div className="w-9"></div> 
      </div>

      {/* KONTEN UTAMA */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className={`relative w-full aspect-[3/4] max-h-[60vh] rounded-3xl overflow-hidden border-2 flex flex-col items-center justify-center transition-all shadow-2xl ${activeMode === 'PERSONAL' ? 'bg-slate-800 border-pink-500/30 shadow-pink-900/20' : 'bg-slate-800 border-blue-500/30 shadow-blue-900/20'}`}>
          {status === 'idle' && (
            <div className="flex flex-col gap-4 w-full px-8 animate-fade-in-up">
               <button onClick={() => handleNativeCamera('camera')} className={`w-full py-5 rounded-2xl flex flex-col items-center justify-center gap-2 transition active:scale-95 hover:brightness-110 ${activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-blue-600'}`}><span className="text-3xl">📸</span><span className="font-bold text-white text-lg">Ambil Foto</span></button>
               <button onClick={() => handleNativeCamera('photos')} className="w-full py-4 bg-slate-700/50 border border-slate-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-700 transition active:scale-95"><span className="text-xl">🖼️</span><span className="font-bold text-slate-300">Pilih Galeri</span></button>
            </div>
          )}
          {(status === 'preview' || status === 'processing' || status === 'success') && imagePreview && (<img src={imagePreview} className="w-full h-full object-contain bg-black" alt="Struk Preview" />)}
          {status === 'processing' && (<div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20"><div className={`w-14 h-14 border-4 border-t-transparent rounded-full animate-spin mb-4 ${activeMode === 'PERSONAL' ? 'border-pink-500' : 'border-blue-500'}`}></div><p className="font-bold text-white animate-pulse">AI Sedang Membaca...</p></div>)}
        </div>
        {status === 'preview' && (<div className="flex gap-3 w-full mt-6 max-w-sm animate-slide-up"><button onClick={() => setStatus('idle')} className="flex-1 py-3.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700"><Repeat size={18}/> Ulang</button><button onClick={handleAnalyze} className={`flex-[2] py-3.5 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 ${activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-blue-600'}`}>Analisa Struk <ArrowLeft className="rotate-180" size={20}/></button></div>)}
      </div>

      {/* --- MODAL HASIL ANALISA --- */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-md h-[80vh] rounded-t-[2.5rem] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
                <div className="w-full flex justify-center pt-3 pb-1 bg-white cursor-grab"><div className="w-12 h-1.5 bg-slate-200 rounded-full"></div></div>
                <div className="px-6 pb-4 border-b border-slate-100 bg-white">
                    <div className="flex justify-between items-start mb-2"><div><p className="text-xs text-slate-400 font-bold uppercase tracking-wider">MERCHANT</p><h2 className="text-2xl font-extrabold text-slate-900 truncate max-w-[200px]">{aiResult.merchant}</h2></div><div className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${activeMode === 'PERSONAL' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>{activeMode === 'PERSONAL' ? 'Pribadi' : 'Bisnis'}</div></div>
                    <div className="flex items-center gap-3 mt-2"><div className="flex bg-slate-100 p-1 rounded-xl"><button onClick={() => setTrxType('expense')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${trxType === 'expense' ? 'bg-red-500 text-white shadow-md' : 'text-slate-500'}`}>Keluar</button><button onClick={() => setTrxType('income')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${trxType === 'income' ? 'bg-green-500 text-white shadow-md' : 'text-slate-500'}`}>Masuk</button></div><span className={`text-2xl font-mono font-bold ${trxType === 'income' ? 'text-green-600' : 'text-red-600'}`}>Rp {aiResult.amount?.toLocaleString()}</span></div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    
                    {/* CARD KONFIRMASI TAGIHAN (NEW FITUR) */}
                    {matchedBill && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in-up mb-4">
                          <div className="p-2 bg-white rounded-full text-indigo-600 shadow-sm shrink-0"><Link size={20}/></div>
                          <div className="flex-1">
                              <h4 className="font-bold text-indigo-900 text-sm">Terdeteksi Tagihan!</h4>
                              <p className="text-xs text-indigo-600 mt-0.5 leading-relaxed">
                                  Transaksi ini mirip dengan tagihan <b>{matchedBill.name}</b>. Mau tandai sebagai lunas sekalian?
                              </p>
                          </div>
                          <div className="flex items-center h-full">
                              <input type="checkbox" checked={linkToBill} onChange={(e) => setLinkToBill(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"/>
                          </div>
                      </div>
                    )}

                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 transition-all">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Kategori {aiResult.isManualCategory ? '(Manual)' : '(Otomatis)'}</label>
                            <button onClick={toggleCategoryMode} className="p-1.5 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-indigo-600 transition" title={aiResult.isManualCategory ? "Ganti ke Pilihan" : "Ketik Manual"}>{aiResult.isManualCategory ? <List size={14}/> : <Pencil size={14}/>}</button>
                        </div>
                        {aiResult.isManualCategory ? (
                            <input type="text" autoFocus value={aiResult.category} onChange={(e) => updateAiResult('category', e.target.value)} className="w-full p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 font-bold text-sm outline-none placeholder-indigo-300" placeholder="Ketik kategori bebas..."/>
                        ) : (
                            <div className="relative">
                                <select value={aiResult.category} onChange={(e) => updateAiResult('category', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm outline-none appearance-none">
                                    {categoryList.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Alokasi Dana</label>{activeMode === 'BUSINESS' ? (<select value={aiResult.allocation_type} onChange={(e) => updateAiResult('allocation_type', e.target.value)} className="w-full p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 font-bold text-sm outline-none"><option value="BUSINESS">🏢 Operasional Toko</option><option value="SALARY">💰 Ambil Gaji Owner</option></select>) : (<select value={aiResult.allocation_type} onChange={(e) => updateAiResult('allocation_type', e.target.value)} className="w-full p-2 bg-pink-50 border border-pink-100 rounded-lg text-pink-700 font-bold text-sm outline-none"><option value="PERSONAL">🏠 Belanja Pribadi</option><option value="PRIVE">💸 Prive (Ambil Kas Toko)</option></select>)}</div>
                    <div className="space-y-3"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detail Item</p>{aiResult.items?.map((item, idx) => (<div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100"><span className="text-sm font-medium text-slate-700 truncate w-[60%]">{item.name}</span><span className="text-sm font-bold text-slate-900">{item.price?.toLocaleString()}</span></div>))}{(!aiResult.items || aiResult.items.length === 0) && (<p className="text-center text-xs text-slate-400 py-4 italic">Tidak ada detail item terdeteksi.</p>)}</div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex gap-3"><button onClick={() => { setStatus('idle'); setAiResult(null); }} className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">Batal</button><button onClick={handleSave} disabled={saving} className={`flex-[2] py-3.5 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition active:scale-95 ${trxType === 'income' ? 'bg-green-600' : 'bg-slate-900'}`}>{saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Check size={20}/>}{saving ? 'Menyimpan...' : 'Simpan Transaksi'}</button></div>
            </div>
        </div>
      )}
    </div>
  );
}