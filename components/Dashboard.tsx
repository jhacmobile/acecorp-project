
import React, { useState, useMemo } from 'react';
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

  const activeStore = stores.find(s => String(s.id) === String(selectedStoreId));
  const formatCurrency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filteredOrders = useMemo(() => {
    const anchor = new Date(registryDate);
    let base = orders.filter(o => String(o.storeId) === String(selectedStoreId));

    if (statusFilter !== 'ALL') {
      base = base.filter(o => o.status === statusFilter);
    }

    if (paymentFilter !== 'ALL') {
      base = base.filter(o => o.paymentMethod === paymentFilter);
    }

    if (reportPeriod === 'daily') {
      return base.filter(o => toPHDateString(o.createdAt) === registryDate);
    } 
    
    if (reportPeriod === 'weekly') {
      const start = new Date(anchor);
      start.setDate(anchor.getDate() - anchor.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return base.filter(o => {
        const d = new Date(o.createdAt);
        return d >= start && d <= end;
      });
    }

    if (reportPeriod === 'monthly') {
      const year = anchor.getFullYear();
      const month = anchor.getMonth();
      return base.filter(o => {
        const d = new Date(o.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }

    return [];
  }, [orders, selectedStoreId, registryDate, reportPeriod, statusFilter, paymentFilter]);

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
    
    const paymentBreakdown: Record<PaymentMethod, number> = {
      'CASH': 0, 'GCASH': 0, 'MAYA': 0, 'BANK': 0, 'OTHER': 0
    };

    revenueOrders.forEach(o => {
      const method = (o.paymentMethod || 'CASH') as PaymentMethod;
      if (paymentBreakdown[method] !== undefined) paymentBreakdown[method] += o.totalAmount;
      else paymentBreakdown['OTHER'] += o.totalAmount;
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
        const productName = matchedProduct ? matchedProduct.name : 'SKU';
        return {
          name: productName.split(',')[0],
          qty: Number(s.quantity)
        };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    return { velocityData, pieData, storeStocks };
  }, [filteredOrders, reportPeriod, stats.paymentBreakdown, stocks, selectedStoreId, products]);

  const generateReceiptPart = (order: Order, label: string) => {
    const store = stores.find(s => s.id === order.storeId);
    return (
       <div className="receipt-copy font-mono text-black text-center text-[10px] w-[68mm] mx-auto pt-2 pb-12">
          <div className="w-48 h-auto max-h-32 mx-auto mb-0 overflow-hidden flex items-center justify-center">
             <AceCorpLogo customUrl={logoUrl} className="w-full h-auto" />
          </div>
          <div className="border border-black px-4 py-1 inline-block mb-1">
             <h3 className="text-[12px] font-black uppercase tracking-widest">{label}</h3>
          </div>
          <h4 className="text-sm font-black uppercase italic leading-none mb-1 text-black">{store?.name || 'ACECORP'}</h4>
          <p className="text-[10px] uppercase font-bold leading-tight text-black">{store?.address || ''}</p>
          <p className="text-[10px] uppercase font-bold text-black">{store?.mobile || ''}</p>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="text-left font-bold space-y-1 uppercase text-[10px] text-black">
             <div className="flex justify-between"><span>Ref:</span> <span>{order.id.slice(-8)}</span></div>
             <div className="flex justify-between"><span>Date:</span> <span>{new Date(order.createdAt).toLocaleDateString()}</span></div>
             <div className="flex justify-between"><span>Operator:</span> <span>{order.createdBy}</span></div>
             {order.riderName && <div className="flex justify-between"><span>Rider:</span> <span>{order.riderName}</span></div>}
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
          {order.totalDiscount > 0 && (
              <div className="flex justify-between font-bold uppercase mb-1 text-[10px] text-black"><span>Discount:</span> <span>-₱{formatCurrency(order.totalDiscount).replace('₱','')}</span></div>
          )}
          <div className="flex justify-between text-[14px] font-black italic uppercase text-black"><span>TOTAL:</span> <span>₱{formatCurrency(order.totalAmount).replace('₱','')}</span></div>
          
          <div className="mt-6 pt-2 border-t border-black border-dashed text-center text-black space-y-2">
              <p className="font-black uppercase text-[10px]">Thank you for choosing AceCorp!</p>
              <div className="pt-6 pb-2">
                  <p className="text-[10px] text-left border-b border-black inline-block w-full text-white">_</p>
                  <p className="text-[9px] text-center font-black uppercase mt-1">CUSTOMER SIGNATURE</p>
              </div>
          </div>
          <div className="mt-4 pt-2 border-t border-black border-dashed text-center text-black">
              <p className="font-bold uppercase text-[9px]">OFFICIAL REGISTRY COPY</p>
              <p className="font-bold uppercase text-[8px] mt-1">System Timestamp: {new Date().toLocaleTimeString()}</p>
          </div>
       </div>
    );
  };

  const handlePrintRequest = async (type: 'CUSTOMER' | 'GATE' | 'STORE' | 'ALL') => {
    if (type === 'ALL') {
      const copies: ('CUSTOMER' | 'GATE' | 'STORE')[] = ['CUSTOMER', 'GATE', 'STORE'];
      for (const copy of copies) {
        setPrintCopyType(copy);
        await new Promise(resolve => setTimeout(resolve, 250));
        window.print();
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } else {
      setPrintCopyType(type);
      setTimeout(() => {
         window.print();
      }, 150);
    }
  };

  const COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans no-print text-gray-900">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0mm; }
          body * { visibility: hidden !important; }
          #dashboard-thermal-print-root, #dashboard-thermal-print-root * { visibility: visible !important; display: block !important; }
          #dashboard-thermal-print-root { 
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important; 
            background: white !important; 
            color: black !important; 
            padding: 0 !important;
            margin: 0 !important;
          }
          .receipt-copy { 
             page-break-after: always !important; 
             break-after: page !important; 
             width: 68mm !important;
             margin: 0 auto !important;
          }
        }
      `}</style>
      
      {/* THERMAL PRINT ROOT (HIDDEN) */}
      <div id="dashboard-thermal-print-root" className="hidden">
         {selectedOrder && (
           <div className="w-[80mm] bg-white">
              {(printCopyType === 'ALL' || printCopyType === 'CUSTOMER') && generateReceiptPart(selectedOrder, 'CUSTOMER COPY')}
              {(printCopyType === 'ALL' || printCopyType === 'GATE') && generateReceiptPart(selectedOrder, 'GATE PASS')}
              {(printCopyType === 'ALL' || printCopyType === 'STORE') && generateReceiptPart(selectedOrder, 'STORE COPY')}
           </div>
         )}
      </div>

      <div className="px-4 sm:px-8 py-5 bg-[#050810] text-white flex flex-wrap items-center justify-between shadow-2xl relative overflow-hidden shrink-0 gap-4 sm:gap-0">
         <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-12 relative z-10 w-full sm:w-auto">
            <div className="shrink-0">
               <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 leading-none">Actual Cash Inflow</p>
               <h2 className="text-xl sm:text-3xl font-black italic tracking-tighter text-[#38bdf8] leading-none">{formatCurrency(stats.totalSales + stats.arCollectionsTotal)}</h2>
            </div>
            <div className="hidden sm:block h-12 w-px bg-white/10 mx-4"></div>
            <div className="flex flex-wrap gap-4 sm:gap-8 overflow-x-auto pb-1 no-scrollbar items-center">
               <div className="shrink-0">
                  <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1.5 leading-none">Total Booked Revenue</p>
                  <p className="text-xs sm:text-lg font-black italic text-white leading-none">{formatCurrency(stats.totalSales + stats.newARGenerated)}</p>
               </div>
               <div className="shrink-0">
                  <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1.5 leading-none">AR Collected</p>
                  <p className="text-xs sm:text-lg font-black italic tracking-tight text-[#10b981] leading-none">{formatCurrency(stats.arCollectionsTotal)}</p>
               </div>
               <div className="shrink-0">
                  <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1.5 leading-none">NEW AR GENERATED</p>
                  <p className="text-xs sm:text-lg font-black italic tracking-tight text-[#f59e0b] leading-none">{formatCurrency(stats.newARGenerated)}</p>
               </div>
               <div className="h-8 w-px bg-white/5 mx-2"></div>
               {Object.entries(stats.paymentBreakdown).map(([method, amount]) => (
                  <div key={method} className="shrink-0">
                     <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1.5 leading-none">{method}</p>
                     <p className="text-xs sm:text-lg font-black italic text-white leading-none">{formatCurrency(amount as number)}</p>
                  </div>
               ))}
            </div>
         </div>
         <div className="relative z-10 text-right shrink-0 ml-auto sm:ml-0 flex flex-col items-end">
            <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Manifest</p>
            <div className="bg-slate-800/80 px-4 py-1.5 rounded-full border border-white/5">
                <p className="text-lg sm:text-2xl font-black italic text-white leading-none">{stats.orderCount}</p>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8 flex flex-col gap-8">
         <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 shrink-0">
            <div>
               <h1 className="text-2xl sm:text-[28px] font-black italic uppercase tracking-tighter text-slate-900 leading-none">Intelligence Hub</h1>
               <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest mt-1">Real-time Performance Metrics</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-2 rounded-[20px] sm:rounded-[24px] shadow-sm border border-slate-100">
               <CustomDatePicker value={registryDate} onChange={setRegistryDate} className="w-full sm:w-48" />
               <div className="flex p-1 bg-slate-50 rounded-xl">
                  {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map(p => (
                  <button key={p} onClick={() => setReportPeriod(p)} className={`flex-1 sm:px-4 py-2 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all ${reportPeriod === p ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>{p}</button>
                  ))}
               </div>
            </div>
         </div>

         {/* Charts Grid - Balanced 3 Columns */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col h-[380px]">
               <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-6">Settlement Distribution</h3>
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

            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col h-[380px]">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Revenue Velocity</h3>
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

            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col h-[380px]">
               <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-6">Physical Inventory</h3>
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
               <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-center mt-2">Top 8 physical Assets</p>
            </div>
         </div>

         {/* Ledger Table */}
         <div className="bg-white rounded-[32px] sm:rounded-[48px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-6 sm:px-10 py-4 sm:py-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 gap-4">
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Registry Manifest Ledger</span>
            </div>
            <div className="flex-1 overflow-x-auto custom-scrollbar">
               <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50 text-[9px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 sm:px-10 py-5">Timestamp</th>
                      <th className="px-6 py-5 text-sky-500">Ticket #</th>
                      <th className="px-6 py-5">Profile / Reference</th>
                      <th className="px-6 py-5">Operator</th>
                      <th className="px-6 py-5 text-center">Status</th>
                      <th className="px-6 sm:px-10 py-5 text-right">Settlement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredOrders.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(o => (
                        <tr key={o.id} onClick={() => { setSelectedOrder(o); setShowOrderReceipt(false); setPrintCopyType('ALL'); }} className="hover:bg-sky-50/50 cursor-pointer transition-colors group">
                           <td className="px-6 sm:px-10 py-5">
                              <span className="text-[10px] sm:text-[11px] font-bold text-slate-900 leading-none">{new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                              <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 mt-0.5">{toPHDateString(o.createdAt)}</p>
                           </td>
                           <td className="px-6 py-5"><span className="font-mono font-black text-[10px] text-sky-600 bg-sky-50 px-2 py-1 rounded-md">#{o.id.slice(-8)}</span></td>
                           <td className="px-6 py-5"><p className="text-[10px] sm:text-[11px] font-black uppercase italic text-slate-800 truncate max-w-[150px]">{o.customerName}</p></td>
                           <td className="px-6 py-5"><p className="text-[10px] sm:text-[11px] font-black uppercase italic text-slate-800">{o.createdBy}</p></td>
                           <td className="px-6 py-5 text-center">
                                 <span className={`px-2 py-0.5 rounded text-[7px] sm:text-[8px] font-black uppercase tracking-widest border ${o.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : o.status === OrderStatus.RECEIVABLE ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-500'}`}>{o.status}</span>
                           </td>
                           <td className="px-6 sm:px-10 py-5 text-right font-black italic text-slate-900 text-xs sm:text-sm">{formatCurrency(o.totalAmount)}</td>
                        </tr>
                      ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      {selectedOrder && (
         <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300 no-print" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white w-full max-w-[700px] rounded-[32px] sm:rounded-[56px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]" onClick={e => e.stopPropagation()}>
               <div className="p-6 sm:p-8 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
                  <div className="flex items-center gap-2 sm:gap-4">
                     <h3 className="text-base sm:text-xl font-black uppercase italic tracking-tighter text-slate-900">Manifest Mirror</h3>
                     <button onClick={() => setShowOrderReceipt(!showOrderReceipt)} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-sky-50 text-sky-600 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase">{showOrderReceipt ? 'View Registry' : 'View Receipt'}</button>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-2xl"></i></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar bg-slate-50/30">
                  {showOrderReceipt ? (
                     <div className="bg-white p-4 sm:p-8 shadow-sm border border-slate-200 mx-auto w-full max-w-[320px] text-black">
                        <div className="receipt-container font-mono text-black text-center text-[10px] w-full pt-2">
                           {generateReceiptPart(selectedOrder, printCopyType === 'ALL' ? 'CUSTOMER COPY' : `${printCopyType} COPY`)}
                        </div>
                     </div>
                  ) : (
                    <div className="space-y-6 sm:space-y-8 text-slate-800">
                        <div className="p-5 sm:p-6 bg-white rounded-2xl sm:rounded-[32px] border border-slate-100 space-y-4 shadow-sm">
                           <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                              <div><label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer Profile</label><p className="text-xs sm:text-[14px] font-black text-slate-800 uppercase italic">{selectedOrder.customerName}</p></div>
                              <div className="text-left sm:text-right">
                                 {selectedOrder.riderName && (<div className="mb-2"><label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Logistics</label><p className="text-[10px] sm:text-[12px] font-black text-sky-600 uppercase italic">{selectedOrder.riderName}</p></div>)}
                                 <div><label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator (User ID)</label><p className="text-[10px] sm:text-[12px] font-black text-slate-700 uppercase italic">{selectedOrder.createdBy}</p></div>
                              </div>
                           </div>
                           <div><label className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest">Address Mirror</label><p className="text-[10px] font-bold text-slate-600 uppercase italic">{selectedOrder.address || 'N/A'}</p></div>
                           <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                              <div><label className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest">Settlement Method</label><p className="text-[10px] font-black text-emerald-600 uppercase italic">{selectedOrder.paymentMethod}</p></div>
                              <span className={`px-2 py-1 rounded text-[7px] sm:text-[8px] font-black uppercase tracking-widest border ${selectedOrder.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{selectedOrder.status}</span>
                           </div>
                        </div>
                        <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                           <table className="w-full text-left font-bold text-slate-800">
                              <thead className="bg-slate-50 text-[8px] sm:text-[9px] font-black text-slate-400 uppercase"><tr className="border-b border-slate-100"><th className="px-6 sm:px-8 py-4">Asset Detail</th><th className="px-6 sm:px-8 py-4 text-right">Value</th></tr></thead>
                              <tbody className="divide-y divide-slate-50">{selectedOrder.items.map((item, idx) => (<tr key={idx}><td className="px-6 sm:px-8 py-4 font-black uppercase italic text-slate-800 text-[10px] sm:text-[12px]">{item.productName} (x{item.qty})</td><td className="px-6 sm:px-8 py-4 text-right font-black italic text-slate-900 text-[10px] sm:text-[12px]">{formatCurrency(item.total)}</td></tr>))}</tbody>
                           </table>
                        </div>
                        <div className="p-6 sm:p-8 bg-slate-950 rounded-[24px] sm:rounded-[40px] flex justify-between items-center text-white shadow-2xl mt-4"><span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] italic opacity-50">Settlement Total</span><span className="text-xl sm:text-3xl font-black italic">{formatCurrency(selectedOrder.totalAmount)}</span></div>
                    </div>
                  )}
               </div>
               <div className="p-4 sm:p-8 border-t bg-white flex flex-col gap-3 shrink-0">
                  {showOrderReceipt ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                         <button onClick={() => handlePrintRequest('CUSTOMER')} className="py-3 bg-white border-2 border-slate-200 text-slate-900 rounded-xl font-black uppercase text-[8px] hover:bg-slate-50 transition-all">Cust</button>
                         <button onClick={() => handlePrintRequest('GATE')} className="py-3 bg-white border-2 border-slate-200 text-slate-900 rounded-xl font-black uppercase text-[8px] hover:bg-slate-50 transition-all">Gate</button>
                         <button onClick={() => handlePrintRequest('STORE')} className="py-3 bg-white border-2 border-slate-200 text-slate-900 rounded-xl font-black uppercase text-[8px] hover:bg-slate-50 transition-all">Store</button>
                         <button onClick={() => handlePrintRequest('ALL')} className="py-3 bg-slate-950 text-white rounded-xl font-black uppercase text-[8px] shadow-xl">ALL</button>
                      </div>
                      <button onClick={() => handlePrintRequest(printCopyType)} className="w-full py-4 bg-sky-600 text-white rounded-xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center gap-2"><i className="fas fa-print"></i> Authorize Print</button>
                    </div>
                  ) : (
                    <button onClick={() => { setShowOrderReceipt(true); setPrintCopyType('ALL'); }} className="w-full py-4 bg-slate-950 text-white rounded-xl font-black uppercase text-[10px] shadow-xl">Reprint Manifest</button>
                  )}
                  <button onClick={() => setSelectedOrder(null)} className="w-full py-4 sm:py-5 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[8px] sm:text-[10px] active:scale-95 transition-all">Dismiss View</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Dashboard;
