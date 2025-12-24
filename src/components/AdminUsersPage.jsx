import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      alert("Gagal ambil data user: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
           👥 Data Member
        </h1>
        <button onClick={() => navigate('/dashboard')} className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200 transition">
          ← Kembali
        </button>
      </div>

      <div className="p-4">
        {/* CONTAINER TABEL (SCROLLABLE) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          
          <div className="overflow-x-auto"> {/* <-- KUNCI SUPAYA BISA DIGESER SAMPING */}
            <table className="w-full text-left text-xs whitespace-nowrap"> {/* <-- whitespace-nowrap biar teks sejajar */}
              <thead className="bg-gray-100 text-gray-600 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">HP / WA</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-right">Tgl Gabung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="4" className="p-6 text-center text-gray-400">Loading data...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="4" className="p-6 text-center text-gray-400">Belum ada user.</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-bold text-gray-800">
                        {u.full_name || <span className="text-gray-300 italic">Tanpa Nama</span>}
                      </td>
                      <td className="px-4 py-3">
                        {u.phone ? (
                          <a 
                            href={`https://wa.me/${u.phone.replace(/^0/, '62').replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 hover:bg-green-100"
                          >
                            <span className="text-[10px]">📞</span> {u.phone}
                          </a>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3 text-gray-400 text-right">
                        {u.created_at 
                          ? new Date(u.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: '2-digit'})
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
        
        <p className="text-center text-xs text-gray-400 mt-4">
          Total: {users.length} Member • Geser tabel ke kanan untuk detail
        </p>
      </div>
    </div>
  );
}