import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processVoiceInput } from '../utils/aiLogic'; // Logic AI tetap dipakai
// HAPUS IMPORT checkUsageLimit KARENA GRATIS
import { ArrowLeft, Keyboard, X, User, Building2, Send } from 'lucide-react';

export default function ManualInputPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('idle'); // idle, processing, success
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // STATE MODE GLOBAL (Otomatis)
  const [activeMode, setActiveMode] = useState('PERSONAL');

  // 1. CEK MODE SAAT LOAD
  useEffect(() => {
    fetchUserMode();
  }, []);

  const fetchUserMode = async () => {
    if (!user) return;
    const savedMode = localStorage.getItem('app_mode');
    
    if (savedMode) {
        setActiveMode(savedMode);
    } else {
        const { data } = await supabase.from('profiles').select('account_type').eq('id', user.id).single();
        if (data) {
            const defaultMode = data.account_type === 'business' ? 'BUSINESS' : 
                                data.account_type === 'organization' ? 'ORGANIZATION' : 'PERSONAL';
            setActiveMode(defaultMode);
        }
    }
  };

  // --- PROSES AI (GRATIS / UNLIMITED) ---
  const handleProcess = async () => {
    if (!inputText.trim()) {
      alert("Ketik dulu transaksinya, Juragan!");
      return;
    }

    // --- BAGIAN CEK LIMIT SUDAH DIHAPUS DISINI ---
    // User bebas pakai fitur ini sepuasnya.

    setStatus('processing');

    try {
      // Kita pakai fungsi processVoiceInput karena fungsinya sama: String -> JSON Transaksi
      const result = await processVoiceInput(inputText);
      
      // --- LOGIC SMART DEFAULT ---
      const enrichedResult = result.map(txn => ({
          ...txn,
          type: txn.type || 'expense', 
          // OTOMATIS SESUAI MODE AKTIF
          allocation_type: (activeMode === 'BUSINESS' || activeMode === 'ORGANIZATION') ? 'BUSINESS' : 'PERSONAL' 
      }));

      setAiResult(enrichedResult);
      setStatus('success');
    } catch (error) {
      alert("Gagal memproses: " + error.message);
      setStatus('idle');
    }
  };

  // --- HELPER UPDATE DATA ---
  const updateTransaction = (index, field, value) => {
      const updatedList = [...aiResult];
      updatedList[index][field] = value;
      setAiResult(updatedList);
  };

  // --- SIMPAN KE DB ---
  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    
    try {
      for (const txn of aiResult) {
        const { data: headerData, error: headerError } = await supabase
          .from('transaction_headers')
          .insert([{
            user_id: user.id,
            merchant: txn.merchant,
            total_amount: txn.total_amount,
            type: txn.type,
            allocation_type: txn.allocation_type,
            category: txn.category,
            receipt_url: "Manual Text V1 (Free Unlimited)", // Tandai sebagai fitur gratis
            is_ai_generated: true,
            is_journalized: false
          }])
          .select().single();

        if (headerError) throw headerError;

        if (txn.items && txn.items.length > 0) {
          const itemsToInsert = txn.items.map(item => ({
            header_id: headerData.id,
            name: item.name,
            price: item.price,
            qty: 1
          }));
          await supabase.from('transaction_items').insert(itemsToInsert);
        }
      }

      navigate('/dashboard');

    } catch (error) {
      console.error(error);
      alert('Gagal simpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // TEMA WARNA DINAMIS
  const themeColor = activeMode === 'PERSONAL' ? 'pink' : 'blue';
  const btnColor = activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-blue-600';
  const lightBg = activeMode === 'PERSONAL' ? 'bg-pink-50' : 'bg-blue-50';
  const borderColor = activeMode === 'PERSONAL' ? 'border-pink-200' : 'border-blue-200';
  const textColor = activeMode === 'PERSONAL' ? 'text-pink-600' : 'text-blue-600';

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative font-sans">
      
      {/* HEADER (Sticky) */}
      <div className="p-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-slate-100">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition">
            <X size={20}/>
        </button>
        
        {/* Indikator Mode */}
        <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg text-slate-800">Input Teks AI</h1>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${lightBg} ${borderColor} ${textColor}`}>
                {activeMode === 'PERSONAL' ? <User size={10} /> : <Building2 size={10} />}
                <span>Mode {activeMode === 'PERSONAL' ? 'Pribadi' : activeMode === 'BUSINESS' ? 'Bisnis' : 'Organisasi'}</span>
            </div>
        </div>
        
        <div className="w-9"></div> 
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 p-6 flex flex-col items-center overflow-y-auto pb-32">
        
        {status !== 'success' && (
            <>
                {/* ICON UTAMA */}
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-xl mb-6 mt-8 ${btnColor} text-white shadow-${themeColor}-200`}>
                    <Keyboard size={36}/>
                </div>

                <p className="text-slate-500 text-sm mb-6 font-medium text-center max-w-[280px]">
                  Ketik transaksi secara natural, AI akan merapikannya untuk {activeMode === 'PERSONAL' ? 'catatan pribadimu' : 'laporan bisnismu'}.
                </p>

                {/* TEXT AREA INPUT */}
                <div className="w-full bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 flex-1 min-h-[200px] flex flex-col relative focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <textarea 
                        className="w-full h-full bg-transparent outline-none text-slate-700 text-lg resize-none placeholder-slate-300 font-medium leading-relaxed"
                        placeholder='Contoh: "Beli kertas A4 1 rim 50rb dan Tinta Printer 100rb buat stok kantor"'
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    ></textarea>
                    
                    {/* Clear Button */}
                    {inputText && (
                        <button onClick={() => setInputText('')} className="absolute top-2 right-2 p-1.5 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                            <X size={14}/>
                        </button>
                    )}
                </div>

                {/* TOMBOL PROSES */}
                <button 
                    onClick={handleProcess}
                    disabled={!inputText.trim() || status === 'processing'}
                    className={`w-full py-4 text-white rounded-2xl font-bold text-lg shadow-lg hover:brightness-110 transition active:scale-95 flex items-center justify-center gap-2 ${btnColor} disabled:bg-slate-300 disabled:cursor-not-allowed`}
                >
                    {status === 'processing' ? 'Memproses...' : 'Proses Tulisan'} 
                    {status !== 'processing' && <Send size={20}/>}
                </button>

                {/* LOADING INDICATOR */}
                {status === 'processing' && (
                    <div className="text-center animate-pulse mt-4 flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin border-${themeColor}-500`}></div>
                        <p className="text-slate-500 font-bold text-sm">AI sedang membaca tulisanmu...</p>
                    </div>
                )}
            </>
        )}
      </div>

      {/* --- HASIL AI (CARD LIST EDITABLE) --- */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 bg-slate-50 z-20 flex flex-col animate-slide-up overflow-hidden">
           
           {/* HEADER HASIL */}
           <div className={`p-6 border-b shadow-sm z-10 flex justify-between items-center ${lightBg} ${borderColor}`}>
               <div>
                   <h2 className={`font-bold text-lg flex items-center gap-2 ${activeMode === 'PERSONAL' ? 'text-pink-800' : 'text-blue-800'}`}>
                       ✅ Hasil Deteksi ({aiResult.length})
                   </h2>
                   <p className="text-xs text-slate-500">Silakan koreksi jika ada yang salah.</p>
               </div>
               <div className={`p-2 rounded-full ${activeMode === 'PERSONAL' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                   {activeMode === 'PERSONAL' ? <User size={20}/> : <Building2 size={20}/>}
               </div>
           </div>
           
           {/* LIST TRANSAKSI */}
           <div className="p-4 flex-1 overflow-y-auto space-y-4 pb-28">
              {aiResult.map((txn, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
                      
                      {/* BARIS 1: MERCHANT & AMOUNT */}
                      <div className="flex justify-between items-start mb-4">
                          <input 
                            type="text" 
                            value={txn.merchant}
                            onChange={(e) => updateTransaction(idx, 'merchant', e.target.value)}
                            className="font-bold text-slate-800 text-lg border-b border-transparent focus:border-blue-500 outline-none w-[60%] bg-transparent"
                            placeholder="Nama Item/Toko"
                          />
                          <p className="font-bold text-xl text-slate-800">
                              Rp {txn.total_amount.toLocaleString()}
                          </p>
                      </div>

                      {/* BARIS 2: TIPE & ALOKASI */}
                      <div className="flex flex-col gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          
                          {/* SWITCH TYPE */}
                          <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-100">
                              <button 
                                onClick={() => updateTransaction(idx, 'type', 'expense')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                    txn.type === 'expense' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                                }`}
                              >
                                Keluar
                              </button>
                              <button 
                                onClick={() => updateTransaction(idx, 'type', 'income')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                    txn.type === 'income' ? 'bg-green-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                                }`}
                              >
                                Masuk
                              </button>
                          </div>

                          {/* DROPDOWN ALOKASI */}
                          <div className="relative">
                              <select 
                                value={txn.allocation_type}
                                onChange={(e) => updateTransaction(idx, 'allocation_type', e.target.value)}
                                className={`w-full p-2.5 pl-3 rounded-lg border font-bold text-sm outline-none appearance-none ${
                                    txn.allocation_type === 'BUSINESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    txn.allocation_type === 'PERSONAL' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                                    'bg-orange-50 text-orange-700 border-orange-200'
                                }`}
                              >
                                 {activeMode === 'BUSINESS' ? (
                                    <>
                                        <option value="BUSINESS">🏢 Operasional Toko</option>
                                        <option value="SALARY">💰 Ambil Gaji Owner</option>
                                    </>
                                 ) : (
                                    <>
                                        <option value="PERSONAL">🏠 Belanja Pribadi</option>
                                        <option value="PRIVE">💸 Prive (Ambil Kas Toko)</option>
                                    </>
                                 )}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                          </div>
                      </div>
                  </div>
              ))}
           </div>

           {/* FOOTER */}
           <div className="p-5 border-t border-slate-200 bg-white sticky bottom-0 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] z-20">
               <div className="flex gap-3">
                   <button 
                     onClick={() => { setStatus('idle'); setAiResult(null); }}
                     className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition"
                   >
                     Ulang
                   </button>
                   <button 
                     onClick={handleSave}
                     disabled={saving}
                     className={`flex-[2] py-3.5 text-white rounded-xl font-bold shadow-lg hover:brightness-110 transition flex justify-center items-center gap-2 ${btnColor}`}
                   >
                     {saving ? 'Menyimpan...' : 'Simpan Semua'}
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}