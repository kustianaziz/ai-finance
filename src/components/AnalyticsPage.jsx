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
  
  // States Data
  const [financials, setFinancials] = useState({ income: 0, expense: 0, balance: 0 });
  const [categoryData, setCategoryData] = useState([]);
  const [merchantData, setMerchantData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  
  // State Grafik Khusus
  const [businessItemData, setBusinessItemData] = useState([]); 
  const [personalItemData, setPersonalItemData] = useState([]); 
  const [splitData, setSplitData] = useState([]); 

  // Warna-warni
  const COLORS = ['#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#10B981', '#6366F1'];
  const SPLIT_COLORS = ['#6366F1', '#EC4899']; // Indigo (Bisnis) vs Pink (Pribadi)
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // KATA KUNCI BISNIS
  const BUSINESS_KEYWORDS = ['usaha', 'modal', 'bisnis', 'stok', 'kulakan', 'jualan', 'toko'];

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      
      // 1. Ambil Header
      const { data: headerData, error: headerError } = await supabase
        .from('transaction_headers')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startOfMonth);

      if (headerError) throw headerError;

      // 2. Ambil Item Detail + Join Header
      const { data: itemData, error: itemError } = await supabase
        .from('transaction_items')
        .select(`
          *,
          transaction_headers!inner (
            type,
            date,
            user_id,
            category
          )
        `)
        .eq('transaction_headers.user_id', user.id)
        .gte('transaction_headers.date', startOfMonth);

      if (itemError) throw itemError;

      processData(headerData, itemData);
    } catch (error) {
      console.error('Error analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processData = (headerData, itemData) => {
    // --- 1. ANALISA UMUM ---
    let income = 0;
    let expense = 0;
    let totalBusinessExpense = 0;
    let totalPersonalExpense = 0;

    headerData.forEach(t => {
      const amt = Number(t.total_amount);
      if (t.type === 'income') {
        income += amt;
      } else {
        expense += amt;
        
        // Cek apakah ini pengeluaran Bisnis atau Pribadi
        const cat = (t.category || "").toLowerCase();
        const isBusiness = BUSINESS_KEYWORDS.some(k => cat.includes(k));
        
        if (isBusiness) totalBusinessExpense += amt;
        else totalPersonalExpense += amt;
      }
    });

    setFinancials({ income, expense, balance: income - expense });

    // Set Data Pie Chart Split (Bisnis vs Pribadi)
    setSplitData([
      { name: 'Modal Bisnis', value: totalBusinessExpense },
      { name: 'Konsumsi Pribadi', value: totalPersonalExpense }
    ]);

    // Pie Chart Kategori (Expense Only) - INI YANG ABANG MINTA DIKEMBALIKAN
    const expensesOnly = headerData.filter(t => t.type === 'expense');
    const catGroup = expensesOnly.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + Number(curr.total_amount);
      return acc;
    }, {});
    setCategoryData(Object.keys(catGroup).map(k => ({ name: k, value: catGroup[k] })));

    // Top Merchant
    const merchGroup = expensesOnly.reduce((acc, curr) => {
      const name = curr.merchant || 'Lainnya';
      acc[name] = (acc[name] || 0) + Number(curr.total_amount);
      return acc;
    }, {});
    setMerchantData(Object.keys(merchGroup)
      .map(k => ({ name: k, value: merchGroup[k] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5));

    // Tren Mingguan
    const weekStats = Array(7).fill(0).map((_, i) => ({ day: DAYS[i], income: 0, expense: 0 }));
    headerData.forEach(t => {
      const dayIndex = new Date(t.date).getDay();
      if (t.type === 'income') weekStats[dayIndex].income += Number(t.total_amount);
      else weekStats[dayIndex].expense += Number(t.total_amount);
    });
    setWeeklyData([...weekStats.slice(1), weekStats[0]]);

    // --- 2. ANALISA ITEM (BISNIS & PRIBADI) ---
    const bizStats = {};
    const personalStats = {};

    itemData.forEach(item => {
      const header = item.transaction_headers;
      const cat = (header.category || "").toLowerCase();
      const isBusiness = BUSINESS_KEYWORDS.some(k => cat.includes(k));
      
      const rawName = item.name || "Tanpa Nama";
      const name = rawName.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      const amount = Number(item.price);

      if (header.type === 'income') {
        // Income masuk ke omzet bisnis
        if (!bizStats[name]) bizStats[name] = { name: name, modal: 0, omzet: 0 };
        bizStats[name].omzet += amount;
      } else if (header.type === 'expense') {
        if (isBusiness) {
          // Expense Bisnis (Modal)
          if (!bizStats[name]) bizStats[name] = { name: name, modal: 0, omzet: 0 };
          bizStats[name].modal += amount;
        } else {
          // Expense Pribadi (Konsumsi)
          if (!personalStats[name]) personalStats[name] = { name: name, value: 0 };
          personalStats[name].value += amount;
        }
      }
    });

    const sortedBiz = Object.values(bizStats)
      .sort((a, b) => (b.modal + b.omzet) - (a.modal + a.omzet))
      .slice(0, 5);
    setBusinessItemData(sortedBiz);

    const sortedPersonal = Object.values(personalStats)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    setPersonalItemData(sortedPersonal);
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      
      {/* Header */}
      <div className="bg-white p-6 shadow-sm sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-gray-100">←</button>
        <h1 className="text-xl font-bold text-gray-800">Laporan Keuangan</h1>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Sedang mengkalkulasi data...</div>
      ) : (
        <div className="p-6 space-y-6">

          {/* 1. RINGKASAN */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-green-100 p-4 rounded-2xl border border-green-200">
                <p className="text-xs font-bold text-green-600 uppercase">Pemasukan</p>
                <p className="text-lg font-bold text-green-700">{formatIDR(financials.income)}</p>
             </div>
             <div className="bg-red-100 p-4 rounded-2xl border border-red-200">
                <p className="text-xs font-bold text-red-600 uppercase">Pengeluaran</p>
                <p className="text-lg font-bold text-red-700">{formatIDR(financials.expense)}</p>
             </div>
          </div>
          
          <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg shadow-blue-200 flex justify-between items-center">
             <div>
               <p className="text-blue-200 text-xs font-bold uppercase">Sisa Uang (Netto)</p>
               <h2 className="text-2xl font-bold">{formatIDR(financials.balance)}</h2>
             </div>
             <div className="text-4xl opacity-20">⚖️</div>
          </div>

          {/* 2. ANALISA PERFORMA BARANG BISNIS */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 ring-2 ring-indigo-50">
            <h3 className="font-bold text-indigo-700 mb-1">Performa Barang Bisnis 📦</h3>
            <p className="text-xs text-gray-400 mb-4">Modal vs Omzet (Kategori: Usaha/Modal)</p>
            <div className="h-[250px] w-full">
              {businessItemData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={businessItemData} layout="vertical" margin={{left: 30, right: 10}}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
                    <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#f5f7ff'}} />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar dataKey="modal" name="Modal" fill="#EF4444" barSize={12} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="omzet" name="Omzet" fill="#10B981" barSize={12} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                 <div className="text-center py-10 text-gray-400 text-xs">Belum ada data barang bisnis.</div>
              )}
            </div>
          </div>

          {/* 3. TOP ITEM PRIBADI */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-pink-600 mb-1">Top Jajanan Pribadi 🛍️</h3>
            <p className="text-xs text-gray-400 mb-4">Barang konsumsi yang paling menguras dompet</p>
            <div className="h-[250px] w-full">
               {personalItemData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart layout="vertical" data={personalItemData} margin={{left: 30, right: 10}}>
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                     <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#fdf2f8'}} />
                     <Bar dataKey="value" name="Total Beli" fill="#EC4899" barSize={15} radius={[0, 4, 4, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="text-center py-10 text-gray-400 text-xs">Belum ada data belanja pribadi.</div>
               )}
            </div>
          </div>

          {/* 4. CASH FLOW MINGGUAN */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-1">Cash Flow Mingguan 📈</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val) => formatIDR(val)} />
                  <Legend verticalAlign="top" height={36}/>
                  <Line type="monotone" dataKey="income" name="Masuk" stroke="#10B981" strokeWidth={3} dot={{r: 2}} />
                  <Line type="monotone" dataKey="expense" name="Keluar" stroke="#EF4444" strokeWidth={3} dot={{r: 2}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. KATEGORI PENGELUARAN (PIE CHART) - RESTORED ✅ */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-4">Kategori Pengeluaran 🍰</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(val) => formatIDR(val)} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. PIE CHART SPLIT: BISNIS vs PRIBADI */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-4 text-center">Bisnis vs Konsumsi Pribadi ⚖️</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={splitData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {splitData.map((entry, index) => (<Cell key={`cell-${index}`} fill={SPLIT_COLORS[index]} />))}
                  </Pie>
                  <Tooltip formatter={(val) => formatIDR(val)} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 'bold'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-2">
                <p className="text-xs text-gray-500">
                    {splitData[0].value > splitData[1].value 
                        ? "Mantap! Lebih banyak uang diputar untuk modal bisnis. 👍" 
                        : "Waduh! Pengeluaran pribadi lebih besar dari modal bisnis. 😅"}
                </p>
            </div>
          </div>

          {/* 7. LANGGANAN TOKO */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-1">Langganan Toko 🏪</h3>
            <div className="h-[200px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart layout="vertical" data={merchantData} margin={{left: 20}}>
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11}} />
                   <Tooltip formatter={(val) => formatIDR(val)} />
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