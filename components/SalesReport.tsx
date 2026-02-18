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

  const hasGlobalAccess = user.assignedStoreIds.includes('all');

  useEffect(() => {
    setSearchQuery('');
  }, []);

  const filteredOrders = useMemo(() => {
    const anchor = new Date(date);
    let base = orders.filter(o => hasGlobalAccess || o.storeId === user.selectedStoreId);

    if (statusFilter !== 'ALL') base = base.filter(o => o.status === statusFilter);
    if (paymentFilter !== 'ALL') base = base.filter(o => o.paymentMethod === paymentFilter);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter(o => 
        o.customerName.toLowerCase().includes(q) || 
        o.id.toLowerCase().includes(q) ||
        o.createdBy.toLowerCase().includes(q) ||
        o.paymentMethod.toLowerCase().includes(q)
      );
    }

    if (reportPeriod === 'daily') {
      base = base.filter(o => toPHDateString(o.createdAt) === date);
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
  }, [orders, user.selectedStoreId, date, reportPeriod, statusFilter, paymentFilter, hasGlobalAccess, searchQuery]);

  const arCollectionRegistry = useMemo(() => {
    const anchor = new Date(date);
    const payments = receivablePayments.filter(rp => {
        const matchesNode = hasGlobalAccess || orders.find(o => o.id === (receivables.find(r => r.id === rp.receivableId)?.orderId))?.storeId === user.selectedStoreId;
        if (!matchesNode) return false;
        const pDate = toPHDateString(rp.paidAt);
        if (reportPeriod === 'daily') return pDate === date;
        const d = new Date(rp.paidAt);
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
        const ar = receivables.find(r => r.id === rp.receivableId);
        const order = orders.find(o => o.id === ar?.orderId);
        return { payment: rp, order, ar };
    }).filter(item => !!item.order).sort((a,b) => b.payment.paidAt.localeCompare(a.payment.paidAt));
  }, [receivablePayments, receivables, orders, date, reportPeriod, hasGlobalAccess, user.selectedStoreId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [date, reportPeriod, auditMode, statusFilter, paymentFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
  const arTotalPages = Math.max(1, Math.ceil(arCollectionRegistry.length / ITEMS_PER_PAGE));
  const currentTotalPages = auditMode === 'SALES' ? totalPages : arTotalPages;

  const paginatedOrders = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage, totalPages]);

  const paginatedAR = useMemo(() => {
    const safePage = Math.min(currentPage, arTotalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return arCollectionRegistry.slice(start, start + ITEMS_PER_PAGE);
  }, [arCollectionRegistry, currentPage, arTotalPages]);

  const stats = useMemo(() => {
    const revenueOrders = filteredOrders.filter(o => o.status === OrderStatus.ORDERED);
    const totalSales = revenueOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const newARGenerated = filteredOrders.filter(o => o.status === OrderStatus.RECEIVABLE).reduce((sum, o) => sum + o.totalAmount, 0);
    const arCollectionsTotal = arCollectionRegistry.reduce((sum, item) => sum + item.payment.amount, 0);
    const paymentBreakdown: Record<PaymentMethod, number> = { 'CASH': 0, 'GCASH': 0, 'MAYA': 0, 'BANK': 0, 'OTHER': 0 };
    revenueOrders.forEach(o => { const m = o.paymentMethod as PaymentMethod; if (paymentBreakdown[m] !== undefined) paymentBreakdown[m] += o.totalAmount; });
    arCollectionRegistry.forEach(item => { const m = item.payment.paymentMethod as PaymentMethod; if (paymentBreakdown[m] !== undefined) paymentBreakdown[m] += item.payment.amount; });
    return { totalSales, newARGenerated, arCollectionsTotal, paymentBreakdown };
  }, [filteredOrders, arCollectionRegistry]);

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
             {order.items.map((item: any, i: number) => (
                <div key={i}><div className="flex justify-between font-black uppercase italic text-[10px] text-black"><span>{item.productName} (x{item.qty})</span><span>₱{formatCurrency(item.total).replace('₱','')}</span></div></div>
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

  const formatCurrency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const activeStore = stores.find(s => s.id === user.selectedStoreId);
  const headerName = hasGlobalAccess ? 'ACECORP ENTERPRISE' : (activeStore?.name?.toUpperCase() || 'ACECORP BRANCH');

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden text-slate-900 font-sans">
      <style>{`
        @media print {
          /* Force page dimensions and margins */
          @page { size: portrait; margin: 15mm; }
          
          /* Neutralize application overflow constraints */
          html, body { 
            height: auto !important; 
            overflow: visible !important; 
            background: white !important;
            color: black !important;
            font-family: 'Inter', sans-serif;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Force all containers to expand vertically */
          #root, main, .flex-1, .h-screen, .overflow-hidden, .custom-scrollbar {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            min-height: 0 !important;
            position: static !important;
          }

          /* Hide interface chrome */
          .no-print, header, aside, .pagination-controls, button { 
            display: none !important; 
          }

          /* Optimize table for multi-page document */
          #audit-manifest-report-root {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            padding: 0 !important;
          }

          #audit-manifest-report-root table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
            display: table !important;
          }

          /* Repeat headers on every page */
          #audit-manifest-report-root thead {
            display: table-header-group !important;
          }

          #audit-manifest-report-root tr {
            page-break-inside: avoid !important;
            display: table-row !important;
          }

          #audit-manifest-report-root td, #audit-manifest-report-root th {
            border-bottom: 1px solid #ddd !important;
            padding: 8px !important;
          }
          
          /* Thermal Reprint Logic */
          #audit-thermal-print-root {
            display: none !important;
          }
        }
      `}</style>
      
      {/* PROFESSIONAL FULL MANIFEST PRINT (Multi-page optimized) */}
      <div id="audit-manifest-report-root" className="hidden">
         <div className="text-center mb-10 border-b-4 border-slate-900 pb-6">
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">{headerName}</h1>
            <h2 className="text-sm font-bold uppercase tracking-[0.4em] text-slate-500 mt-2">Registry Audit Manifest • System Extract</h2>
            <div className="flex justify-center gap-10 mt-4 text-[10px] font-black uppercase">
               <p>Date Range: {reportPeriod.toUpperCase()} ({date})</p>
               <p>Auth Operator: {user.username}</p>
            </div>
         </div>

         {auditMode === 'SALES' ? (
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-slate-50 text-[10px] font-black uppercase">
                    <th className="py-4 px-2">Timestamp</th>
                    <th className="py-4 px-2">Ticket #</th>
                    <th className="py-4 px-2">Customer Profile</th>
                    <th className="py-4 px-2">Method</th>
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
                       <td className="py-3 px-2">{o.paymentMethod}</td>
                       <td className="py-3 px-2 text-sky-600 font-bold">{o.createdBy}</td>
                       <td className="py-3 px-2 text-center">{o.status}</td>
                       <td className="py-3 px-2 text-right font-black">{formatCurrency(o.totalAmount)}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
         ) : (
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-slate-50 text-[10px] font-black uppercase">
                    <th className="py-4 px-2">Timestamp</th>
                    <th className="py-4 px-2">PAY #</th>
                    <th className="py-4 px-2">Entity Profile</th>
                    <th className="py-4 px-2">Method</th>
                    <th className="py-4 px-2 text-right">Value</th>
                 </tr>
              </thead>
              <tbody className="text-[10px] font-medium uppercase">
                 {arCollectionRegistry.map((item, i) => (
                    <tr key={i} className="border-b border-slate-200">
                       <td className="py-3 px-2 font-mono">{toPHDateString(item.payment.paidAt)}</td>
                       <td className="py-3 px-2">PAY-{item.payment.id.slice(-4)}</td>
                       <td className="py-3 px-2 font-black italic">{item.order?.customerName}</td>
                       <td className="py-3 px-2">{item.payment.paymentMethod}</td>
                       <td className="py-3 px-2 text-right font-black">{formatCurrency(item.payment.amount)}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
         )}

         <div className="mt-12 pt-6 border-t-2 border-slate-300 flex justify-between items-baseline">
            <div className="text-[11px] font-black uppercase">
               <p className="text-slate-500 mb-1">AGGREGATE AUDIT FOOTER</p>
               <p className="text-lg">Audit Total Inflow: {formatCurrency(stats.totalSales + stats.arCollectionsTotal)}</p>
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase">Registry Lock: {new Date().toLocaleString()}</p>
         </div>
      </div>

      {/* INTELLIGENCE HUB SUMMARY */}
      <div className="px-8 py-6 bg-slate-950 text-white flex flex-wrap items-center justify-between shadow-2xl relative overflow-hidden shrink-0 no-print">
         <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-12 relative z-10 w-full sm:w-auto">
            <div className="shrink-0 border-l-4 border-sky-500 pl-6">
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 leading-none">Net Actual Cash Inflow</p>
               <h2 className="text-3xl font-black italic tracking-tighter text-white leading-none">{formatCurrency(stats.totalSales + stats.arCollectionsTotal)}</h2>
            </div>
            <div className="flex flex-wrap gap-8 overflow-x-auto no-scrollbar items-center">
               <div className="shrink-0">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">Total Booked Revenue</p>
                  <p className="text-lg font-black italic tracking-tight text-white leading-none">{formatCurrency(stats.totalSales + stats.newARGenerated)}</p>
               </div>
               <div className="shrink-0">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">AR Collections</p>
                  <p className="text-lg font-black italic tracking-tight text-emerald-400 leading-none">{formatCurrency(stats.arCollectionsTotal)}</p>
               </div>
               <div className="hidden lg:flex gap-6 border-l border-white/10 pl-6">
                  {Object.entries(stats.paymentBreakdown).filter(([_,v]) => v > 0).slice(0, 3).map(([method, amount]) => (
                    <div key={method} className="shrink-0">
                       <p className="text-[7px] font-black text-slate-600 uppercase mb-1 leading-none">{method}</p>
                       <p className="text-xs font-black italic text-slate-300 leading-none">{formatCurrency(amount as number)}</p>
                    </div>
                  ))}
               </div>
            </div>
         </div>
         <div className="no-print">
            <button onClick={() => window.print()} className="px-6 py-3 bg-white text-slate-950 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 hover:bg-sky-50 transition-all active:scale-95"><i className="fas fa-print"></i> Full Audit Report</button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden no-print">
         <aside className="w-[320px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
            <div className="p-10 space-y-12 h-full overflow-y-auto custom-scrollbar">
               <div>
                  <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">{headerName}</h1>
                  <p className="text-[9px] font-bold text-sky-600 uppercase tracking-[0.2em] mt-2">Internal Audit Protocol</p>
               </div>
               
               <div className="space-y-10">
                  <div className="space-y-4">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Audit Target</label>
                     <div className="grid grid-cols-1 gap-2 p-1.5 bg-slate-50 rounded-[24px] border border-slate-100">
                        <button onClick={() => setAuditMode('SALES')} className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${auditMode === 'SALES' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Sales Registry</button>
                        <button onClick={() => setAuditMode('AR_COLLECTION')} className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${auditMode === 'AR_COLLECTION' ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>AR Collections</button>
                     </div>
                  </div>

                  <div className="space-y-4"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Reference Date</label><CustomDatePicker value={date} onChange={setDate} className="w-full shadow-sm" /></div>
                  
                  <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Time Scope</label>
                        <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm">
                           {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map(p => (
                             <button key={p} onClick={() => setReportPeriod(p)} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${reportPeriod === p ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400'}`}>{p}</button>
                           ))}
                        </div>
                     </div>
                     
                     {auditMode === 'SALES' && (
                        <>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status Filter</label>
                              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full bg-white border border-slate-100 p-2.5 rounded-xl text-[10px] font-black uppercase italic outline-none">
                                 <option value="ALL">All Status</option>
                                 <option value={OrderStatus.ORDERED}>Ordered</option>
                                 <option value={OrderStatus.RECEIVABLE}>Receivable</option>
                                 <option value={OrderStatus.CANCELLED}>Cancelled</option>
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Payment Method</label>
                              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as any)} className="w-full bg-white border border-slate-100 p-2.5 rounded-xl text-[10px] font-black uppercase italic outline-none">
                                 <option value="ALL">All Methods</option>
                                 <option value="CASH">Cash</option>
                                 <option value="GCASH">GCash</option>
                                 <option value="MAYA">Maya</option>
                                 <option value="BANK">Bank</option>
                                 <option value="OTHER">Other</option>
                              </select>
                           </div>
                        </>
                     )}
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
               <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Displaying turn <span className="text-slate-950">{currentPage}</span> of {currentTotalPages}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-slate-50/20">
               <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full min-w-[1000px]">
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                           <tr>
                              <th className="px-10 py-6">Timestamp</th>
                              <th className="px-4 py-6 text-sky-600">Ticket #</th>
                              <th className="px-10 py-6">Customer / Entity Profile</th>
                              <th className="px-4 py-6">Method</th>
                              <th className="px-6 py-6">Op</th>
                              <th className="px-6 py-6 text-center">Status</th>
                              <th className="px-10 py-6 text-right">Total Settlement</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {auditMode === 'SALES' ? (
                             paginatedOrders.map(o => (
                                <tr key={o.id} onClick={() => { setSelectedOrder(o); setShowOrderReceipt(false); setPrintCopyType('ALL'); }} className="hover:bg-sky-50/50 transition-colors cursor-pointer group">
                                   <td className="px-10 py-6 font-mono text-[10px]">
                                      <div className="font-bold text-slate-900">{new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                      <div className="text-[8px] opacity-40 uppercase">{toPHDateString(o.createdAt)}</div>
                                   </td>
                                   <td className="px-4 py-6"><span className="font-mono font-black text-[10px] text-sky-600">#{o.id.slice(-8)}</span></td>
                                   <td className="px-10 py-6"><p className="text-[12px] font-black uppercase italic text-slate-900 leading-none">{o.customerName}</p></td>
                                   <td className="px-4 py-6"><span className="text-[9px] font-bold text-slate-500 uppercase">{o.paymentMethod}</span></td>
                                   <td className="px-6 py-6"><p className="text-[11px] font-black text-sky-600 uppercase italic leading-none">{o.createdBy}</p></td>
                                   <td className="px-6 py-6 text-center"><span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${o.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : o.status === OrderStatus.RECEIVABLE ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{o.status}</span></td>
                                   <td className="px-10 py-6 text-right"><span className="text-[16px] font-black italic text-slate-950">{formatCurrency(o.totalAmount)}</span></td>
                                </tr>
                             ))
                           ) : (
                             paginatedAR.map((item, i) => (
                                <tr key={i} className="hover:bg-emerald-50/50 transition-colors group">
                                   <td className="px-10 py-6 text-[10px] font-bold text-slate-900">{new Date(item.payment.paidAt).toLocaleDateString()}</td>
                                   <td className="px-4 py-6"><span className="font-mono font-black text-sky-600">PAY-{item.payment.id.slice(-4)}</span></td>
                                   <td className="px-10 py-6 font-black uppercase italic text-slate-800 text-[12px]">{item.order?.customerName}</td>
                                   <td className="px-4 py-6 text-[10px] font-bold text-slate-500">{item.payment.paymentMethod}</td>
                                   <td colSpan={2} className="px-6 py-6 text-center"><span className="px-3 py-1 rounded-lg text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">COLLECTED</span></td>
                                   <td className="px-10 py-6 text-right font-black italic text-emerald-700 text-base">{formatCurrency(item.payment.amount)}</td>
                                </tr>
                             ))
                           )}
                        </tbody>
                     </table>
                  </div>
                  
                  {/* PAGINATION ENGINE */}
                  {currentTotalPages > 1 && (
                    <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 pagination-controls">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry turn {currentPage} of {currentTotalPages}</p>
                       <div className="flex gap-4">
                          <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="px-8 py-3 bg-white text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-sky-50 transition-all disabled:opacity-20 active:scale-95">Previous Turn</button>
                          <button disabled={currentPage === currentTotalPages} onClick={() => setCurrentPage(prev => Math.min(currentTotalPages, prev + 1))} className="px-8 py-3 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all disabled:opacity-20 active:scale-95">Next Turn</button>
                       </div>
                    </div>
                  )}
               </div>
            </div>
         </div>
      </div>

      {/* DETAIL OVERLAY */}
      {selectedOrder && (
         <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in zoom-in duration-300 no-print" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white w-full max-w-[500px] rounded-[56px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]" onClick={e => e.stopPropagation()}>
               <div className="p-10 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-6">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">{showOrderReceipt ? 'Registry Reprint' : 'Order Asset Detail'}</h3>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-3xl"></i></button>
               </div>
               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/30">
                  {showOrderReceipt ? (
                    <div className="bg-white p-10 shadow-xl border border-slate-200 mx-auto w-full max-w-[320px] text-black">
                        {generateReceiptPart(selectedOrder, 'SYSTEM REPRINT')}
                    </div>
                  ) : (
                    <div className="space-y-8">
                        <div className="p-8 bg-white rounded-[32px] border border-slate-100 space-y-4 shadow-sm">
                           <div className="flex justify-between items-start">
                              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity Profile</label><p className="text-[18px] font-black text-slate-950 uppercase italic leading-tight mt-1">{selectedOrder.customerName}</p></div>
                              <div className="text-right">
                                 <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Operator (Op)</label><p className="text-[13px] font-black text-sky-600 uppercase italic mt-1">{selectedOrder.createdBy}</p></div>
                              </div>
                           </div>
                           <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                              <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Settlement Path</label><p className="text-[14px] font-black text-emerald-600 uppercase italic">{selectedOrder.paymentMethod}</p></div>
                              <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border ${selectedOrder.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>{selectedOrder.status}</span>
                           </div>
                        </div>
                        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden font-bold">
                           <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[9px] font-black text-slate-400 uppercase"><th className="px-8 py-4">Registry SKU</th><th className="px-8 py-4 text-right">Value</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{selectedOrder.items.map((item, idx) => (<tr key={idx}><td className="px-8 py-5 text-[13px] font-black uppercase italic text-slate-800">{item.productName} (x{item.qty})</td><td className="px-8 py-5 text-right text-[13px] font-black italic text-slate-950">₱{formatCurrency(item.total).replace('₱','')}</td></tr>))}</tbody>
                           </table>
                        </div>
                        <div className="p-8 bg-slate-950 rounded-[40px] flex justify-between items-center text-white shadow-2xl"><span className="text-[10px] font-black uppercase italic opacity-50">Settlement Aggregate</span><span className="text-3xl font-black italic">{formatCurrency(selectedOrder.totalAmount)}</span></div>
                    </div>
                  )}
               </div>
               <div className="p-10 border-t bg-white flex flex-col gap-4 shrink-0">
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => { setShowOrderReceipt(!showOrderReceipt); }} className="py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all">{showOrderReceipt ? 'View Audit Log' : 'View Thermal Copy'}</button>
                    <button onClick={() => handlePrintRequest('ALL')} className="py-5 bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 hover:bg-sky-700 active:scale-95"><i className="fas fa-print"></i> Authorize Print</button>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] active:scale-95">Dismiss Detailed View</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default SalesReport;