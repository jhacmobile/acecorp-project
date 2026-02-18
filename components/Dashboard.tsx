import React, { useState, useMemo, useEffect } from 'react';
import { Order, Product, OrderStatus, Store, Stock, User, PaymentMethod, ReceivablePayment, AccountsReceivable } from '../types';
import CustomDatePicker from './CustomDatePicker';
import AceCorpLogo from './AceCorpLogo';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend 
} from 'recharts';

interface DashboardProps {
  user: User | null;
  orders: Order[];
  products: Product[];
  stocks: Stock[];
  stores: Store[];
  selectedStoreId: string;
  receivables: AccountsReceivable[];
  receivablePayments: ReceivablePayment[];
  logoUrl?: string;
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

const Dashboard: React.FC<DashboardProps> = ({ user, orders, products, stocks, stores, selectedStoreId, receivables, receivablePayments, logoUrl }) => {
  const getPHDateString = (date: Date = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  const toPHDateString = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString.split('T')[0];
      return getPHDateString(d);
    } catch (e) {
      return isoString?.split('T')[0] || '';
    }
  };

  const todayString = getPHDateString();
  const [registryDate, setRegistryDate] = useState(todayString);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'ALL'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderReceipt, setShowOrderReceipt] = useState(false);
  const [printCopyType, setPrintCopyType] = useState<'CUSTOMER' | 'GATE' | 'STORE' | 'ALL'>('ALL');
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const activeStore = stores.find(s => String(s.id) === String(selectedStoreId));
  const formatCurrency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filteredOrders = useMemo(() => {
    const anchor = new Date(registryDate);
    let base = orders.filter(o => String(o.storeId) === String(selectedStoreId));

    if (statusFilter !== 'ALL') base = base.filter(o => o.status === statusFilter);
    if (paymentFilter !== 'ALL') base = base.filter(o => o.paymentMethod === paymentFilter);

    if (reportPeriod === 'daily') {
      base = base.filter(o => toPHDateString(o.createdAt) === registryDate);
    } else if (reportPeriod === 'weekly') {
      const start = new Date(anchor);
      start.setDate(anchor.getDate() - anchor.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      base = base.filter(o => {
        const d = new Date(o.createdAt);
        return d >= start && d <= end;
      });
    } else if (reportPeriod === 'monthly') {
      const year = anchor.getFullYear();
      const month = anchor.getMonth();
      base = base.filter(o => {
        const d = new Date(o.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }
    return base.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, selectedStoreId, registryDate, reportPeriod, statusFilter, paymentFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStoreId, registryDate, reportPeriod, statusFilter, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
  const paginatedOrders = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage, totalPages]);

  const arCollectionsList = useMemo(() => {
    const payments = receivablePayments.filter(rp => {
      const pDate = toPHDateString(rp.paidAt);
      if (reportPeriod === 'daily') return pDate === registryDate;
      const d = new Date(rp.paidAt);
      const anchor = new Date(registryDate);
      if (reportPeriod === 'weekly') {
          const start = new Date(anchor);
          start.setDate(anchor.getDate() - anchor.getDay());
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          return d >= start && d <= end;
      }
      if (reportPeriod === 'monthly') return d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear();
      return false;
    });

    return payments.map(rp => {
       const ar = receivables.find(a => a.id === rp.receivableId);
       const order = orders.find(o => o.id === ar?.orderId);
       return { payment: rp, order, ar };
    }).filter(item => !!item.order && String(item.order.storeId) === String(selectedStoreId));
  }, [receivablePayments, receivables, orders, registryDate, reportPeriod, selectedStoreId]);

  const stats = useMemo(() => {
    const revenueOrders = filteredOrders.filter(o => o.status === OrderStatus.ORDERED);
    const totalSales = revenueOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const orderCount = filteredOrders.length;
    const newARGenerated = filteredOrders.filter(o => o.status === OrderStatus.RECEIVABLE).reduce((sum, o) => sum + o.totalAmount, 0);
    const arCollectionsTotal = arCollectionsList.reduce((sum, item) => sum + item.payment.amount, 0);
    
    const paymentBreakdown: Record<PaymentMethod, number> = { 'CASH': 0, 'GCASH': 0, 'MAYA': 0, 'BANK': 0, 'OTHER': 0 };
    revenueOrders.forEach(o => {
      const method = (o.paymentMethod || 'CASH') as PaymentMethod;
      if (paymentBreakdown[method] !== undefined) paymentBreakdown[method] += o.totalAmount;
    });
    arCollectionsList.forEach(item => {
        const method = (item.payment.paymentMethod || 'CASH') as PaymentMethod;
        if (paymentBreakdown[method] !== undefined) paymentBreakdown[method] += item.payment.amount;
    });
    return { totalSales, orderCount, paymentBreakdown, newARGenerated, arCollectionsTotal };
  }, [filteredOrders, arCollectionsList]);

  const charts = useMemo(() => {
    let velocityData: { name: string; value: number }[] = [];
    if (reportPeriod === 'daily') {
      const hours = Array.from({ length: 24 }, (_, i) => i);
      velocityData = hours.map(h => ({
        name: `${h}:00`,
        value: filteredOrders
          .filter(o => o.status === OrderStatus.ORDERED && new Date(o.createdAt).getHours() === h)
          .reduce((sum, o) => sum + o.totalAmount, 0)
      }));
    } else {
      const days = Array.from(new Set<string>(filteredOrders.map(o => toPHDateString(o.createdAt)))).sort();
      velocityData = days.map(d => ({
        name: String(d).split('-').slice(1).join('/'),
        value: filteredOrders
          .filter(o => o.status === OrderStatus.ORDERED && toPHDateString(o.createdAt) === d)
          .reduce((sum, o) => sum + o.totalAmount, 0)
      }));
    }
    const pieData = Object.entries(stats.paymentBreakdown)
      .filter(([_, value]) => (value as number) > 0)
      .map(([name, value]) => ({ name, value: value as number }));
    const storeStocks = stocks
      .filter(s => String(s.storeId) === String(selectedStoreId))
      .map(s => {
        const matchedProduct = products.find(p => String(p.id) === String(s.productId));
        return { name: (matchedProduct ? matchedProduct.name : 'SKU').split(',')[0], qty: Number(s.quantity) };
      })
      .sort((a, b) => b.qty - a.qty).slice(0, 8);
    return { velocityData, pieData, storeStocks };
  }, [filteredOrders, reportPeriod, stats.paymentBreakdown, stocks, selectedStoreId, products]);

  const generateReceiptPart = (order: Order, label: string) => {
    const store = stores.find(s => s.id === order.storeId);
    return (
       <div className="receipt-copy font-mono text-black text-center text-[10px] w-[68mm] mx-auto pt-2 pb-12">
          <div className="w-48 h-auto max-h-32 mx-auto mb-0 overflow-hidden flex items-center justify-center"><AceCorpLogo customUrl={logoUrl} className="w-full h-auto" /></div>
          <div className="border border-black px-4 py-1 inline-block mb-1"><h3 className="text-[12px] font-black uppercase tracking-widest">{label}</h3></div>
          <h4 className="text-sm font-black uppercase italic leading-none mb-1 text-black">{store?.name || 'ACECORP'}</h4>
          <p className="text-[10px] uppercase font-bold leading-tight text-black">{store?.address || ''}</p>
          <p className="text-[10px] uppercase font-bold text-black">{store?.mobile || ''}</p>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="text-left font-bold space-y-1 uppercase text-[10px] text-black">
             <div className="flex justify-between"><span>Ref:</span> <span>{order.id.slice(-8)}</span></div>
             <div className="flex justify-between"><span>Date:</span> <span>{new Date(order.createdAt).toLocaleDateString()}</span></div>
             <div className="flex justify-between"><span>Operator:</span> <span>{order.createdBy}</span></div>
             <div className="pt-1"><p className="font-black text-[11px] uppercase italic text-black">{order.customerName}</p><p className="text-black">{order.address}</p></div>
          </div>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="space-y-2 mb-4">
             {order.items.map((item, idx) => (
                <div key={idx}><div className="flex justify-between font-black uppercase italic text-[10px] text-black"><span>{item.productName} (x{item.qty})</span><span>₱{formatCurrency(item.total).replace('₱','')}</span></div></div>
             ))}
          </div>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="flex justify-between font-bold uppercase mb-1 text-[10px] text-black"><span>Method:</span> <span>{order.paymentMethod}</span></div>
          <div className="flex justify-between text-[14px] font-black italic uppercase text-black"><span>TOTAL:</span> <span>₱{formatCurrency(order.totalAmount).replace('₱','')}</span></div>
          <div className="mt-6 pt-2 border-t border-black border-dashed text-center text-black space-y-2">
              <p className="font-black uppercase text-[10px]">Thank you for choosing AceCorp!</p>
              <div className="pt-6 pb-2">
                  <p className="text-[10px] text-left border-b border-black inline-block w-full text-white">_</p>
                  <p className="text-[9px] text-center font-black uppercase mt-1">CUSTOMER SIGNATURE</p>
              </div>
          </div>
       </div>
    );
  };

  const handlePrintRequest = async (type: 'CUSTOMER' | 'GATE' | 'STORE' | 'ALL') => {
    if (type === 'ALL') {
      const sequence: ('CUSTOMER' | 'GATE' | 'STORE')[] = ['CUSTOMER', 'GATE', 'STORE'];
      for (const copy of sequence) {
         setPrintCopyType(copy);
         await new Promise(r => setTimeout(r, 300));
         window.print();
      }
      setPrintCopyType('ALL');
    } else {
      setPrintCopyType(type);
      setTimeout(() => { window.print(); }, 150);
    }
  };

  const COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans text-slate-900">
      <style>{`
        @media print {
          @page { size: portrait; margin: 15mm; }
          html, body { height: auto !important; overflow: visible !important; background: white !important; color: black !important; font-family: 'Inter', sans-serif; margin: 0 !important; padding: 0 !important; }
          #root, main, .flex-1, .h-screen, .overflow-hidden, .custom-scrollbar { height: auto !important; overflow: visible !important; display: block !important; min-height: 0 !important; position: static !important; }
          .no-print, header, aside, .pagination-controls, button { display: none !important; }
          #dashboard-all-orders-print-root { display: block !important; visibility: visible !important; width: 100% !important; position: relative !important; top: 0 !important; left: 0 !important; padding: 0 !important; }
          #dashboard-all-orders-print-root table { width: 100% !important; border-collapse: collapse !important; table-layout: auto !important; display: table !important; }
          #dashboard-all-orders-print-root thead { display: table-header-group !important; }
          #dashboard-all-orders-print-root tr { page-break-inside: avoid !important; display: table-row !important; }
          #dashboard-all-orders-print-root td, #dashboard-all-orders-print-root th { border-bottom: 1px solid #ddd !important; padding: 8px !important; }
          #dashboard-thermal-print-root { display: none !important; }
        }
      `}</style>
      
      <div id="dashboard-all-orders-print-root" className="hidden">
         <div className="text-center mb-10 border-b-4 border-slate-900 pb-6">
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">{activeStore?.name || 'ACECORP'}</h1>
            <h2 className="text-sm font-bold uppercase tracking-[0.4em] text-slate-500 mt-2">Registry Activity Manifest • System Extract</h2>
            <div className="flex justify-center gap-10 mt-4 text-[10px] font-black uppercase">
               <p>Interval: {reportPeriod.toUpperCase()} ({registryDate})</p>
               <p>Auth Operator: {user?.username || 'SYSTEM'}</p>
            </div>
         </div>
         <table className="w-full text-left">
            <thead>
               <tr className="bg-slate-50 text-[10px] font-black uppercase">
                  <th className="py-4 px-2">Timestamp</th>
                  <th className="py-4 px-2">Ticket #</th>
                  <th className="py-4 px-2">Entity Profile</th>
                  <th className="py-4 px-2">Operator (Op)</th>
                  <th className="py-4 px-2 text-center">Status</th>
                  <th className="py-4 px-2 text-right">Settlement</th>
               </tr>
            </thead>
            <tbody className="text-[10px] font-medium uppercase">
               {filteredOrders.map(o => (
                  <tr key={o.id} className="border-b border-slate-200">
                     <td className="py-3 px-2 font-mono">{toPHDateString(o.createdAt)} {new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                     <td className="py-3 px-2">#{o.id.slice(-8)}</td>
                     <td className="py-3 px-2 font-black italic">{o.customerName}</td>
                     <td className="py-3 px-2 text-sky-600 font-bold">{o.createdBy}</td>
                     <td className="py-3 px-2 text-center">{o.status}</td>
                     <td className="py-3 px-2 text-right font-black">{formatCurrency(o.totalAmount)}</td>
                  </tr>
               ))}
            </tbody>
         </table>
         <div className="mt-12 pt-6 border-t-2 border-slate-300 flex justify-between items-baseline">
            <div className="text-[11px] font-black uppercase">
               <p className="text-slate-500 mb-1">AGGREGATE AUDIT FOOTER</p>
               <p className="text-lg">Aggregate Cash Inflow: {formatCurrency(stats.totalSales + stats.arCollectionsTotal)}</p>
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase">Registry Lock: {new Date().toLocaleString()}</p>
         </div>
      </div>

      {/* INTELLIGENCE HUB SUMMARY (SCREENSHOT ACCURATE) */}
      <div className="px-8 py-6 bg-slate-800 text-white flex flex-wrap items-center justify-between shadow-2xl relative overflow-hidden shrink-0 gap-4 sm:gap-0 no-print">
         <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-12 relative z-10 w-full sm:w-auto">
            <div className="shrink-0 border-l-[6px] border-sky-500 pl-8">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 leading-none">Net Actual Cash Inflow</p>
               <h2 className="text-[32px] font-black italic tracking-tighter text-white leading-none">
                 {formatCurrency(stats.totalSales + stats.arCollectionsTotal)}
               </h2>
            </div>
            <div className="flex flex-wrap gap-8 items-center border-l border-white/10 pl-10">
               <div className="shrink-0">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">Total Booked Revenue</p>
                  <p className="text-xl font-black italic tracking-tight text-slate-300 leading-none">{formatCurrency(stats.totalSales + stats.newARGenerated)}</p>
               </div>
               <div className="shrink-0">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">New AR Generated</p>
                  <p className="text-xl font-black italic tracking-tight text-orange-400 leading-none">{formatCurrency(stats.newARGenerated)}</p>
               </div>
               <div className="shrink-0">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">AR Collections</p>
                  <p className="text-xl font-black italic tracking-tight text-[#10b981] leading-none">{formatCurrency(stats.arCollectionsTotal)}</p>
               </div>
               <div className="h-10 w-px bg-white/10 mx-2 hidden xl:block"></div>
               <div className="flex gap-8">
                  {Object.entries(stats.paymentBreakdown).filter(([k,v]) => ['CASH', 'GCASH', 'MAYA'].includes(k)).map(([method, amount]) => (
                    <div key={method} className="shrink-0">
                       <p className="text-[7px] font-black text-slate-500 uppercase mb-1 leading-none">{method}</p>
                       <p className="text-lg font-black italic text-slate-400 leading-none">{formatCurrency(amount as number)}</p>
                    </div>
                  ))}
               </div>
            </div>
         </div>
         <div className="relative z-10 text-right shrink-0 ml-auto sm:ml-0 flex flex-col items-end">
            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Manifest</p>
            <div className="bg-slate-400 w-12 h-12 rounded-full flex items-center justify-center shadow-inner border border-white/10">
                <p className="text-2xl font-black italic text-slate-900 leading-none">{stats.orderCount}</p>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 flex flex-col gap-10 no-print">
         <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 shrink-0">
            <div>
               <h1 className="text-2xl sm:text-[28px] font-black italic uppercase tracking-tighter text-slate-900 leading-none">Intelligence Hub</h1>
               <p className="text-[9px] font-black text-sky-600 uppercase tracking-widest mt-1">Real-time Performance Metrics</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-2 rounded-[24px] shadow-sm border border-slate-100">
               <CustomDatePicker value={registryDate} onChange={setRegistryDate} className="w-full sm:w-48" />
               <div className="flex p-1 bg-slate-50 rounded-xl">
                  {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map(p => (
                  <button key={p} onClick={() => setReportPeriod(p)} className={`flex-1 sm:px-4 py-2 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all ${reportPeriod === p ? 'bg-slate-400 text-white shadow-md' : 'text-slate-400'}`}>{p}</button>
                  ))}
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col h-[400px]">
               <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-8">Settlement Distribution</h3>
               <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={charts.pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                           {charts.pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius:'16px', border:'none', fontWeight:'900', fontSize:'11px'}} />
                        <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{fontSize:'9px', fontWeight:'bold', textTransform:'uppercase', paddingTop: '20px'}} />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col h-[400px]">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Revenue Velocity</h3>
                  <span className="text-[8px] font-bold text-sky-500 px-3 py-1 bg-sky-50 rounded-full uppercase italic">Live Tracking</span>
               </div>
               <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.velocityData}>
                        <defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 800}} interval={2} />
                        <YAxis hide />
                        <Tooltip contentStyle={{borderRadius:'16px', border:'none', fontWeight:'900'}} formatter={(val: number) => [formatCurrency(val), 'Revenue']} />
                        <Area type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col h-[400px]">
               <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-8">Physical Assets</h3>
               <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.storeStocks} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#64748b', fontWeight: 800}} width={75} />
                        <Tooltip contentStyle={{borderRadius:'12px', border:'none'}} cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="qty" fill="#0ea5e9" radius={[0, 10, 10, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
               <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-center mt-2">Top 8 Active SKUs</p>
            </div>
         </div>

         {/* PROFESSIONAL REGISTRY MANIFEST TABLE */}
         <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
            <div className="px-10 py-8 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 gap-6">
               <div className="flex items-center gap-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry Manifest Ledger</span>
                  {/* FUNCTIONAL PAGINATION PILL FROM SCREENSHOT */}
                  <div className="flex items-center bg-sky-50 border-2 border-sky-200 rounded-full px-4 py-1.5 shadow-sm">
                     <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="text-sky-600 hover:text-sky-800 disabled:opacity-30 p-1"
                     >
                        <i className="fas fa-chevron-left text-[10px]"></i>
                     </button>
                     <span className="mx-4 text-[10px] font-black text-sky-600 uppercase tracking-widest">
                        TURN {currentPage} OF {totalPages}
                     </span>
                     <button 
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="text-sky-600 hover:text-sky-800 disabled:opacity-30 p-1"
                     >
                        <i className="fas fa-chevron-right text-[10px]"></i>
                     </button>
                  </div>
               </div>
               <button onClick={() => window.print()} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95"><i className="fas fa-print"></i> Generate Full Registry</button>
            </div>
            <div className="flex-1 overflow-x-auto custom-scrollbar">
               <table className="w-full text-left min-w-[1000px]">
                  <thead className="bg-slate-50 text-[10px] text-slate-300 font-black uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-10 py-6">Timestamp</th>
                      <th className="px-4 py-6 text-sky-400">Ticket #</th>
                      <th className="px-10 py-6">Personnel / Reference</th>
                      <th className="px-6 py-6">Operator (Op)</th>
                      <th className="px-6 py-6 text-center">Status</th>
                      <th className="px-10 py-6 text-right">Settlement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedOrders.length === 0 ? (
                      <tr><td colSpan={6} className="px-10 py-32 text-center text-slate-300 font-black uppercase italic tracking-[0.4em] opacity-40">Empty registry mirror in this window</td></tr>
                    ) : (
                      paginatedOrders.map(o => (
                        <tr key={o.id} onClick={() => { setSelectedOrder(o); setShowOrderReceipt(false); setPrintCopyType('ALL'); }} className="hover:bg-sky-50/50 cursor-pointer transition-colors group">
                           <td className="px-10 py-6">
                              <span className="text-[11px] font-bold text-slate-400 leading-none">{new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                           </td>
                           <td className="px-4 py-6"><span className="font-mono font-black text-[10px] text-sky-400 bg-sky-50 px-2 py-1 rounded-md">#{o.id.slice(-8)}</span></td>
                           <td className="px-10 py-6"><p className="text-[12px] font-black uppercase italic text-slate-500 leading-none truncate max-w-[200px]">{o.customerName}</p></td>
                           <td className="px-6 py-6"><p className="text-[11px] font-black uppercase italic text-sky-400">{o.createdBy || 'SYSTEM'}</p></td>
                           <td className="px-6 py-5 text-center">
                                 <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${o.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-400 border-emerald-100' : o.status === OrderStatus.RECEIVABLE ? 'bg-orange-50 text-orange-400 border-orange-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>{o.status}</span>
                           </td>
                           <td className="px-10 py-6 text-right font-black italic text-slate-400 text-base">{formatCurrency(o.totalAmount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
      {selectedOrder && (
         <div className="fixed inset-0 z-[4000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300 no-print" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white w-full max-w-[500px] rounded-[56px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
               <div className="p-8 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                     <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">{showOrderReceipt ? 'Reprint Mirror' : 'Manifest Detail'}</h3>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-3xl"></i></button>
               </div>
               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/20">
                  {showOrderReceipt ? (
                     <div className="bg-white p-8 shadow-xl border border-slate-200 mx-auto w-full max-w-[320px] text-black">
                        {generateReceiptPart(selectedOrder, 'REPRINT COPY')}
                     </div>
                  ) : (
                    <div className="space-y-8 text-slate-800">
                        <div className="p-8 bg-white rounded-[32px] border border-slate-100 space-y-4 shadow-sm">
                           <div className="flex justify-between items-start">
                              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel Profile</label><p className="text-[16px] font-black text-slate-950 uppercase italic leading-tight mt-1">{selectedOrder.customerName}</p></div>
                              <div className="text-right">
                                 <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Operator (Op)</label><p className="text-[12px] font-black text-sky-600 uppercase italic mt-1">{selectedOrder.createdBy}</p></div>
                              </div>
                           </div>
                           <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                              <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Settlement Method</label><p className="text-[13px] font-black text-emerald-600 uppercase italic">{selectedOrder.paymentMethod}</p></div>
                              <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border ${selectedOrder.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-400 border-emerald-100' : selectedOrder.status === OrderStatus.RECEIVABLE ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-400'}`}>{selectedOrder.status}</span>
                           </div>
                        </div>
                        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden font-bold">
                           <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[9px] font-black text-slate-400 uppercase"><th className="px-8 py-4">Registry Asset</th><th className="px-8 py-4 text-right">Value</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{selectedOrder.items.map((item, idx) => (<tr key={idx}><td className="px-8 py-5 font-black uppercase italic text-slate-800 text-[12px]">{item.productName} (x{item.qty})</td><td className="px-8 py-5 text-right font-black italic text-slate-950 text-[12px]">{formatCurrency(item.total)}</td></tr>))}</tbody>
                           </table>
                        </div>
                        <div className="p-8 bg-slate-950 rounded-[40px] flex justify-between items-center text-white shadow-2xl mt-4"><span className="text-[10px] font-black uppercase tracking-[0.2em] italic opacity-50">Net Total</span><span className="text-3xl font-black italic">{formatCurrency(selectedOrder.totalAmount)}</span></div>
                    </div>
                  )}
               </div>
               <div className="p-10 border-t bg-white flex flex-col gap-4 shrink-0">
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => { setShowOrderReceipt(!showOrderReceipt); }} className="py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all">{showOrderReceipt ? 'View Registry' : 'View Thermal Copy'}</button>
                    <button onClick={() => handlePrintRequest('ALL')} className="py-5 bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 hover:bg-sky-700 active:scale-95 transition-all"><i className="fas fa-print"></i> Authorize Reprint</button>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] active:scale-95">Dismiss detailed view</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Dashboard;