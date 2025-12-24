import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await signIn({ email, password });

    if (error) {
      setErrorMsg('Email atau Password salah!');
      setLoading(false);
    } else {
      // Login sukses, AuthProvider akan otomatis mendeteksi perubahan sesi
      // dan App.jsx akan mengarahkan ke Dashboard
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white p-6 justify-center">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-brand-500 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-6 shadow-xl shadow-brand-200">
          🤖
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">AI Finance</h1>
        <p className="text-gray-500 mt-2">Masuk ke Akun Real</p>
      </div>

      {errorMsg && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm font-bold text-center">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Email</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 bg-gray-50 px-5 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" 
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Password</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 bg-gray-50 px-5 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" 
            required
          />
        </div>
        <button disabled={loading} type="submit" className="w-full bg-brand-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-brand-600 transition transform active:scale-[0.98] disabled:bg-gray-400">
          {loading ? 'Memuat...' : 'Masuk Sekarang'}
        </button>
      </form>

      <p className="text-center mt-8 text-sm text-gray-500">
        Belum punya akun? 
        <span onClick={() => navigate('/register')} className="text-brand-600 font-bold cursor-pointer ml-1 hover:underline">
          Daftar Gratis
        </span>
      </p>
    </div>
  );
}