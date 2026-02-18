
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
  
  // Pagination State - 25 items per page for Audit
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const hasGlobalAccess = user.assignedStoreIds.includes('all');

  useEffect(() => {
    setSearchQuery('');
  }, []);

  const filteredOrders = useMemo(() => {
    const anchor = new Date(date);
    let base = orders.filter(o => hasGlobalAccess || o.storeId === user.selectedStoreId);

    if (statusFilter !== 'ALL') {
      base = base.filter(o => o.status === statusFilter);
    }

    if (paymentFilter !== 'ALL') {
      base = base.filter(o => o.paymentMethod === paymentFilter);
    }

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
    } 
    
    else if (reportPeriod === 'weekly') {
      const start = new Date(anchor);
      start.setDate(anchor.getDate() - anchor.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      base = base.filter(o => {
        const d = new Date(o.createdAt);
        return d >= start && d <= end;
      });
    }

    else if (reportPeriod === 'monthly') {
      const year = anchor.getFullYear();
      const month = anchor.getMonth();
      base = base.filter(o => {
        const d = new Date(o.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }

    return base.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, user.selectedStoreId, date, reportPeriod, statusFilter, paymentFilter, hasGlobalAccess, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [date, reportPeriod, auditMode, statusFilter, paymentFilter, searchQuery]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

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

  const paginatedAR = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return arCollectionRegistry.slice(start, start + ITEMS_PER_PAGE);
  }, [arCollectionRegistry, currentPage]);

  const arTotalPages = Math.ceil(arCollectionRegistry.length / ITEMS_PER_PAGE);

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
          <div className="w-48 h-48 mx-auto mb-4">
             <AceCorpLogo customUrl={logoUrl} />
          </div>
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
          @page { 
            size: A4 portrait; 
            margin: 15mm; 
          }
          
          html, body, #root, [class*="flex-1"], main, section, div {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
            width: auto !important;
          }

          body * { visibility: hidden !important; }

          body:has(#audit-thermal-print-root:not(.hidden)) #audit-manifest-report-root {
            display: none !important;
          }

          #audit-thermal-print-root, #audit-thermal-print-root * { 
            visibility: visible !important; 
            display: block !important; 
          }
          #audit-thermal-print-root { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 80mm !important; 
            background: white !important; 
          }
          #audit-thermal-print-root .receipt-copy { 
            width: 68mm !important; 
            margin: 0 auto !important; 
            break-after: page; 
            page-break-after: always; 
            display: block !important; 
          }
          
          #audit-manifest-report-root, #audit-manifest-report-root * { 
            visibility: visible !important; 
          }
          #audit-manifest-report-root { 
            position: static !important; 
            width: 100% !important; 
            display: block !important;
            background: white !important; 
            color: black !important; 
            padding: 0 !important;
            margin: 0 !important;
          }
          #audit-manifest-report-root .report-container { 
            width: 100% !important; 
            padding: 5mm !important; 
          }
          
          #audit-manifest-report-root table { 
            width: 100% !important; 
            border-collapse: collapse !important; 
            display: table !important;
            table-layout: auto !important;
            page-break-inside: auto !important;
          }
          
          #audit-manifest-report-root thead { 
            display: table-header-group !important;
          }
          
          #audit-manifest-report-root tr { 
            display: table-row !important; 
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          
          #audit-manifest-report-root th, #audit-manifest-report-root td { 
            display: table-cell !important;
            border-bottom: 1px solid #000 !important; 
            padding: 10px 8px !important; 
            text-align: left !important;
            font-size: 10px !important;
          }

          .no-print { display: none !important; }
        }
      `}</style>
      
      {/* THERMAL PRINT ROOT */}
      <div id="audit-thermal-print-root" className={selectedOrder ? "block" : "hidden"}>
         {selectedOrder && (
           <div className="w-[80mm] bg-white">
              {(printCopyType === 'ALL' || printCopyType === 'CUSTOMER') && generateReceiptPart(selectedOrder, 'CUSTOMER COPY')}
              {(printCopyType === 'ALL' || printCopyType === 'GATE') && generateReceiptPart(selectedOrder, 'GATE PASS')}
              {(printCopyType === 'ALL' || printCopyType === 'STORE') && generateReceiptPart(selectedOrder, 'STORE COPY')}
           </div>
         )}
      </div>

      {/* SALES MANIFEST ROOT - CRITICAL: Targets COMPLETE ARRAY for unpaginated printing */}
      <div id="audit-manifest-report-root" className={selectedOrder ? "hidden" : "hidden text-black font-sans"}>
          <div className="report-container">
             <div className="text-center mb-10 border-b-4 border-black pb-8">
                <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-2">{headerName}</h1>
                <p className="text-sm font-bold uppercase tracking-[0.3em] opacity-80">Master Audit Registry • Sales Manifest (COMPLETE)</p>
                <div className="mt-8 flex justify-center items-center gap-12 text-[10px] font-black uppercase">
                   <div className="flex flex-col"><span className="opacity-40">Period</span><span>{reportPeriod.toUpperCase()}</span></div>
                   <div className="flex flex-col"><span className="opacity-40">Registry Date</span><span>{date}</span></div>
                   <div className="flex flex-col text-sky-600"><span className="opacity-40">Audit Op</span><span>{user.username}</span></div>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-10 mb-12 py-8 bg-slate-50/50 rounded-[20px] border border-black/5 px-10">
                <div className="space-y-4">
                   <p className="text-[10px] font-black uppercase text-slate-400 border-b border-black/10 pb-2">Fiscal Performance Summary</p>
                   <div className="flex justify-between text-xs"><span>Total Records in Period:</span> <b>{filteredOrders.length} Entries</b></div>
                   <div className="flex justify-between text-xs"><span>Booked Revenue:</span> <b>{formatCurrency(stats.totalSales + stats.newARGenerated)}</b></div>
                   <div className="flex justify-between text-xs text-emerald-600"><span>AR Collections:</span> <b>{formatCurrency(stats.arCollectionsTotal)}</b></div>
                   <div className="flex justify-between font-black text-xl border-t-2 border-black pt-4 mt-2"><span>Liquid Inflow:</span> <span>{formatCurrency(stats.totalSales + stats.arCollectionsTotal)}</span></div>
                </div>
                <div className="border-l border-black/10 pl-12 space-y-3">
                   <p className="text-[10px] font-black uppercase text-slate-400 border-b border-black/10 pb-2">Settlement Distribution</p>
                   {Object.entries(stats.paymentBreakdown).map(([m, val]) => (
                      <div key={m} className="flex justify-between text-[11px] font-bold"><span>{m}:</span> <b>{formatCurrency(val as number)}</b></div>
                   ))}
                </div>
             </div>

             <table className="w-full">
                <thead>
                   <tr className="bg-slate-100 border-y-2 border-black">
                      <th className="p-3 text-[10px] font-black uppercase text-left">Time</th>
                      <th className="p-3 text-[10px] font-black uppercase text-left">Ticket #</th>
                      <th className="p-3 text-[10px] font-black uppercase text-left">Entity Profile</th>
                      <th className="p-3 text-[10px] font-black uppercase text-left">Method</th>
                      <th className="p-3 text-[10px] font-black uppercase text-center">Status</th>
                      <th className="p-3 text-[10px] font-black uppercase text-right">Settlement</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                   {filteredOrders.map(o => (
                      <tr key={o.id}>
                         <td className="p-3 text-[10px] font-mono text-left font-bold">{new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                         <td className="p-3 text-[10px] font-mono font-black text-left text-sky-700">#{o.id.slice(-8)}</td>
                         <td className="p-3 text-[10px] uppercase font-black text-left truncate max-w-[250px]">{o.customerName}</td>
                         <td className="p-3 text-[10px] font-bold text-left">{o.paymentMethod}</td>
                         <td className="p-3 text-center text-[9px] font-black uppercase italic">{o.status}</td>
                         <td className="p-3 text-right font-black italic text-[11px]">{formatCurrency(o.totalAmount)}</td>
                      </tr>
                   ))}
                </tbody>
             </table>

             <div className="mt-24 flex justify-between items-end border-t-2 border-dashed border-black/30 pt-12 text-[10px] uppercase font-black">
                <div className="space-y-8">
                  <div>
                    <p className="opacity-40 mb-10">Authenticated & Prepared By:</p>
                    <div className="w-64 border-b-2 border-black mb-2"></div>
                    <p className="text-sky-600">ID: {user.username}</p>
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <p className="opacity-40">Audit Mirror Information</p>
                  <p>Generated: {new Date().toLocaleString()}</p>
                  <p className="font-mono text-[9px] tracking-tight">ACECORP_SECURE_AUDIT_V4.0</p>
                </div>
             </div>
          </div>
      </div>

      <div className="px-8 py-5 bg-[#050810] text-white flex flex-wrap items-center justify-between shadow-2xl relative overflow-hidden shrink-0 gap-4 sm:gap-0 no-print">
         <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-12 relative z-10 w-full sm:w-auto">
            <div className="shrink-0">
               <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 leading-none">Actual Cash Inflow</p>
               <h2 className="text-xl sm:text-3xl font-black italic tracking-tighter text-[#38bdf8] leading-none">{formatCurrency(stats.totalSales + stats.arCollectionsTotal)}</h2>
            </div>
            <div className="hidden sm:block h-12 w-px bg-white/10 mx-4"></div>
            <div className="flex flex-wrap gap-4 sm:gap-8 overflow-x-auto no-scrollbar items-center">
               <div className="shrink-0"><p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1.5 leading-none">Total Booked Revenue</p><p className="text-xs sm:text-lg font-black italic tracking-tight text-white leading-none">{formatCurrency(stats.totalSales + stats.newARGenerated)}</p></div>
               <div className="shrink-0"><p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1.5 leading-none">AR Collected</p><p className="text-xs sm:text-lg font-black italic tracking-tight text-[#10b981] leading-none">{formatCurrency(stats.arCollectionsTotal)}</p></div>
               <div className="shrink-0"><p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1.5 leading-none">NEW AR GENERATED</p><p className="text-xs sm:text-lg font-black italic tracking-tight text-[#f59e0b] leading-none">{formatCurrency(stats.newARGenerated)}</p></div>
               <div className="h-8 w-px bg-white/5 mx-2"></div>
               {Object.entries(stats.paymentBreakdown).map(([method, amount]) => (
                  <div key={method} className="shrink-0">
                     <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-[0.1em] mb-1.5 leading-none">{method}</p>
                     <p className="text-xs sm:text-lg font-black italic text-white leading-none">{formatCurrency(amount as number)}</p>
                  </div>
               ))}
            </div>
         </div>
         <button onClick={() => { setSelectedOrder(null); setShowOrderReceipt(false); setTimeout(() => window.print(), 100); }} className="relative z-10 bg-[#2d89c8] hover:bg-sky-500 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">Generate Audit Manifest</button>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0 no-print">
         <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
            <div className="p-8 space-y-10">
               <div><h1 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">{headerName}</h1><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Audit Ledger Interface</p></div>
               <div className="space-y-8">
                  <div className="space-y-3">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Audit Focus</label>
                     <div className="flex flex-col gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <button onClick={() => setAuditMode('SALES')} className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${auditMode === 'SALES' ? 'bg-[#0f172a] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Sales Registry</button>
                        <button onClick={() => setAuditMode('AR_COLLECTION')} className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${auditMode === 'AR_COLLECTION' ? 'bg-[#0f172a] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>AR Collections</button>
                     </div>
                  </div>
                  <div className="space-y-3"><label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Reference Date</label><CustomDatePicker value={date} onChange={setDate} className="w-full" /></div>
                  <div className="space-y-3 p-6 bg-slate-50 rounded-[32px] border border-slate-100"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Registry Type</label><div className="flex gap-2 p-1 bg-white rounded-xl shadow-sm">{(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map(p => (<button key={p} onClick={() => setReportPeriod(p)} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${reportPeriod === p ? 'bg-[#2d89c8] text-white shadow-md' : 'text-slate-400'}`}>{p}</button>))}</div></div>
               </div>
            </div>
         </aside>

         <div className="flex-1 flex flex-col bg-white">
            <div className="p-8 border-b flex justify-between items-center bg-white shrink-0 no-print">
               <div className="relative w-full max-w-xl group">
                  <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search Ledger..." className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-100 rounded-[24px] text-xs font-bold shadow-inner outline-none focus:bg-white focus:border-sky-400 transition-all text-slate-900 uppercase" />
               </div>
               <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {auditMode === 'SALES' ? filteredOrders.length : arCollectionRegistry.length} Total Records Analyzed
                  </span>
               </div>
            </div>
            <div className="flex-1 overflow-x-auto custom-scrollbar p-8 flex flex-col">
               <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden min-w-[900px] flex-1">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 text-[9px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10 shadow-sm"><tr><th className="px-8 py-6">Timestamp</th><th className="px-4 py-6 text-sky-600">Ticket #</th><th className="px-8 py-6">Entity Profile</th><th className="px-4 py-6">Method</th><th className="px-4 py-6">Operator</th><th className="px-6 py-6 text-center">Status</th><th className="px-8 py-6 text-right">Value</th></tr></thead>
                     <tbody className="divide-y divide-slate-50">
                        {auditMode === 'SALES' ? (
                          paginatedOrders.length === 0 ? (
                            <tr><td colSpan={7} className="px-10 py-20 text-center text-slate-300 font-black uppercase italic tracking-widest opacity-40">Empty sales registry in this window</td></tr>
                          ) : (
                            paginatedOrders.map(o => (
                               <tr key={o.id} onClick={() => { setSelectedOrder(o); setShowOrderReceipt(false); setPrintCopyType('ALL'); }} className="hover:bg-slate-50/50 transition-colors cursor-pointer group"><td className="px-8 py-6 font-mono text-[10px] text-slate-600"><div className="font-bold text-slate-900">{new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div><div className="text-[8px] opacity-40">{toPHDateString(o.createdAt)}</div></td><td className="px-4 py-6"><span className="font-mono font-black text-[10px] text-sky-600">#{o.id.slice(-8)}</span></td><td className="px-8 py-6"><p className="text-[11px] font-black uppercase italic text-slate-900 leading-none">{o.customerName}</p></td><td className="px-4 py-6"><span className="text-[9px] font-bold text-slate-500 uppercase">{o.paymentMethod}</span></td><td className="px-4 py-6"><p className="text-[11px] font-black uppercase italic text-sky-600">{o.createdBy}</p></td><td className="px-6 py-6 text-center"><span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${o.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : o.status === OrderStatus.RECEIVABLE ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-500'}`}>{o.status}</span></td><td className="px-8 py-6 text-right"><span className="text-[14px] font-black italic text-slate-900">{formatCurrency(o.totalAmount)}</span></td></tr>
                            ))
                          )
                        ) : (
                          paginatedAR.length === 0 ? (
                            <tr><td colSpan={7} className="px-10 py-20 text-center text-slate-300 font-black uppercase italic tracking-widest opacity-40">No collections registered in window</td></tr>
                          ) : (
                            paginatedAR.map((item, i) => (
                               <tr key={i} className="hover:bg-slate-50/50 transition-colors group"><td className="px-8 py-6 text-[10px] font-bold text-slate-900">{new Date(item.payment.paidAt).toLocaleDateString()}</td><td className="px-4 py-6"><span className="font-mono font-black text-sky-600">PAY-{item.payment.id.slice(-4)}</span></td><td className="px-8 py-6 font-black uppercase italic text-slate-800 text-[11px]">{item.order?.customerName}</td><td className="px-4 py-6 text-[10px] font-bold text-slate-500">{item.payment.paymentMethod}</td><td colSpan={2} className="px-6 py-6 text-center"><span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">COLLECTED</span></td><td className="px-8 py-6 text-right font-black italic text-emerald-700">{formatCurrency(item.payment.amount)}</td></tr>
                            ))
                          )
                        )}
                     </tbody>
                  </table>
               </div>
               
               {/* Pagination Controls - Egress Control Implementation */}
               {((auditMode === 'SALES' && totalPages > 1) || (auditMode === 'AR_COLLECTION' && arTotalPages > 1)) && (
                 <div className="mt-8 flex items-center justify-between shrink-0 bg-white px-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Showing Page {currentPage} of {auditMode === 'SALES' ? totalPages : arTotalPages}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="px-6 py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button 
                        disabled={currentPage === (auditMode === 'SALES' ? totalPages : arTotalPages)}
                        onClick={() => setCurrentPage(prev => Math.min(auditMode === 'SALES' ? totalPages : arTotalPages, prev + 1))}
                        className="px-6 py-2.5 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                 </div>
               )}
            </div>
         </div>
      </div>

      {selectedOrder && (
         <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in zoom-in duration-300 no-print" onClick={() => setSelectedOrder(null)}>
            <div className="bg-[#f8fafc] w-full max-w-[500px] rounded-[56px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]" onClick={e => e.stopPropagation()}>
               <div className="p-8 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4"><h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">{showOrderReceipt ? 'Manifest Mirror' : 'Order Detail'}</h3><button onClick={() => setShowOrderReceipt(!showOrderReceipt)} className="px-3 py-1 bg-sky-50 text-sky-600 rounded-lg text-[9px] font-black mt-2 uppercase">{showOrderReceipt ? 'View Audit' : 'View Receipt'}</button></div>
                  <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-3xl"></i></button>
               </div>
               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/20">
                  {showOrderReceipt ? (
                    <div className="bg-white p-6 shadow-sm border border-slate-200 mx-auto w-full max-w-[320px] text-black">
                        <div className="receipt-container font-mono text-black text-center text-[10px] w-full pt-2">
                           {generateReceiptPart(selectedOrder, printCopyType === 'ALL' ? 'CUSTOMER COPY' : `${printCopyType} COPY`)}
                        </div>
                    </div>
                  ) : (
                    <div className="space-y-6 text-slate-800">
                        <div className="p-6 bg-white rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                           <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                              <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Personnel Profile</label><p className="text-[14px] font-black text-slate-800 uppercase italic">{selectedOrder.customerName}</p></div>
                              <div className="text-left sm:text-right">
                                 {selectedOrder.riderName && (<div className="mb-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logistics</label><p className="text-[10px] sm:text-[12px] font-black text-sky-600 uppercase italic">{selectedOrder.riderName}</p></div>)}
                                 <div><label className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator (User ID)</label><p className="text-[12px] font-black text-slate-700 uppercase italic">{selectedOrder.createdBy}</p></div>
                              </div>
                           </div>
                           <div className="pt-2 border-t border-slate-50 flex justify-between items-center"><div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Settlement Method</label><p className="text-[11px] font-black text-emerald-600 uppercase italic">{selectedOrder.paymentMethod}</p></div><span className={`px-2 py-1 rounded text-[7px] sm:text-[8px] font-black uppercase tracking-widest border ${selectedOrder.status === OrderStatus.ORDERED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : selectedOrder.status === OrderStatus.RECEIVABLE ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-500'}`}>{selectedOrder.status}</span></div>
                        </div>
                        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden text-gray-900 font-bold">
                           <table className="w-full text-left">
                              <thead className="bg-slate-50/50 border-b border-slate-100"><tr className="text-[9px] font-black text-slate-400 uppercase"><th className="px-8 py-4">Asset Detail</th><th className="px-8 py-4 text-right">Value</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{selectedOrder.items.map((item, idx) => (<tr key={idx}><td className="px-8 py-4"><span className="text-[12px] font-black uppercase italic text-slate-800">{item.productName} (x{item.qty})</span></td><td className="px-8 py-4 text-right text-[12px] font-black italic text-slate-900">₱{formatCurrency(item.total).replace('₱','')}</td></tr>))}</tbody>
                           </table>
                        </div>
                        <div className="p-6 bg-slate-950 rounded-[32px] flex justify-between items-center text-white shadow-2xl"><span className="text-[9px] font-black uppercase italic opacity-50">Registry Settlement</span><span className="text-2xl font-black italic">{formatCurrency(selectedOrder.totalAmount)}</span></div>
                    </div>
                  )}
               </div>
               <div className="p-8 border-t bg-white flex flex-col gap-3 shrink-0">
                  {showOrderReceipt ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                         <button onClick={() => handlePrintRequest('CUSTOMER')} className="py-2.5 bg-white border-2 border-slate-200 text-slate-900 rounded-xl font-black uppercase text-[8px] hover:bg-slate-50 transition-all">Cust</button>
                         <button onClick={() => handlePrintRequest('GATE')} className="py-2.5 bg-white border-2 border-slate-200 text-slate-900 rounded-xl font-black uppercase text-[8px] hover:bg-slate-50 transition-all">Gate</button>
                         <button onClick={() => handlePrintRequest('STORE')} className="py-2.5 bg-white border-2 border-slate-200 text-slate-900 rounded-xl font-black uppercase text-[8px] hover:bg-slate-50 transition-all">Store</button>
                         <button onClick={() => handlePrintRequest('ALL')} className="py-2.5 bg-slate-950 text-white rounded-xl font-black uppercase text-[8px] shadow-lg">ALL</button>
                      </div>
                      <button onClick={() => handlePrintRequest(printCopyType)} className="w-full py-4 bg-sky-600 text-white rounded-xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center gap-2"><i className="fas fa-print"></i> Authorize Print</button>
                    </div>
                  ) : (
                    <button onClick={() => { setShowOrderReceipt(true); setPrintCopyType('ALL'); }} className="w-full py-4 bg-slate-950 text-white rounded-xl font-black uppercase text-[10px] shadow-xl">Reprint Manifest</button>
                  )}
                  <button onClick={() => setSelectedOrder(null)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] active:scale-95 transition-all">Dismiss</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default SalesReport;
