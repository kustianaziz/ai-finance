import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthProvider';
import ModalInfo from '../../components/ModalInfo';
import { ensureUserHasCOA } from '../../utils/accountingService'; 

import { 
  ArrowLeft, Plus, Search, Folder, FileText, 
  Edit3, Trash2, ChevronRight, ChevronDown, Loader2, X, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CoaPage() {
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth();
  const ownerId = user?.id || activeEmployee?.storeId;

  // --- STATE ---
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ASSET'); 
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [processing, setProcessing] = useState(false); // State untuk loading button

  // Form Data
  const [formData, setFormData] = useState({
    id: null, code: '', name: '', type: 'ASSET', parent_id: null, is_header: false, normal_balance: 'debit'
  });

  // Notif & Confirm Modal
  const [notif, setNotif] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const showAlert = (type, title, message) => setNotif({ isOpen: true, type, title, message });
  const showConfirm = (title, message, onConfirm) => setConfirmModal({ isOpen: true, title, message, onConfirm });

  // --- MAPPING TYPE ---
  const ACCOUNT_TYPES = {
    ASSET: { label: 'Harta', balance: 'debit', color: 'bg-blue-600', light: 'bg-blue-50', text: 'text-blue-600' },
    LIABILITY: { label: 'Kewajiban', balance: 'credit', color: 'bg-red-600', light: 'bg-red-50', text: 'text-red-600' },
    EQUITY: { label: 'Modal', balance: 'credit', color: 'bg-purple-600', light: 'bg-purple-50', text: 'text-purple-600' },
    REVENUE: { label: 'Pendapatan', balance: 'credit', color: 'bg-green-600', light: 'bg-green-50', text: 'text-green-600' },
    EXPENSE: { label: 'Beban', balance: 'debit', color: 'bg-orange-600', light: 'bg-orange-50', text: 'text-orange-600' }
  };

  // --- INIT ---
  useEffect(() => {
    if (ownerId) fetchAccounts();
  }, [ownerId]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase
            .from('chart_of_accounts')
            .select('*')
            .eq('user_id', ownerId)
            .order('code', { ascending: true });
        
        if (error) throw error;
        setAccounts(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- GENERATE DEFAULT (FIXED LOADING) ---
  const handleGenerateDefault = () => {
      showConfirm(
          "Buat Akun Standar?", 
          "Sistem akan membuatkan akun standar (Kas, Bank, Modal, dll) secara otomatis. Proses ini mungkin memakan waktu beberapa detik.",
          async () => {
              // 1. Kunci Button Utama
              setProcessing(true);
              
              // 2. Tampilkan Modal Loading (Blocking UI)
              setNotif({ 
                  isOpen: true, 
                  type: 'loading', 
                  title: 'Sedang Memproses...', 
                  message: 'Mohon tunggu, sistem sedang menyusun struktur akun dan mengintegrasikan data.' 
              });

              try {
                  await ensureUserHasCOA(ownerId);
                  
                  // 3. Refresh Data
                  await fetchAccounts();
                  
                  // 4. Tampilkan Sukses
                  showAlert('success', 'Selesai', 'Akun standar berhasil dibuat.');
              } catch (e) {
                  showAlert('error', 'Gagal', e.message);
              } finally {
                  setProcessing(false);
              }
          }
      );
  };

  // --- TREE LOGIC ---
  const buildTree = (flatList, parentId = null, level = 0) => {
      return flatList
          .filter(item => item.parent_id === parentId && item.type === activeTab)
          .map(item => ({
              ...item,
              level,
              children: buildTree(flatList, item.id, level + 1)
          }));
  };

  const treeData = useMemo(() => {
      // 1. Jika User Sedang Mencari (Search Mode: List Datar)
      if (searchQuery) {
          const lowerQ = searchQuery.toLowerCase();
          return accounts
              .filter(item => 
                  // Filter sesuai Tab yang aktif (Harta/Kewajiban/dll)
                  item.type === activeTab && 
                  // Filter sesuai Keyword (Kode atau Nama)
                  (item.code.toLowerCase().includes(lowerQ) || item.name.toLowerCase().includes(lowerQ))
              )
              .map(item => ({
                  ...item,
                  children: [], // Kosongkan anak agar tidak muncul panah expand
                  level: 0      // Reset indentasi agar rata kiri
              }));
      }

      // 2. Jika Tidak Mencari (Normal Mode: Tree Hierarchy)
      return buildTree(accounts);
  }, [accounts, activeTab, searchQuery]);

  // --- ACTIONS ---
  const openCreateForm = (parentId = null) => {
      setFormData({
          id: null, code: '', name: '', type: activeTab, parent_id: parentId, 
          is_header: false, normal_balance: ACCOUNT_TYPES[activeTab].balance
      });
      setIsEditMode(false); setShowForm(true);
  };

  const openEditForm = (acc) => {
      setFormData({
          id: acc.id, code: acc.code, name: acc.name, type: acc.type, parent_id: acc.parent_id,
          is_header: acc.is_header, normal_balance: acc.normal_balance
      });
      setIsEditMode(true); setShowForm(true);
  };

  const handleSave = async () => {
      if (!formData.code || !formData.name) return showAlert('error', 'Gagal', 'Kode dan Nama wajib diisi.');
      setProcessing(true);
      try {
          const payload = {
              user_id: ownerId, code: formData.code, name: formData.name, type: formData.type,
              parent_id: formData.parent_id || null, is_header: formData.is_header, normal_balance: formData.normal_balance
          };
          if (isEditMode) { await supabase.from('chart_of_accounts').update(payload).eq('id', formData.id); } 
          else { await supabase.from('chart_of_accounts').insert(payload); }
          showAlert('success', 'Berhasil', 'Data Akun tersimpan.'); setShowForm(false); fetchAccounts();
      } catch (e) { showAlert('error', 'Gagal', e.message); } finally { setProcessing(false); }
  };

  const handleDelete = (id) => {
      const hasChildren = accounts.some(a => a.parent_id === id);
      if (hasChildren) return showAlert('error', 'Gagal', 'Hapus sub-akun di bawahnya terlebih dahulu.');
      
      showConfirm(
          "Hapus Akun?",
          "Pastikan akun ini belum pernah digunakan dalam transaksi jurnal apapun. Data yang dihapus tidak bisa dikembalikan.",
          async () => {
              try {
                  const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id);
                  if (error) throw error;
                  fetchAccounts(); showAlert('success', 'Terhapus', 'Akun dihapus.');
              } catch (e) { showAlert('error', 'Gagal', 'Akun mungkin sudah dipakai.'); }
          }
      );
  };

  // --- RECURSIVE ROW COMPONENT ---
  const AccountRow = ({ item }) => {
      const [isExpanded, setIsExpanded] = useState(true);
      const paddingLeft = item.level * 24 + 16; 
      
      return (
          <>
              <div className={`flex items-center border-b border-slate-50 hover:bg-slate-50/80 transition p-3 ${item.is_header ? 'bg-slate-50 font-bold' : 'bg-white'}`}>
                  <div className="flex-1 flex items-center" style={{ paddingLeft: `${paddingLeft}px` }}>
                      {item.children.length > 0 ? (
                          <button onClick={() => setIsExpanded(!isExpanded)} className="mr-2 text-slate-400 hover:text-blue-600 transition">
                              {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                          </button>
                      ) : <div className="w-6"></div>}
                      
                      <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${item.is_header ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                              {item.is_header ? <Folder size={14}/> : <FileText size={14}/>}
                          </div>
                          <div>
                              <p className={`text-sm ${item.is_header ? 'text-slate-800' : 'text-slate-600'}`}>
                                  <span className="font-mono text-xs text-slate-400 mr-2 bg-slate-100 px-1.5 py-0.5 rounded">{item.code}</span>
                                  {item.name}
                              </p>
                          </div>
                      </div>
                  </div>

                  <div className="w-24 text-[10px] font-bold text-slate-400 uppercase text-center hidden sm:block bg-slate-50 py-1 rounded">
                      {item.normal_balance}
                  </div>

                  <div className="w-28 flex justify-end gap-1 pl-2">
                      {item.is_header && (
                          <button onClick={() => openCreateForm(item.id)} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition shadow-sm"><Plus size={14}/></button>
                      )}
                      <button onClick={() => openEditForm(item)} className="p-1.5 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition shadow-sm"><Edit3 size={14}/></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition shadow-sm"><Trash2 size={14}/></button>
                  </div>
              </div>
              
              <AnimatePresence>
                  {isExpanded && item.children.length > 0 && (
                      <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}>
                          {item.children.map(child => <AccountRow key={child.id} item={child} />)}
                      </motion.div>
                  )}
              </AnimatePresence>
          </>
      );
  };

  const currentTheme = ACCOUNT_TYPES[activeTab];

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
      
      {/* HEADER FIXED */}
      <div className="shrink-0 bg-slate-50 z-50 shadow-md">
          {/* Top Bar Dynamic Color */}
          <div className={`${currentTheme.color} px-6 pt-6 pb-6 rounded-b-[2rem] relative z-10 transition-colors duration-300`}>
              <div className="flex items-center gap-3 mb-4">
                  <button 
                        // Logic: Jika user (Owner) ada -> ke Dashboard Utama. Jika tidak -> ke Dashboard Karyawan.
                        onClick={() => navigate(user ? '/dashboard' : '/employee-dashboard')} 
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm"
                    >
                        <ArrowLeft size={20}/>
                    </button>
                  <div className="flex-1"><h1 className="text-xl font-extrabold text-white">Master Akun</h1><p className="text-xs text-white/80 font-medium">Chart of Accounts</p></div>
                  
                  {accounts.length === 0 && (
                      <button onClick={handleGenerateDefault} disabled={processing} className="p-2 bg-yellow-400 text-yellow-900 rounded-xl shadow-md hover:bg-yellow-300 transition active:scale-95 flex items-center gap-2 text-xs font-bold px-3 disabled:opacity-70 disabled:cursor-not-allowed">
                          {processing ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>} 
                          {processing ? 'Loading...' : 'Default'}
                      </button>
                  )}

                  <button onClick={() => openCreateForm(null)} className="p-2 bg-white text-blue-700 rounded-xl shadow-md hover:bg-slate-100 transition active:scale-95"><Plus size={20}/></button>
              </div>
              
              {/* Search Bar */}
              <div className="bg-white/10 p-2 rounded-xl border border-white/20 flex items-center px-3 backdrop-blur-sm">
                  <Search size={18} className="text-white"/>
                  <input type="text" placeholder="Cari kode atau nama akun..." className="w-full bg-transparent p-1 text-sm text-white placeholder:text-white/70 outline-none font-medium" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {searchQuery && <button onClick={()=>setSearchQuery('')}><X size={16} className="text-white/70"/></button>}
              </div>
          </div>

          {/* TABS & INFO (White BG) */}
          <div className="bg-white pb-3 pt-3 px-4 border-b border-slate-100">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2">
                  {Object.keys(ACCOUNT_TYPES).map(type => (
                      <button key={type} onClick={() => setActiveTab(type)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeTab === type ? `${ACCOUNT_TYPES[type].color} text-white shadow-md` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          {ACCOUNT_TYPES[type].label}
                      </button>
                  ))}
              </div>
              <div className={`p-3 rounded-xl border border-slate-100 ${currentTheme.light} flex items-center justify-between`}>
                  <p className={`text-xs font-bold ${currentTheme.text}`}>Total {treeData.length} Grup Akun</p>
                  <p className="text-[10px] text-slate-400">Normal Balance: <span className="font-bold uppercase">{currentTheme.balance}</span></p>
              </div>
          </div>
      </div>

      {/* LIST TREE */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50 pb-20">
          {loading ? <div className="text-center py-10 text-slate-400 text-xs">Memuat data...</div> : 
           treeData.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                  <Folder size={48} className="mx-auto mb-2 opacity-30"/>
                  <p className="text-sm font-medium">Belum ada akun di kategori ini.</p>
                  
                  {/* TOMBOL GENERATE DI TENGAH JUGA ADA */}
                  <button 
                    onClick={handleGenerateDefault} 
                    disabled={processing}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 mx-auto"
                  >
                    {processing ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                    Generate Akun Standar
                  </button>
              </div>
           ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  {treeData.map(node => <AccountRow key={node.id} item={node} />)}
              </div>
           )}
      </div>

      {/* MODAL FORM */}
      <AnimatePresence>
          {showForm && (
              <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                  <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
                      <div className="p-5 border-b bg-white flex justify-between items-center">
                          <h3 className="font-extrabold text-lg text-slate-800">{isEditMode ? 'Edit Akun' : 'Buat Akun Baru'}</h3>
                          <button onClick={() => setShowForm(false)} className="p-1 rounded-full bg-slate-100 hover:text-red-500 transition"><X size={20}/></button>
                      </div>
                      <div className="p-6 space-y-4 bg-slate-50/50">
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                              <div><label className="text-xs font-bold text-slate-500 block mb-1">Kode Akun</label><input type="text" className="w-full p-3 bg-slate-50 border rounded-xl font-mono font-bold text-slate-700 focus:border-blue-500 outline-none" placeholder="Contoh: 1101" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} autoFocus/></div>
                              <div><label className="text-xs font-bold text-slate-500 block mb-1">Nama Akun</label><input type="text" className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-slate-700 focus:border-blue-500 outline-none" placeholder="Contoh: Kas Kecil" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/></div>
                              <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100"><input type="checkbox" id="isHeader" className="w-5 h-5 accent-blue-600" checked={formData.is_header} onChange={e => setFormData({...formData, is_header: e.target.checked})}/><label htmlFor="isHeader" className="text-xs font-bold text-slate-700 cursor-pointer flex-1">Ini Akun Induk (Folder)<span className="block text-[10px] text-slate-500 font-normal">Hanya untuk grouping, tidak bisa diisi saldo.</span></label></div>
                              <div><label className="text-xs font-bold text-slate-500 block mb-1">Induk (Parent)</label><select className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-medium outline-none" value={formData.parent_id || ''} onChange={e => setFormData({...formData, parent_id: e.target.value || null})}><option value="">-- Tidak Ada (Top Level) --</option>{accounts.filter(a => a.is_header && a.type === formData.type && a.id !== formData.id).map(a => (<option key={a.id} value={a.id}>{a.code} - {a.name}</option>))}</select></div>
                          </div>
                          <button onClick={handleSave} disabled={processing} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-lg">{processing ? <Loader2 className="animate-spin"/> : 'Simpan Akun'}</button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* CUSTOM CONFIRM MODAL */}
      <ModalInfo 
          isOpen={confirmModal.isOpen} 
          type="info" 
          title={confirmModal.title} 
          message={confirmModal.message} 
          onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
          onConfirm={confirmModal.onConfirm}
          confirmText="Ya, Lanjutkan"
      />

      {/* ALERT MODAL (Termasuk Loading Screen) */}
      <ModalInfo isOpen={notif.isOpen} type={notif.type} title={notif.title} message={notif.message} onClose={() => setNotif(prev => ({...prev, isOpen: false}))} />
    </div>
  );
}