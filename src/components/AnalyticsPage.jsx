import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { User, Building2, PieChart as PieIcon, ArrowLeft, Calendar } from 'lucide-react';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  
  // --- STATE FILTER & MODE ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState('ALL'); 
  const [accountType, setAccountType] = useState('personal');

  // --- STATE CHART TAB ---
  const [activeChart, setActiveChart] = useState('DAILY'); 

  // --- STATE DATA ---
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawItems, setRawItems] = useState([]);

  // --- STATE OLAHAN ---
  const [financials, setFinancials] = useState({ income: 0, expense: 0, balance: 0 });
  const [chartData, setChartData] = useState({
      trend: [],         
      granularity: 'Harian', 
      expenseCat: [],    
      incomeCat: [],     
      topSales: [],    
      topExpenseBiz: [], 
      topSalary: [],   
      topPersonal: [], 
      topPrive: []     
  });

  const COLORS = ['#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#10B981', '#6366F1'];
  const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // 1. INIT
  useEffect(() => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);

    const savedMode = localStorage.getItem('app_mode');
    if (savedMode) setViewMode(savedMode);
    
    fetchProfileType();
  }, []);

  const fetchProfileType = async () => {
      if(!user) return;
      const { data } = await supabase.from('profiles').select('account_type').eq('id', user.id).single();
      if(data) setAccountType(data.account_type);
  };

  // 2. FETCH DATA
  useEffect(() => {
    if (user && startDate && endDate) fetchData();
  }, [user, startDate, endDate]);

  // 3. RE-CALCULATE
  useEffect(() => {
    if (rawHeaders.length > 0 || !loading) calculateStatistics();
  }, [rawHeaders, rawItems, viewMode, activeChart]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const endD = new Date(endDate);
      const startLimit = new Date(endD);
      startLimit.setFullYear(endD.getFullYear() - 1); 
      const safeStartDate = startLimit.toISOString().split('T')[0];

      const { data: headerData, error: headerError } = await supabase
        .from('transaction_headers')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', safeStartDate) 
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (headerError) throw headerError;

      const { data: itemData, error: itemError } = await supabase
        .from('transaction_items')
        .select(`*, transaction_headers!inner (type, date, allocation_type)`)
        .eq('transaction_headers.user_id', user.id)
        .gte('transaction_headers.date', safeStartDate)
        .lte('transaction_headers.date', endDate);

      if (itemError) throw itemError;

      setRawHeaders(headerData);
      setRawItems(itemData);
    } catch (error) {
      console.error('Error analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- HELPER FORMAT TANGGAL ---
  const formatDateKey = (dateObj) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
  };

  const calculateStatistics = () => {
    
    // A. FILTER MODE
    const filteredHeaders = rawHeaders.filter(h => {
        if (viewMode === 'ALL') return true;
        if (viewMode === 'PERSONAL') return ['PERSONAL', 'PRIVE'].includes(h.allocation_type);
        if (viewMode === 'BUSINESS' || viewMode === 'ORGANIZATION') return ['BUSINESS', 'ORGANIZATION', 'SALARY'].includes(h.allocation_type);
        return true;
    });

    // B. HITUNG TOTAL
    let totalIncome = 0;
    let totalExpense = 0;
    
    filteredHeaders.forEach(t => {
        const tDate = t.date.split('T')[0];
        if (tDate >= startDate && tDate <= endDate) {
            const amt = Number(t.total_amount);
            if (t.type === 'income') totalIncome += amt;
            else totalExpense += amt;
        }
    });
    setFinancials({ income: totalIncome, expense: totalExpense, balance: totalIncome - totalExpense });

    // --- C. CHART GENERATION ---
    let chartMap = {};
    let granularity = 'Harian';

    // 1. HARIAN (7 Hari Terakhir)
    if (activeChart === 'DAILY') {
        granularity = 'Harian (7 Hari Terakhir)';
        const endD = new Date(endDate);
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(endD);
            d.setDate(d.getDate() - i);
            const key = formatDateKey(d); 
            const label = `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]}`; 
            
            chartMap[key] = { name: label, income: 0, expense: 0, sortKey: key };
        }
    }
    // 2. MINGGUAN
    else if (activeChart === 'WEEKLY') {
        granularity = 'Mingguan (Sesuai Filter)';
    } 
    // 3. BULANAN
    else if (activeChart === 'MONTHLY') {
        granularity = 'Bulanan (1 Tahun Terakhir)';
        const endD = new Date(endDate);
        
        for (let i = 11; i >= 0; i--) {
            const d = new Date(endD);
            d.setMonth(d.getMonth() - i);
            d.setDate(1); 
            
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const label = `${MONTHS_ID[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`;
            
            chartMap[key] = { name: label, income: 0, expense: 0, sortKey: key };
        }
    }

    // ISI DATA CHART
    filteredHeaders.forEach(t => {
        const amt = Number(t.total_amount);
        const tDate = t.date.split('T')[0];
        const d = new Date(tDate);

        if (activeChart === 'DAILY') {
            if (chartMap[tDate]) {
                if (t.type === 'income') chartMap[tDate].income += amt;
                else chartMap[tDate].expense += amt;
            }
        }
        else if (activeChart === 'MONTHLY') {
            const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            if (chartMap[monthKey]) {
                if (t.type === 'income') chartMap[monthKey].income += amt;
                else chartMap[monthKey].expense += amt;
            }
        }
        else if (activeChart === 'WEEKLY') {
            if (tDate >= startDate && tDate <= endDate) {
                const oneJan = new Date(d.getFullYear(), 0, 1);
                const numberOfDays = Math.floor((d - oneJan) / (24 * 60 * 60 * 1000));
                const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
                const weekKey = `W${weekNum}-${d.getFullYear()}`;
                const label = `Minggu ${weekNum} (${MONTHS_ID[d.getMonth()]})`;

                if (!chartMap[weekKey]) chartMap[weekKey] = { name: label, income: 0, expense: 0, sortKey: weekKey };
                
                if (t.type === 'income') chartMap[weekKey].income += amt;
                else chartMap[weekKey].expense += amt;
            }
        }
    });

    const trendData = Object.values(chartMap).sort((a, b) => (a.sortKey > b.sortKey) ? 1 : -1);

    // D. PIE CHARTS
    const rangeData = filteredHeaders.filter(t => {
        const d = t.date.split('T')[0];
        return d >= startDate && d <= endDate;
    });
    
    const groupByCategory = (data) => {
        const group = data.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + Number(curr.total_amount);
            return acc;
        }, {});
        return Object.keys(group).map(k => ({ name: k, value: group[k] }));
    };

    const expenseCatData = groupByCategory(rangeData.filter(t => t.type === 'expense'));
    const incomeCatData = groupByCategory(rangeData.filter(t => t.type === 'income'));

    // E. DETAIL ITEM
    const salesMap = {};
    const bizItemMap = {};
    const salaryMap = {};
    const personalMap = {};
    const priveMap = {};

    rawItems.forEach(item => {
        const h = item.transaction_headers;
        const hDate = h.date.split('T')[0];
        
        if (hDate < startDate || hDate > endDate) return;

        let isIncluded = false;
        if (viewMode === 'ALL') isIncluded = true;
        else if (viewMode === 'PERSONAL' && ['PERSONAL', 'PRIVE'].includes(h.allocation_type)) isIncluded = true;
        else if ((viewMode === 'BUSINESS' || viewMode === 'ORGANIZATION') && ['BUSINESS', 'ORGANIZATION', 'SALARY'].includes(h.allocation_type)) isIncluded = true;

        if (isIncluded) {
            const name = (item.name || "Item").trim().replace(/\b\w/g, l => l.toUpperCase());
            const amt = Number(item.price);

            if (h.type === 'income' && (h.allocation_type === 'BUSINESS' || h.allocation_type === 'ORGANIZATION')) {
                if (!salesMap[name]) salesMap[name] = { name, value: 0 };
                salesMap[name].value += amt;
            } else if (h.type === 'expense') {
                if (['BUSINESS', 'ORGANIZATION'].includes(h.allocation_type)) {
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
        }
    });

    const getTop5 = (map) => Object.values(map).sort((a, b) => b.value - a.value).slice(0, 5);

    setChartData({
        trend: trendData,
        granularity: granularity,
        expenseCat: expenseCatData,
        incomeCat: incomeCatData,
        topSales: getTop5(salesMap),
        topExpenseBiz: getTop5(bizItemMap),
        topSalary: getTop5(salaryMap),
        topPersonal: getTop5(personalMap),
        topPrive: getTop5(priveMap)
    });
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const EmptyChart = ({ msg }) => (<div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs text-center"><span className="text-xl opacity-50 mb-2">📉</span>{msg}</div>);

  const getTheme = () => {
      if (viewMode === 'PERSONAL') return 'pink';
      if (viewMode === 'BUSINESS' || viewMode === 'ORGANIZATION') return accountType === 'organization' ? 'teal' : 'blue';
      return 'indigo';
  };
  const theme = getTheme();

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      
      {/* HEADER */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 space-y-4">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
                <h1 className="text-lg font-bold text-gray-800">Analisa Keuangan</h1>
                <p className="text-xs text-gray-500">Laporan & Statistik</p>
            </div>
        </div>

        {/* MODE SWITCHER */}
        <div className="bg-gray-100 p-1 rounded-xl flex">
            <button onClick={() => setViewMode('PERSONAL')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${viewMode === 'PERSONAL' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'}`}>
                <User size={14}/> Pribadi
            </button>
            <button onClick={() => setViewMode(accountType === 'organization' ? 'ORGANIZATION' : 'BUSINESS')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${['BUSINESS', 'ORGANIZATION'].includes(viewMode) ? `bg-white text-${accountType === 'organization' ? 'teal' : 'blue'}-600 shadow-sm` : 'text-gray-500'}`}>
                <Building2 size={14}/> {accountType === 'organization' ? 'Organisasi' : 'Bisnis'}
            </button>
            <button onClick={() => setViewMode('ALL')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${viewMode === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                <PieIcon size={14}/> Gabungan
            </button>
        </div>

        {/* DATE FILTER */}
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
        <div className="text-center py-20 text-gray-400 animate-pulse"><p className="text-2xl mb-2">📊</p>Menyiapkan Data...</div>
      ) : (
        <div className="p-4 space-y-6">

          {/* 1. RINGKASAN */}
          <div className={`bg-gradient-to-r ${viewMode === 'PERSONAL' ? 'from-pink-500 to-rose-500' : ['BUSINESS', 'ORGANIZATION'].includes(viewMode) ? (accountType === 'organization' ? 'from-teal-500 to-emerald-500' : 'from-blue-600 to-indigo-600') : 'from-indigo-600 to-purple-600'} text-white p-6 rounded-3xl shadow-lg shadow-${theme}-200 flex justify-between items-center relative overflow-hidden transition-all duration-500`}>
             <div className="absolute -right-5 -top-5 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
             <div className="relative z-10">
               <p className="text-white/80 text-xs font-bold uppercase mb-1">
                   {viewMode === 'PERSONAL' ? 'Saldo Pribadi' : ['BUSINESS', 'ORGANIZATION'].includes(viewMode) ? 'Profit Bersih' : 'Total Saldo Netto'}
               </p>
               <h2 className="text-3xl font-bold tracking-tight">{formatIDR(financials.balance)}</h2>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Pemasukan ⬇</p>
                <p className="text-lg font-bold text-green-600">{formatIDR(financials.income)}</p>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Pengeluaran ⬆</p>
                <p className="text-lg font-bold text-red-500">{formatIDR(financials.expense)}</p>
             </div>
          </div>
          
          {/* 2. GRAFIK DINAMIS */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        📈 Arus Kas
                    </h3>
                    <p className="text-[10px] text-gray-400">{chartData.granularity}</p>
                </div>
                
                {/* TABS CHART */}
                <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                    <button onClick={() => setActiveChart('DAILY')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeChart === 'DAILY' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Harian</button>
                    <button onClick={() => setActiveChart('WEEKLY')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeChart === 'WEEKLY' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Mingguan</button>
                    <button onClick={() => setActiveChart('MONTHLY')} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeChart === 'MONTHLY' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Bulanan</button>
                </div>
            </div>
            
            <div className="h-[220px] w-full">
              {chartData.trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.trend}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      {/* === X-AXIS MIRING 45 DERAJAT === */}
                      <XAxis 
                        dataKey="name" 
                        tick={{fontSize: 10, fill: '#9ca3af', angle: -45, textAnchor: 'end'}} 
                        height={60} 
                        axisLine={false} 
                        tickLine={false} 
                        interval={0} 
                      />
                      <Tooltip formatter={(val) => formatIDR(val)} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Area type="monotone" dataKey="income" name="Masuk" stroke="#10B981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                      <Area type="monotone" dataKey="expense" name="Keluar" stroke="#F43F5E" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
              ) : <EmptyChart msg="Belum ada data grafik" />}
            </div>
          </div>

          {/* 3. PIE CHART (VERTICAL STACK) */}
          <div className="flex flex-col gap-6">
              
              {/* PIE CHART PENGELUARAN */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 text-center">Kategori Pengeluaran 💸</h3>
                <div className="h-[200px] w-full">
                  {chartData.expenseCat.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData.expenseCat} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                            {chartData.expenseCat.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                          </Pie>
                          <Tooltip formatter={(val) => formatIDR(val)} />
                          <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '10px'}}/>
                        </PieChart>
                      </ResponsiveContainer>
                  ) : <EmptyChart msg="Belum ada pengeluaran" />}
                </div>
              </div>

              {/* PIE CHART PEMASUKAN */}
              {chartData.incomeCat.length > 0 && (
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 text-center">Sumber Pemasukan 💰</h3>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                            <Pie data={chartData.incomeCat} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                                {chartData.incomeCat.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />))}
                            </Pie>
                            <Tooltip formatter={(val) => formatIDR(val)} />
                            <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '10px'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                  </div>
              )}
          </div>

          {/* 4. DETAIL ITEM */}
          {(['BUSINESS', 'ORGANIZATION', 'ALL'].includes(viewMode)) && (
             <>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-emerald-500">
                    <h3 className="font-bold text-gray-800 mb-1">🏆 Produk Terlaris (Bisnis)</h3>
                    <div className="h-[200px] w-full mt-4">
                        {chartData.topSales.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={chartData.topSales} margin={{left: 0, right: 20}}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                    <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#ecfdf5'}} />
                                    <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart msg="Belum ada penjualan" />}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
                    <h3 className="font-bold text-gray-800 mb-1">📦 Belanja Operasional</h3>
                    <div className="h-[200px] w-full mt-4">
                        {chartData.topExpenseBiz.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={chartData.topExpenseBiz} margin={{left: 0, right: 20}}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                    <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#eff6ff'}} />
                                    <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart msg="Belum ada belanja bisnis" />}
                    </div>
                </div>
             </>
          )}

          {(['PERSONAL', 'ALL'].includes(viewMode)) && (
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-pink-500">
                <h3 className="font-bold text-gray-800 mb-1">🛍️ Belanja Pribadi Terbanyak</h3>
                <div className="h-[200px] w-full mt-4">
                    {chartData.topPersonal.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={chartData.topPersonal} margin={{left: 0, right: 20}}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#fdf2f8'}} />
                                <Bar dataKey="value" fill="#EC4899" radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart msg="Hemat pangkal kaya!" />}
                </div>
             </div>
          )}

        </div>
      )}
    </div>
  );
}