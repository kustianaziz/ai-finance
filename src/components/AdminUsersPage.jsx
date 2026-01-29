import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
    Users, Search, Calendar, Smartphone, Mail, 
    Building2, Bot, ArrowLeft, Edit3, Check, X, Loader2 
} from 'lucide-react';

// --- MODAL EDIT (TETAP SAMA SEPERTI SEBELUMNYA) ---
const EditAccountModal = ({ user, onClose, onUpdate }) => {
    const [selectedType, setSelectedType] = useState(user.account_type);
    const [updating, setUpdating] = useState(false);

    const handleSave = async () => {
        setUpdating(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ account_type: selectedType })
                .eq('id', user.id)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                throw new Error("Gagal update. Cek RLS Policy di Supabase.");
            }

            alert(`Berhasil! Akun ${user.full_name} kini menjadi ${selectedType.toUpperCase()}`);
            onUpdate(); 
            onClose(); 

        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            setUpdating(false);
        }
    };

    const OptionItem = ({ type, label, icon: Icon }) => (
        <div 
            onClick={() => setSelectedType(type)}
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all active:scale-95 ${
                selectedType === type 
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 shadow-sm' 
                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
            }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    selectedType === type ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                }`}>
                    {selectedType === type && <Check size={12} className="text-white" strokeWidth={4} />}
                </div>
                
                <span className={`capitalize font-bold text-sm ${selectedType === type ? 'text-blue-700' : 'text-slate-700'}`}>
                    {label}
                </span>
            </div>
            {Icon && <Icon size={18} className={selectedType === type ? 'text-blue-500' : 'text-slate-400'} />}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-extrabold text-slate-800">Ubah Status Akun</h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-800 truncate">{user.full_name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                </div>
                
                <div className="space-y-3 mb-6">
                    <OptionItem type="personal" label="Personal (Gratis)" icon={Users} />
                    <OptionItem type="personal_pro" label="Personal Pro" icon={Users} />
                    <OptionItem type="business" label="Business" icon={Building2} />
                    <OptionItem type="organization" label="Organization" icon={Building2} />
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} disabled={updating} className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold text-sm">Batal</button>
                    <button onClick={handleSave} disabled={updating} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70">
                        {updating ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>}
                        {updating ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsersAndStats();
  }, []);

  const fetchUsersAndStats = async () => {
    try {
      setLoading(true);

      // 1. Ambil Data Profil
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // 2. Fetch Data Pendukung (Parallel)
      // - ai_logs: Untuk hitung total TOKEN (Bukan cuma count)
      // - transaction_headers: Untuk hitung Last Active User
      const [logsRes, trxRes] = await Promise.all([
          supabase.from('ai_logs').select('user_id, total_tokens'), // Ambil kolom total_tokens
          supabase.from('transaction_headers').select('user_id, date')
      ]);

      if (logsRes.error) throw logsRes.error;
      if (trxRes.error) throw trxRes.error;

      const aiLogs = logsRes.data || [];
      const transactions = trxRes.data || [];

      // 3. Olah Data (Gabungkan)
      const enrichedUsers = profiles.map(profile => {
          // A. Hitung Last Active
          const userTrx = transactions.filter(t => t.user_id === profile.id);
          let lastActive = '-';
          if (userTrx.length > 0) {
              const sortedDates = userTrx.map(t => new Date(t.date)).sort((a,b) => b - a);
              lastActive = sortedDates[0].toISOString();
          }

          // B. Hitung Total Token AI (Data REAL)
          const userLogs = aiLogs.filter(log => log.user_id === profile.id);
          const totalTokens = userLogs.reduce((sum, log) => sum + (log.total_tokens || 0), 0);
          const totalRequests = userLogs.length;
          
          // C. Hitung Durasi Gabung
          const joinDate = new Date(profile.created_at);
          const today = new Date();
          const diffTime = Math.abs(today - joinDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

          return {
              ...profile,
              last_active: lastActive,
              ai_usage: totalTokens, // Total Token
              ai_requests: totalRequests, // Jumlah Request
              trx_count: userTrx.length,
              days_joined: diffDays
          };
      });

      setUsers(enrichedUsers);
    } catch (error) {
      alert("Gagal ambil data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
      const matchSearch = (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (u.phone || '').includes(searchTerm);
      
      let matchDate = true;
      if (startDate && endDate) {
          const joinDate = u.created_at.split('T')[0];
          matchDate = joinDate >= startDate && joinDate <= endDate;
      }

      return matchSearch && matchDate;
  });

  const stats = {
      total: filteredUsers.length,
      personal: filteredUsers.filter(u => u.account_type === 'personal').length,
      pro: filteredUsers.filter(u => u.account_type === 'personal_pro').length,
      business: filteredUsers.filter(u => u.account_type === 'business').length,
      org: filteredUsers.filter(u => u.account_type === 'organization').length,
  };

  const getTypeBadge = (type) => {
      switch(type) {
          case 'business': return <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">BISNIS</span>;
          case 'organization': return <span className="px-2 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200">ORGANISASI</span>;
          case 'personal_pro': return <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">PRO</span>;
          default: return <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-bold border border-gray-200">PRIBADI</span>;
      }
  };

  // Helper Format Angka Ribuan (K)
  const formatCompact = (num) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      {editingUser && (
          <EditAccountModal 
              user={editingUser} 
              onClose={() => setEditingUser(null)} 
              onUpdate={fetchUsersAndStats} 
          />
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition"><ArrowLeft size={20}/></button>
                <div>
                    <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2"><Users className="text-blue-600"/> Data Member Vizofin</h1>
                    <p className="text-xs text-slate-500">Monitoring & Manajemen User</p>
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                    <span className="px-2 text-slate-400"><Calendar size={14}/></span>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-xs font-medium outline-none text-slate-600 w-28"/>
                    <span className="text-slate-300 mx-1">-</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-xs font-medium outline-none text-slate-600 w-28"/>
                    {(startDate || endDate) && <button onClick={() => {setStartDate(''); setEndDate('')}} className="p-1 hover:bg-slate-200 rounded-full ml-1"><X size={12} className="text-slate-500"/></button>}
                </div>

                <div className="bg-slate-100 rounded-lg flex items-center px-3 py-2 w-full md:w-64 border border-slate-200 focus-within:ring-2 ring-blue-100 transition">
                    <Search size={16} className="text-slate-400 mr-2"/>
                    <input type="text" placeholder="Cari user..." className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                </div>
            </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Total Member</p>
                <p className="text-2xl font-extrabold text-slate-800">{stats.total}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-l-4 border-l-gray-400 border-slate-200 shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Pribadi</p>
                <p className="text-xl font-bold text-gray-700">{stats.personal}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-l-4 border-l-amber-400 border-slate-200 shadow-sm">
                <p className="text-xs text-amber-600 uppercase font-bold mb-1">Personal Pro</p>
                <p className="text-xl font-bold text-amber-700">{stats.pro}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-l-4 border-l-blue-500 border-slate-200 shadow-sm">
                <p className="text-xs text-blue-600 uppercase font-bold mb-1">Bisnis</p>
                <p className="text-xl font-bold text-blue-700">{stats.business}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-l-4 border-l-purple-500 border-slate-200 shadow-sm">
                <p className="text-xs text-purple-600 uppercase font-bold mb-1">Organisasi</p>
                <p className="text-xl font-bold text-purple-700">{stats.org}</p>
            </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">User Info</th>
                            <th className="px-6 py-4">Status Akun</th>
                            <th className="px-6 py-4">Entitas</th>
                            <th className="px-6 py-4">Aktivitas</th>
                            <th className="px-6 py-4 text-center">AI Usage (Tokens)</th>
                            <th className="px-6 py-4 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {loading ? (
                            <tr><td colSpan="6" className="p-10 text-center text-slate-400 animate-pulse">Sedang memuat data member...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="6" className="p-10 text-center text-slate-400">Tidak ada user ditemukan.</td></tr>
                        ) : (
                            filteredUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-blue-50/30 transition group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-base">{u.full_name || 'Tanpa Nama'}</span>
                                            <div className="flex items-center gap-4 mt-1 text-slate-500 text-xs">
                                                <span className="flex items-center gap-1"><Mail size={12}/> {u.email}</span>
                                                {u.phone && (
                                                    <a href={`https://wa.me/${u.phone.replace(/^0/, '62').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-green-600 hover:underline cursor-pointer transition">
                                                        <Smartphone size={12}/> {u.phone}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-start gap-1">
                                            {getTypeBadge(u.account_type)}
                                            <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">{u.days_joined} Hari Bergabung</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {['business', 'organization'].includes(u.account_type) ? (
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <Building2 size={16} className="text-slate-400"/>
                                                {u.business_name || u.organization_name || <span className="text-slate-400 italic">Belum diset</span>}
                                            </div>
                                        ) : <span className="text-slate-300 text-xs">-</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 text-xs">
                                            <div className="flex justify-between w-40"><span className="text-slate-400">Gabung:</span><span className="font-medium text-slate-700">{new Date(u.created_at).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'2-digit'})}</span></div>
                                            <div className="flex justify-between w-40"><span className="text-slate-400">Aktif:</span><span className={`font-medium ${u.last_active !== '-' ? 'text-green-600' : 'text-slate-300'}`}>{u.last_active !== '-' ? new Date(u.last_active).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'2-digit'}) : 'Belum Transaksi'}</span></div>
                                        </div>
                                    </td>
                                    
                                    {/* KOLOM AI USAGE YANG SUDAH DI-UPDATE */}
                                    <td className="px-6 py-4 text-center">
                                        <div className="inline-flex flex-col items-center bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg min-w-[80px]">
                                            <div className="flex items-center gap-1 text-indigo-600 font-bold text-lg">
                                                <Bot size={16}/> {formatCompact(u.ai_usage)}
                                            </div>
                                            <span className="text-[10px] text-indigo-400 font-medium uppercase tracking-wide">
                                                {u.ai_requests} Requests
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => setEditingUser(u)} className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition" title="Ubah Tipe Akun">
                                            <Edit3 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}