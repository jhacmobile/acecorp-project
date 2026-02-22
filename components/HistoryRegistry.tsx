
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, Store, User, UserRole, OrderItem } from '../types';
import { PICKUP_CUSTOMER } from '../constants';
import CustomDatePicker from './CustomDatePicker';
import AceCorpLogo from './AceCorpLogo';

interface HistoryRegistryProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  stores: Store[];
  user: User;
  logoUrl?: string;
  selectedCustomerId?: string;
  onModifyOrder?: (order: Order) => void;
  onReprint?: (order: Order, type: 'CUSTOMER' | 'GATE' | 'STORE' | 'ALL') => void;
  onVoidOrder?: (order: Order) => void;
}

const HistoryRegistry: React.FC<HistoryRegistryProps> = ({ 
  isOpen, onClose, orders, stores, user, logoUrl, selectedCustomerId, onModifyOrder, onReprint, onVoidOrder 
}) => {
  const [historyTab, setHistoryTab] = useState<'store' | 'pickup' | 'delivery' | 'customer'>('store');
  const [historyDate, setHistoryDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<Order | null>(null);
  const [showHistoryReceipt, setShowHistoryReceipt] = useState(false);
  const [printCopyType, setPrintCopyType] = useState<'CUSTOMER' | 'GATE' | 'STORE' | 'ALL'>('ALL');

  const formatCurrency = (amount: number) => amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isAdmin = user.role === UserRole.ADMIN;

  const filteredHistory = useMemo(() => {
    return orders.filter(o => {
      const toPHDateString = (isoString: string) => {
        try {
          if (!isoString) return '';
          const d = new Date(isoString);
          return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        } catch (e) { return isoString?.split('T')[0] || ''; }
      };

      const dateMatch = toPHDateString(o.createdAt) === historyDate;
      const statusMatch = historyStatusFilter === 'ALL' || o.status === historyStatusFilter;
      const storeMatch = String(o.storeId) === String(user.selectedStoreId);
      
      if (!dateMatch || !statusMatch || !storeMatch) return false;
      
      if (historyTab === 'store') return true;
      if (historyTab === 'pickup') return o.customerId === PICKUP_CUSTOMER.id;
      if (historyTab === 'delivery') return o.customerId !== PICKUP_CUSTOMER.id;
      if (historyTab === 'customer') return selectedCustomerId ? String(o.customerId) === String(selectedCustomerId) : false;
      return true;
    });
  }, [orders, historyDate, historyStatusFilter, historyTab, user.selectedStoreId, selectedCustomerId]);

  const generateReceiptPart = (order: Order, label: string) => {
    const store = stores.find(s => s.id === order.storeId);
    return (
       <div className="receipt-copy font-mono text-black text-center text-[10px] w-[68mm] mx-auto pt-2 pb-12">
          <div className="w-48 h-auto max-h-32 mx-auto mb-4 overflow-hidden flex items-center justify-center">
             <AceCorpLogo customUrl={logoUrl} className="w-full h-auto" />
          </div>
          <div className="border border-black px-4 py-1 inline-block mb-2">
             <h3 className="text-[12px] font-black uppercase tracking-widest">{label}</h3>
          </div>
          <h4 className="text-sm font-black uppercase italic leading-none mb-1 text-black">{store?.name || 'ACECORP'}</h4>
          <p className="text-[10px] uppercase font-bold leading-tight text-black">{store?.address || ''}</p>
          <p className="text-[10px] uppercase font-bold text-black">{store?.mobile || ''}</p>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="text-left font-bold space-y-0.5 uppercase text-[10px] text-black">
             <div className="flex gap-1"><span>Ref:</span> <span>{order.id.slice(-8)}</span></div>
             <div className="flex gap-1"><span>Date:</span> <span>{new Date(order.createdAt).toLocaleDateString()}</span></div>
             <div className="flex gap-1"><span>Operator:</span> <span>{order.createdBy}</span></div>
             {order.riderName && <div className="flex gap-1"><span>Rider:</span> <span>{order.riderName}</span></div>}
             <div className="pt-2"><p className="font-black text-[11px] uppercase italic text-black leading-tight">{order.customerName}</p><p className="text-black leading-tight">{order.address}</p></div>
          </div>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="space-y-2 mb-4">
             {order.items.map((item, idx) => (
                <div key={idx}><div className="flex justify-between font-black uppercase italic text-[10px] text-black"><span>{item.productName} (x{item.qty})</span><span>₱{formatCurrency(item.total)}</span></div></div>
             ))}
          </div>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="flex justify-between font-bold uppercase mb-1 text-[10px] text-black"><span>Method:</span> <span>{order.paymentMethod}</span></div>
          {order.totalDiscount > 0 && (
              <div className="flex justify-between font-bold uppercase mb-1 text-[10px] text-black"><span>Discount:</span> <span>-₱{formatCurrency(order.totalDiscount)}</span></div>
          )}
          <div className="flex justify-between text-[14px] font-black italic uppercase text-black"><span>TOTAL:</span> <span>₱{formatCurrency(order.totalAmount)}</span></div>
          
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

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[4000] flex justify-end animate-in fade-in duration-300 text-gray-900 no-print`}>
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => { onClose(); setSelectedHistoryOrder(null); }}></div>
      <div className="w-full max-w-[1000px] bg-[#f8fafc] h-full shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-right duration-500 overflow-hidden rounded-l-[48px] border-l border-slate-200">
         <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
            <div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-black">History Registry</h3>
              <div className="flex gap-4 mt-3">
                {['store', 'pickup', 'delivery', 'customer'].map((tab) => (
                  <button 
                    key={tab} 
                    onClick={() => { setHistoryTab(tab as any); setSelectedHistoryOrder(null); }} 
                    className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${historyTab === tab ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => { onClose(); setSelectedHistoryOrder(null); }} className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-300 hover:text-red-500 transition-all flex items-center justify-center border border-slate-100"><i className="fas fa-times text-xl"></i></button>
         </div>
         <div className="flex-1 flex overflow-hidden">
            <div className={`flex-[1.2] flex flex-col border-r border-slate-200 bg-white overflow-hidden ${selectedHistoryOrder ? 'hidden md:flex' : 'flex'}`}>
               <div className="px-6 py-5 bg-white border-b border-slate-100 sticky top-0 z-20 space-y-3">
                 <CustomDatePicker value={historyDate} onChange={setHistoryDate} className="w-full" />
                 <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-sky-500 transition-all cursor-pointer text-slate-600">
                   <option value="ALL">All Status</option>
                   <option value={OrderStatus.ORDERED}>Ordered</option>
                   <option value={OrderStatus.RECEIVABLE}>Receivable</option>
                   <option value={OrderStatus.CANCELLED}>Cancelled</option>
                 </select>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#fcfdfe]">
                 {filteredHistory.map(o => (
                   <button 
                    key={o.id} 
                    onClick={() => { setSelectedHistoryOrder(o); setShowHistoryReceipt(false); setPrintCopyType('ALL'); }} 
                    className={`w-full flex flex-col p-4 rounded-[20px] transition-all text-left border-2 ${selectedHistoryOrder?.id === o.id ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-transparent hover:bg-slate-50'}`}
                   >
                     <div className="flex justify-between items-start mb-2">
                       <span className="text-[9px] font-black text-slate-800 uppercase italic">ID: {o.id.slice(-8)}</span>
                       <span className="text-[9px] font-bold text-slate-400 italic">{new Date(o.createdAt).toLocaleDateString()}</span>
                     </div>
                     <p className="text-[10px] font-black uppercase italic truncate">{o.customerName}</p>
                     <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                       <span className="text-[11px] font-black italic">₱{formatCurrency(o.totalAmount)}</span>
                       <span className="text-[9px] font-bold text-sky-600 uppercase italic">BY: {o.createdBy}</span>
                       <span className={`text-[8px] font-black uppercase tracking-widest ${o.status === OrderStatus.CANCELLED ? 'text-red-500' : o.status === OrderStatus.RECEIVABLE ? 'text-orange-500' : 'text-emerald-500'}`}>{o.status}</span>
                     </div>
                   </button>
                 ))}
               </div>
            </div>
            <div className={`flex-[1.8] bg-[#f8fafc] flex flex-col overflow-hidden ${!selectedHistoryOrder ? 'hidden md:flex' : 'flex'}`}>
               {selectedHistoryOrder ? (
                 <>
                    <div className="p-8 border-b bg-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4">
                        <h4 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900">{showHistoryReceipt ? 'Receipt Mirror' : 'Order Detail'}</h4>
                        <button onClick={() => setShowHistoryReceipt(!showHistoryReceipt)} className="px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-[9px] font-black uppercase hover:bg-sky-100 transition-all">{showHistoryReceipt ? 'View Data' : 'View Receipt'}</button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                       {showHistoryReceipt ? (
                          <div className="bg-white p-8 shadow-sm border border-slate-200 mx-auto w-full max-w-[320px] thermal-preview text-black">
                            <div className="w-full bg-white">
                               <div className="receipt-copy">{generateReceiptPart(selectedHistoryOrder, 'CUSTOMER COPY')}</div>
                               <div className="receipt-copy">{generateReceiptPart(selectedHistoryOrder, 'GATE PASS')}</div>
                               <div className="receipt-copy">{generateReceiptPart(selectedHistoryOrder, 'STORE COPY')}</div>
                            </div>
                          </div>
                       ) : (
                          <div className="space-y-8">
                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer Profile</label>
                                  <p className="text-[14px] font-black text-slate-800 uppercase italic">{selectedHistoryOrder.customerName}</p>
                                </div>
                                <div className="text-right">
                                  {selectedHistoryOrder.riderName && (
                                    <div className="mb-2">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logistics</label>
                                      <p className="text-[12px] font-black text-sky-600 uppercase italic">{selectedHistoryOrder.riderName}</p>
                                    </div>
                                  )}
                                  <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator (User ID)</label>
                                    <p className="text-[12px] font-black text-slate-700 uppercase italic">{selectedHistoryOrder.createdBy}</p>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Address</label>
                                <p className="text-[11px] font-bold text-slate-600 uppercase italic">{selectedHistoryOrder.address}</p>
                              </div>
                              <div className="flex justify-between">
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Settlement Method</label>
                                  <p className="text-[11px] font-black text-emerald-600 uppercase italic">{selectedHistoryOrder.paymentMethod}</p>
                                </div>
                              </div>
                              {selectedHistoryOrder.remark && (
                                <div className="pt-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session Remarks</label>
                                  <p className="text-[11px] font-black text-amber-600 uppercase italic bg-amber-50 p-2 rounded-lg border border-amber-100">{selectedHistoryOrder.remark}</p>
                                </div>
                              )}
                            </div>
                            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                              <table className="w-full text-left font-bold text-gray-900">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                  <tr className="text-[9px] font-black text-slate-400 uppercase">
                                    <th className="px-8 py-4">Asset Detail</th>
                                    <th className="px-8 py-4 text-right">Value</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {selectedHistoryOrder.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="px-8 py-4">
                                        <span className="text-[12px] font-black uppercase italic text-slate-800">{item.productName} (x{item.qty})</span>
                                      </td>
                                      <td className="px-8 py-4 text-right text-[12px] font-black italic text-slate-900">₱{formatCurrency(item.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="space-y-2">
                              {selectedHistoryOrder.totalDiscount > 0 && (
                                <div className="flex justify-between items-center px-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                  <span>Applied Discount</span>
                                  <span className="text-emerald-500">- ₱{formatCurrency(selectedHistoryOrder.totalDiscount)}</span>
                                </div>
                              )}
                              <div className="p-6 bg-slate-950 rounded-[32px] flex justify-between items-center text-white shadow-2xl">
                                <span className="text-[11px] font-black uppercase tracking-widest italic">Settlement Total</span>
                                <span className="text-3xl font-black italic">₱{formatCurrency(selectedHistoryOrder.totalAmount)}</span>
                              </div>
                            </div>
                          </div>
                       )}
                    </div>
                    <div className="p-8 border-t bg-white grid grid-cols-3 gap-3 shrink-0 relative no-print">
                       <button 
                        onClick={() => onModifyOrder?.(selectedHistoryOrder)} 
                        disabled={selectedHistoryOrder.status === OrderStatus.CANCELLED || !onModifyOrder} 
                        className="py-5 bg-[#2d5da7] text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all disabled:opacity-30"
                       >
                         Modify Order
                       </button>
                       <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-4 gap-1">
                             <button onClick={() => onReprint?.(selectedHistoryOrder, 'CUSTOMER')} className={`py-2 rounded-lg text-[8px] font-black transition-all border ${printCopyType === 'CUSTOMER' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200'}`}>CUST</button>
                             <button onClick={() => onReprint?.(selectedHistoryOrder, 'GATE')} className={`py-2 rounded-lg text-[8px] font-black transition-all border ${printCopyType === 'GATE' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200'}`}>GATE</button>
                             <button onClick={() => onReprint?.(selectedHistoryOrder, 'STORE')} className={`py-2 rounded-lg text-[8px] font-black transition-all border ${printCopyType === 'STORE' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200'}`}>STOR</button>
                             <button onClick={() => onReprint?.(selectedHistoryOrder, 'ALL')} className={`py-2 rounded-lg text-[8px] font-black transition-all border ${printCopyType === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}>ALL</button>
                          </div>
                          <button onClick={() => onReprint?.(selectedHistoryOrder, 'ALL')} className="py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><i className="fas fa-print"></i> Quick ALL</button>
                       </div>
                       {isAdmin && (
                          <button 
                            onClick={() => onVoidOrder?.(selectedHistoryOrder)} 
                            disabled={selectedHistoryOrder.status === OrderStatus.CANCELLED || !onVoidOrder} 
                            className="py-5 bg-white border-2 border-red-100 text-red-500 rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all hover:bg-red-50 disabled:opacity-30 disabled:border-slate-100 disabled:text-slate-300"
                          >
                            Void Order
                          </button>
                       )}
                    </div>
                 </>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center opacity-10 py-32 text-slate-400"><i className="fas fa-file-invoice-dollar text-8xl mb-8"></i><p className="text-xl font-black uppercase tracking-[0.4em]">Select a Session</p></div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default HistoryRegistry;
