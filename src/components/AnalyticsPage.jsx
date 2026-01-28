import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { 
    User, Building2, PieChart as PieIcon, ArrowLeft, Calendar, Crown, 
    ArrowDownLeft, ArrowUpRight, Wallet, Target, PiggyBank, Landmark, AlertTriangle, CheckCircle2, Search, X, AlertCircle, TrendingUp, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  
  // --- STATE FILTER & MODE ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState('PERSONAL'); 
  const [accountType, setAccountType] = useState('personal');

  // --- STATE CHART TAB ---
  const [activeChart, setActiveChart] = useState('DAILY'); 

  // --- STATE DATA MENTAH ---
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawItems, setRawItems] = useState([]);
  const [walletData, setWalletData] = useState([]); 
  const [billsData, setBillsData] = useState([]);
  const [budgetsData, setBudgetsData] = useState([]);
  const [goalsData, setGoalsData] = useState([]);

  // --- STATE MODAL DETAIL ---
  const [detailModal, setDetailModal] = useState({ show: false, title: '', type: '', transactions: [] });

  // --- STATE OLAHAN (INSIGHTS) ---
  const [financials, setFinancials] = useState({ 
      income: 0, expense: 0, netFlow: 0, openingBalance: 0, endingBalance: 0 
  });
  
  const [chartData, setChartData] = useState({
      trend: [], granularity: 'Harian', 
      expenseCat: [], incomeCat: [],     
      topSales: [], topExpenseBiz: [], topSalary: [], topPersonal: [], 
      assetComposition: [], 
      budgetHealth: [], 
      totalBudgetLimit: 0,
      totalBillsAmount: 0,
      totalObligations: 0,
      fixedCostRatio: 0,    
      
      // Goals Data
      totalGoalTarget: 0,
      totalGoalSaved: 0,
      goalProgressPercent: 0,

      // Saving Power
      monthlySavingTarget: 0, 
      potentialSaving: 0,     
      savingStatus: 'UNKNOWN' 
  });

  const COLORS = ['#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#10B981', '#6366F1'];
  const ASSET_COLORS = { 'BANK': '#3B82F6', 'E-WALLET': '#8B5CF6', 'CASH': '#10B981', 'OTHER': '#9CA3AF' };
  const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // 1. INIT
  useEffect(() => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);
    fetchProfileType();
  }, []);

  const fetchProfileType = async () => {
      if(!user) return;
      const { data } = await supabase.from('profiles').select('account_type').eq('id', user.id).single();
      if(data) {
          setAccountType(data.account_type);
          const hasBusinessAccess = ['business', 'organization'].includes(data.account_type);
          if (hasBusinessAccess) {
              const savedMode = localStorage.getItem('app_mode');
              if (savedMode) setViewMode(savedMode); else setViewMode('ALL');
          } else {
              setViewMode('PERSONAL');
          }
      }
  };

  // 2. FETCH ALL DATA
  useEffect(() => {
    if (user && startDate && endDate) fetchData();
  }, [user, startDate, endDate]);

  // 3. RE-CALCULATE ALL
  useEffect(() => {
    if (rawHeaders.length > 0 || !loading) calculateStatistics();
  }, [rawHeaders, rawItems, viewMode, activeChart, walletData, billsData, budgetsData, goalsData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const endD = new Date(endDate);
      const startLimit = new Date(endD);
      startLimit.setFullYear(endD.getFullYear() - 1); 
      const safeStartDate = startLimit.toISOString().split('T')[0];

      // --- FIX DATE LOGIC FOR BUDGET ---
      // Kita harus memastikan string 'YYYY-MM-DD' untuk budget period sama persis dengan cara BudgetPage menyimpannya.
      // BudgetPage menggunakan new Date(y, m, 1).toISOString(), yang bisa terpengaruh timezone.
      // Untuk amannya, kita construct Date object lokal lalu toISOString(), sama seperti BudgetPage.
      let budgetPeriodStr = '';
      if (startDate) {
          const [y, m] = startDate.split('-').map(Number);
          // Buat tanggal lokal jam 00:00 tanggal 1 bulan tersebut
          const localDate = new Date(y, m - 1, 1);
          // Konversi ke format DB (Logic yang sama dengan BudgetPage)
          budgetPeriodStr = localDate.toISOString().split('T')[0];
      }

      const [headersRes, itemsRes, walletsRes, billsRes, budgetsRes, goalsRes] = await Promise.all([
          supabase.from('transaction_headers').select('*').eq('user_id', user.id).gte('date', safeStartDate).lte('date', endDate).order('date', { ascending: true }),
          supabase.from('transaction_items').select(`*, transaction_headers!inner (type, date, allocation_type, category)`).eq('transaction_headers.user_id', user.id).gte('transaction_headers.date', safeStartDate).lte('transaction_headers.date', endDate),
          supabase.from('wallets').select('*').eq('user_id', user.id), 
          supabase.from('bills').select('*').eq('user_id', user.id),
          supabase.from('budgets').select('*').eq('user_id', user.id).eq('month_period', budgetPeriodStr), 
          supabase.from('goals').select('*').eq('user_id', user.id)
      ]);

      if (headersRes.error) throw headersRes.error;

      setRawHeaders(headersRes.data || []);
      setRawItems(itemsRes.data || []);
      setWalletData(walletsRes.data || []);
      setBillsData(billsRes.data || []);
      setBudgetsData(budgetsRes.data || []); // Sekarang harusnya sudah ada datanya
      setGoalsData(goalsRes.data || []);

    } catch (error) { console.error('Error analytics:', error); } finally { setLoading(false); }
  };

  const formatDateKey = (dateObj) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
  };

  const calculateStatistics = () => {
    // 1. FILTER TRANSAKSI
    const filteredHeaders = rawHeaders.filter(h => {
        if (viewMode === 'ALL') return true;
        if (viewMode === 'PERSONAL') return ['PERSONAL', 'PRIVE'].includes(h.allocation_type);
        if (viewMode === 'BUSINESS' || viewMode === 'ORGANIZATION') return ['BUSINESS', 'ORGANIZATION', 'SALARY'].includes(h.allocation_type);
        return true;
    });

    // 2. HITUNG SALDO & ARUS KAS
    let totalIncome = 0;
    let totalExpense = 0;
    let currentRealBalance = 0;
    
    walletData.forEach(w => {
        let isIncluded = false;
        if (viewMode === 'ALL') isIncluded = true;
        if (viewMode === 'PERSONAL' && w.allocation_type === 'PERSONAL') isIncluded = true;
        if ((viewMode === 'BUSINESS' || viewMode === 'ORGANIZATION') && w.allocation_type === viewMode) isIncluded = true;
        if (isIncluded) currentRealBalance += Number(w.initial_balance);
    });

    let flowSinceStart = 0; 
    filteredHeaders.forEach(t => {
        const tDate = t.date.split('T')[0];
        const amt = Number(t.total_amount);
        if (tDate >= startDate) {
             if (t.type === 'income') flowSinceStart += amt; else if (t.type === 'expense') flowSinceStart -= amt;
        }
        if (t.category === 'Mutasi Saldo' || t.category === 'Pindah Dana') return;

        if (tDate >= startDate && tDate <= endDate) {
            if (t.type === 'income') totalIncome += amt; else totalExpense += amt;
        }
    });

    const calculatedOpeningBalance = currentRealBalance - flowSinceStart;
    const netFlow = totalIncome - totalExpense;
    setFinancials({ income: totalIncome, expense: totalExpense, netFlow, openingBalance: calculatedOpeningBalance, endingBalance: calculatedOpeningBalance + netFlow });

    // 3. CHART GENERATION
    let chartMap = {};
    let granularity = 'Harian';
    if (activeChart === 'DAILY') {
        granularity = '7 Hari Terakhir'; const endD = new Date(endDate);
        for(let i=6;i>=0;i--){const d=new Date(endD); d.setDate(d.getDate()-i); const k=formatDateKey(d); const l=`${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]}`; chartMap[k]={name:l,income:0,expense:0,sortKey:k, fullDate:k};}
    } else if (activeChart === 'MONTHLY') {
        granularity = '1 Tahun Terakhir'; const endD = new Date(endDate);
        for(let i=11;i>=0;i--){const d=new Date(endD); d.setMonth(d.getMonth()-i); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; chartMap[k]={name:`${MONTHS_ID[d.getMonth()]}`,income:0,expense:0,sortKey:k, monthKey:k};}
    } else if (activeChart === 'WEEKLY') { granularity = 'Mingguan'; }

    filteredHeaders.forEach(t => {
        if (t.category === 'Mutasi Saldo' || t.category === 'Pindah Dana') return; 
        const amt = Number(t.total_amount); const tDate = t.date.split('T')[0]; const d = new Date(tDate);
        if (activeChart === 'DAILY' && chartMap[tDate]) {
            if(t.type==='income') chartMap[tDate].income+=amt; else chartMap[tDate].expense+=amt;
        } else if (activeChart === 'MONTHLY') {
            const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            if(chartMap[k]) { if(t.type==='income') chartMap[k].income+=amt; else chartMap[k].expense+=amt; }
        }
    });
    const trendData = Object.values(chartMap).sort((a,b)=>a.sortKey>b.sortKey?1:-1);

    // 4. PIE CHART ASSET
    const assetGroup = { 'BANK': 0, 'E-WALLET': 0, 'CASH': 0, 'LAINNYA': 0 };
    walletData.forEach(w => {
        let isIncluded = (viewMode === 'ALL') || (viewMode === 'PERSONAL' && w.allocation_type === 'PERSONAL') || (viewMode === w.allocation_type);
        if (isIncluded) {
            const type = (w.wallet_type || w.name || '').toUpperCase();
            if (type.includes('BANK') || type.includes('BCA') || type.includes('MANDIRI') || type.includes('BRI') || type.includes('BNI')) assetGroup['BANK'] += Number(w.initial_balance);
            else if (type.includes('PAY') || type.includes('DANA') || type.includes('OVO')) assetGroup['E-WALLET'] += Number(w.initial_balance);
            else if (type.includes('CASH') || type.includes('TUNAI')) assetGroup['CASH'] += Number(w.initial_balance);
            else assetGroup['LAINNYA'] += Number(w.initial_balance);
        }
    });
    const assetCompositionData = Object.keys(assetGroup).map(k => ({ name: k, value: assetGroup[k] })).filter(i => i.value > 0);

    // 5. BUDGET HEALTH (TOP 8 & TOTAL)
    const expensePerCategory = {};
    filteredHeaders.forEach(t => {
        if (t.type === 'expense' && t.date >= startDate && t.date <= endDate) {
            const catName = (t.category || '').trim(); 
            expensePerCategory[catName.toLowerCase()] = (expensePerCategory[catName.toLowerCase()] || 0) + Number(t.total_amount);
        }
    });

    const budgetHealthData = budgetsData.map(b => {
        const limit = Number(b.amount_limit) || 0; 
        const targetCategory = (b.category || '').toLowerCase().trim();
        const spent = expensePerCategory[targetCategory] || 0;
        const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
        return { category: b.category, limit, spent, percentage };
    }).sort((a,b) => b.percentage - a.percentage).slice(0, 8);

    const totalBudgetLimit = budgetsData.reduce((acc, curr) => acc + Number(curr.amount_limit), 0);
    const totalBillsAmount = billsData.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalObligations = totalBillsAmount + totalBudgetLimit; // Total Kewajiban (Budget + Bills)

    // 6. RATIO & SAVING ANALYSIS
    const fixedCostRatio = totalIncome > 0 ? Math.round((totalBillsAmount / totalIncome) * 100) : 0;
    
    // --- GOALS PROGRESS (TOTAL) ---
    let monthlySavingTarget = 0;
    let totalGoalTarget = 0;
    let totalGoalSaved = 0;
    const now = new Date();

    goalsData.forEach(g => {
        // Hitung total akumulasi
        totalGoalTarget += Number(g.target_amount);
        totalGoalSaved += Number(g.current_amount);

        // Hitung rata-rata target bulanan
        const target = Number(g.target_amount);
        const current = Number(g.current_amount);
        const remaining = Math.max(0, target - current);
        if (remaining > 0) {
            if (g.deadline) {
                const deadlineDate = new Date(g.deadline);
                const monthsLeft = (deadlineDate.getFullYear() - now.getFullYear()) * 12 + (deadlineDate.getMonth() - now.getMonth());
                const divider = Math.max(1, monthsLeft);
                monthlySavingTarget += (remaining / divider);
            } else {
                monthlySavingTarget += (remaining / 12);
            }
        }
    });

    const goalProgressPercent = totalGoalTarget > 0 ? Math.round((totalGoalSaved / totalGoalTarget) * 100) : 0;

    const potentialSaving = Math.max(0, totalIncome - totalObligations);
    let savingStatus = 'SAFE'; 
    if (monthlySavingTarget > 0) {
        if (potentialSaving >= monthlySavingTarget) savingStatus = 'SAFE';
        else if (potentialSaving > 0) savingStatus = 'WARNING'; 
        else savingStatus = 'DANGER'; 
    } else if (potentialSaving <= 0 && totalIncome > 0) {
        savingStatus = 'DANGER'; 
    }

    const savingRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

    // 7. & 8. PIE KATEGORI & TOP ITEMS
    const rangeData = filteredHeaders.filter(t => { const d = t.date.split('T')[0]; return d >= startDate && d <= endDate && t.category !== 'Mutasi Saldo' && t.category !== 'Pindah Dana'; });
    const groupByCategory = (data) => { const group = data.reduce((acc, curr) => { acc[curr.category] = (acc[curr.category] || 0) + Number(curr.total_amount); return acc; }, {}); return Object.keys(group).map(k => ({ name: k, value: group[k] })); };
    const expenseCatData = groupByCategory(rangeData.filter(t => t.type === 'expense'));
    const incomeCatData = groupByCategory(rangeData.filter(t => t.type === 'income'));

    const salesMap = {}; const bizItemMap = {}; const salaryMap = {}; const personalMap = {}; const priveMap = {};
    rawItems.forEach(item => {
        const h = item.transaction_headers;
        const hDate = h.date.split('T')[0];
        if (hDate < startDate || hDate > endDate) return;
        if (h.category === 'Mutasi Saldo' || h.category === 'Pindah Dana') return;
        let isIncluded = (viewMode === 'ALL') || (viewMode === 'PERSONAL' && ['PERSONAL', 'PRIVE'].includes(h.allocation_type)) || (['BUSINESS', 'ORGANIZATION'].includes(viewMode) && ['BUSINESS', 'ORGANIZATION', 'SALARY'].includes(h.allocation_type));
        if (isIncluded) {
            const name = (item.name || "Item").trim().replace(/\b\w/g, l => l.toUpperCase()); const amt = Number(item.price);
            if (h.type === 'income' && ['BUSINESS','ORGANIZATION'].includes(h.allocation_type)) { if (!salesMap[name]) salesMap[name] = { name, value: 0 }; salesMap[name].value += amt; }
            else if (h.type === 'expense') {
                if (['BUSINESS','ORGANIZATION'].includes(h.allocation_type)) { if (!bizItemMap[name]) bizItemMap[name] = { name, value: 0 }; bizItemMap[name].value += amt; }
                else if (h.allocation_type === 'PERSONAL') { if (!personalMap[name]) personalMap[name] = { name, value: 0 }; personalMap[name].value += amt; }
            }
        }
    });
    const getTop5 = (map) => Object.values(map).sort((a, b) => b.value - a.value).slice(0, 5);

    setChartData({
        trend: trendData, assetComposition: assetCompositionData, budgetHealth: budgetHealthData,
        fixedCostRatio, savingRate, granularity, expenseCat: expenseCatData, incomeCat: incomeCatData,
        topSales: getTop5(salesMap), topExpenseBiz: getTop5(bizItemMap), topSalary: getTop5(salaryMap), topPersonal: getTop5(personalMap), topPrive: getTop5(priveMap),
        totalBudgetLimit, totalBillsAmount, totalObligations, monthlySavingTarget, potentialSaving, savingStatus,
        totalGoalTarget, totalGoalSaved, goalProgressPercent
    });
  };

  const handleChartClick = (type, data) => {
      if (!data) return;
      let filteredTransactions = []; let title = '';
      if (type === 'TREND' && data.activeLabel) {
          const selectedData = chartData.trend.find(d => d.name === data.activeLabel);
          if (selectedData && selectedData.fullDate) {
              title = `Transaksi ${new Date(selectedData.fullDate).toLocaleDateString('id-ID', {dateStyle: 'full'})}`;
              filteredTransactions = rawHeaders.filter(h => h.date.startsWith(selectedData.fullDate) && h.category !== 'Mutasi Saldo' && isModeMatch(h.allocation_type));
          }
      } else if (type === 'CATEGORY' && data.name) {
          title = `Kategori: ${data.name}`;
          filteredTransactions = rawHeaders.filter(h => { const d = h.date.split('T')[0]; return d >= startDate && d <= endDate && h.category === data.name && isModeMatch(h.allocation_type); });
      } else if (type === 'ITEM' && data.name) {
          title = `Item: ${data.name}`;
          const relatedItems = rawItems.filter(i => { const h = i.transaction_headers; const d = h.date.split('T')[0]; const itemName = (i.name || "").trim().toLowerCase(); return d >= startDate && d <= endDate && itemName === data.name.toLowerCase() && isModeMatch(h.allocation_type) && h.category !== 'Mutasi Saldo'; });
          filteredTransactions = relatedItems.map(i => ({ ...i.transaction_headers, total_amount: i.price, merchant: i.name }));
      }
      if (filteredTransactions.length > 0) setDetailModal({ show: true, title, transactions: filteredTransactions });
  };

  const isModeMatch = (allocationType) => {
      if (viewMode === 'ALL') return true;
      if (viewMode === 'PERSONAL') return ['PERSONAL', 'PRIVE'].includes(allocationType);
      if (viewMode === 'BUSINESS' || viewMode === 'ORGANIZATION') return ['BUSINESS', 'ORGANIZATION', 'SALARY'].includes(allocationType);
      return false;
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDateShort = (dateString) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const EmptyChart = ({ msg }) => (<div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs text-center"><span className="text-xl opacity-50 mb-2">📉</span>{msg}</div>);
  const hasBusinessAccess = ['business', 'organization'].includes(accountType);

  // LOGIC STATUS KEUANGAN (Safe / Warning / Danger)
  const isSafe = financials.income >= chartData.totalObligations;
  const isWarning = financials.income < chartData.totalObligations && financials.income >= (chartData.totalObligations * 0.8);
  const isDanger = financials.income < (chartData.totalObligations * 0.8);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      
      {/* HEADER */}
      <div className="bg-blue-600 p-6 pb-12 rounded-b-[2rem] shadow-lg sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm"><ArrowLeft size={20} /></button>
            <div className="flex-1"><h1 className="text-xl font-extrabold text-white">Analisa Keuangan</h1><p className="text-xs text-blue-100 font-medium">Laporan Lengkap 360°</p></div>
        </div>
        <div className="flex gap-3 bg-white p-3 rounded-2xl shadow-md items-center">
            <Calendar size={18} className="text-blue-500 ml-1"/>
            <div className="flex-1 flex gap-2 items-center text-sm"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-transparent font-bold text-slate-700 outline-none"/><span className="text-slate-300">-</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-transparent font-bold text-slate-700 outline-none"/></div>
        </div>
      </div>

      {/* MODE TABS */}
      <div className="px-4 -mt-6 relative z-30">
        {hasBusinessAccess ? (
            <div className="bg-white p-1.5 rounded-xl shadow-md flex border border-gray-100">
                <button onClick={() => setViewMode('PERSONAL')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${viewMode === 'PERSONAL' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-400'}`}><User size={14}/> PRIBADI</button>
                <button onClick={() => setViewMode(accountType === 'organization' ? 'ORGANIZATION' : 'BUSINESS')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${['BUSINESS', 'ORGANIZATION'].includes(viewMode) ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-400'}`}><Building2 size={14}/> {accountType === 'organization' ? 'ORG' : 'BISNIS'}</button>
                <button onClick={() => setViewMode('ALL')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${viewMode === 'ALL' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-400'}`}><PieIcon size={14}/> SEMUA</button>
            </div>
        ) : (
            <div className={`bg-white p-3 rounded-xl shadow-md border border-gray-100 text-center flex items-center justify-center gap-2`}><span className={`text-xs font-bold ${accountType === 'personal_pro' ? 'text-amber-600' : 'text-slate-600'} flex items-center gap-2`}>{accountType === 'personal_pro' && <Crown size={14} fill="currentColor"/>}<User size={14}/> {accountType === 'personal_pro' ? 'Mode Personal Pro' : 'Mode Pribadi'}</span></div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 animate-pulse"><p className="text-2xl mb-2">📊</p>Menyiapkan Data...</div>
      ) : (
        <div className="p-4 space-y-6">

          {/* 1. RINGKASAN SALDO (PALING ATAS) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
             <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                 <span className="text-xs font-bold text-gray-400 uppercase">Saldo Awal</span>
                 <span className="text-sm font-bold text-gray-600">{formatIDR(financials.openingBalance)}</span>
             </div>
             <div className="grid grid-cols-2 gap-4">
                 <div className="bg-green-50 p-3 rounded-xl">
                     <div className="flex items-center gap-1 mb-1"><ArrowDownLeft size={14} className="text-green-600"/><span className="text-[10px] font-bold text-green-700 uppercase">Masuk</span></div>
                     <p className="text-sm font-bold text-slate-800">{formatIDR(financials.income)}</p>
                 </div>
                 <div className="bg-red-50 p-3 rounded-xl">
                     <div className="flex items-center gap-1 mb-1"><ArrowUpRight size={14} className="text-red-600"/><span className="text-[10px] font-bold text-red-700 uppercase">Keluar</span></div>
                     <p className="text-sm font-bold text-slate-800">{formatIDR(financials.expense)}</p>
                 </div>
             </div>
             <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                 <span className="text-xs font-bold text-blue-600 uppercase">Saldo Akhir</span>
                 <span className="text-lg font-extrabold text-blue-600">{formatIDR(financials.endingBalance)}</span>
             </div>
          </div>

          {/* 2. POTENSI NABUNG (DI BAWAH SALDO) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 relative overflow-hidden">
              <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={18} className="text-emerald-500"/> Potensi Nabung</h3>
                      <p className="text-[10px] text-slate-400 mt-1">Estimasi sisa uang setelah kebutuhan</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${chartData.savingStatus === 'SAFE' ? 'bg-emerald-100 text-emerald-700' : chartData.savingStatus === 'WARNING' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                      {chartData.savingStatus === 'SAFE' ? 'BISA TERCAPAI' : chartData.savingStatus === 'WARNING' ? 'PERLU HEMAT' : 'SULIT TERCAPAI'}
                  </div>
              </div>

              <div className="flex items-center gap-4 relative z-10">
                  <div className="flex-1 text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Target / Bulan</p>
                      <p className="text-sm font-bold text-slate-700">{formatIDR(chartData.monthlySavingTarget)}</p>
                  </div>
                  <div className="flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-300">VS</span>
                  </div>
                  <div className="flex-1 text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Potensi Sisa</p>
                      <p className={`text-sm font-bold ${chartData.potentialSaving >= chartData.monthlySavingTarget ? 'text-emerald-600' : 'text-red-500'}`}>{formatIDR(chartData.potentialSaving)}</p>
                  </div>
              </div>
              
              <div className={`mt-3 text-[10px] p-2 rounded-lg font-medium flex items-start gap-2 ${chartData.savingStatus === 'SAFE' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                  <Info size={14} className="shrink-0 mt-0.5"/>
                  {chartData.savingStatus === 'SAFE' 
                    ? "Aman! Income kamu cukup untuk menutup Budget, Tagihan, dan Target Nabung." 
                    : "Waspada! Rencana pengeluaranmu (Budget + Tagihan) terlalu besar, sulit mencapai target nabung."}
              </div>
          </div>

          {/* 3. GRID PROGRESS NABUNG & BEBAN TAGIHAN (NEW LAYOUT) */}
          <div className="grid grid-cols-2 gap-3">
              {/* Progress Nabung (Kiri) */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-2"><PiggyBank size={16} className="text-emerald-500"/><span className="text-xs font-bold text-slate-500">Progress Nabung</span></div>
                  <div className="flex flex-col">
                      <span className="text-lg font-extrabold text-slate-800">{formatIDR(chartData.totalGoalSaved)}</span>
                      <span className="text-[9px] text-slate-400 mb-2">dari target {formatIDR(chartData.totalGoalTarget)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-auto"><div className="h-1.5 rounded-full bg-emerald-500" style={{width: `${Math.min(100, chartData.goalProgressPercent)}%`}}></div></div>
                  <span className="text-[9px] text-emerald-600 font-bold mt-1 block text-right">{chartData.goalProgressPercent}% Terkumpul</span>
              </div>

              {/* Beban Tagihan (Kanan) */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-2"><Landmark size={16} className="text-purple-500"/><span className="text-xs font-bold text-slate-500">Beban Tagihan</span></div>
                  <div className="flex items-end gap-1"><span className="text-2xl font-extrabold text-slate-800">{chartData.fixedCostRatio}%</span><span className="text-[10px] text-slate-400 mb-1">dari Income</span></div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2"><div className={`h-1.5 rounded-full ${chartData.fixedCostRatio > 50 ? 'bg-red-500' : 'bg-purple-500'}`} style={{width: `${Math.min(100, chartData.fixedCostRatio)}%`}}></div></div>
                  {chartData.fixedCostRatio > 50 && <span className="text-[9px] text-red-500 font-bold flex items-center gap-1 mt-1"><AlertTriangle size={10}/> Waspada!</span>}
              </div>
          </div>

          {/* 4. KOMPOSISI ASET */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
             <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Wallet size={18} className="text-blue-500"/> Komposisi Aset</h3>
             <div className="h-[200px] w-full">
                {chartData.assetComposition.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={chartData.assetComposition} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
                                {chartData.assetComposition.map((entry, index) => (<Cell key={`cell-${index}`} fill={ASSET_COLORS[entry.name] || COLORS[index % COLORS.length]} />))}
                            </Pie>
                            <Tooltip formatter={(val) => formatIDR(val)} />
                            <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize:'10px'}}/>
                        </PieChart>
                    </ResponsiveContainer>
                ) : <EmptyChart msg="Belum ada aset terdaftar" />}
             </div>
          </div>

          {/* 5. BUDGET HEALTH (TOP 8 & TOTAL SUMMARY) - FIXED RENDER CONDITION */}
          {(chartData.totalObligations > 0) && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Target size={18} className="text-rose-500"/> Kesehatan Budget & Tagihan</h3>
                  
                  {/* TOTAL SUMMARY CARD */}
                  <div className={`p-4 rounded-xl mb-6 flex flex-col gap-2 border ${isSafe ? 'bg-green-50 border-green-100' : isWarning ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider opacity-70">
                          <span>Total Rencana (Budget+Tagihan)</span>
                          <span>Total Pemasukan</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold">
                          <div className="flex flex-col">
                              <span>{formatIDR(chartData.totalObligations)}</span>
                              <span className="text-[9px] text-slate-400 font-medium">(Budget: {formatIDR(chartData.totalBudgetLimit)} + Bill: {formatIDR(chartData.totalBillsAmount)})</span>
                          </div>
                          <span className={isSafe ? 'text-green-700' : isWarning ? 'text-orange-700' : 'text-red-700'}>{formatIDR(financials.income)}</span>
                      </div>
                      <div className="h-px w-full bg-current opacity-10 my-1"></div>
                      <p className={`text-xs font-bold flex items-center gap-2 ${isSafe ? 'text-green-600' : isWarning ? 'text-orange-600' : 'text-red-600'}`}>
                          {isSafe ? <CheckCircle2 size={14}/> : isWarning ? <AlertTriangle size={14}/> : <AlertCircle size={14}/>}
                          {isSafe 
                            ? "Aman! Pemasukan > Rencana Belanja & Tagihan." 
                            : isWarning 
                                ? "Waspada! Rencana pengeluaran mepet dengan Income."
                                : "BAHAYA! Rencana pengeluaran MELEBIHI Pemasukan (Besar Pasak)."}
                      </p>
                  </div>

                  {chartData.budgetHealth.length > 0 ? (
                      <div className="space-y-4">
                          {chartData.budgetHealth.map((b, idx) => (
                              <div key={idx}>
                                  <div className="flex justify-between text-xs mb-1">
                                      <span className="font-bold text-slate-700">{b.category}</span>
                                      <span className={`${b.percentage > 100 ? 'text-red-500 font-extrabold' : 'text-slate-500'}`}>{b.percentage}%</span>
                              </div>
                                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${b.percentage > 100 ? 'bg-red-500' : b.percentage > 80 ? 'bg-orange-400' : 'bg-green-500'}`} style={{width: `${Math.min(100, b.percentage)}%`}}></div>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1 text-right">Terpakai {formatIDR(b.spent)} / {formatIDR(b.limit)}</p>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="text-center py-4 text-xs text-gray-400 italic">
                          <p>Hanya ada data Tagihan ({formatIDR(chartData.totalBillsAmount)}).</p>
                          <p>Belum ada budget kategori yang diatur.</p>
                      </div>
                  )}
              </div>
          )}
          
          {/* 6. GRAFIK TREND */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">📈 Tren Arus Kas</h3>
                <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                    <button onClick={() => setActiveChart('DAILY')} className={`px-2 py-1 rounded-md text-[10px] font-bold ${activeChart === 'DAILY' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Harian</button>
                    <button onClick={() => setActiveChart('MONTHLY')} className={`px-2 py-1 rounded-md text-[10px] font-bold ${activeChart === 'MONTHLY' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Bulan</button>
                </div>
            </div>
            <div className="h-[220px] w-full">
              {chartData.trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.trend} onClick={(e) => handleChartClick('TREND', e)} cursor="pointer">
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2}/><stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{fontSize: 10, fill: '#9ca3af', angle: -45, textAnchor: 'end'}} height={60} axisLine={false} tickLine={false} interval={0} />
                      <Tooltip formatter={(val) => formatIDR(val)} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Area type="monotone" dataKey="income" name="Masuk" stroke="#10B981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                      <Area type="monotone" dataKey="expense" name="Keluar" stroke="#F43F5E" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
              ) : <EmptyChart msg="Belum ada data grafik" />}
            </div>
          </div>

          {/* 7. PIE CHART KATEGORI */}
          <div className="flex flex-col gap-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 text-center">Kategori Pengeluaran 💸</h3>
                <div className="h-[200px] w-full">
                  {chartData.expenseCat.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData.expenseCat} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" onClick={(e) => handleChartClick('CATEGORY', e)} cursor="pointer">
                            {chartData.expenseCat.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                          </Pie>
                          <Tooltip formatter={(val) => formatIDR(val)} />
                          <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '10px'}}/>
                        </PieChart>
                      </ResponsiveContainer>
                  ) : <EmptyChart msg="Belum ada pengeluaran" />}
                </div>
              </div>
              {chartData.incomeCat.length > 0 && (
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 text-center">Sumber Pemasukan 💰</h3>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                            <Pie data={chartData.incomeCat} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" onClick={(e) => handleChartClick('CATEGORY', e)} cursor="pointer">
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

          {/* 8. DETAIL ITEM */}
          {(['BUSINESS', 'ORGANIZATION', 'ALL'].includes(viewMode)) && (
             <>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-emerald-500">
                    <h3 className="font-bold text-gray-800 mb-1">🏆 Produk Terlaris</h3>
                    <div className="h-[200px] w-full mt-4">
                        {chartData.topSales.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={chartData.topSales} margin={{left: 0, right: 20}}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                    <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#ecfdf5'}} />
                                    <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} barSize={16} onClick={(e) => handleChartClick('ITEM', e)} cursor="pointer" />
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
                                    <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={16} onClick={(e) => handleChartClick('ITEM', e)} cursor="pointer" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyChart msg="Belum ada belanja bisnis" />}
                    </div>
                </div>
             </>
          )}

          {(['PERSONAL', 'ALL'].includes(viewMode)) && (
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-pink-500">
                <h3 className="font-bold text-gray-800 mb-1">🛍️ Belanja Pribadi</h3>
                <div className="h-[200px] w-full mt-4">
                    {chartData.topPersonal.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={chartData.topPersonal} margin={{left: 0, right: 20}}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                <Tooltip formatter={(val) => formatIDR(val)} cursor={{fill: '#fdf2f8'}} />
                                <Bar dataKey="value" fill="#EC4899" radius={[0, 4, 4, 0]} barSize={16} onClick={(e) => handleChartClick('ITEM', e)} cursor="pointer" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart msg="Hemat pangkal kaya!" />}
                </div>
             </div>
          )}

        </div>
      )}

      {/* MODAL DETAIL */}
      <AnimatePresence>
        {detailModal.show && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setDetailModal({ ...detailModal, show: false })}>
                <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                        <div><h3 className="font-bold text-gray-800 text-lg leading-tight">{detailModal.title}</h3><p className="text-xs text-gray-500 mt-1">{detailModal.transactions.length} Transaksi ditemukan</p></div>
                        <button onClick={() => setDetailModal({ ...detailModal, show: false })} className="p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {detailModal.transactions.length > 0 ? (
                            detailModal.transactions.map((t, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-white border border-gray-50 rounded-xl hover:bg-gray-50 transition shadow-sm">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`p-2.5 rounded-lg ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{t.type === 'income' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</div>
                                        <div className="overflow-hidden"><p className="text-sm font-bold text-gray-800 truncate">{t.merchant || t.name || 'Transaksi'}</p><p className="text-xs text-gray-400 flex items-center gap-1">{new Date(t.date).toLocaleDateString('id-ID', {day:'numeric',month:'short'})} • <span className="bg-gray-100 px-1 rounded text-[10px]">{t.category}</span></p></div>
                                    </div>
                                    <span className={`text-sm font-bold whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-gray-800'}`}>{t.type === 'income' ? '+' : '-'} {formatIDR(t.total_amount)}</span>
                                </div>
                            ))
                        ) : (<div className="text-center py-10 text-gray-400"><Search size={40} className="mx-auto mb-2 opacity-20"/><p className="text-sm">Tidak ada detail transaksi.</p></div>)}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}