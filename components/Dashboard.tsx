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
type OrderTypeFilter = 'ALL' | 'PICKUP' | 'DELIVERY';

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
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderReceipt, setShowOrderReceipt] = useState(false);
  const [printCopyType, setPrintCopyType] = useState<'CUSTOMER' | 'GATE' | 'STORE' | 'ALL'>('ALL');
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const activeStore = stores.find(s => String(s.id) === String(selectedStoreId));
  const formatCurrency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const nodeOrders = useMemo(() => orders.filter(o => String(o.storeId) === String(selectedStoreId)), [orders, selectedStoreId]);
  
  const stats = useMemo(() => {
    const anchorDateStr = registryDate;
    
    let dailyOrders = nodeOrders;
    if (reportPeriod === 'daily') dailyOrders = nodeOrders.filter(o => toPHDateString(o.createdAt) === anchorDateStr);
    else if (reportPeriod === 'weekly') {
      const anchor = new Date(anchorDateStr);
      const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      dailyOrders = nodeOrders.filter(o => { const d = new Date(o.createdAt); return d >= start && d <= end; });
    } else if (reportPeriod === 'monthly') {
      const anchor = new Date(anchorDateStr);
      dailyOrders = nodeOrders.filter(o => { const d = new Date(o.createdAt); return d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchor.getMonth(); });
    }

    const dailyPayments = receivablePayments.filter(rp => {
      const ar = receivables.find(a => a.id === rp.receivableId);
      const order = orders.find(o => o.id === ar?.orderId);
      if (!order || String(order.storeId) !== String(selectedStoreId)) return false;
      const pDate = toPHDateString(rp.paidAt);
      if (reportPeriod === 'daily') return pDate === anchorDateStr;
      const d = new Date(rp.paidAt);
      const anchor = new Date(anchorDateStr);
      if (reportPeriod === 'weekly') {
        const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
        const end = new Date(start); end.setDate(start.getDate() + 6);
        return d >= start && d <= end;
      }
      return d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear();
    });

    const directCashSales = dailyOrders.filter(o => o.status === OrderStatus.ORDERED && !receivables.some(r => r.orderId === o.id));
    const directSalesTotal = directCashSales.reduce((sum, o) => sum + o.totalAmount, 0);
    const newAROrders = dailyOrders.filter(o => receivables.some(r => r.orderId === o.id));
    const newARGeneratedTotal = newAROrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const arRecoveryPayments = dailyPayments.filter(p => {
       const ar = receivables.find(a => a.id === p.receivableId);
       const order = orders.find(o => o.id === ar?.orderId);
       if (!order) return false;
       return toPHDateString(order.createdAt) !== toPHDateString(p.paidAt);
    });
    const arCollectionsTotal = arRecoveryPayments.reduce((sum, p) => sum + p.amount, 0);

    const netActualInflow = directSalesTotal + dailyPayments.reduce((sum, p) => sum + p.amount, 0);
    const bookedRevenue = directSalesTotal + newARGeneratedTotal;

    const breakdown: Record<PaymentMethod, number> = { 'CASH': 0, 'GCASH': 0, 'MAYA': 0, 'BANK': 0, 'OTHER': 0 };
    directCashSales.forEach(o => { if (breakdown[o.paymentMethod] !== undefined) breakdown[o.paymentMethod] += o.totalAmount; });
    dailyPayments.forEach(p => { 
      const method = (p.paymentMethod || 'CASH') as PaymentMethod;
      if (breakdown[method] !== undefined) breakdown[method] += p.amount; 
    });

    return { netActualInflow, bookedRevenue, newARGenerated: newARGeneratedTotal, arCollections: arCollectionsTotal, breakdown, orderCount: dailyOrders.length, filteredOrders: dailyOrders, dailyPayments };
  }, [nodeOrders, registryDate, reportPeriod, receivables, receivablePayments, selectedStoreId, orders]);

  useEffect(() => { setCurrentPage(1); }, [selectedStoreId, registryDate, reportPeriod, statusFilter, paymentFilter, orderTypeFilter, searchQuery]);

  const filteredOrdersForList = useMemo(() => {
    let base = stats.filteredOrders;
    if (statusFilter !== 'ALL') base = base.filter(o => o.status === statusFilter);
    if (paymentFilter !== 'ALL') base = base.filter(o => o.paymentMethod === paymentFilter);
    if (orderTypeFilter === 'PICKUP') base = base.filter(o => o.customerId === 'PICKUP-CUST');
    if (orderTypeFilter === 'DELIVERY') base = base.filter(o => o.customerId !== 'PICKUP-CUST');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter(o => o.customerName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || o.createdBy.toLowerCase().includes(q));
    }
    return base;
  }, [stats.filteredOrders, statusFilter, paymentFilter, orderTypeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOrdersForList.length / ITEMS_PER_PAGE));
  const paginatedOrders = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredOrdersForList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrdersForList, currentPage, totalPages]);

  const charts = useMemo(() => {
    let velocityData: { name: string; value: number }[] = [];
    if (reportPeriod === 'daily') {
      const hours = Array.from({ length: 24 }, (_, i) => i);
      velocityData = hours.map(h => {
        const direct = stats.filteredOrders
          .filter(o => o.status === OrderStatus.ORDERED && !receivables.some(r => r.orderId === o.id) && new Date(o.createdAt).getHours() === h)
          .reduce((sum, o) => sum + o.totalAmount, 0);
        const payments = stats.dailyPayments
          .filter(p => new Date(p.paidAt).getHours() === h)
          .reduce((sum, p) => sum + p.amount, 0);
        return { name: `${h}:00`, value: direct + payments };
      });
    } else {
      const days = Array.from(new Set([...stats.filteredOrders.map(o => toPHDateString(o.createdAt)), ...stats.dailyPayments.map(p => toPHDateString(p.paidAt))])).sort();
      velocityData = days.map(d => {
        const direct = stats.filteredOrders
          .filter(o => o.status === OrderStatus.ORDERED && !receivables.some(r => r.orderId === o.id) && toPHDateString(o.createdAt) === d)
          .reduce((sum, o) => sum + o.totalAmount, 0);
        const payments = stats.dailyPayments
          .filter(p => toPHDateString(p.paidAt) === d)
          .reduce((sum, p) => sum + p.amount, 0);
        return { name: String(d).split('-').slice(1).join('/'), value: direct + payments };
      });
    }
    const pieData = Object.entries(stats.breakdown).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
    const storeStocks = stocks.filter(s => String(s.storeId) === String(selectedStoreId)).map(s => {
      const p = products.find(prod => String(prod.id) === String(s.productId));
      return { name: (p ? p.name : 'SKU').split(',')[0], qty: Number(s.quantity) };
    }).sort((a, b) => b.qty - a.qty).slice(0, 8);
    return { velocityData, pieData, storeStocks };
  }, [stats, reportPeriod, receivables, stocks, selectedStoreId, products]);

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
      const sequence: ('CUSTOMER' | 'GATE' | 'STORE')[] = ['CUSTOMER', 'GATE', 'STORE'];
      for (const copy of sequence) {
        setPrintCopyType(copy);
        document.body.classList.add('printing-receipt');
        const style = document.createElement('style');
        style.id = 'receipt-print-style';
        style.innerHTML = '@media print { @page { size: 80mm auto !important; margin: 0mm !important; } }';
        document.head.appendChild(style);

        await new Promise(resolve => setTimeout(resolve, 200));
        window.print();
        
        document.body.classList.remove('printing-receipt');
        const injectedStyle = document.getElementById('receipt-print-style');
        if (injectedStyle) injectedStyle.remove();
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      setPrintCopyType('ALL');
    } else {
      document.body.classList.add('printing-receipt');
      const style = document.createElement('style');
      style.id = 'receipt-print-style';
      style.innerHTML = '@media print { @page { size: 80mm auto !important; margin: 0mm !important; } }';
      document.head.appendChild(style);

      setPrintCopyType(type); 
      setTimeout(() => { 
         window.print(); 
         document.body.classList.remove('printing-receipt');
         const injectedStyle = document.getElementById('receipt-print-style');
         if (injectedStyle) injectedStyle.remove();
      }, 200);
    }
  };

  const COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans text-slate-900">
      <style>{`
        @media print {
          @page { size: auto; margin: 10mm; }
          
          html, body { 
            height: auto !important; 
            overflow: visible !important; 
            background: white !important; 
            color: black !important; 
            display: block !important;
          }
          
          body { visibility: hidden !important; }
          .no-print { display: none !important; }

          /* Reset layout to allow content to flow */
          #root, .flex, .flex-col, .flex-1, .h-screen, .overflow-hidden, .custom-scrollbar { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important; 
            position: static !important; 
          }
          
          /* --- REPORT MODE (Default) --- */
          body:not(.printing-receipt) #dashboard-all-orders-print-root {
            visibility: visible !important;
            display: block !important;
            position: relative !important;
            width: 100% !important;
            background: white;
            height: auto !important;
            overflow: visible !important;
          }
          body:not(.printing-receipt) #dashboard-all-orders-print-root * {
            visibility: visible !important;
          }
          /* Add margins for the report content itself */
          body:not(.printing-receipt) #dashboard-all-orders-print-root > div {
            margin: 0;
          }

          /* Ensure table headers repeat and page breaks work */
          table { 
            width: 100% !important; 
            border-collapse: collapse !important;
            table-layout: auto !important;
            page-break-inside: auto !important;
          }
          thead { display: table-header-group !important; }
          tr { page-break-inside: avoid !important; page-break-after: auto !important; }
          
          /* Disable flexbox for print if it causes issues with page breaks */
          .flex, .grid { display: block !important; }

          /* --- RECEIPT MODE --- */
          body.printing-receipt #dashboard-receipt-print-root {
            visibility: visible !important;
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important; 
            height: auto !important; 
            min-height: 0 !important;
            padding: 0 !important; 
            margin: 0 !important; 
            background: white !important; 
            color: black !important; 
            z-index: 9999 !important;
          }
          body.printing-receipt #dashboard-receipt-print-root * {
            visibility: visible !important;
          }
          
          .receipt-copy { 
             display: block !important;
             page-break-after: always !important; 
             break-after: page !important; 
             width: 68mm !important;
             margin: 0 auto !important;
             position: relative !important;
             overflow: hidden !important;
          }

          /* Explicitly hide the opposing container to prevent interference */
          body.printing-receipt #dashboard-all-orders-print-root { display: none !important; }
          body:not(.printing-receipt) #dashboard-receipt-print-root { display: none !important; }

          button, header, aside { display: none !important; }
        }
      `}</style>

      {/* FULL SALES REPORT PRINT ROOT */}
      <div id="dashboard-all-orders-print-root" className="hidden">
         <div className="p-8">
            <div className="text-center mb-8 border-b-2 border-black pb-4">
               <div className="flex justify-center mb-4"><AceCorpLogo customUrl={logoUrl} className="h-16 w-auto" /></div>
               <h1 className="text-2xl font-black uppercase tracking-widest mb-1">Sales Registry Manifest</h1>
               <p className="text-xs font-bold uppercase tracking-[0.2em]">{activeStore?.name} — {reportPeriod} Report</p>
               <p className="text-[10px] font-mono mt-2">Generated: {new Date().toLocaleString()}</p>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-8 border-b border-black pb-6">
               <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Net Inflow</p><p className="text-xl font-black">{formatCurrency(stats.netActualInflow)}</p></div>
               <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Booked Revenue</p><p className="text-xl font-black">{formatCurrency(stats.bookedRevenue)}</p></div>
               <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">AR Generated</p><p className="text-xl font-black">{formatCurrency(stats.newARGenerated)}</p></div>
               <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">AR Collected</p><p className="text-xl font-black">{formatCurrency(stats.arCollections)}</p></div>
            </div>

            <table className="w-full text-left text-[10px]">
               <thead className="border-b-2 border-black">
                  <tr>
                     <th className="py-2 uppercase font-black">Time</th>
                     <th className="py-2 uppercase font-black">Ticket</th>
                     <th className="py-2 uppercase font-black">Customer</th>
                     <th className="py-2 uppercase font-black">Operator</th>
                     <th className="py-2 uppercase font-black text-center">Status</th>
                     <th className="py-2 uppercase font-black text-right">Amount</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                  {stats.filteredOrders.map(o => (
                     <tr key={o.id}>
                        <td className="py-2 font-mono">{new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                        <td className="py-2 font-mono">#{o.id.slice(-8)}</td>
                        <td className="py-2 font-bold uppercase">{o.customerName}</td>
                        <td className="py-2 uppercase">{o.createdBy}</td>
                        <td className="py-2 text-center uppercase font-bold">{o.status}</td>
                        <td className="py-2 text-right font-mono font-bold">{formatCurrency(o.totalAmount)}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
            
            <div className="mt-8 pt-4 border-t-2 border-black flex justify-between items-center">
               <p className="text-[9px] font-bold uppercase">End of Report</p>
               <p className="text-[9px] font-bold uppercase">Total Records: {stats.filteredOrders.length}</p>
            </div>
         </div>
      </div>

      {/* RECEIPT PRINT ROOT */}
      <div id="dashboard-receipt-print-root" className="hidden">
        {selectedOrder && (
          <div className="w-[80mm] bg-white">
            <div className="receipt-copy">
              {generateReceiptPart(
                selectedOrder, 
                printCopyType === 'ALL' ? 'CUSTOMER COPY' : (printCopyType === 'GATE' ? 'GATE PASS' : `${printCopyType} COPY`)
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="px-8 py-6 bg-slate-800 text-white flex flex-wrap items-center justify-between shadow-2xl relative overflow-hidden shrink-0 gap-4 sm:gap-0 no-print">
         <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-12 relative z-10 w-full sm:w-auto">
            <div className="shrink-0 border-l-[6px] border-sky-500 pl-8">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 leading-none">Net Actual Cash Inflow</p>
               <h2 className="text-[32px] font-black italic tracking-tighter text-white leading-none">
                 {formatCurrency(stats.netActualInflow)}
               </h2>
            </div>
            <div className="flex flex-wrap gap-8 items-center border-l border-white/10 pl-10">
               <div className="shrink-0">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">Total Booked Revenue</p>
                  <p className="text-xl font-black italic tracking-tight text-slate-300 leading-none">{formatCurrency(stats.bookedRevenue)}</p>
               </div>
               <div className="shrink-0">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">New AR Generated</p>
                  <p className="text-xl font-black italic tracking-tight text-orange-400 leading-none">{formatCurrency(stats.newARGenerated)}</p>
               </div>
               <div className="shrink-0">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">AR Collections</p>
                  <p className="text-xl font-black italic tracking-tight text-[#10b981] leading-none">{formatCurrency(stats.arCollections)}</p>
               </div>
               <div className="h-10 w-px bg-white/10 mx-2 hidden xl:block"></div>
               <div className="flex gap-8">
                  {Object.entries(stats.breakdown).filter(([k,v]) => ['CASH', 'GCASH', 'MAYA'].includes(k)).map(([method, amount]) => (
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
               <p className="text-[9px] font-black text-sky-600 uppercase tracking-widest mt-1">Cash-Basis Performance Registry</p>
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
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Actual Inflow Velocity</h3>
                  <span className="text-[8px] font-bold text-sky-500 px-3 py-1 bg-sky-50 rounded-full uppercase italic">Live Cash</span>
               </div>
               <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.velocityData}>
                        <defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 800}} interval={2} />
                        <YAxis hide />
                        <Tooltip contentStyle={{borderRadius:'16px', border:'none', fontWeight:'900'}} formatter={(val: number) => [formatCurrency(val), 'Net Inflow']} />
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

         <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
            <div className="px-10 py-8 border-b border-slate-50 flex flex-col lg:flex-row justify-between items-start lg:items-center shrink-0 gap-6">
               <div className="flex items-center gap-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry Manifest Ledger</span>
                  <div className="flex items-center bg-sky-50 border-2 border-sky-200 rounded-full px-4 py-1.5 shadow-sm">
                     <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="text-sky-600 hover:text-sky-800 disabled:opacity-30 p-1"><i className="fas fa-chevron-left text-[10px]"></i></button>
                     <span className="mx-4 text-[10px] font-black text-sky-600 uppercase tracking-widest">TURN {currentPage} OF {totalPages}</span>
                     <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="text-sky-600 hover:text-sky-800 disabled:opacity-30 p-1"><i className="fas fa-chevron-right text-[10px]"></i></button>
                  </div>
               </div>
               <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 sm:flex-none sm:w-64">
                     <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
                     <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search Ticket/Customer..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold uppercase outline-none focus:bg-white focus:border-sky-400 transition-all" />
                  </div>
                  <select value={orderTypeFilter} onChange={e => setOrderTypeFilter(e.target.value as any)} className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase outline-none focus:border-sky-400 transition-all">
                     <option value="ALL">All Types</option>
                     <option value="PICKUP">Pickup</option>
                     <option value="DELIVERY">Delivery</option>
                  </select>
                  <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as any)} className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase outline-none focus:border-sky-400 transition-all">
                     <option value="ALL">All Payments</option>
                     <option value="CASH">Cash</option>
                     <option value="GCASH">GCash</option>
                     <option value="MAYA">Maya</option>
                     <option value="BANK">Bank</option>
                  </select>
                  <button onClick={() => window.print()} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95"><i className="fas fa-print"></i> Generate Full Registry</button>
               </div>
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
                           <td className="px-10 py-6"><span className="text-[11px] font-bold text-slate-400">{new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></td>
                           <td className="px-4 py-6"><span className="font-mono font-black text-[10px] text-sky-400 bg-sky-50 px-2 py-1 rounded-md">#{o.id.slice(-8)}</span></td>
                           <td className="px-10 py-6"><p className="text-[12px] font-black uppercase italic text-slate-500 truncate max-w-[200px]">{o.customerName}</p></td>
                           <td className="px-6 py-6"><p className="text-[11px] font-black uppercase italic text-sky-400">{o.createdBy || 'SYSTEM'}</p></td>
                           <td className="px-6 py-5 text-center"><span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${o.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-400 border-emerald-100' : o.status === OrderStatus.RECEIVABLE ? 'bg-orange-50 text-orange-400 border-orange-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>{o.status}</span></td>
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
                     <button onClick={() => setShowOrderReceipt(!showOrderReceipt)} className="px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-[9px] font-black uppercase hover:bg-sky-100 transition-all">{showOrderReceipt ? 'View Data' : 'View Receipt'}</button>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-3xl"></i></button>
               </div>
               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/20">
                  {showOrderReceipt ? (
                     <div className="bg-white p-8 shadow-xl border border-slate-200 mx-auto w-full max-w-[320px] text-black">
                        {generateReceiptPart(selectedOrder, printCopyType === 'ALL' ? 'CUSTOMER COPY' : `${printCopyType} COPY`)}
                     </div>
                  ) : (
                    <div className="space-y-8 text-slate-800">
                        <div className="p-8 bg-white rounded-[32px] border border-slate-100 space-y-4 shadow-sm">
                           <div className="flex justify-between items-start">
                              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel Profile</label><p className="text-[16px] font-black text-slate-950 uppercase italic leading-tight mt-1">{selectedOrder.customerName}</p></div>
                              <div className="text-right">
                                 {selectedOrder.riderName && (<div className="mb-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logistics</label><p className="text-[12px] font-black text-sky-600 uppercase italic">{selectedOrder.riderName}</p></div>)}
                                 <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Operator (Op)</label><p className="text-[12px] font-black text-sky-600 uppercase italic mt-1">{selectedOrder.createdBy}</p></div>
                              </div>
                           </div>
                           <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Address Cluster</label><p className="text-[11px] font-bold text-slate-600 uppercase italic">{selectedOrder.address}, {selectedOrder.city}</p></div>
                           <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                              <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Settlement Method</label><p className="text-[13px] font-black text-emerald-600 uppercase italic">{selectedOrder.paymentMethod}</p></div>
                              <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border ${selectedOrder.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-400 border-emerald-100' : selectedOrder.status === OrderStatus.RECEIVABLE ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-400'}`}>{selectedOrder.status}</span>
                           </div>
                           {selectedOrder.remark && (<div className="pt-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session Remarks</label><p className="text-[11px] font-black text-amber-600 uppercase italic bg-amber-50 p-2 rounded-lg border border-amber-100">{selectedOrder.remark}</p></div>)}
                        </div>
                        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden font-bold">
                           <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[9px] font-black text-slate-400 uppercase"><th className="px-8 py-4">Registry Asset</th><th className="px-8 py-4 text-right">Value</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{selectedOrder.items.map((item, idx) => (<tr key={idx}><td className="px-8 py-5 font-black uppercase italic text-slate-800 text-[12px]">{item.productName} (x{item.qty})</td><td className="px-8 py-5 text-right font-black italic text-slate-950 text-[12px]">{formatCurrency(item.total).replace('₱','')}</td></tr>))}</tbody>
                           </table>
                        </div>
                        <div className="space-y-2">
                           {selectedOrder.totalDiscount > 0 && (<div className="flex justify-between items-center px-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest"><span>Applied Discount</span><span className="text-emerald-500">- ₱{formatCurrency(selectedOrder.totalDiscount)}</span></div>)}
                           <div className="p-8 bg-slate-950 rounded-[40px] flex justify-between items-center text-white shadow-2xl mt-4"><span className="text-[10px] font-black uppercase tracking-[0.2em] italic opacity-50">Net Total</span><span className="text-3xl font-black italic">{formatCurrency(selectedOrder.totalAmount)}</span></div>
                        </div>
                    </div>
                  )}
               </div>
               <div className="p-10 border-t bg-white flex flex-col gap-4 shrink-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-4 gap-1">
                        <button onClick={() => handlePrintRequest('CUSTOMER')} className={`py-3 rounded-xl font-black uppercase text-[8px] transition-all border-2 ${printCopyType === 'CUSTOMER' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-900 border-slate-200'}`}>Cust</button>
                        <button onClick={() => handlePrintRequest('GATE')} className={`py-3 rounded-xl font-black uppercase text-[8px] transition-all border-2 ${printCopyType === 'GATE' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-900 border-slate-200'}`}>Gate</button>
                        <button onClick={() => handlePrintRequest('STORE')} className={`py-3 rounded-xl font-black uppercase text-[8px] transition-all border-2 ${printCopyType === 'STORE' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-900 border-slate-200'}`}>Store</button>
                        <button onClick={() => handlePrintRequest('ALL')} className={`py-3 rounded-xl font-black uppercase text-[8px] transition-all border-2 ${printCopyType === 'ALL' ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-900 border-slate-200'}`}>ALL</button>
                    </div>
                    <button onClick={() => handlePrintRequest(printCopyType)} className="py-5 bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 hover:bg-sky-700 active:scale-95 transition-all"><i className="fas fa-print"></i> Authorize Reprint</button>
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