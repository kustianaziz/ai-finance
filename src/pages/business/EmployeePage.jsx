import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthProvider';
import { 
  ArrowLeft, Plus, Users, Shield, Edit2, Trash2, 
  CheckCircle2, X, Save, KeyRound, Loader2, Search, Briefcase, Filter, ChevronDown, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PERMISSIONS_LIST = [
    { code: 'POS_ACCESS', label: 'Akses Kasir (POS)' },
    { code: 'PRODUCT_MANAGE', label: 'Kelola Produk & Resep' },
    { code: 'INVENTORY_MANAGE', label: 'Kelola Stok (Alat & Bahan)' },
    { code: 'INVOICE_MANAGE', label: 'Kelola Invoice' },
    { code: 'DEBT_MANAGE', label: 'Catat Hutang Piutang' },
    { code: 'TAX_MANAGE', label: 'Kelola Pajak' },
    { code: 'STOCK_MANAGE', label: 'Kelola Stok Gudang' },
    { code: 'REPORT_VIEW', label: 'Lihat Laporan Keuangan' },
    { code: 'EMPLOYEE_MANAGE', label: 'Kelola Karyawan Lain' },
    { code: 'SETTINGS_ACCESS', label: 'Akses Pengaturan' },
    { code: 'BUDGET_TARGET_VIEW', label: 'Lihat Target & Budget' },
    { code: 'REPORT_VIEW', label: 'Lihat Laporan Keuangan' },
];

export default function EmployeePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState('staff'); 
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);

  // Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');

  // Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form
  const [roleForm, setRoleForm] = useState({ id: null, name: '', permissions: [] });
  const [staffForm, setStaffForm] = useState({ 
      id: null, full_name: '', role_id: '', pin_code: '', commission_rate: 0, phone: '' 
  });

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
        setLoading(true);
        const { data: rolesData } = await supabase.from('business_roles').select('*').eq('business_id', user.id).order('created_at', { ascending: true });
        const { data: staffData } = await supabase.from('business_employees').select(`*, business_roles ( name )`).eq('business_id', user.id).order('created_at', { ascending: false });

        setRoles(rolesData || []);
        setEmployees(staffData || []);
    } catch (error) {
        console.error("Error fetching data:", error);
    } finally {
        setLoading(false);
    }
  };

  // --- HANDLERS DENGAN DEBUGGING ERROR ---
  const handleRoleSubmit = async () => {
      if (!roleForm.name) return alert("Nama jabatan wajib diisi!");
      setProcessing(true);
      try {
          const payload = { business_id: user.id, name: roleForm.name, permissions: roleForm.permissions };
          
          const { error } = roleForm.id 
            ? await supabase.from('business_roles').update(payload).eq('id', roleForm.id)
            : await supabase.from('business_roles').insert(payload);

          if (error) throw error;
          
          setShowRoleModal(false); fetchData();
      } catch (e) { alert("Gagal: " + (e.message || JSON.stringify(e))); } finally { setProcessing(false); }
  };

  const handleStaffSubmit = async () => {
      // 1. Validasi Dasar
      if (!staffForm.full_name || !staffForm.role_id || !staffForm.pin_code) return alert("Nama, Jabatan, dan PIN wajib diisi!");
      
      setProcessing(true);
      try {
          // 2. Sanitasi Payload (PENTING AGAR TIDAK ERROR 400)
          // Mengubah string kosong "" menjadi NULL, dan memastikan angka benar-benar angka.
          const payload = {
              business_id: user.id,
              full_name: staffForm.full_name,
              role_id: staffForm.role_id, // Pastikan ini UUID valid dari dropdown
              pin_code: staffForm.pin_code,
              phone: staffForm.phone ? staffForm.phone : null, // Kirim NULL jika kosong
              commission_rate: staffForm.commission_rate ? Number(staffForm.commission_rate) : 0,
              is_active: true
          };

          console.log("Mengirim Payload:", payload); // Cek console jika masih error

          const { error } = staffForm.id 
            ? await supabase.from('business_employees').update(payload).eq('id', staffForm.id)
            : await supabase.from('business_employees').insert(payload);

          if (error) {
              console.error("Supabase Error Detail:", error);
              throw error; // Lempar ke catch agar muncul alert
          }

          setShowStaffModal(false); 
          fetchData();
          
      } catch (e) { 
          // Tampilkan pesan error detail dari database
          alert("Gagal simpan: " + (e.details || e.message || "Periksa koneksi atau input data")); 
      } finally { 
          setProcessing(false); 
      }
  };

  const deleteItem = async (table, id) => {
      if (window.confirm("Yakin hapus data ini?")) {
          await supabase.from(table).delete().eq('id', id);
          fetchData();
      }
  };

  const togglePermission = (code) => {
      const current = roleForm.permissions || [];
      setRoleForm({ ...roleForm, permissions: current.includes(code) ? current.filter(p => p !== code) : [...current, code] });
  };

  const getFilteredEmployees = () => {
      return employees.filter(emp => {
          const matchName = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchRole = filterRole === 'ALL' || emp.role_id === filterRole;
          return matchName && matchRole;
      });
  };

  const getInitials = (name) => name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans max-w-md mx-auto relative shadow-2xl shadow-slate-200">
      
      {/* HEADER COMPACT */}
      <div className="bg-blue-600 p-5 pb-16 rounded-b-[2rem] shadow-lg sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm"><ArrowLeft size={18} /></button>
            <div className="flex-1"><h1 className="text-lg font-extrabold text-white">Manajemen Tim</h1><p className="text-[10px] text-blue-100 font-medium">Atur Pasukan Bisnismu</p></div>
        </div>
        
        {/* TABS PILL COMPACT */}
        <div className="bg-white/10 p-1 rounded-xl flex backdrop-blur-sm border border-white/20">
            <button onClick={() => setActiveTab('staff')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'staff' ? 'bg-white text-blue-600 shadow-md' : 'text-blue-100 hover:bg-white/10'}`}>
                <Users size={12}/> KARYAWAN
            </button>
            <button onClick={() => setActiveTab('roles')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'roles' ? 'bg-white text-blue-600 shadow-md' : 'text-blue-100 hover:bg-white/10'}`}>
                <Shield size={12}/> JABATAN
            </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="px-4 -mt-10 relative z-30 space-y-3">
          
          {loading ? (
             <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-400 animate-pulse"><p className="text-xl mb-1">👥</p><span className="text-xs">Memuat Data...</span></div>
          ) : (
             <>
                {activeTab === 'staff' && (
                    <>
                        {/* SEARCH & FILTER COMPACT */}
                        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex gap-2">
                            <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 flex items-center gap-2 border border-transparent focus-within:border-blue-200 transition">
                                <Search size={14} className="text-gray-400"/>
                                <input type="text" placeholder="Cari..." className="bg-transparent text-xs font-medium outline-none w-full text-slate-700 placeholder:text-gray-400" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <div className="relative">
                                <select className="appearance-none bg-gray-50 text-[10px] font-bold text-slate-600 py-1.5 pl-2 pr-6 rounded-lg border border-transparent focus:border-blue-200 outline-none h-full" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                                    <option value="ALL">Semua Role</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                            </div>
                        </div>

                        <div className="space-y-2 pb-20">
                            {getFilteredEmployees().length === 0 ? (
                                <div className="text-center py-8 bg-white rounded-xl border border-gray-100 shadow-sm">
                                    <Users size={32} className="mx-auto mb-1 text-gray-300"/>
                                    <p className="text-xs text-gray-400 font-medium">Data kosong.</p>
                                </div>
                            ) : (
                                getFilteredEmployees().map(emp => (
                                    <motion.div initial={{opacity:0, y:5}} animate={{opacity:1, y:0}} key={emp.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:shadow-md transition">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shadow-sm ring-2 ring-white">
                                                {getInitials(emp.full_name)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-xs leading-tight">{emp.full_name}</h3>
                                                <div className="flex items-center gap-2 text-[9px] text-slate-500 mt-0.5">
                                                    <span className="text-blue-600 font-bold uppercase tracking-wider">{emp.business_roles?.name || 'No Role'}</span>
                                                    <span className="w-0.5 h-0.5 bg-gray-300 rounded-full"></span>
                                                    <span className="flex items-center gap-0.5 bg-slate-100 px-1 rounded text-slate-600"><KeyRound size={8}/> {emp.pin_code}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setStaffForm(emp); setShowStaffModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 size={14}/></button>
                                            <button onClick={() => deleteItem('business_employees', emp.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={14}/></button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'roles' && (
                    <div className="space-y-2 pb-20">
                        {roles.length === 0 ? (
                            <div className="text-center py-8 bg-white rounded-xl border border-gray-100 shadow-sm">
                                <Shield size={32} className="mx-auto mb-1 text-gray-300"/>
                                <p className="text-xs text-gray-400 font-medium">Belum ada jabatan.</p>
                            </div>
                        ) : (
                            roles.map(role => (
                                <motion.div initial={{opacity:0, y:5}} animate={{opacity:1, y:0}} key={role.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 bg-blue-50 rounded text-blue-600"><Briefcase size={12}/></div>
                                            <h3 className="font-bold text-slate-800 text-xs">{role.name}</h3>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setRoleForm(role); setShowRoleModal(true); }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 size={12}/></button>
                                            <button onClick={() => deleteItem('business_roles', role.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {role.permissions && role.permissions.length > 0 ? (
                                            role.permissions.map(p => {
                                                const label = PERMISSIONS_LIST.find(pl => pl.code === p)?.label || p;
                                                return <span key={p} className="text-[8px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-gray-100 truncate max-w-[120px]">{label}</span>
                                            })
                                        ) : <span className="text-[9px] text-gray-300 italic">No Access</span>}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                )}
             </>
          )}
      </div>

      {/* FAB - FIXED BOTTOM */}
      <div className="fixed bottom-6 left-0 right-0 mx-auto max-w-md px-5 z-40 pointer-events-none flex justify-end">
          <button 
            onClick={() => {
                if (activeTab === 'staff') {
                    setStaffForm({ id: null, full_name: '', role_id: '', pin_code: '', commission_rate: 0, phone: '' });
                    setShowStaffModal(true);
                } else {
                    setRoleForm({ id: null, name: '', permissions: [] });
                    setShowRoleModal(true);
                }
            }}
            className="pointer-events-auto w-12 h-12 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-200 flex items-center justify-center hover:bg-blue-700 transition active:scale-90"
          >
              <Plus size={20}/>
          </button>
      </div>

      {/* MODAL ROLE */}
      <AnimatePresence>
        {showRoleModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setShowRoleModal(false)}>
                <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                        <h3 className="font-bold text-gray-800 text-base">{roleForm.id ? 'Edit Jabatan' : 'Jabatan Baru'}</h3>
                        <button onClick={() => setShowRoleModal(false)}><X size={18} className="text-gray-400"/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">NAMA JABATAN</label>
                            <input type="text" placeholder="Contoh: Kasir" className="w-full p-2.5 bg-slate-50 rounded-xl font-bold border border-slate-200 focus:border-blue-500 outline-none text-sm text-slate-700" value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 mb-2 block">IZIN AKSES</label>
                            <div className="space-y-1.5">
                                {PERMISSIONS_LIST.map(perm => {
                                    const isChecked = roleForm.permissions.includes(perm.code);
                                    return (
                                        <div key={perm.code} onClick={() => togglePermission(perm.code)} className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${isChecked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                                            <span className={`text-xs font-medium ${isChecked ? 'text-blue-700' : 'text-slate-600'}`}>{perm.label}</span>
                                            {isChecked ? <CheckCircle2 size={16} className="text-blue-600"/> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300"></div>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100">
                        <button onClick={handleRoleSubmit} disabled={processing} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-100 active:scale-95 transition">
                            {processing ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} SIMPAN
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL STAFF */}
      <AnimatePresence>
        {showStaffModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setShowStaffModal(false)}>
                <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                        <h3 className="font-bold text-gray-800 text-base">{staffForm.id ? 'Edit Karyawan' : 'Karyawan Baru'}</h3>
                        <button onClick={() => setShowStaffModal(false)}><X size={18} className="text-gray-400"/></button>
                    </div>
                    <div className="p-4 space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">NAMA LENGKAP</label>
                            <input type="text" placeholder="Nama Karyawan" className="w-full p-2.5 bg-slate-50 rounded-xl font-bold border border-slate-200 focus:border-blue-500 outline-none text-sm text-slate-700" value={staffForm.full_name} onChange={e => setStaffForm({...staffForm, full_name: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">JABATAN</label>
                            <select className="w-full p-2.5 bg-slate-50 rounded-xl font-bold border border-slate-200 focus:border-blue-500 outline-none text-sm text-slate-700" value={staffForm.role_id} onChange={e => setStaffForm({...staffForm, role_id: e.target.value})}>
                                <option value="">Pilih Jabatan...</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 mb-1 block flex items-center gap-1"><KeyRound size={10}/> PIN (LOGIN)</label>
                                <input type="tel" maxLength={6} placeholder="123456" className="w-full p-2.5 bg-slate-50 rounded-xl font-bold border border-slate-200 focus:border-blue-500 outline-none text-center tracking-widest text-sm text-slate-700" value={staffForm.pin_code} onChange={e => setStaffForm({...staffForm, pin_code: e.target.value.replace(/\D/g,'')})} />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 mb-1 block">KOMISI (%)</label>
                                <input type="number" placeholder="0" className="w-full p-2.5 bg-slate-50 rounded-xl font-bold border border-slate-200 focus:border-blue-500 outline-none text-center text-sm text-slate-700" value={staffForm.commission_rate} onChange={e => setStaffForm({...staffForm, commission_rate: e.target.value})} />
                            </div>
                        </div>
                        <button onClick={handleStaffSubmit} disabled={processing} className="w-full mt-2 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-100 active:scale-95 transition">
                            {processing ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} SIMPAN
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}