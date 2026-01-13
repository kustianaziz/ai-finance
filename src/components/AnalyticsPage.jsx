import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  
  // --- STATE FILTER TANGGAL ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- STATE DATA ---
  const [financials, setFinancials] = useState({ income: 0, expense: 0, balance: 0 });
  
  // State Grafik
  const [salesItemData, setSalesItemData] = useState([]);       // NEW: Produk Terlaris
  const [businessItemData, setBusinessItemData] = useState([]); 
  const [salaryData, setSalaryData] = useState([]);             
  const [personalItemData, setPersonalItemData] = useState([]); 
  const [priveData, setPriveData] = useState([]);               
  const [weeklyAll, setWeeklyAll] = useState([]);               
  const [weeklyBiz, setWeeklyBiz] = useState([]);               
  const [categoryData, setCategoryData] = useState([]);         
  const [splitData, setSplitData] = useState([]);               
  const [merchantData, setMerchantData] = useState([]);         
  
  // Palette Warna
  const COLORS = ['#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#10B981', '#6366F1'];
  const SPLIT_COLORS = ['#4F46E5', '#EC4899']; 
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // INIT TANGGAL
  useEffect(() => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);
  }, []);

  // FETCH DATA
  useEffect(() => {
    if (user && startDate && endDate) fetchData();
  }, [user, startDate, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: headerData, error: headerError } = await supabase
        .from('transaction_headers')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (headerError) throw headerError;

      const { data: itemData, error: itemError } = await supabase
        .from('transaction_items')
        .select(`
          *,
          transaction_headers!inner (
            type,
            date,
            user_id,
            category,
            allocation_type,
            merchant
          )
        `)
        .eq('transaction_headers.user_id', user.id)
        .gte('transaction_headers.date', startDate)
        .lte('transaction_headers.date', endDate);

      if (itemError) throw itemError;

      processData(headerData, itemData);
    } catch (error) {
      console.error('Error analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processData = (headerData, itemData) => {
    // 1. RINGKASAN
    let totalIncome = 0;
    let totalExpense = 0;
    let groupBusiness = 0; 
    let groupPersonal = 0; 

    headerData.forEach(t => {
        const amt = Number(t.total_amount);
        if (t.type === 'income') {
            totalIncome += amt;
            groupBusiness += amt; 
        } else if (t.type === 'expense') {
            totalExpense += amt;
            if (['BUSINESS', 'SALARY'].includes(t.allocation_type)) {
                groupBusiness += amt;
            } else if (['PERSONAL', 'PRIVE'].includes(t.allocation_type)) {
                groupPersonal += amt;
            }
        }
    });

    setFinancials({ income: totalIncome, expense: totalExpense, balance: totalIncome - totalExpense });

    setSplitData([
        { name: 'Putaran Bisnis', value: groupBusiness },
        { name: 'Konsumsi Pribadi', value: groupPersonal }
    ]);

    // 2. MINGGUAN
    const weekStatsAll = Array(7).fill(0).map((_, i) => ({ day: DAYS[i], income: 0, expense: 0 }));
    const weekStatsBiz = Array(7).fill(0).map((_, i) => ({ day: DAYS[i], income: 0, expense: 0 }));

    headerData.forEach(t => {
        const dayIndex = new Date(t.date).getDay();
        const amt = Number(t.total_amount);

        if (t.type === 'income') {
            weekStatsAll[dayIndex].income += amt;
        } else {
            weekStatsAll[dayIndex].expense += amt;
        }

        if (['BUSINESS', 'SALARY', 'PRIVE'].includes(t.allocation_type) || t.type === 'income') {
            if (t.type === 'income') weekStatsBiz[dayIndex].income += amt;
            else weekStatsBiz[dayIndex].expense += amt;
        }
    });
    setWeeklyAll(weekStatsAll);
    setWeeklyBiz(weekStatsBiz);

    // 3. KATEGORI & MERCHANT
    const expensesOnly = headerData.filter(t => t.type === 'expense');
    const catGroup = expensesOnly.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + Number(curr.total_amount);
        return acc;
    }, {});
    setCategoryData(Object.keys(catGroup).map(k => ({ name: k, value: catGroup[k] })));

    const merchGroup = expensesOnly.reduce((acc, curr) => {
        const name = curr.merchant || 'Lainnya';
        acc[name] = (acc[name] || 0) + Number(curr.total_amount);
        return acc;
    }, {});
    setMerchantData(Object.keys(merchGroup)
        .map(k => ({ name: k, value: merchGroup[k] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5));

    // 4. DETAIL ITEM (TERMASUK SALES BARU)
    const salesMap = {};     // NEW: Produk Terlaris
    const bizItemMap = {};   
    const salaryMap = {};    
    const personalMap = {};  
    const priveMap = {};     

    itemData.forEach(item => {
        const h = item.transaction_headers;
        const name = (item.name || "Item").trim().replace(/\b\w/g, l => l.toUpperCase());
        const amt = Number(item.price);

        // A. LOGIC INCOME (PENJUALAN)
        if (h.type === 'income') {
            // Filter: Hanya yang BUSINESS (Sesuai Request)
            if (h.allocation_type === 'BUSINESS') {
                if (!salesMap[name]) salesMap[name] = { name, value: 0 };
                salesMap[name].value += amt;
            }
        } 
        // B. LOGIC EXPENSE (PENGELUARAN)
        else if (h.type === 'expense') {
            if (h.allocation_type === 'BUSINESS') {
                if (!bizItemMap[name]) bizItemMap[name] = { name, value: 0 };
                bizItemMap[name].value += amt;
            } else if (h.allocation_type === 'SALARY') {
                if (!salaryMap[name]) salaryMap[name] = { name, value: 0 };
                salaryMap[name].value += amt;
            } else if (h.allocation_type === 'PERSONAL') {
                if (!personalMap[name]) personalMap[name] = { name, value: 0 };
                personalMap[name].value += amt;
            } else if (h.allocation_type === 'PRIVE') {
                if (!priveMap[name]) priveMap[name] = { name, value: 0 };
                priveMap[name].value += amt;
            }
        }
    });

    const getTop5 = (map) => Object.values(map).sort((a, b) => b.value - a.value).slice(0, 5);
    
    setSalesItemData(getTop5(salesMap)); // Set Data Sales
    setBusinessItemData(getTop5(bizItemMap));
    setSalaryData(getTop5(salaryMap));
    setPersonalItemData(getTop5(personalMap));
    setPriveData(getTop5(priveMap));
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  const EmptyChart = ({ msg }) => (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs text-center">
          <span className="text-xl opacity-50 mb-2">📉</span>
          {msg}
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      
      {/* HEADER */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 space-y-3">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">←</button>
            <div>
                <h1 className="text-xl font-bold text-gray-800">Analisa Keuangan</h1>
                <p className="text-xs text-gray-500">Laporan & Statistik</p>
            </div>
        </div>

        {/* FILTER DATE */}
        <div className="flex gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
            <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase block ml-1">Dari</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-transparent font-bold text-sm text-gray-700 outline-none"/>
            </div>
            <div className="w-[1px] bg-gray-300 my-1"></div>
            <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase block ml-1">Sampai</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-transparent font-bold text-sm text-gray-700 outline-none"/>
            </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 animate-pulse"><p className="text-2xl mb-2">📊</p>Sedang mengkalkulasi data...</div>
      ) : (
        <div className="p-6 space-y-6">

          {/* 1. RINGKASAN */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-2xl shadow-lg shadow-blue-200 flex justify-between items-center">
             <div>
               <p className="text-blue-100 text-xs font-bold uppercase mb-1">Sisa Uang (Netto)</p>
               <h2 className="text-3xl font-bold">{formatIDR(financials.balance)}</h2>
             </div>
             <div className="text-5xl opacity-20">💰</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-green-100 p-4 rounded-2xl border border-green-200">
                <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Pemasukan</p>
                <p className="text-lg font-bold text-green-700">{formatIDR(financials.income)}</p>
             </div>
             <div className="bg-red-100 p-4 rounded-2xl border border-red-200">
                <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Pengeluaran</p>
                <p className="text-lg font-bold text-red-700">{formatIDR(financials.expense)}</p>
             </div>
          </div>
          
          {/* 2. CASH FLOW */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-indigo-700 mb-1 flex items-center gap-2">📊 Arus Kas Toko</h3>
            <p className="text-xs text-gray-400 mb-4">Transaksi Bisnis, Gaji & Prive</p>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyBiz}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val) => formatIDR(val)} />
                  <Legend verticalAlign="top" height={36} iconType="circle"/>
                  <Line type="monotone" dataKey="income" name="Masuk" stroke="#10B981" strokeWidth={3} dot={{r: 3}} />
                  <Line type="monotone" dataKey="expense" name="Keluar" stroke="#6366F1" strokeWidth={3} dot={{r: 3}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-1">📈 Arus Kas Total</h3>
            <p className="text-xs text-gray-400 mb-4">Termasuk Pribadi & Lainnya</p>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyAll}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val) => formatIDR(val)} />
                  <Legend verticalAlign="top" height={36} iconType="circle"/>
                  <Line type="monotone" dataKey="income" name="Masuk" stroke="#10B981" strokeWidth={3} dot={{r: 3}} />
                  <Line type="monotone" dataKey="expense" name="Keluar" stroke="#F87171" strokeWidth={3} dot={{r: 3}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. SPLIT & KATEGORI */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-4 text-center">Bisnis vs Pribadi ⚖️</h3>
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={splitData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {splitData.map((entry, index) => (<Cell key={`cell-${index}`} fill={SPLIT_COLORS[index]} />))}
                  </Pie>
                  <Tooltip formatter={(val) => formatIDR(val)} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-xs font-bold text-gray-400">Rasio</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-4 text-center">Kategori Pengeluaran 🍰</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                    {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(val) => formatIDR(val)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. DETAIL ITEM (STACKED) */}
          
          {/* --- GRAFIK BARU: TOP PRODUK TERLARIS (INCOME + BUSINESS) --- */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-emerald-500">
            <h3 className="font-bold text-gray-800 mb-1">🏆 Top Produk Terlaris</h3>
            <p className="text-xs text-gray-400 mb-4">Barang Paling Menghasilkan (Allocation: BUSINESS)</p>
            <div className="h-[220px] w-full">
              {salesItemData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={salesItemData} margin={{left: 10, right: 10}}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                        <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#ecfdf5'}} />
                        <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart msg="Belum ada data penjualan" />}
            </div>
          </div>

          {/* Barang Bisnis (EXPENSE) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
            <h3 className="font-bold text-gray-800 mb-1">📦 Belanja Operasional</h3>
            <p className="text-xs text-gray-400 mb-4">Pengeluaran Modal (Allocation: BUSINESS)</p>
            <div className="h-[220px] w-full">
              {businessItemData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={businessItemData} margin={{left: 10, right: 10}}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                        <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#eff6ff'}} />
                        <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart msg="Belum ada data belanja bisnis" />}
            </div>
          </div>

          {/* Gaji */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
            <h3 className="font-bold text-gray-800 mb-1">💰 Penggajian</h3>
            <p className="text-xs text-gray-400 mb-4">Riwayat Gaji (Allocation: SALARY)</p>
            <div className="h-[220px] w-full">
               {salaryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={salaryData} margin={{left: 10, right: 10}}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                        <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#f3e8ff'}} />
                        <Bar dataKey="value" fill="#A855F7" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
               ) : <EmptyChart msg="Belum ada data gaji" />}
            </div>
          </div>

          {/* Prive */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-orange-500">
            <h3 className="font-bold text-gray-800 mb-1">👨‍👩‍👧 Prive (Ambil Modal)</h3>
            <p className="text-xs text-gray-400 mb-4">Penggunaan Kas Toko (Allocation: PRIVE)</p>
            <div className="h-[220px] w-full">
               {priveData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={priveData} margin={{left: 10, right: 10}}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                        <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#fff7ed'}} />
                        <Bar dataKey="value" fill="#F97316" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
               ) : <EmptyChart msg="Aman, belum ada Prive" />}
            </div>
          </div>

          {/* Murni Pribadi */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-gray-400">
            <h3 className="font-bold text-gray-800 mb-1">🛍️ Murni Pribadi</h3>
            <p className="text-xs text-gray-400 mb-4">Hanya Arsip (Allocation: PERSONAL)</p>
            <div className="h-[220px] w-full">
               {personalItemData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={personalItemData} margin={{left: 10, right: 10}}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                        <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#f3f4f6'}} />
                        <Bar dataKey="value" fill="#9CA3AF" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
               ) : <EmptyChart msg="Belum ada data pribadi" />}
            </div>
          </div>

          {/* 5. LANGGANAN */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-1">Langganan Toko 🏪</h3>
            <p className="text-xs text-gray-400 mb-4">Merchant Paling Sering Dikunjungi (All)</p>
            <div className="h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart layout="vertical" data={merchantData} margin={{left: 20}}>
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11}} />
                   <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#fffbeb'}} />
                   <Bar dataKey="value" fill="#FBBF24" radius={[0, 4, 4, 0]} barSize={20} />
                 </BarChart>
               </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}