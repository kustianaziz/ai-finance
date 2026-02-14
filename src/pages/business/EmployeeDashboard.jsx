import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';
import { 
  LogOut, ScanLine, Package, ClipboardList, 
  Settings, ShoppingBag, Loader2,
  Receipt, Calculator, Landmark, PiggyBank, Archive,
  BookOpenCheck, Users, HandCoins, ScrollText, Target
} from 'lucide-react';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { activeEmployee, employeeLogout, canAccess } = useAuth();
  const [checking, setChecking] = useState(true);

  // 1. Proteksi Halaman
  useEffect(() => {
    const timer = setTimeout(() => {
        if (!activeEmployee) {
            const lastSlug = localStorage.getItem('last_store_slug');
            if (lastSlug) {
                window.location.href = `/portal/${lastSlug}`;
            } else {
                navigate('/login');
            }
        } else {
            setChecking(false);
        }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeEmployee, navigate]);

  if (checking) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;
  if (!activeEmployee) return null;

  // 2. DEFINISI MENU LENGKAP (SINKRON DENGAN OWNER DASHBOARD)
  const ALL_MENUS = [
      // --- OPERASIONAL UTAMA ---
      { 
          label: 'Kasir (POS)', 
          icon: ScanLine, 
          path: '/pos-mode', 
          permission: 'POS_ACCESS', 
          color: 'bg-blue-50 text-blue-600' 
      },
      { 
          label: 'Produk & Resep', 
          icon: ShoppingBag, 
          path: '/products', 
          permission: 'PRODUCT_MANAGE', 
          color: 'bg-orange-50 text-orange-600' 
      },
      { 
          label: 'Bahan & Alat', // Inventory
          icon: Archive, 
          path: '/inventory', 
          permission: 'INVENTORY_MANAGE', 
          color: 'bg-teal-50 text-teal-600' 
      },
      { 
          label: 'Gudang', // Warehouse (Lokasi Stok)
          icon: Package, 
          path: '/warehouse', 
          permission: 'STOCK_MANAGE', 
          color: 'bg-amber-50 text-amber-600' // Disamakan dengan Owner (Amber)
      },

      // --- KEUANGAN & ADMIN ---
      { 
          label: 'Invoice', 
          icon: Receipt, 
          path: '/invoice', 
          permission: 'INVOICE_MANAGE', 
          color: 'bg-red-50 text-red-600' 
      },
      { 
          label: 'Hutang', 
          icon: Calculator, 
          path: '/debts', // FIXED: Plural (Sesuai App.jsx)
          permission: 'DEBT_MANAGE', 
          color: 'bg-cyan-50 text-cyan-600' 
      },
      { 
          label: 'Pajak', 
          icon: Landmark, 
          path: '/tax', 
          permission: 'TAX_MANAGE', 
          color: 'bg-violet-50 text-violet-600' 
      },
      { 
          label: 'Jurnal', // NEW: Tambahan biar sama kayak Owner
          icon: BookOpenCheck, 
          path: '/journal-process', 
          permission: 'JOURNAL_MANAGE', // Pastikan permission ini ada di Role Owner
          color: 'bg-indigo-50 text-indigo-600' 
      },

      // --- ORGANISASI (JIKA PERLU) ---
      { 
          label: 'Anggota', 
          icon: Users, 
          path: '/members', 
          permission: 'MEMBER_MANAGE', 
          color: 'bg-cyan-50 text-cyan-600' 
      },
      { 
          label: 'Iuran', 
          icon: HandCoins, 
          path: '/dues', 
          permission: 'FINANCE_MANAGE', 
          color: 'bg-pink-50 text-pink-600' 
      },
      { 
          label: 'Proposal', 
          icon: ScrollText, 
          path: '/proposals', 
          permission: 'Proposal_View', // Sesuaikan kode permission
          color: 'bg-yellow-50 text-yellow-600' 
      },

      // --- MANAJEMEN & LAPORAN ---
      { 
          label: 'Target & Budget', 
          icon: PiggyBank, 
          path: '/targets', 
          permission: 'BUDGET_TARGET_VIEW', 
          color: 'bg-lime-50 text-lime-600' 
      },
      { 
          label: 'Laporan', 
          icon: ClipboardList, 
          path: '/analytics', 
          permission: 'REPORT_VIEW', 
          color: 'bg-rose-50 text-rose-600' // Disamakan dengan Owner (Rose)
      },
      { 
          label: 'Pengaturan', 
          icon: Settings, 
          path: '/settings', 
          permission: 'SETTINGS_ACCESS', 
          color: 'bg-slate-50 text-slate-600' 
      }
  ];

  // Filter Menu Berdasarkan Permission Karyawan
  const allowedMenus = ALL_MENUS.filter(menu => canAccess(menu.permission));

  const handleLogout = () => {
      if(window.confirm("Akhiri sesi kerja?")) {
          employeeLogout(); 
          navigate('/login'); // Pastikan redirect ke login setelah logout
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      
      {/* HEADER */}
      <div className="bg-blue-600 p-6 pb-16 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
        
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white font-bold text-2xl border border-white/20 shadow-inner">
                    {activeEmployee.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mb-1">Mode Karyawan</p>
                    <h1 className="text-xl font-extrabold text-white leading-tight">{activeEmployee.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block bg-white/20 px-2.5 py-0.5 rounded-lg text-[10px] text-white font-bold backdrop-blur-sm border border-white/10">
                            {activeEmployee.role || 'Staff'}
                        </span>
                        <span className="text-[10px] text-blue-100 bg-blue-700/50 px-2 py-0.5 rounded-lg">
                            {activeEmployee.storeName}
                        </span>
                    </div>
                </div>
            </div>
            <button onClick={handleLogout} className="p-2.5 bg-red-500/20 rounded-xl text-white hover:bg-red-500 transition border border-red-400/30 backdrop-blur-sm shadow-sm active:scale-95">
                <LogOut size={20}/>
            </button>
        </div>
      </div>

      {/* MENU GRID */}
      <div className="px-6 -mt-10 relative z-10">
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 min-h-[400px]">
              <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
                  <h2 className="text-sm font-extrabold text-slate-800">Menu Akses</h2>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-medium">{allowedMenus.length} Menu</span>
              </div>
              
              {allowedMenus.length === 0 ? (
                  <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Settings size={24} className="text-slate-300"/>
                      </div>
                      <p className="text-slate-500 font-bold text-sm">Tidak ada akses menu.</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
                          Minta Owner untuk mencentang "Hak Akses" di menu Jabatan.
                      </p>
                      
                      {/* Debugging Info */}
                      <div className="mt-6 p-3 bg-red-50 rounded-xl text-[10px] text-red-500 text-left overflow-hidden">
                          <p className="font-bold mb-1">Debug Info:</p>
                          <pre>{JSON.stringify(activeEmployee.permissions, null, 2)}</pre>
                      </div>
                  </div>
              ) : (
                  <div className="grid grid-cols-2 gap-4">
                      {allowedMenus.map((menu, idx) => (
                          <button 
                              key={idx}
                              onClick={() => navigate(menu.path)}
                              className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-slate-50 shadow-sm hover:shadow-lg hover:border-indigo-100 hover:scale-[1.02] transition-all active:scale-95 bg-white aspect-[4/3] group relative overflow-hidden"
                          >
                              {/* Background Decoration */}
                              <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full opacity-10 ${menu.color.split(' ')[0]}`}></div>

                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${menu.color} group-hover:scale-110 transition-transform shadow-sm relative z-10`}>
                                  <menu.icon size={24}/>
                              </div>
                              <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 relative z-10">{menu.label}</span>
                          </button>
                      ))}
                  </div>
              )}
          </div>
      </div>

      {/* FOOTER INFO */}
      <div className="text-center mt-8 text-slate-400 text-[10px] px-10 pb-4">
          <p>Logged in as <span className="font-bold text-slate-500">{activeEmployee.name}</span></p>
          <p className="mt-0.5 opacity-70">{activeEmployee.storeName || '...'}</p>
      </div>

    </div>
  );
}