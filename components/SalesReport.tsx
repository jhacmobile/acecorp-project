import React, { useState, useMemo, useEffect } from 'react';
import { User, Order, OrderStatus, Store, PaymentMethod, ReceivablePayment, AccountsReceivable } from '../types';
import CustomDatePicker from './CustomDatePicker';
import AceCorpLogo from './AceCorpLogo';

interface SalesProps {
  user: User;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  expenses: any[];
  setExpenses: React.Dispatch<React.SetStateAction<any[]>>;
  products: any[];
  stores: Store[];
  receivables: AccountsReceivable[];
  receivablePayments: ReceivablePayment[];
  logoUrl?: string;
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly';
type AuditMode = 'SALES' | 'AR_COLLECTION';

const SalesReport: React.FC<SalesProps> = ({ user, orders, stores, receivables, receivablePayments, logoUrl }) => {
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

  const [date, setDate] = useState(getPHDateString());
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
  const [auditMode, setAuditMode] = useState<AuditMode>('SALES');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderReceipt, setShowOrderReceipt] = useState(false);
  const [printCopyType, setPrintCopyType] = useState<'CUSTOMER' | 'GATE' | 'STORE' | 'ALL'>('ALL');
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => { setSearchQuery(''); }, []);

  const nodeOrders = useMemo(() => orders.filter(o => String(o.storeId) === String(user.selectedStoreId)), [orders, user.selectedStoreId]);

  const stats = useMemo(() => {
    const anchorDateStr = date;
    
    // 1. Date Filtering Logic
    let dailyOrders = nodeOrders;
    if (reportPeriod === 'daily') {
      dailyOrders = nodeOrders.filter(o => toPHDateString(o.createdAt) === anchorDateStr);
    } else if (reportPeriod === 'weekly') {
      const anchor = new Date(anchorDateStr);
      const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      dailyOrders = nodeOrders.filter(o => { 
        const d = new Date(o.createdAt); 
        return d >= start && d <= end; 
      });
    } else if (reportPeriod === 'monthly') {
      const anchor = new Date(anchorDateStr);
      dailyOrders = nodeOrders.filter(o => { 
        const d = new Date(o.createdAt); 
        return d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchor.getMonth(); 
      });
    }

    // 2. Filter ALL Payments received within this registry window
    const dailyPayments = receivablePayments.filter(rp => {
      const ar = receivables.find(a => a.id === rp.receivableId);
      const order = orders.find(o => o.id === ar?.orderId);
      if (!order || String(order.storeId) !== String(user.selectedStoreId)) return false;
      
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

    // 3. SEGRAGATION LOGIC
    const directSalesOrders = dailyOrders.filter(o => o.status === OrderStatus.ORDERED && !receivables.some(r => r.orderId === o.id));
    const directSalesTotal = directSalesOrders.reduce((sum, o) => sum + o.totalAmount, 0);

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
    directSalesOrders.forEach(o => { if (breakdown[o.paymentMethod] !== undefined) breakdown[o.paymentMethod] += o.totalAmount; });
    dailyPayments.forEach(p => { 
      const m = (p.paymentMethod || 'CASH') as PaymentMethod;
      if (breakdown[m] !== undefined) breakdown[m] += p.amount; 
    });

    return { netActualInflow, bookedRevenue, newARGenerated: newARGeneratedTotal, arCollections: arCollectionsTotal, breakdown, dailyOrders, dailyPayments };
  }, [nodeOrders, date, reportPeriod, receivables, receivablePayments, user.selectedStoreId, orders]);

  useEffect(() => { setCurrentPage(1); }, [date, reportPeriod, auditMode, statusFilter, paymentFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(stats.dailyOrders.length / ITEMS_PER_PAGE));
  const arTotalPages = Math.max(1, Math.ceil(stats.dailyPayments.length / ITEMS_PER_PAGE));
  const currentTotalPages = auditMode === 'SALES' ? totalPages : arTotalPages;

  const paginatedOrders = useMemo(() => {
    let base = stats.dailyOrders;
    if (statusFilter !== 'ALL') base = base.filter(o => o.status === statusFilter);
    if (paymentFilter !== 'ALL') base = base.filter(o => o.paymentMethod === paymentFilter);
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        base = base.filter(o => o.customerName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || o.createdBy.toLowerCase().includes(q));
    }
    const safePage = Math.min(currentPage, Math.ceil(base.length / ITEMS_PER_PAGE) || 1);
    return base.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  }, [stats.dailyOrders, currentPage, statusFilter, paymentFilter, searchQuery]);

  const paginatedAR = useMemo(() => {
    const data = stats.dailyPayments.map(p => {
       const ar = receivables.find(r => r.id === p.receivableId);
       const order = orders.find(o => o.id === ar?.orderId);
       return { payment: p, order, ar };
    }).filter(i => !!i.order);
    const safePage = Math.min(currentPage, Math.ceil(data.length / ITEMS_PER_PAGE) || 1);
    return data.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  }, [stats.dailyPayments, currentPage, receivables, orders]);

  const formatCurrency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="text-left font-bold space-y-1 uppercase text-[10px] text-black">
             <div className="flex justify-between"><span>Ref:</span> <span>{order.id.slice(-8)}</span></div>
             <div className="flex justify-between"><span>Date:</span> <span>{new Date(order.createdAt).toLocaleDateString()}</span></div>
             <div className="flex justify-between"><span>Operator:</span> <span>{order.createdBy}</span></div>
             <div className="pt-1"><p className="font-black text-[11px] uppercase italic text-black">{order.customerName}</p></div>
          </div>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="space-y-2 mb-4">
             {order.items.map((item, idx) => (
                <div key={idx}><div className="flex justify-between font-black uppercase italic text-[10px] text-black"><span>{item.productName} (x{item.qty})</span><span>₱{formatCurrency(item.total).replace('₱','')}</span></div></div>
             ))}
          </div>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="flex justify-between text-[14px] font-black italic uppercase text-black"><span>TOTAL:</span> <span>₱{formatCurrency(order.totalAmount).replace('₱','')}</span></div>
          <div className="mt-6 pt-2 border-t border-black border-dashed text-center text-black space-y-2">
              <p className="font-black uppercase text-[10px]">Thank you for choosing AceCorp!</p>
          </div>
       </div>
    );
  };

  const handlePrintRequest = async (type: 'CUSTOMER' | 'GATE' | 'STORE' | 'ALL') => {
    if (type === 'ALL') {
        document.body.classList.add('printing-receipt');
        const sequence: ('CUSTOMER' | 'GATE' | 'STORE')[] = ['CUSTOMER', 'GATE', 'STORE'];
        for (const copy of sequence) {
            setPrintCopyType(copy);
            await new Promise(resolve => setTimeout(resolve, 100));
            window.print();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        setPrintCopyType('ALL');
        document.body.classList.remove('printing-receipt');
    } else {
        document.body.classList.add('printing-receipt');
        setPrintCopyType(type);
        setTimeout(() => { 
           window.print(); 
           document.body.classList.remove('printing-receipt');
        }, 150);
    }
  };

  const activeStore = stores.find(s => s.id === user.selectedStoreId);
  const headerName = activeStore?.name?.toUpperCase() || 'ACECORP BRANCH';

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden text-slate-900 font-sans">
      <style>{`
        @media print {
          @page { size: portrait; margin: 10mm; }
          html, body { height: auto !important; overflow: visible !important; background: white !important; color: black !important; }
          #root, main, .flex-1, .h-screen, .overflow-hidden, .custom-scrollbar { height: auto !important; overflow: visible !important; display: block !important; position: static !important; }
          .no-print, header, aside, .pagination-controls, button { display: none !important; }
          
          /* Ensure table headers repeat */
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          
          /* Report Container */
          #audit-manifest-report-root { 
            display: block !important; 
            width: 100% !important; 
            position: static !important;
            visibility: visible !important;
          }
          
          /* Hide everything else when printing report */
          body > *:not(#audit-manifest-report-root) {
             display: none !important;
          }

          /* Receipt Printing Override */
          #audit-receipt-print-root { 
            display: none !important; 
          }
          body.printing-receipt > * { display: none !important; }
          body.printing-receipt #audit-receipt-print-root { 
            display: block !important; 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            z-index: 9999 !important; 
            background: white !important; 
            width: 80mm !important;
          }
          body.printing-receipt .receipt-copy { 
             display: block !important;
             page-break-after: always !important; 
             break-after: page !important; 
             width: 68mm !important;
             margin: 0 auto !important;
             position: relative !important;
             overflow: hidden !important;
          }
        }
      `}</style>

      {/* FULL AUDIT REPORT PRINT ROOT */}
      <div id="audit-manifest-report-root" className="hidden">
         <div className="p-8">
            <div className="text-center mb-8 border-b-2 border-black pb-4">
               <div className="flex justify-center mb-4"><AceCorpLogo customUrl={logoUrl} className="h-16 w-auto" /></div>
               <h1 className="text-2xl font-black uppercase tracking-widest mb-1">Audit Ledger Manifest</h1>
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
                     <th className="py-2 uppercase font-black">Ref ID</th>
                     <th className="py-2 uppercase font-black">Entity / Customer</th>
                     <th className="py-2 uppercase font-black">Method</th>
                     <th className="py-2 uppercase font-black text-center">Status</th>
                     <th className="py-2 uppercase font-black text-right">Amount</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                  {auditMode === 'SALES' ? (
                     stats.dailyOrders.map(o => (
                        <tr key={o.id}>
                           <td className="py-2 font-mono">{new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                           <td className="py-2 font-mono">#{o.id.slice(-8)}</td>
                           <td className="py-2 font-bold uppercase">{o.customerName}</td>
                           <td className="py-2 uppercase">{o.paymentMethod}</td>
                           <td className="py-2 text-center uppercase font-bold">{o.status}</td>
                           <td className="py-2 text-right font-mono font-bold">{formatCurrency(o.totalAmount)}</td>
                        </tr>
                     ))
                  ) : (
                     stats.dailyPayments.map((p, i) => {
                        const ar = receivables.find(r => r.id === p.receivableId);
                        const order = orders.find(o => o.id === ar?.orderId);
                        return (
                           <tr key={i}>
                              <td className="py-2 font-mono">{new Date(p.paidAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                              <td className="py-2 font-mono">PAY-{p.id.slice(-4)}</td>
                              <td className="py-2 font-bold uppercase">{order?.customerName || 'UNKNOWN'}</td>
                              <td className="py-2 uppercase">{p.paymentMethod}</td>
                              <td className="py-2 text-center uppercase font-bold">COLLECTED</td>
                              <td className="py-2 text-right font-mono font-bold">{formatCurrency(p.amount)}</td>
                           </tr>
                        );
                     })
                  )}
               </tbody>
            </table>
            
            <div className="mt-8 pt-4 border-t-2 border-black flex justify-between items-center">
               <p className="text-[9px] font-bold uppercase">End of Report</p>
               <p className="text-[9px] font-bold uppercase">Total Records: {auditMode === 'SALES' ? stats.dailyOrders.length : stats.dailyPayments.length}</p>
            </div>
         </div>
      </div>

      {/* RECEIPT PRINT ROOT */}
      <div id="audit-receipt-print-root" className="hidden">
        {selectedOrder && (
          <div className="w-[80mm] bg-white">
             <div className="receipt-copy">{generateReceiptPart(selectedOrder, printCopyType === 'ALL' ? 'CUSTOMER COPY' : `${printCopyType} COPY`)}</div>
          </div>
        )}
      </div>
      
      {/* INTELLIGENCE HUB SUMMARY */}
      <div className="px-8 py-6 bg-slate-800 text-white flex flex-wrap items-center justify-between shadow-2xl relative overflow-hidden shrink-0 no-print">
         <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-12 relative z-10 w-full sm:w-auto">
            <div className="shrink-0 border-l-[6px] border-sky-500 pl-8">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 leading-none">Net Actual Cash Inflow</p>
               <h2 className="text-[32px] font-black italic tracking-tighter text-white leading-none">
                 {formatCurrency(stats.netActualInflow)}
               </h2>
               <p className="text-[8px] font-bold text-sky-400 uppercase tracking-widest mt-1 opacity-60 italic">{reportPeriod} Perspective</p>
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
         <div className="no-print">
            <button onClick={() => window.print()} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95 border border-white/10"><i className="fas fa-print"></i> Full Audit Report</button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden no-print">
         <aside className="w-[320px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
            <div className="p-10 space-y-10 h-full overflow-y-auto custom-scrollbar">
               <div>
                  <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">{headerName}</h1>
                  <p className="text-[9px] font-bold text-sky-600 uppercase tracking-[0.2em] mt-2">Internal Audit Protocol</p>
               </div>
               <div className="space-y-10">
                  {/* Audit Mode Selector */}
                  <div className="space-y-4">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Audit Target</label>
                     <div className="grid grid-cols-1 gap-2 p-1.5 bg-slate-50 rounded-[24px] border border-slate-100">
                        <button onClick={() => setAuditMode('SALES')} className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${auditMode === 'SALES' ? 'bg-slate-400 text-white shadow-lg italic' : 'text-slate-400 hover:text-slate-600'}`}>Sales Registry</button>
                        <button onClick={() => setAuditMode('AR_COLLECTION')} className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${auditMode === 'AR_COLLECTION' ? 'bg-slate-400 text-white shadow-lg italic' : 'text-slate-400 hover:text-slate-600'}`}>AR Collections</button>
                     </div>
                  </div>

                  {/* Period Selector - NEW Feature */}
                  <div className="space-y-4">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Timeframe Protocol</label>
                     <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-100">
                        {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map(p => (
                          <button 
                            key={p} 
                            onClick={() => setReportPeriod(p)} 
                            className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${reportPeriod === p ? 'bg-white text-sky-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {p}
                          </button>
                        ))}
                     </div>
                  </div>

                  {/* Reference Date Picker */}
                  <div className="space-y-4">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Reference Date</label>
                    <CustomDatePicker value={date} onChange={setDate} className="w-full shadow-sm" />
                  </div>
               </div>
            </div>
         </aside>

         <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
               <div className="relative w-full max-w-xl group">
                  <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors"></i>
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search Ledger Registry (Customer, Ticket, Operator)..." className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-[28px] text-[11px] font-bold uppercase outline-none focus:bg-white focus:border-sky-400 transition-all shadow-inner" />
               </div>
               <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Displaying turn <span className="text-slate-950">{currentPage}</span> of {currentTotalPages}</div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-slate-50/10">
               <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full min-w-[1000px]">
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <div className="px-10 py-6 border-b border-slate-50 flex items-center gap-6 bg-white sticky top-0 z-20">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry Audit Manifest ({reportPeriod.toUpperCase()})</span>
                        <div className="flex items-center bg-sky-50 border-2 border-sky-200 rounded-full px-4 py-1.5 shadow-sm">
                           <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="text-sky-600 hover:text-sky-800 disabled:opacity-30 p-1"><i className="fas fa-chevron-left text-[10px]"></i></button>
                           <span className="mx-4 text-[10px] font-black text-sky-600 uppercase tracking-widest">TURN {currentPage} OF {currentTotalPages}</span>
                           <button disabled={currentPage >= currentTotalPages} onClick={() => setCurrentPage(p => Math.min(currentTotalPages, p + 1))} className="text-sky-600 hover:text-sky-800 disabled:opacity-30 p-1"><i className="fas fa-chevron-right text-[10px]"></i></button>
                        </div>
                     </div>
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] text-slate-300 font-black uppercase tracking-widest border-b border-slate-100 sticky top-[57px] z-10 shadow-sm">
                           <tr>
                              <th className="px-10 py-6">Timestamp</th>
                              <th className="px-4 py-6 text-sky-400">Ticket #</th>
                              <th className="px-10 py-6">Customer / Entity Profile</th>
                              <th className="px-4 py-6">Method</th>
                              <th className="px-6 py-6">Op</th>
                              <th className="px-6 py-6 text-center">Status</th>
                              <th className="px-10 py-6 text-right">Settlement</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {auditMode === 'SALES' ? (
                             paginatedOrders.map(o => (
                                <tr key={o.id} onClick={() => { setSelectedOrder(o); setShowOrderReceipt(false); setPrintCopyType('ALL'); }} className="hover:bg-sky-50/50 transition-colors cursor-pointer group">
                                   <td className="px-10 py-6 font-mono text-[10px]"><div className="font-bold text-slate-400">{new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></td>
                                   <td className="px-4 py-6"><span className="font-mono font-black text-[10px] text-sky-400">#{o.id.slice(-8)}</span></td>
                                   <td className="px-10 py-6"><p className="text-[12px] font-black uppercase italic text-slate-500 leading-none">{o.customerName}</p></td>
                                   <td className="px-4 py-6"><span className="text-[9px] font-bold text-slate-400 uppercase">{o.paymentMethod}</span></td>
                                   <td className="px-6 py-6"><p className="text-[10px] font-black text-sky-400 uppercase italic leading-none">{o.createdBy}</p></td>
                                   <td className="px-6 py-6 text-center"><span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${o.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-400 border-emerald-100' : o.status === OrderStatus.RECEIVABLE ? 'bg-orange-50 text-orange-400 border-orange-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>{o.status}</span></td>
                                   <td className="px-10 py-6 text-right font-black italic text-slate-400">{formatCurrency(o.totalAmount)}</td>
                                </tr>
                             ))
                           ) : (
                             paginatedAR.map((item, i) => (
                                <tr key={i} className="hover:bg-emerald-50/50 transition-colors group">
                                   <td className="px-10 py-6 text-[10px] font-bold text-slate-400">{new Date(item.payment.paidAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                                   <td className="px-4 py-6"><span className="font-mono font-black text-sky-400">PAY-{item.payment.id.slice(-4)}</span></td>
                                   <td className="px-10 py-6 font-black uppercase italic text-slate-500 text-[12px]">{item.order?.customerName}</td>
                                   <td className="px-4 py-6 text-[10px] font-bold text-slate-400">{item.payment.paymentMethod}</td>
                                   <td colSpan={2} className="px-6 py-6 text-center"><span className="px-3 py-1 rounded-lg text-[8px] font-black uppercase bg-emerald-50 text-emerald-400 border border-emerald-100">COLLECTED</span></td>
                                   <td className="px-10 py-6 text-right font-black italic text-emerald-600 text-base">{formatCurrency(item.payment.amount)}</td>
                                </tr>
                             ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {selectedOrder && (
         <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in zoom-in duration-300 no-print" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white w-full max-w-[500px] rounded-[56px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]" onClick={e => e.stopPropagation()}>
               <div className="p-10 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                     <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">{showOrderReceipt ? 'Reprint Mirror' : 'Registry Detail'}</h3>
                     <button onClick={() => setShowOrderReceipt(!showOrderReceipt)} className="px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-[9px] font-black uppercase hover:bg-sky-100 transition-all">{showOrderReceipt ? 'View Data' : 'View Receipt'}</button>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-3xl"></i></button>
               </div>
               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/30">
                  {showOrderReceipt ? (
                    <div className="bg-white p-10 shadow-xl border border-slate-200 mx-auto w-full max-w-[320px] text-black">
                        {generateReceiptPart(selectedOrder, printCopyType === 'ALL' ? 'CUSTOMER COPY' : `${printCopyType} COPY`)}
                    </div>
                  ) : (
                    <div className="space-y-8">
                        <div className="p-8 bg-white rounded-[32px] border border-slate-100 space-y-4 shadow-sm">
                           <div className="flex justify-between items-start">
                              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity Profile</label><p className="text-[18px] font-black text-slate-950 uppercase italic leading-tight mt-1">{selectedOrder.customerName}</p></div>
                              <div className="text-right">
                                 {selectedOrder.riderName && (<div className="mb-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logistics</label><p className="text-[12px] font-black text-sky-600 uppercase italic">{selectedOrder.riderName}</p></div>)}
                                 <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Operator (Op)</label><p className="text-[12px] font-black text-sky-600 uppercase italic mt-1">{selectedOrder.createdBy}</p></div>
                              </div>
                           </div>
                           <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Address Protocol</label><p className="text-[11px] font-bold text-slate-600 uppercase italic">{selectedOrder.address}, {selectedOrder.city}</p></div>
                           <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                              <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Settlement Method</label><p className="text-[14px] font-black text-emerald-600 uppercase italic">{selectedOrder.paymentMethod}</p></div>
                              <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border ${selectedOrder.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>{selectedOrder.status}</span>
                           </div>
                           {selectedOrder.remark && (<div className="pt-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session Remarks</label><p className="text-[11px] font-black text-amber-600 uppercase italic bg-amber-50 p-2 rounded-lg border border-amber-100">{selectedOrder.remark}</p></div>)}
                        </div>
                        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                           <table className="w-full text-left font-bold text-gray-900"><thead className="bg-slate-50/50 border-b border-slate-100"><tr className="text-[9px] font-black text-slate-400 uppercase"><th className="px-8 py-4">Asset Detail</th><th className="px-8 py-4 text-right">Value</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedOrder.items.map((item, idx) => (<tr key={idx}><td className="px-8 py-4"><span className="text-[12px] font-black uppercase italic text-slate-800">{item.productName} (x{item.qty})</span></td><td className="px-8 py-4 text-right text-[12px] font-black italic text-slate-900">₱{formatCurrency(item.total).replace('₱','')}</td></tr>))}</tbody></table>
                        </div>
                        <div className="space-y-2">
                           {selectedOrder.totalDiscount > 0 && (<div className="flex justify-between items-center px-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest"><span>Applied Discount</span><span className="text-emerald-500">- ₱{formatCurrency(selectedOrder.totalDiscount)}</span></div>)}
                           <div className="p-8 bg-slate-950 rounded-[40px] flex justify-between items-center text-white shadow-2xl mt-4"><span className="text-[10px] font-black uppercase italic opacity-50">Settlement Aggregate</span><span className="text-3xl font-black italic">{formatCurrency(selectedOrder.totalAmount)}</span></div>
                        </div>
                    </div>
                  )}
               </div>
               <div className="p-10 border-t bg-white flex flex-col gap-4 shrink-0 no-print">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-4 gap-1">
                        <button onClick={() => handlePrintRequest('CUSTOMER')} className={`py-3 rounded-xl font-black uppercase text-[8px] transition-all border-2 ${printCopyType === 'CUSTOMER' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-900 border-slate-200'}`}>Cust</button>
                        <button onClick={() => handlePrintRequest('GATE')} className={`py-3 rounded-xl font-black uppercase text-[8px] transition-all border-2 ${printCopyType === 'GATE' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-900 border-slate-200'}`}>Gate</button>
                        <button onClick={() => handlePrintRequest('STORE')} className={`py-3 rounded-xl font-black uppercase text-[8px] transition-all border-2 ${printCopyType === 'STORE' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-900 border-slate-200'}`}>Store</button>
                        <button onClick={() => handlePrintRequest('ALL')} className={`py-3 rounded-xl font-black uppercase text-[8px] transition-all border-2 ${printCopyType === 'ALL' ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-900 border-slate-200'}`}>ALL</button>
                    </div>
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

export default SalesReport;