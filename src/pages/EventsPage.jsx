import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Calendar, Gift, Receipt, ArrowUpRight, 
  Trash2, CheckCircle2, PartyPopper, Briefcase, 
  BookOpen, Smile, Clock, Repeat, LayoutList, CalendarDays,
  StickyNote, CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EventsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- STATE ---
  const [events, setEvents] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('agenda'); 
  
  // Detail View State
  const [activeEvent, setActiveEvent] = useState(null); 
  const [eventTrx, setEventTrx] = useState([]); 
  const [activeTab, setActiveTab] = useState('overview'); 

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTrxModal, setShowTrxModal] = useState(false);
  
  // Forms
  const [eventForm, setEventForm] = useState({ 
      name: '', date: '', time: '', budget: '', category: 'kerja',
      isRecurring: false, repeatDays: [] 
  });
  
  const [trxForm, setTrxForm] = useState({ type: 'expense', name: '', amount: '', notes: '' });

  // --- CONFIG ---
  const CATEGORIES = {
      'hajatan': { label: 'Hajatan/Pesta', icon: PartyPopper, color: 'bg-rose-100 text-rose-600' },
      'kerja': { label: 'Pekerjaan', icon: Briefcase, color: 'bg-blue-100 text-blue-600' },
      'skill': { label: 'Upgrade Skill', icon: BookOpen, color: 'bg-amber-100 text-amber-600' },
      'spiritual': { label: 'Spiritual', icon: Smile, color: 'bg-purple-100 text-purple-600' },
      'general': { label: 'Umum', icon: Calendar, color: 'bg-slate-100 text-slate-600' },
  };

  const DAYS = [
      { id: 1, label: 'Sen' }, { id: 2, label: 'Sel' }, { id: 3, label: 'Rab' },
      { id: 4, label: 'Kam' }, { id: 5, label: 'Jum' }, { id: 6, label: 'Sab' }, { id: 0, label: 'Min' }
  ];

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDate = (date) => new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    if (user) fetchEvents();
  }, [user]);

  // --- FETCHING ---
  const fetchEvents = async () => {
    setLoading(true);
    const { data: eventsData } = await supabase.from('events').select('*').eq('user_id', user.id);
    setEvents(eventsData || []);

    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    const { data: logsData } = await supabase.from('event_transactions').select('event_id, id, notes').eq('type', 'log').gte('created_at', startOfDay).lte('created_at', endOfDay);
    setTodayLogs(logsData || []);
    setLoading(false);
  };

  const fetchEventDetails = async (eventId) => {
      const { data } = await supabase.from('event_transactions').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
      setEventTrx(data || []);
  };

  // --- ACTIONS ---
  const handleToggleDay = (dayId) => {
      const currentDays = eventForm.repeatDays;
      if (currentDays.includes(dayId)) setEventForm({ ...eventForm, repeatDays: currentDays.filter(d => d !== dayId) });
      else setEventForm({ ...eventForm, repeatDays: [...currentDays, dayId] });
  };

  const handleCreateEvent = async () => {
      if (!eventForm.name) return alert("Nama kegiatan wajib diisi");
      if (!eventForm.isRecurring && !eventForm.date) return alert("Tanggal wajib diisi");
      
      const finalCategory = viewMode === 'project' ? 'hajatan' : eventForm.category;
      const payload = {
          user_id: user.id, name: eventForm.name, category: finalCategory, start_time: eventForm.time || null, budget_limit: eventForm.budget || 0,
          is_recurring: eventForm.isRecurring, event_date: eventForm.isRecurring ? null : eventForm.date, repeat_days: eventForm.isRecurring ? eventForm.repeatDays : null
      };

      const { error } = await supabase.from('events').insert(payload);
      if (error) return alert("Gagal menyimpan: " + error.message);

      setShowCreateModal(false);
      setEventForm({ name: '', date: '', time: '', budget: '', category: 'kerja', isRecurring: false, repeatDays: [] });
      fetchEvents();
  };

  const handleToggleDone = async (e, ev) => {
      if(e) e.stopPropagation();
      if (ev.is_recurring) {
          const existingLog = todayLogs.find(log => log.event_id === ev.id);
          if (existingLog) await supabase.from('event_transactions').delete().eq('id', existingLog.id);
          else await supabase.from('event_transactions').insert({ event_id: ev.id, type: 'log', name: 'Selesai', amount: 0, is_gift: false });
      } else {
          await supabase.from('events').update({ is_done: !ev.is_done }).eq('id', ev.id);
          if (activeEvent && activeEvent.id === ev.id) setActiveEvent({ ...activeEvent, is_done: !ev.is_done });
      }
      fetchEvents();
  };

  const handleCreateTrx = async () => {
      const finalAmount = trxForm.type === 'note' || trxForm.type === 'log' ? 0 : (trxForm.amount || 0);
      const finalType = viewMode === 'agenda' ? 'log' : trxForm.type;

      if (viewMode === 'agenda' && activeEvent.is_recurring) {
          const existingLog = todayLogs.find(log => log.event_id === activeEvent.id);
          if (existingLog) await supabase.from('event_transactions').update({ notes: trxForm.name }).eq('id', existingLog.id);
          else await supabase.from('event_transactions').insert({ event_id: activeEvent.id, type: 'log', name: 'Selesai', notes: trxForm.name, amount: 0 });
      } else {
          await supabase.from('event_transactions').insert({
              event_id: activeEvent.id, type: finalType, name: trxForm.name, amount: finalAmount, notes: trxForm.notes, is_gift: trxForm.type === 'income'
          });
      }
      setShowTrxModal(false); setTrxForm({ type: 'expense', name: '', amount: '', notes: '' }); fetchEventDetails(activeEvent.id); fetchEvents();
  };

  const handleDeleteEvent = async () => {
      if(!confirm("Hapus data ini?")) return;
      await supabase.from('events').delete().eq('id', activeEvent.id); setActiveEvent(null); fetchEvents();
  };

  const getDayLabel = (dayArr) => {
      if (!dayArr || dayArr.length === 0) return '';
      if (dayArr.length === 7) return 'Setiap Hari';
      return dayArr.sort().map(d => DAYS.find(day => day.id === d)?.label).join(', ');
  };

  const getEventStats = (trxList) => {
      let expense = 0, income = 0;
      trxList.forEach(t => { if(t.type === 'expense') expense += Number(t.amount); else if(t.type === 'income') income += Number(t.amount); });
      return { expense, income };
  };

  const isEventDone = (ev) => {
      if (ev.is_recurring) return todayLogs.some(log => log.event_id === ev.id);
      return ev.is_done;
  };

  // --- RENDER LIST ---
  const renderList = () => {
      const filteredEvents = events.filter(ev => {
          if (viewMode === 'project') return ev.category === 'hajatan';
          return ev.category !== 'hajatan';
      }).sort((a, b) => {
          const doneA = isEventDone(a); const doneB = isEventDone(b);
          if (doneA === doneB) { if (a.is_recurring === b.is_recurring) return new Date(a.event_date) - new Date(b.event_date); return a.is_recurring ? -1 : 1; }
          return doneA ? 1 : -1;
      });

      return (
          <div className="px-6 space-y-4 pb-24">
              <button onClick={() => setShowCreateModal(true)} className="w-full py-4 bg-white border border-dashed border-indigo-200 text-indigo-500 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition flex items-center justify-center gap-2">
                  <Plus size={18}/> Tambah {viewMode === 'project' ? 'Hajatan' : 'Agenda'}
              </button>
              {loading ? <p className="text-center text-slate-400 mt-10">Memuat...</p> : filteredEvents.length === 0 ? (<div className="text-center py-10 text-slate-400"><p className="text-4xl mb-2">📅</p><p className="text-sm">Belum ada data.</p></div>) : (
                  filteredEvents.map(ev => {
                      const Cat = CATEGORIES[ev.category] || CATEGORIES.general; const Icon = Cat.icon; const done = isEventDone(ev);
                      if (viewMode === 'agenda') {
                          return (
                              <motion.div key={ev.id} layout onClick={() => { setActiveEvent(ev); fetchEventDetails(ev.id); }} className={`bg-white p-4 rounded-2xl shadow-sm border flex items-center gap-4 cursor-pointer transition ${done ? 'border-green-100 opacity-60' : 'border-slate-100'}`}>
                                  <button onClick={(e) => handleToggleDone(e, ev)} className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${done ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-transparent'}`}><CheckCircle2 size={14}/></button>
                                  <div className="flex-1">
                                      <div className="flex justify-between items-start"><h3 className={`font-bold text-slate-800 ${done ? 'line-through text-slate-400' : ''}`}>{ev.name}</h3>{ev.start_time && (<span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg flex items-center gap-1"><Clock size={10}/> {ev.start_time.slice(0,5)}</span>)}</div>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap"><span className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${Cat.color}`}><Icon size={10}/> {Cat.label}</span>{ev.is_recurring ? (<span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium"><Repeat size={10}/> {getDayLabel(ev.repeat_days)}</span>) : (<span className="text-[10px] text-slate-400">• {formatDate(ev.event_date)}</span>)}</div>
                                  </div>
                              </motion.div>
                          );
                      }
                      return (
                          <motion.div key={ev.id} layout onClick={() => { setActiveEvent(ev); fetchEventDetails(ev.id); }} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition">
                              <div className="flex justify-between items-start mb-2"><div className="flex items-center gap-3"><div className={`p-3 rounded-xl ${Cat.color} bg-opacity-20`}><PartyPopper size={24}/></div><div><h3 className="font-bold text-slate-800 text-lg">{ev.name}</h3><p className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={12}/> {formatDate(ev.event_date)}</p></div></div></div>
                              <div className="mt-3"><div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Estimasi Budget</span><span className="font-bold text-slate-800">{formatIDR(ev.budget_limit)}</span></div><div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-rose-500 rounded-full w-1/2 opacity-50"></div></div></div>
                          </motion.div>
                      );
                  })
              )}
          </div>
      );
  };

  // --- RENDER DETAIL: AGENDA ---
  const renderAgendaDetail = () => {
      const Cat = CATEGORIES[activeEvent.category] || CATEGORIES.general; const Icon = Cat.icon; const done = isEventDone(activeEvent);
      return (
          <div className="min-h-screen bg-slate-50 relative pb-20">
              <div className="bg-white p-6 pb-6 border-b border-slate-100 sticky top-0 z-10">
                  <div className="flex justify-between items-center mb-4"><button onClick={() => setActiveEvent(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><ArrowLeft size={20}/></button><button onClick={handleDeleteEvent} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={20}/></button></div>
                  <div className="flex items-start gap-4"><div className={`p-4 rounded-2xl ${Cat.color} bg-opacity-20`}><Icon size={32}/></div><div className="flex-1"><h2 className="text-2xl font-bold text-slate-900 leading-tight mb-1">{activeEvent.name}</h2><p className="text-sm text-slate-500 flex items-center gap-2">{activeEvent.is_recurring ? <><Repeat size={14}/> {getDayLabel(activeEvent.repeat_days)}</> : <><Calendar size={14}/> {formatDate(activeEvent.event_date)}</>}{activeEvent.start_time && <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs font-bold">{activeEvent.start_time.slice(0,5)}</span>}</p></div></div>
                  <div onClick={(e) => handleToggleDone(e, activeEvent)} className={`mt-6 p-4 rounded-xl border-2 flex items-center justify-center gap-3 cursor-pointer transition active:scale-95 ${done ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${done ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}><CheckCircle2 size={16}/></div><span className="font-bold">{done ? 'Selesai Hari Ini' : 'Tandai Selesai'}</span></div>
              </div>
              <div className="px-6 py-6">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800 text-lg">Jurnal & Catatan</h3><button onClick={() => { setTrxForm({ type: 'note', name: '', amount: '', notes: '' }); setShowTrxModal(true); }} className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1"><Plus size={16}/> Tulis</button></div>
                  {eventTrx.length === 0 ? <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><BookOpen size={32} className="mx-auto mb-2 opacity-50"/><p className="text-sm">Belum ada catatan.</p><p className="text-xs mt-1">Tulis evaluasi atau progresmu disini.</p></div> : <div className="space-y-3">{eventTrx.map((t, idx) => (<div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div className="flex justify-between items-start mb-2"><p className="text-slate-800 text-sm leading-relaxed font-medium">{t.type === 'log' ? (t.notes || 'Selesai (Tanpa Catatan)') : t.name}</p>{t.type === 'log' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Done</span>}</div><p className="text-[10px] text-slate-400 text-right">{new Date(t.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>))}</div>}
              </div>
          </div>
      );
  };

  // --- RENDER DETAIL: PROJECT (HAJATAN) ---
  const renderProjectDetail = () => {
      const stats = getEventStats(eventTrx);
      
      let filteredTrx = [];
      if (activeTab === 'overview') {
          filteredTrx = eventTrx.slice(0, 5); 
      } else if (activeTab === 'expense') {
          filteredTrx = eventTrx.filter(t => t.type === 'expense');
      } else if (activeTab === 'income') { // RENAME: 'guests' jadi 'income'
          filteredTrx = eventTrx.filter(t => t.type === 'income');
      }

      // LOGIC PINTAR + FORM LABEL
      const openAddModal = () => {
          let defaultType = 'expense';
          if (activeTab === 'income') defaultType = 'income'; 
          
          setTrxForm({ type: defaultType, name: '', amount: '', notes: '' });
          setShowTrxModal(true);
      };

      return (
          <div className="min-h-screen bg-slate-50 relative pb-20">
              <div className="bg-rose-600 p-6 pb-28 rounded-b-[2.5rem] relative">
                  <div className="flex justify-between items-center text-white mb-6">
                      <button onClick={() => setActiveEvent(null)} className="p-2 bg-white/20 rounded-full"><ArrowLeft size={20}/></button>
                      <h2 className="font-bold text-lg truncate max-w-[200px]">{activeEvent.name}</h2>
                      <button onClick={handleDeleteEvent} className="p-2 bg-white/20 rounded-full text-red-200 hover:bg-red-500 hover:text-white"><Trash2 size={20}/></button>
                  </div>
                  <div className="flex justify-between text-white px-2">
                      <div className="text-center"><p className="text-white/60 text-xs mb-1">Total Budget</p><p className="font-bold text-xl">{formatIDR(activeEvent.budget_limit)}</p></div>
                      <div className="w-px bg-white/20"></div>
                      <div className="text-center"><p className="text-white/60 text-xs mb-1">Sisa Budget</p><p className="font-bold text-xl">{formatIDR(activeEvent.budget_limit - stats.expense)}</p></div>
                  </div>
              </div>
              <div className="px-6 -mt-20 relative z-10 grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100"><div className="flex items-center gap-2 mb-2 text-red-500 text-xs font-bold"><ArrowUpRight size={14}/> Pengeluaran</div><p className="font-extrabold text-slate-800">{formatIDR(stats.expense)}</p></div>
                  <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100"><div className="flex items-center gap-2 mb-2 text-green-500 text-xs font-bold"><Gift size={14}/> Pemasukan</div><p className="font-extrabold text-slate-800">{formatIDR(stats.income)}</p></div>
              </div>
              
              {/* TAB GANTI JUDUL 'Buku Tamu' -> 'Pemasukan' */}
              <div className="px-6 mb-4"><div className="bg-white p-1 rounded-xl flex shadow-sm border border-slate-100">{['overview', 'expense', 'income'].map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${activeTab === tab ? 'bg-rose-50 text-rose-600' : 'text-slate-400'}`}>{tab === 'overview' ? 'Ringkasan' : tab === 'expense' ? 'Biaya' : 'Pemasukan'}</button>))}</div></div>
              
              <div className="px-6 space-y-3 pb-24">
                  <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-slate-700 text-sm">{activeTab === 'income' ? 'Daftar Pemasukan' : activeTab === 'expense' ? 'Rincian Biaya' : 'Riwayat Terakhir'}</h3>
                      <button onClick={openAddModal} className="text-rose-600 text-xs font-bold flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg hover:bg-rose-100 transition"><Plus size={12}/> {activeTab === 'income' ? 'Catat Pemasukan' : 'Catat Biaya'}</button>
                  </div>
                  {filteredTrx.length === 0 ? <div className="text-center py-10 text-slate-400"><p className="text-4xl mb-2">📝</p><p className="text-xs">Belum ada data.</p></div> : filteredTrx.map((t, idx) => (<div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center hover:bg-slate-50 transition"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{t.type === 'income' ? <Gift size={18}/> : <Receipt size={18}/>}</div><div><p className="font-bold text-sm text-slate-800">{t.name}</p><p className="text-[10px] text-slate-400">{t.notes || (t.type === 'income' ? 'Pemasukan' : 'Pengeluaran')}</p></div></div><span className={`font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-slate-800'}`}>{t.type === 'income' ? '+' : '-'} {formatIDR(t.amount)}</span></div>))}
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {!activeEvent ? (
          <>
            <div className="bg-white p-4 sticky top-0 z-10 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-4"><button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-slate-100"><ArrowLeft size={20}/></button><h1 className="font-bold text-lg text-slate-800">Event & Agenda</h1></div>
                <div className="flex p-1 bg-slate-100 rounded-xl"><button onClick={() => setViewMode('agenda')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'agenda' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Agenda Harian</button><button onClick={() => setViewMode('project')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'project' ? 'bg-white shadow text-rose-600' : 'text-slate-400'}`}>Hajatan & Proyek</button></div>
            </div>
            {renderList()}
          </>
      ) : (viewMode === 'agenda' ? renderAgendaDetail() : renderProjectDetail())}

      <AnimatePresence>
        {showCreateModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl h-[85vh] overflow-y-auto">
                    <h3 className="font-bold text-lg mb-4">Buat {viewMode === 'project' ? 'Hajatan Baru' : 'Agenda Baru'}</h3>
                    <div className="space-y-4">
                        <div><label className="text-xs font-bold text-slate-500 mb-1">Nama Kegiatan</label><input type="text" className="w-full p-3 bg-slate-50 rounded-xl border" placeholder={viewMode === 'project' ? "Contoh: Nikahan" : "Contoh: Sholat Duha"} value={eventForm.name} onChange={e=>setEventForm({...eventForm, name: e.target.value})}/></div>
                        {viewMode === 'agenda' && (<div className="flex gap-2 mb-2"><button onClick={() => setEventForm({...eventForm, isRecurring: false})} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${!eventForm.isRecurring ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'}`}><CalendarDays size={14} className="inline mr-1"/> Sekali Jalan</button><button onClick={() => setEventForm({...eventForm, isRecurring: true})} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${eventForm.isRecurring ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-white border-slate-200 text-slate-400'}`}><Repeat size={14} className="inline mr-1"/> Rutin</button></div>)}
                        {(!eventForm.isRecurring || viewMode === 'project') && (<div className="flex gap-3"><div className="flex-1"><label className="text-xs font-bold text-slate-500 mb-1">Tanggal</label><input type="date" className="w-full p-3 bg-slate-50 rounded-xl border" value={eventForm.date} onChange={e=>setEventForm({...eventForm, date: e.target.value})}/></div>{viewMode === 'agenda' && <div className="w-1/3"><label className="text-xs font-bold text-slate-500 mb-1">Jam</label><input type="time" className="w-full p-3 bg-slate-50 rounded-xl border" value={eventForm.time} onChange={e=>setEventForm({...eventForm, time: e.target.value})}/></div>}</div>)}
                        {eventForm.isRecurring && viewMode === 'agenda' && (<div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-slate-500">Pilih Hari Rutinitas</label><div className="w-1/3"><input type="time" className="w-full p-1 bg-white rounded-lg border text-xs" value={eventForm.time} onChange={e=>setEventForm({...eventForm, time: e.target.value})}/></div></div><div className="flex justify-between gap-1">{DAYS.map(day => { const isSelected = eventForm.repeatDays.includes(day.id); return (<button key={day.id} onClick={() => handleToggleDay(day.id)} className={`w-9 h-9 rounded-full text-[10px] font-bold transition flex items-center justify-center ${isSelected ? 'bg-purple-600 text-white shadow-md transform scale-110' : 'bg-white text-slate-400 border border-slate-200'}`}>{day.label}</button>) })}</div></div>)}
                        {viewMode === 'agenda' && (<div><label className="text-xs font-bold text-slate-500 mb-1">Kategori</label><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{['kerja', 'skill', 'spiritual', 'general'].map(cat => { const CatData = CATEGORIES[cat]; return (<button key={cat} onClick={() => setEventForm({...eventForm, category: cat})} className={`px-3 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap ${eventForm.category === cat ? `border-${CatData.color.split('-')[1]}-500 ${CatData.color}` : 'border-slate-200 text-slate-500'}`}>{CatData.label}</button>) })}</div></div>)}
                        {viewMode === 'project' && (<div><label className="text-xs font-bold text-slate-500 mb-1">Budget (Rp)</label><input type="number" className="w-full p-3 bg-slate-50 rounded-xl border" placeholder="0" value={eventForm.budget} onChange={e=>setEventForm({...eventForm, budget: e.target.value})}/></div>)}
                        <button onClick={handleCreateEvent} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold mt-2">Simpan</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTrxModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                    <h3 className="font-bold text-lg mb-4">{viewMode === 'agenda' ? 'Tulis Catatan / Jurnal' : 'Catat Keuangan Event'}</h3>
                    {/* HAPUS TOGGLE EXPENSE/INCOME DI SINI KARENA SUDAH DI-HANDLE 'openAddModal' */}
                    
                    <div className="space-y-4">
                        {viewMode === 'agenda' ? (<div><label className="text-xs font-bold text-slate-500 mb-1">Isi Catatan</label><textarea rows={4} className="w-full p-3 bg-slate-50 rounded-xl border font-medium" placeholder="Tulis evaluasi atau progres hari ini..." value={trxForm.name} onChange={e=>setTrxForm({...trxForm, name: e.target.value, type: 'note'})}/></div>) : (
                            <>
                                <div>
                                    {/* LABEL DINAMIS: SUMBER DANA / NAMA ITEM */}
                                    <label className="text-xs font-bold text-slate-500 mb-1">{trxForm.type === 'expense' ? 'Nama Item / Vendor' : 'Sumber Dana / Keterangan'}</label>
                                    <input type="text" className="w-full p-3 bg-slate-50 rounded-xl border" placeholder={trxForm.type === 'expense' ? "Contoh: Catering Bu Marni" : "Contoh: Kotak Amplop / Sumbangan Keluarga"} value={trxForm.name} onChange={e=>setTrxForm({...trxForm, name: e.target.value})}/>
                                </div>
                                <div><label className="text-xs font-bold text-slate-500 mb-1">Nominal (Rp)</label><input type="number" className="w-full p-3 bg-slate-50 rounded-xl border font-bold" placeholder="0" value={trxForm.amount} onChange={e=>setTrxForm({...trxForm, amount: e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-slate-500 mb-1">Catatan (Opsional)</label><input type="text" className="w-full p-3 bg-slate-50 rounded-xl border" placeholder={trxForm.type === 'expense' ? "Lunas / DP" : "Detail Pemasukan"} value={trxForm.notes} onChange={e=>setTrxForm({...trxForm, notes: e.target.value})}/></div>
                            </>
                        )}
                        <button onClick={handleCreateTrx} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold mt-2">Simpan</button>
                        <button onClick={() => setShowTrxModal(false)} className="w-full py-3 text-slate-500 font-bold">Batal</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}