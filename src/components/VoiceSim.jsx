import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processVoiceInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic';

export default function VoiceSim() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(''); 
  const [status, setStatus] = useState('idle'); 
  const [aiResult, setAiResult] = useState(null); // Array transaksi
  const [saving, setSaving] = useState(false);

  // STATE MODE (Sticky Toggle)
  const [mode, setMode] = useState('BUSINESS'); 

  // Ref Speech
  const recognitionRef = useRef(null);

  // 1. CEK MEMORY MODE SAAT LOAD
  useEffect(() => {
    const savedMode = localStorage.getItem('voice_mode');
    if (savedMode) setMode(savedMode);
  }, []);

  // 2. TOGGLE MODE DEPAN
  const toggleMode = (newMode) => {
      setMode(newMode);
      localStorage.setItem('voice_mode', newMode);
  };

  // 3. SETUP SPEECH RECOGNITION
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'id-ID'; 
      recognition.continuous = true; 
      recognition.interimResults = false; 

      recognition.onresult = (event) => {
        const lastResultIndex = event.results.length - 1;
        const transcriptChunk = event.results[lastResultIndex][0].transcript.trim();
        if (transcriptChunk) {
            setTranscript(prevText => prevText ? `${prevText} ${transcriptChunk}` : transcriptChunk);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech') return; 
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    } else {
      alert("Browser/HP ini gak support fitur suara.");
    }
  }, []);

  // --- TOGGLE MIC ---
  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      const limitCheck = await checkUsageLimit(user.id, 'VOICE');
      if (!limitCheck.allowed) {
        if(window.confirm(limitCheck.message + "\nMau upgrade sekarang?")) navigate('/upgrade');
        return;
      }

      setTranscript(''); 
      setAiResult(null); 
      setStatus('listening');
      if (recognitionRef.current) recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // --- PROSES KE AI ---
  const handleProcessAI = async () => {
    if (!transcript.trim()) {
      alert("Belum ada suara yang masuk, Gan!");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    }

    setStatus('processing');

    try {
      const result = await processVoiceInput(transcript);
      
      // --- LOGIC SMART DEFAULT ---
      // Kita map hasil AI untuk menyuntikkan allocation_type sesuai Mode Depan
      const enrichedResult = result.map(txn => ({
          ...txn,
          // Default Type Expense kalau AI lupa kasih
          type: txn.type || 'expense', 
          // Default Allocation ikut Mode Toggle
          allocation_type: mode === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL' 
      }));

      setAiResult(enrichedResult);
      setStatus('success');
    } catch (error) {
      alert("Gagal memproses: " + error.message);
      setStatus('idle');
    }
  };

  // --- HELPER UNTUK EDIT DATA DALAM LIST (Karena Voice bisa banyak item) ---
  const updateTransaction = (index, field, value) => {
      const updatedList = [...aiResult];
      updatedList[index][field] = value;
      setAiResult(updatedList);
  };

  // --- SIMPAN KE DATABASE ---
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
            
            // GUNAKAN DATA YANG SUDAH DIEDIT USER DI LIST
            type: txn.type,
            allocation_type: txn.allocation_type,
            
            category: txn.category,
            receipt_url: "Voice Input V4 (Smart Mode)",
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

  return (
    <div className="flex flex-col h-screen bg-white relative">
      
      {/* HEADER */}
      <div className="p-6 flex items-center justify-between bg-white shadow-sm z-10">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-gray-100 rounded-full text-gray-600">✕</button>
        <h1 className="font-bold text-gray-800">Voice Input</h1>
        <div className="w-8"></div>
      </div>

      {/* --- TOGGLE SWITCH MODE (DEPAN) --- */}
      {/* Hanya muncul saat belum ada hasil (Idle/Listening/Processing) */}
      {status !== 'success' && (
        <div className="px-6 py-2 bg-white z-10">
            <div className="bg-gray-100 p-1 rounded-xl flex">
                <button 
                    onClick={() => toggleMode('BUSINESS')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        mode === 'BUSINESS' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    🏢 Bisnis
                </button>
                <button 
                    onClick={() => toggleMode('PERSONAL')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        mode === 'PERSONAL' ? 'bg-gray-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    👤 Pribadi
                </button>
            </div>
            <p className="text-center text-[10px] text-gray-500 mt-2">
                {mode === 'BUSINESS' ? 'Mode Default: Masuk Laporan Usaha' : 'Mode Default: Pribadi (Skip Laporan)'}
            </p>
        </div>
      )}

      {/* CONTENT AREA */}
      <div className="flex-1 p-6 flex flex-col items-center overflow-y-auto">
        
        {/* VISUALISASI MIC */}
        {status !== 'success' && (
            <>
                <div className="relative mb-8 mt-4">
                  {isListening && <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-75"></div>}
                  <button 
                    onClick={toggleListening}
                    className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-xl transition-all ${
                      isListening ? 'bg-red-500 text-white scale-110' : 
                      mode === 'BUSINESS' ? 'bg-blue-600 text-white hover:scale-105' : 'bg-gray-600 text-white hover:scale-105'
                    }`}
                  >
                    {isListening ? '⏹' : '🎙️'}
                  </button>
                </div>

                <p className="text-gray-500 text-sm mb-4 font-medium text-center">
                  {isListening ? 'Sedang mendengarkan...' : `Klik mic untuk catat pengeluaran ${mode === 'BUSINESS' ? 'Bisnis' : 'Pribadi'}`}
                </p>

                {/* TEXT AREA */}
                <div className="w-full bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-6 flex-1 max-h-[200px] overflow-hidden flex flex-col">
                    <textarea 
                        className="w-full h-full bg-transparent outline-none text-gray-700 text-lg resize-none placeholder-gray-300"
                        placeholder='Contoh: "Beli bensin 20 ribu dan kopi 10 ribu"'
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                    ></textarea>
                </div>

                {transcript.length > 3 && status !== 'processing' && (
                    <button 
                        onClick={handleProcessAI}
                        className={`w-full py-4 text-white rounded-xl font-bold text-lg shadow-lg hover:brightness-110 transition animate-fade-in-up ${
                            mode === 'BUSINESS' ? 'bg-blue-600' : 'bg-gray-600'
                        }`}
                    >
                        ⚡ Proses Sekarang
                    </button>
                )}

                {status === 'processing' && (
                    <div className="text-center animate-pulse mt-4">
                        <p className="text-blue-600 font-bold text-lg">🤖 AI sedang berpikir...</p>
                    </div>
                )}
            </>
        )}
      </div>

      {/* --- HASIL AI (CARD LIST EDITABLE) --- */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 bg-gray-50 z-20 flex flex-col animate-slide-up overflow-hidden">
           
           {/* HEADER HASIL */}
           <div className={`p-6 border-b shadow-sm ${mode === 'BUSINESS' ? 'bg-blue-50 border-blue-100' : 'bg-gray-100 border-gray-200'}`}>
               <h2 className={`font-bold text-lg flex items-center gap-2 ${mode === 'BUSINESS' ? 'text-blue-800' : 'text-gray-700'}`}>
                   ✅ Hasil Suara ({aiResult.length})
               </h2>
               <p className="text-xs text-gray-500">Cek tipe transaksi sebelum disimpan.</p>
           </div>
           
           {/* LIST TRANSAKSI */}
           <div className="p-4 flex-1 overflow-y-auto space-y-4 pb-24">
              {aiResult.map((txn, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
                      
                      {/* BARIS 1: MERCHANT & AMOUNT */}
                      <div className="flex justify-between items-start mb-3">
                          <input 
                            type="text" 
                            value={txn.merchant}
                            onChange={(e) => updateTransaction(idx, 'merchant', e.target.value)}
                            className="font-bold text-gray-800 text-lg border-b border-transparent focus:border-blue-500 outline-none w-[60%]"
                          />
                          <p className="font-bold text-xl text-gray-800">
                              Rp {txn.total_amount.toLocaleString()}
                          </p>
                      </div>

                      {/* BARIS 2: TIPE & ALOKASI (BUTTONS & DROPDOWN) */}
                      <div className="flex flex-col gap-3 mb-3 bg-gray-50 p-3 rounded-lg">
                          
                          {/* TOMBOL INCOME / EXPENSE */}
                          <div className="flex gap-2">
                              <button 
                                onClick={() => updateTransaction(idx, 'type', 'expense')}
                                className={`flex-1 py-1 text-xs font-bold rounded border ${txn.type === 'expense' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-400 border-gray-200'}`}
                              >
                                💸 Keluar
                              </button>
                              <button 
                                onClick={() => updateTransaction(idx, 'type', 'income')}
                                className={`flex-1 py-1 text-xs font-bold rounded border ${txn.type === 'income' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-400 border-gray-200'}`}
                              >
                                💰 Masuk
                              </button>
                          </div>

                          {/* DROPDOWN ALOKASI (SESUAI MODE) */}
                          <select 
                            value={txn.allocation_type}
                            onChange={(e) => updateTransaction(idx, 'allocation_type', e.target.value)}
                            className={`w-full p-2 rounded border font-bold text-sm outline-none ${
                                txn.allocation_type === 'BUSINESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                txn.allocation_type === 'PERSONAL' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                txn.allocation_type === 'PRIVE' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                             {mode === 'BUSINESS' ? (
                                <>
                                    <option value="BUSINESS">🏢 Operasional (Laporan)</option>
                                    <option value="SALARY">💰 Gaji (Ambil Gaji)</option>
                                </>
                             ) : (
                                <>
                                    <option value="PERSONAL">⛔ Pribadi (Skip)</option>
                                    <option value="PRIVE">👨‍👩‍👧 Prive (Ambil Kas)</option>
                                </>
                             )}
                          </select>
                      </div>
                      
                      {/* BARIS 3: ITEMS */}
                      <div className="space-y-1 pl-2 border-l-2 border-gray-100">
                          {txn.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-xs text-gray-500">
                                  <span>{item.name}</span>
                                  <span>{item.price.toLocaleString()}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
           </div>

           {/* FOOTER */}
           <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
               <div className="flex gap-3">
                   <button 
                     onClick={() => { setStatus('idle'); setTranscript(''); setAiResult(null); }}
                     className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50"
                   >
                     Ulang
                   </button>
                   <button 
                     onClick={handleSave}
                     disabled={saving}
                     className={`flex-[2] py-3 text-white rounded-xl font-bold shadow-lg hover:brightness-110 flex justify-center items-center gap-2 ${
                         mode === 'BUSINESS' ? 'bg-blue-600' : 'bg-gray-700'
                     }`}
                   >
                     {saving ? 'Menyimpan...' : 'Simpan Semua ✅'}
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}