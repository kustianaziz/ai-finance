import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // STATE BARU: KARYAWAN AKTIF
  // Ini yang bikin Dashboard Karyawan bisa dibuka!
  const [activeEmployee, setActiveEmployee] = useState(() => {
      try {
          const saved = localStorage.getItem('active_employee_session');
          return saved ? JSON.parse(saved) : null;
      } catch (e) {
          return null;
      }
  });

  useEffect(() => {
    // 1. Cek Session Supabase (Owner)
    const initAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- FUNGSI LOGIN KARYAWAN (PIN) ---
  const employeeLogin = async (employeeId, pinInput) => {
      try {
          if (!user) throw new Error("Owner session not found"); // Safety check

          // Cari data karyawan berdasarkan ID & Owner yang sedang login
          const { data, error } = await supabase
              .from('business_employees')
              .select('*, business_roles(permissions, name)')
              .eq('id', employeeId)
              .eq('business_id', user.id) 
              .single();

          if (error || !data) throw new Error("Karyawan tidak ditemukan.");

          // Validasi PIN
          if (data.pin_code !== pinInput) {
              throw new Error("PIN Salah!");
          }

          if (!data.is_active) {
              throw new Error("Akun karyawan ini sudah tidak aktif.");
          }

          // Simpan sesi karyawan
          const empSession = {
              id: data.id,
              name: data.full_name,
              role: data.business_roles?.name,
              permissions: data.business_roles?.permissions || [],
              storeId: user.id // Tambahan info store
          };

          setActiveEmployee(empSession);
          localStorage.setItem('active_employee_session', JSON.stringify(empSession));
          return { success: true };

      } catch (err) {
          return { success: false, message: err.message };
      }
  };

  // --- FUNGSI LOGOUT KARYAWAN ---
  const employeeLogout = () => {
      setActiveEmployee(null);
      localStorage.removeItem('active_employee_session');
      localStorage.removeItem('pos_session'); // Bersihkan sisa session lama jika ada
  };

  // --- HELPER CEK PERMISSION ---
  const canAccess = (permissionCode) => {
      // Jika Owner (tidak ada karyawan aktif) -> BOLEH SEMUA
      if (!activeEmployee) return true;
      // Jika Karyawan -> Cek list permission dia
      return activeEmployee?.permissions?.includes(permissionCode);
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        session, 
        loading, // Penting diexpose untuk routing
        activeEmployee, 
        employeeLogin, 
        employeeLogout,
        canAccess, 
        signOut: () => supabase.auth.signOut() 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// EXPORT DEFAULT AGAR IMPORT DI APP.JSX JALAN
export default AuthProvider;

export const useAuth = () => {
  return useContext(AuthContext);
};