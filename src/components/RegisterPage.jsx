import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Tambah Link buat navigasi ke Login
import { supabase } from '../supabaseClient';

export default function RegisterPage() {
  const navigate = useNavigate();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState(''); // <--- STATE BARU
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Kirim data ke Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          // Disini kita simpan data tambahan (Nama & No HP)
          data: {
            full_name: fullName,
            phone: phone // <--- DISIMPAN DISINI
          }
        }
      });

      if (error) throw error;

      alert('Registrasi Berhasil! Silakan cek email untuk verifikasi (jika diaktifkan) atau langsung login.');
      navigate('/'); // Lempar ke halaman Login

    } catch (error) {
      alert('Gagal daftar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center p-6">
      
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <span className="text-4xl">🚀</span>
          <h1 className="text-2xl font-bold text-gray-800 mt-4">Buat Akun Baru</h1>
          <p className="text-sm text-gray-500">Mulai atur keuanganmu sekarang</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* INPUT NAMA */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nama Lengkap</label>
            <input 
              type="text" 
              required
              placeholder="Contoh: Juragan Budi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
          </div>

          {/* INPUT NO HP / WA (BARU) */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">No. WhatsApp</label>
            <input 
              type="tel" 
              required
              placeholder="0812xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} // Cuma boleh angka
              className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
          </div>

          {/* INPUT EMAIL */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Email</label>
            <input 
              type="email" 
              required
              placeholder="email@contoh.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
          </div>

          {/* INPUT PASSWORD */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Password</label>
            <input 
              type="password" 
              required
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 transition transform active:scale-95 mt-4"
          >
            {loading ? 'Mendaftarkan...' : 'Daftar Sekarang →'}
          </button>

        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Sudah punya akun?{' '}
            <Link to="/" className="font-bold text-brand-600 hover:underline">
              Login disini
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}