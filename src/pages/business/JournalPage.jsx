import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthProvider';
import ModalInfo from '../../components/ModalInfo';

import { 
  ArrowLeft, Search, Filter, Loader2, 
  FileText, Calendar, Wand2, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';

const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function JournalPage() {
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth();
  const ownerId = user?.id || activeEmployee?.storeId;

  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter Default: Hari Ini
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  // Init
  useEffect(() => {
    if (ownerId) fetchJournals();
  }, [ownerId, filterDate]);

  const fetchJournals = async () => {
    setLoading(true);
    try {
        // Ambil Header Jurnal + Detail + Nama Akun
        const { data, error } = await supabase
            .from('journal_headers')
            .select(`
                *,
                journal_details (
                    id, debit, credit,
                    chart_of_accounts (code, name)
                )
            `)
            .eq('user_id', ownerId)
            .eq('transaction_date', filterDate) // Filter per hari biar ringan
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        setJournals(data || []);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <div className="shrink-0 bg-indigo-600 z-50 shadow-md">
          <div className="px-6 pt-6 pb-6">
              <div className="flex items-center gap-3 mb-4">
                {/* Logic: Kalau ada user (Owner login), selalu ke /dashboard. Kalau cuma session karyawan (tanpa login owner), baru ke /employee-dashboard */}
                <button onClick={() => navigate(user ? '/dashboard' : '/employee-dashboard')} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm">
                    <ArrowLeft size={20}/>
                </button>
                  <div className="flex-1"><h1 className="text-xl font-extrabold text-white">Buku Besar</h1><p className="text-xs text-white/80 font-medium">Riwayat Jurnal Umum</p></div>
                  
                  {/* TOMBOL KE HALAMAN PROSES (YANG TADI KITA BUAT) */}
                  <button onClick={() => navigate('/journal-process')} className="p-2 bg-white text-indigo-600 rounded-xl shadow-md hover:bg-indigo-50 transition active:scale-95 flex items-center gap-2 text-xs font-bold px-4">
                      <Wand2 size={16}/> Posting Data
                  </button>
              </div>
              
              {/* Filter Tanggal */}
              <div className="bg-white/10 p-2 rounded-xl border border-white/20 flex items-center px-3 backdrop-blur-sm text-white">
                  <Calendar size={18} className="mr-2"/>
                  <input type="date" className="bg-transparent font-bold text-sm outline-none w-full text-white" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              </div>
          </div>
      </div>

      {/* LIST JURNAL */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50 pb-20">
          {loading ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-indigo-400"/></div> : 
           journals.length === 0 ? (
               <div className="text-center py-20 text-slate-400">
                   <FileText size={48} className="mx-auto mb-2 opacity-30"/>
                   <p className="text-sm font-medium">Belum ada jurnal diposting pada tanggal ini.</p>
                   <button onClick={() => navigate('/journal-process')} className="mt-2 text-indigo-600 font-bold text-xs hover:underline">Cari & Posting Transaksi Pending</button>
               </div>
           ) : (
               journals.map(j => (
                   <div key={j.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                       {/* Header Card */}
                       <div className="flex justify-between items-start mb-3 pb-2 border-b border-dashed border-slate-100">
                           <div>
                               <p className="font-bold text-slate-800 text-sm line-clamp-1">{j.description || 'Jurnal Umum'}</p>
                               <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono mt-1 inline-block">{j.reference_no}</span>
                           </div>
                           <p className="text-[10px] text-slate-400">{new Date(j.transaction_date).toLocaleDateString('id-ID')}</p>
                       </div>
                       
                       {/* Detail Debit/Kredit */}
                       <div className="space-y-2 bg-slate-50 p-2 rounded-lg">
                           {j.journal_details?.map(d => (
                               <div key={d.id} className="flex justify-between text-xs items-center">
                                   <div className={`flex items-center gap-2 ${d.credit > 0 ? 'pl-4' : ''}`}>
                                       {d.credit > 0 ? <ArrowUpRight size={10} className="text-red-400"/> : <ArrowDownLeft size={10} className="text-green-400"/>}
                                       <span className={`${d.credit > 0 ? 'text-slate-500' : 'font-bold text-slate-700'}`}>
                                           {d.chart_of_accounts?.name || 'Akun Tidak Dikenal'} <span className="text-[9px] text-slate-400">({d.chart_of_accounts?.code})</span>
                                       </span>
                                   </div>
                                   <span className={`font-mono ${d.credit > 0 ? 'text-red-500' : 'text-green-600 font-bold'}`}>
                                       {d.debit > 0 ? formatIDR(d.debit) : formatIDR(d.credit)}
                                   </span>
                               </div>
                           ))}
                       </div>
                   </div>
               ))
           )
          }
      </div>
    </div>
  );
}