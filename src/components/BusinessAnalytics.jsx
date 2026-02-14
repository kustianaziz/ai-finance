import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  ArrowLeft, Calendar, TrendingUp, TrendingDown, 
  DollarSign, Package, Users, Activity, Filter, Download
} from 'lucide-react';

const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function BusinessAnalytics() {
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth();
  
  // LOGIC OWNER ID (SAMA SEPERTI DASHBOARD BISNIS)
  const ownerId = user?.id || activeEmployee?.storeId;

  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // STATE DATA
  const [summary, setSummary] = useState({
      revenue: 0,
      expense: 0,
      netProfit: 0,
      margin: 0,
      totalReceivable: 0, // Piutang belum dibayar
      totalPayable: 0     // Hutang belum dibayar
  });

  const [trendData, setTrendData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [expenseCat, setExpenseCat] = useState([]);

  // COLORS
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // 1. INIT DATE (Default: Bulan Ini)
  useEffect(() => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);
  }, []);

  // 2. FETCH DATA
  useEffect(() => {
    if (ownerId && startDate && endDate) fetchData();
  }, [ownerId, startDate, endDate]);

  const fetchData = async () => {
    try {
        setLoading(true);

        // A. AMBIL TRANSAKSI (Income & Expense Bisnis)
        const { data: trx } = await supabase
            .from('transaction_headers')
            .select('*')
            .eq('user_id', ownerId)
            .eq('allocation_type', 'BUSINESS') // Filter Khusus Bisnis
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        // B. AMBIL DATA PRODUK TERLARIS (Dari Transaction Items)
        const { data: items } = await supabase
            .from('transaction_items')
            .select(`
                name, price, qty,
                transaction_headers!inner (date, allocation_type, user_id)
            `)
            .eq('transaction_headers.user_id', ownerId)
            .eq('transaction_headers.allocation_type', 'BUSINESS')
            .gte('transaction_headers.date', startDate)
            .lte('transaction_headers.date', endDate);

        // C. AMBIL STATUS HUTANG & PIUTANG (Keseluruhan, bukan per tanggal)
        const { data: debts } = await supabase
            .from('debts')
            .select('type, remaining_amount')
            .eq('user_id', ownerId)
            .neq('status', 'paid'); // Yang belum lunas

        // --- PENGOLAHAN DATA ---

        // 1. Summary Keuangan
        let rev = 0, exp = 0;
        trx?.forEach(t => {
            if (t.category === 'Mutasi Saldo') return; // Skip mutasi
            if (t.type === 'income') rev += Number(t.total_amount);
            if (t.type === 'expense') exp += Number(t.total_amount);
        });

        const profit = rev - exp;
        const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;

        // 2. Summary Hutang Piutang
        let receivable = 0, payable = 0;
        debts?.forEach(d => {
            if (d.type === 'receivable') receivable += Number(d.remaining_amount);
            if (d.type === 'payable') payable += Number(d.remaining_amount);
        });

        setSummary({
            revenue: rev,
            expense: exp,
            netProfit: profit,
            margin: margin,
            totalReceivable: receivable,
            totalPayable: payable
        });

        // 3. Trend Grafik (Harian)
        const trendMap = {};
        trx?.forEach(t => {
            if (t.category === 'Mutasi Saldo') return;
            const d = new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            if (!trendMap[d]) trendMap[d] = { name: d, omset: 0, profit: 0 };
            
            if (t.type === 'income') {
                trendMap[d].omset += Number(t.total_amount);
                trendMap[d].profit += Number(t.total_amount);
            } else if (t.type === 'expense') {
                trendMap[d].profit -= Number(t.total_amount);
            }
        });
        setTrendData(Object.values(trendMap));

        // 4. Top Products
        const productMap = {};
        items?.forEach(i => {
            const name = i.name || 'Item';
            if (!productMap[name]) productMap[name] = 0;
            productMap[name] += Number(i.price); // Total Penjualan per Item
        });
        const sortedProducts = Object.entries(productMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        setTopProducts(sortedProducts);

        // 5. Kategori Pengeluaran
        const catMap = {};
        trx?.filter(t => t.type === 'expense' && t.category !== 'Mutasi Saldo').forEach(t => {
            if (!catMap[t.category]) catMap[t.category] = 0;
            catMap[t.category] += Number(t.total_amount);
        });
        const sortedCat = Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
        setExpenseCat(sortedCat);

    } catch (error) {
        console.error("Error fetching business analytics:", error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      
      {/* HEADER */}
      <div className="bg-white p-4 sticky top-0 z-20 shadow-sm border-b border-slate-100">
        <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition"><ArrowLeft size={20} /></button>
            <div className="flex-1">
                <h1 className="text-lg font-extrabold text-slate-800">Analisa Bisnis</h1>
                <p className="text-xs text-slate-500">Performa Toko & Keuangan</p>
            </div>
        </div>
        
        {/* DATE FILTER */}
        <div className="flex gap-2 bg-slate-100 p-2 rounded-xl items-center">
            <Calendar size={16} className="text-slate-400 ml-1"/>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none"/>
            <span className="text-slate-400">-</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none"/>
        </div>
      </div>

      {loading ? (
         <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
             <Activity className="animate-spin mb-2 text-blue-500" size={32}/>
             <span className="text-xs font-medium">Menganalisa Data Bisnis...</span>
         </div>
      ) : (
         <div className="p-4 space-y-6">
            
            {/* 1. KARTU PERFORMA UTAMA */}
            <div className="grid grid-cols-2 gap-3">
                {/* Omset */}
                <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-20"><TrendingUp size={40}/></div>
                    <p className="text-blue-100 text-xs font-medium mb-1">Total Omset</p>
                    <h2 className="text-lg font-bold">{formatIDR(summary.revenue)}</h2>
                </div>
                
                {/* Laba Bersih */}
                <div className={`${summary.netProfit >= 0 ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'} p-4 rounded-2xl shadow-lg text-white relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-3 opacity-20"><DollarSign size={40}/></div>
                    <p className="text-white/80 text-xs font-medium mb-1">Laba Bersih</p>
                    <h2 className="text-lg font-bold">{formatIDR(summary.netProfit)}</h2>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded mt-1 inline-block">Margin: {summary.margin}%</span>
                </div>
            </div>

            {/* 2. SUMMARY HUTANG PIUTANG (PENTING BUAT BISNIS) */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2"><Users size={16} className="text-purple-500"/> Posisi Hutang Piutang</h3>
                <div className="flex gap-4">
                    <div className="flex-1 bg-orange-50 p-3 rounded-xl border border-orange-100">
                        <p className="text-[10px] text-orange-600 font-bold uppercase mb-1">Piutang (Hak Kita)</p>
                        <p className="text-sm font-bold text-slate-800">{formatIDR(summary.totalReceivable)}</p>
                    </div>
                    <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Hutang (Kewajiban)</p>
                        <p className="text-sm font-bold text-slate-800">{formatIDR(summary.totalPayable)}</p>
                    </div>
                </div>
            </div>

            {/* 3. GRAFIK OMSET VS PROFIT */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm mb-4">📈 Trend Omset & Profit</h3>
                <div className="h-[200px] w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorOmset" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="name" tick={{fontSize: 9}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                            <Tooltip formatter={(val) => formatIDR(val)} contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                            <Area type="monotone" dataKey="omset" name="Omset" stroke="#3B82F6" fillOpacity={1} fill="url(#colorOmset)" strokeWidth={2} />
                            <Area type="monotone" dataKey="profit" name="Profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 4. TOP SALES & PENGELUARAN */}
            <div className="grid gap-4">
                {/* Produk Terlaris */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><Package size={16} className="text-amber-500"/> Produk Terlaris</h3>
                    <div className="h-[180px] w-full text-xs">
                        {topProducts.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={topProducts} margin={{left: 0, right: 30}}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                                    <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#fff7ed'}} />
                                    <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={12}>
                                        {/* Label Nilai di Ujung Bar */}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="text-center text-slate-300 py-10">Belum ada penjualan</div>}
                    </div>
                </div>

                {/* Komposisi Biaya */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><Activity size={16} className="text-rose-500"/> Alokasi Biaya Operasional</h3>
                    <div className="flex items-center">
                        <div className="h-[150px] w-1/2">
                            {expenseCat.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={expenseCat} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={2} dataKey="value">
                                            {expenseCat.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <div className="text-center text-slate-300 text-xs">No Data</div>}
                        </div>
                        <div className="w-1/2 space-y-2">
                            {expenseCat.slice(0, 4).map((e, i) => (
                                <div key={i} className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                                        <span className="truncate w-20 text-slate-600">{e.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-800">{formatIDR(e.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

         </div>
      )}
    </div>
  );
}