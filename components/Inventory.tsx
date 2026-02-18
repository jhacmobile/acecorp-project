
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Stock, User, Store, StockTransfer, TransferStatus, Brand, ProductCategory, TransferItem, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import CustomDatePicker from './CustomDatePicker';

interface InventoryProps {
  user: User;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  stocks: Stock[];
  setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
  stores: Store[];
  transfers: StockTransfer[];
  setTransfers: React.Dispatch<React.SetStateAction<StockTransfer[]>>;
  brands: Brand[];
  setBrands: React.Dispatch<React.SetStateAction<Brand[]>>;
  categories: ProductCategory[];
  setCategories: React.Dispatch<React.SetStateAction<ProductCategory[]>>;
  activeTab: string;
  onSwitchStore: (id: string) => void;
  onSync: (immediateOrders?: any, immediateStocks?: Stock[], immediateUsers?: any, immediateProducts?: Product[], immediateBrands?: Brand[], immediateCategories?: ProductCategory[], immediateTransfers?: StockTransfer[]) => Promise<boolean>;
  logoUrl?: string;
}

const Inventory: React.FC<InventoryProps> = ({ user, products, setProducts, stocks, setStocks, stores, transfers, setTransfers, brands, setBrands, categories, setCategories, activeTab, onSwitchStore, onSync }) => {
  const view = activeTab.split('-')[1] || 'products';
  const isAdmin = user.role === UserRole.ADMIN;
  
  const assignedStores = useMemo(() => {
    if (!user.assignedStoreIds || user.assignedStoreIds.includes('all')) return stores || [];
    return (stores || []).filter(s => user.assignedStoreIds.includes(s.id));
  }, [user.assignedStoreIds, stores]);

  const currentStore = useMemo(() => stores.find(s => String(s.id) === String(user.selectedStoreId)), [stores, user.selectedStoreId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [registryDate, setRegistryDate] = useState(new Date().toISOString().split('T')[0]);
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [showNodeSwitcher, setShowNodeSwitcher] = useState(false);

  // Modal / Manifest States
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [targetStoreId, setTargetStoreId] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [emptySearch, setEmptySearch] = useState('');
  const [dispatchDraft, setDispatchDraft] = useState<TransferItem[]>([]);
  const [returnDraft, setReturnDraft] = useState<TransferItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manifestToView, setManifestToView] = useState<StockTransfer | null>(null);

  // Registry Management States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingStock, setEditingStock] = useState<any>(null);

  const nodeSwitcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nodeSwitcherRef.current && !nodeSwitcherRef.current.contains(event.target as Node)) {
        setShowNodeSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBrands = useMemo(() => brands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())), [brands, searchQuery]);
  const filteredCategories = useMemo(() => categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())), [categories, searchQuery]);
  const filteredProducts = useMemo(() => products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase()) || p.type.toLowerCase().includes(searchQuery.toLowerCase())), [products, searchQuery]);

  const storeStockGrid = useMemo(() => {
    return stocks
      .filter(s => String(s.storeId) === String(user.selectedStoreId))
      .map(s => {
        const p = products.find(prod => String(prod.id) === String(s.productId));
        return { ...s, productName: p?.name || 'Unknown Product', brand: p?.brand || 'N/A' };
      })
      .filter(s => s.productName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [stocks, products, user.selectedStoreId, searchQuery]);

  const availableToEnroll = useMemo(() => {
    const existingProductIds = new Set(stocks.filter(s => String(s.storeId) === String(user.selectedStoreId)).map(s => String(s.productId)));
    return products.filter(p => !existingProductIds.has(String(p.id)) && p.name.toLowerCase().includes(enrollSearch.toLowerCase()));
  }, [products, stocks, user.selectedStoreId, enrollSearch]);

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand?.name) return;
    let nextBrands = editingBrand.id ? brands.map(b => b.id === editingBrand.id ? editingBrand : b) : [...brands, { ...editingBrand, id: `br-${Date.now()}` }];
    setBrands(nextBrands);
    setIsModalOpen(false);
    await onSync(undefined, undefined, undefined, undefined, nextBrands);
  };

  const handleDeleteBrand = async (id: string) => {
    if (!confirm("SYSTEM WARNING: Permanently delete this brand identifier?")) return;
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) { alert("System sync failure: " + error.message); return; }
    const nextBrands = brands.filter(b => b.id !== id);
    setBrands(nextBrands);
    await onSync(); 
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name) return;
    let nextCats = editingCategory.id ? categories.map(c => c.id === editingCategory.id ? editingCategory : c) : [...categories, { ...editingCategory, id: `cat-${Date.now()}` }];
    setCategories(nextCats);
    setIsModalOpen(false);
    await onSync(undefined, undefined, undefined, undefined, undefined, nextCats);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("SYSTEM WARNING: Permanently delete this category?")) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { alert("System sync failure: " + error.message); return; }
    const nextCats = categories.filter(c => c.id !== id);
    setCategories(nextCats);
    await onSync();
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name) return;
    let nextProds: Product[] = [];
    let nextStocks: Stock[] = stocks;
    if (editingProduct.id) {
      nextProds = products.map(p => p.id === editingProduct.id ? editingProduct : p);
    } else {
      const newId = `pr-${Date.now()}`;
      const newProd = { ...editingProduct, id: newId };
      nextProds = [...products, newProd];
      const initialStocksForNewProduct: Stock[] = stores.map(s => ({
        id: `${s.id}-${newId}`, productId: String(newId).trim(), storeId: String(s.id).trim(), quantity: 0, initialStock: 0, status: 'Active'
      }));
      nextStocks = [...stocks, ...initialStocksForNewProduct];
    }
    setProducts(nextProds);
    setStocks(nextStocks);
    setIsModalOpen(false);
    await onSync(undefined, nextStocks, undefined, nextProds);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("SYSTEM WARNING: Permanently delete this SKU?")) return;
    const { error: stockErr } = await supabase.from('stocks').delete().eq('product_id', id);
    const { error: prodErr } = await supabase.from('products').delete().eq('id', id);
    if (stockErr || prodErr) { alert("Integrity purge failure"); return; }
    const nextProds = products.filter(p => p.id !== id);
    const nextStocks = stocks.filter(s => s.productId !== id);
    setProducts(nextProds);
    setStocks(nextStocks);
    await onSync();
  };

  const handleEnrollProduct = async (product: Product) => {
    const newStock: Stock = {
      id: `${user.selectedStoreId}-${product.id}`,
      productId: String(product.id).trim(),
      storeId: String(user.selectedStoreId).trim(),
      quantity: 0, initialStock: 0, status: 'Active'
    };
    const nextStocks = [...stocks, newStock];
    setStocks(nextStocks);
    setIsEnrollModalOpen(false);
    setEnrollSearch('');
    await onSync(undefined, nextStocks);
  };

  const handleSaveStockCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStock) return;
    const nextStocks = stocks.map(s => s.id === editingStock.id ? { ...s, quantity: editingStock.quantity } : s);
    setStocks(nextStocks);
    setEditingStock(null);
    await onSync(undefined, nextStocks);
  };

  const getStock = (prodId: string) => stocks.find(s => String(s.productId) === String(prodId) && String(s.storeId) === String(user.selectedStoreId))?.quantity || 0;

  const updateDraft = (prodId: string, qty: number, type: 'dispatch' | 'return') => {
    const draft = type === 'dispatch' ? dispatchDraft : returnDraft;
    const setter = type === 'dispatch' ? setDispatchDraft : setReturnDraft;
    const avail = getStock(prodId);
    const existing = draft.find(i => i.productId === prodId);
    if (qty > 0) {
      if (!existing) {
        if (avail > 0 || type === 'return') {
           setter([...draft, { productId: prodId, qty: 1, productName: products.find(p => p.id === prodId)?.name }]);
        }
      } else {
        const nextQty = existing.qty + qty;
        if (type === 'dispatch' && nextQty > avail) return;
        setter(draft.map(i => i.productId === prodId ? { ...i, qty: Math.min(nextQty, 999) } : i));
      }
    } else if (existing) {
      const nextQty = existing.qty + qty;
      if (nextQty <= 0) setter(draft.filter(i => i.productId !== prodId));
      else setter(draft.map(i => i.productId === prodId ? { ...i, qty: nextQty } : i));
    }
  };

  const setDraftQty = (prodId: string, value: number, type: 'dispatch' | 'return') => {
    const setter = type === 'dispatch' ? setDispatchDraft : setReturnDraft;
    const draft = type === 'dispatch' ? dispatchDraft : returnDraft;
    const avail = getStock(prodId);
    const safeVal = Math.min(Math.max(0, value), 999);
    if (type === 'dispatch' && safeVal > avail) return;
    const existing = draft.find(i => i.productId === prodId);
    if (safeVal === 0) setter(draft.filter(i => i.productId !== prodId));
    else if (existing) setter(draft.map(i => i.productId === prodId ? { ...i, qty: safeVal } : i));
    else if (safeVal > 0) setter([...draft, { productId: prodId, qty: safeVal, productName: products.find(p => p.id === prodId)?.name }]);
  };

  const handleFinalizeDispatch = async () => {
    if (!targetStoreId || (dispatchDraft.length === 0 && returnDraft.length === 0)) return;
    setIsProcessing(true);
    const transferId = `TRF-${Date.now()}`;
    const newTransfer: StockTransfer = { id: transferId, fromStoreId: String(user.selectedStoreId), toStoreId: targetStoreId, items: dispatchDraft, returnedItems: returnDraft, status: TransferStatus.PENDING, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), initiatedBy: user.username };
    const updatedStocks = [...stocks];
    dispatchDraft.forEach(item => { const idx = updatedStocks.findIndex(s => s.productId === item.productId && s.storeId === user.selectedStoreId); if (idx > -1) updatedStocks[idx].quantity -= item.qty; });
    const nextTransfers = [newTransfer, ...transfers];
    setTransfers(nextTransfers);
    setStocks(updatedStocks);
    const success = await onSync(undefined, updatedStocks, undefined, undefined, undefined, undefined, nextTransfers);
    if (success) { setIsTransferModalOpen(false); setDispatchDraft([]); setReturnDraft([]); setTargetStoreId(''); }
    setIsProcessing(false);
  };

  const handleAcceptTransfer = async (transfer: StockTransfer) => {
    if (isProcessing) return;
    if (!confirm("Authorize receipt of dispatch manifest?")) return;
    setIsProcessing(true);
    const updatedTransfers = transfers.map(t => t.id === transfer.id ? { ...t, status: TransferStatus.COMPLETED, acceptedBy: user.username, updatedAt: new Date().toISOString() } : t);
    const updatedStocks = [...stocks];
    transfer.items.forEach(item => { const idx = updatedStocks.findIndex(s => s.productId === item.productId && s.storeId === user.selectedStoreId); if (idx > -1) updatedStocks[idx].quantity += item.qty; else updatedStocks.push({ id: `${user.selectedStoreId}-${item.productId}`, productId: item.productId, storeId: String(user.selectedStoreId), quantity: item.qty, initialStock: 0, status: 'Active' }); });
    transfer.returnedItems.forEach(item => { const idx = updatedStocks.findIndex(s => s.productId === item.productId && s.storeId === user.selectedStoreId); if (idx > -1) updatedStocks[idx].quantity -= item.qty; });
    setTransfers(updatedTransfers);
    setStocks(updatedStocks);
    await onSync(undefined, updatedStocks, undefined, undefined, undefined, undefined, updatedTransfers);
    setIsProcessing(false);
  };

  const inboundRequests = useMemo(() => transfers.filter(t => String(t.toStoreId) === String(user.selectedStoreId) && t.status === TransferStatus.PENDING), [transfers, user.selectedStoreId]);

  const outboundRegistry = useMemo(() => {
    let base = transfers.filter(t => String(t.fromStoreId) === String(user.selectedStoreId) || String(t.toStoreId) === String(user.selectedStoreId));
    if (storeFilter !== 'ALL') base = base.filter(t => String(t.toStoreId) === storeFilter || String(t.fromStoreId) === storeFilter);
    if (searchQuery) { const q = searchQuery.toLowerCase(); base = base.filter(t => t.id.toLowerCase().includes(q) || stores.find(s=>s.id===t.toStoreId)?.name.toLowerCase().includes(q)); }
    return base.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }, [transfers, user.selectedStoreId, storeFilter, searchQuery, stores]);

  if (view === 'transfers') {
    return (
      <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans p-6 md:p-10 no-print">
        <style>{`
          @media print {
            @page { size: 80mm auto; margin: 0mm; }
            body { background: white !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            #transfer-manifest-print-root, #inventory-snapshot-root { 
               display: block !important; 
               width: 80mm !important; 
               height: auto !important; 
               min-height: 0 !important; 
               padding: 0 !important; 
               margin: 0 !important; 
               background: white !important; 
               color: black !important; 
               position: static !important; 
            }
            #transfer-manifest-print-root *, #inventory-snapshot-root * { visibility: visible !important; }
          }
        `}</style>

        {/* PRINT ROOT: HUB INVENTORY SNAPSHOT */}
        <div id="inventory-snapshot-root" className="hidden">
           <div className="receipt-container font-mono text-black text-center text-[8.5px] w-[68mm] mx-auto pt-2 pb-2">
              <h2 className="text-lg font-black uppercase italic leading-none mb-1 text-black">{currentStore?.name || 'ACECORP'}</h2>
              <p className="text-[10px] uppercase font-bold border-y border-black border-dashed py-2 my-4 text-black">HUB INVENTORY SNAPSHOT</p>
              <div className="text-left font-bold space-y-1 uppercase text-[8.5px] text-black">
                 <div className="flex justify-between"><span>Registry Date:</span> <span>{new Date().toLocaleDateString()}</span></div>
                 <div className="flex justify-between"><span>Audit Op:</span> <span>{user.username}</span></div>
              </div>
              <div className="border-b border-black border-dashed my-4"></div>
              <table className="w-full text-left">
                 <thead className="border-b border-black"><tr className="font-black text-[9px]"><th className="py-1">Asset SKU</th><th className="py-1 text-right">Qty</th></tr></thead>
                 <tbody className="text-[8.5px]">{storeStockGrid.map(s => (<tr key={s.id} className="border-b border-black border-dotted"><td className="py-2 font-bold text-black uppercase">{s.productName}</td><td className="py-2 text-right font-black text-black">{s.quantity}</td></tr>))}</tbody>
              </table>
              <div className="mt-8 pt-4 border-t border-black border-dashed text-center text-black">
                  <p className="font-bold uppercase text-[8.5px]">OFFICIAL REGISTRY COPY</p>
                  <p className="font-bold uppercase text-[7.5px] mt-1">System Timestamp: {new Date().toLocaleTimeString()}</p>
              </div>
           </div>
        </div>

        <div id="transfer-manifest-print-root" className="hidden">
          {manifestToView && (
             <div className="receipt-container font-mono text-black text-center text-[8.5px] w-[68mm] mx-auto pt-2 pb-2">
                <h2 className="text-lg font-black uppercase italic leading-none mb-1 text-black">{stores.find(s=>s.id===manifestToView.fromStoreId)?.name || 'ACECORP'}</h2>
                <p className="text-[10px] uppercase font-bold border-y border-black border-dashed py-2 my-4 text-black">STOCK TRANSFER MANIFEST</p>
                <div className="text-left font-bold space-y-1 uppercase text-[8.5px] text-black">
                   <div className="flex justify-between"><span>Registry ID:</span> <span>{manifestToView.id.slice(-8)}</span></div>
                   <div className="flex justify-between"><span>To Node:</span> <span>{stores.find(s=>s.id===manifestToView.toStoreId)?.name}</span></div>
                   <div className="flex justify-between"><span>Auth Op:</span> <span>{manifestToView.initiatedBy}</span></div>
                </div>
                <div className="border-b border-black border-dashed my-4"></div>
                {manifestToView.items.length > 0 && (
                  <div className="mb-4">
                     <p className="font-black text-left border-b border-black mb-1 pb-1 text-black text-[9px]">OUTBOUND ASSETS</p>
                     <table className="w-full text-left text-[8.5px]">
                        <tbody>{manifestToView.items.map((item, i) => (<tr key={i} className="border-b border-dashed border-slate-200"><td className="py-2 font-bold text-black uppercase">{products.find(p=>p.id===item.productId)?.name || item.productId}</td><td className="py-2 text-right font-black text-black">x{item.qty}</td></tr>))}</tbody>
                     </table>
                  </div>
                )}
                {manifestToView.returnedItems && manifestToView.returnedItems.length > 0 && (
                  <div className="mt-4">
                     <p className="font-black text-left border-b border-black mb-1 pb-1 text-black text-[9px]">RETURNED EMPTIES</p>
                     <table className="w-full text-left text-[8.5px]">
                        <tbody>{manifestToView.returnedItems.map((item, i) => (<tr key={i} className="border-b border-dashed border-slate-200"><td className="py-2 font-bold text-black uppercase">{products.find(p=>p.id===item.productId)?.name || item.productId}</td><td className="py-2 text-right font-black text-black">x{item.qty}</td></tr>))}</tbody>
                     </table>
                  </div>
                )}
                <div className="mt-8 pt-4 border-t border-black border-dashed text-center text-black">
                    <p className="font-bold uppercase text-[8.5px]">OFFICIAL REGISTRY COPY</p>
                    <p className="font-bold uppercase text-[7.5px] mt-1">System Timestamp: {new Date().toLocaleTimeString()}</p>
                </div>
             </div>
          )}
        </div>
        <div className="flex justify-between items-center mb-8 px-2">
          <h1 className="text-[28px] font-black italic uppercase tracking-tighter text-slate-900 leading-none">Stock Transfer Hub</h1>
          <div className="flex items-center gap-4">
            <button onClick={() => window.print()} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95"><i className="fas fa-print"></i> Print Hub Inventory</button>
            <div className="relative" ref={nodeSwitcherRef}>
              <button onClick={() => setShowNodeSwitcher(!showNodeSwitcher)} className="bg-white border border-slate-100 rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3 group hover:border-sky-200 transition-all"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Node:</span><span className="text-[10px] font-black text-slate-800 uppercase italic">{currentStore?.name}</span><i className={`fas fa-caret-down text-[9px] transition-transform ${showNodeSwitcher ? 'rotate-180' : ''}`}></i></button>
              {showNodeSwitcher && (<div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[500] p-2 animate-in fade-in slide-in-from-top-2"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-3 py-2 border-b border-slate-50 mb-1">Operational Nodes</p>{assignedStores.map(s => (<button key={s.id} onClick={() => { onSwitchStore(s.id); setShowNodeSwitcher(false); }} className={`w-full text-left px-4 py-2.5 rounded-xl transition-all flex items-center justify-between group ${user.selectedStoreId === s.id ? 'bg-sky-50 text-sky-600 font-black' : 'hover:bg-slate-50 text-slate-600'}`}>{s.name}{user.selectedStoreId === s.id && <i className="fas fa-check-circle text-sky-500"></i>}</button>))}</div>)}
            </div>
            <button onClick={() => { setIsTransferModalOpen(true); setAssetSearch(''); setEmptySearch(''); setDispatchDraft([]); setReturnDraft([]); setTargetStoreId(''); }} className="bg-[#2d89c8] hover:bg-sky-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.1em] shadow-xl shadow-sky-900/10 flex items-center gap-3 transition-all active:scale-95"><i className="fas fa-plus"></i> Create Manifest</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="md:col-span-2 relative group">
            <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search Transmissions..." className="w-full pl-14 pr-14 py-3 bg-white border border-slate-100 rounded-[20px] text-[10px] font-bold shadow-inner outline-none focus:border-sky-400 transition-all uppercase" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400">
                <i className="fas fa-times-circle"></i>
              </button>
            )}
          </div>
          <CustomDatePicker value={registryDate} onChange={setRegistryDate} className="w-full" />
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} className="w-full px-6 py-3 bg-white border border-slate-100 rounded-[20px] text-[9px] font-black uppercase outline-none focus:border-sky-400 shadow-inner"><option value="ALL">All Stores</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10 overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-3 mb-6 px-2"><i className="fas fa-inbox text-sky-500 text-sm"></i><h2 className="text-[12px] font-black uppercase italic tracking-widest text-slate-800">Inbound Requests</h2>{inboundRequests.length > 0 && <span className="bg-red-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black animate-bounce">{inboundRequests.length}</span>}</div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-3">
              {inboundRequests.map(t => (<div key={t.id} className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:border-sky-200 transition-all flex justify-between items-center group"><div className="space-y-1"><h3 className="text-[11px] font-black uppercase italic text-slate-900 leading-none">{stores.find(s=>s.id===t.fromStoreId)?.name}</h3><div className="flex items-center gap-3"><p className="text-[9px] font-bold text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</p><p className="text-[8px] font-black text-sky-500 uppercase tracking-tighter">Prep: {t.initiatedBy}</p></div></div><div className="flex items-center gap-4"><span className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-xl text-[10px] font-black">{t.items.reduce((s,i)=>s+i.qty,0)} Units</span><div className="flex gap-2"><button onClick={() => setManifestToView(t)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-all"><i className="fas fa-eye text-xs"></i></button><button onClick={() => handleAcceptTransfer(t)} className="w-10 h-10 rounded-xl bg-emerald-50 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"><i className="fas fa-check text-xs"></i></button></div></div></div>))}
            </div>
          </div>
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-3 mb-6 px-2"><i className="fas fa-paper-plane text-slate-400 text-sm"></i><h2 className="text-[12px] font-black uppercase italic tracking-widest text-slate-800">Outbound Registry</h2></div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-3">
              <div className="bg-white rounded-[28px] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-widest border-b border-slate-100 text-slate-400"><tr><th className="px-8 py-4">Destination</th><th className="px-4 py-4">Control Log</th><th className="px-8 py-4 text-center">Status</th><th className="px-8 py-4 text-right">Control</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">{outboundRegistry.map(t => (<tr key={t.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-8 py-5"><p className="text-[11px] font-black uppercase italic text-slate-900 leading-none">{stores.find(s=>s.id===t.toStoreId)?.name || 'N/A'}</p><p className="text-[8px] font-bold text-slate-400 mt-1">{new Date(t.createdAt).toLocaleDateString()}</p></td><td className="px-4 py-5"><div className="flex flex-col gap-0.5"><span className="text-[8px] font-black text-sky-500 uppercase italic">Sender: {t.initiatedBy}</span>{t.acceptedBy && <span className="text-[8px] font-black text-emerald-500 uppercase italic">Recv: {t.acceptedBy}</span>}</div></td><td className="px-8 py-5 text-center"><span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-[0.1em] border ${t.status === TransferStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{t.status}</span></td><td className="px-8 py-5 text-right"><button onClick={() => setManifestToView(t)} className="text-[9px] font-black text-slate-400 hover:text-sky-600 uppercase tracking-widest transition-colors">View</button></td></tr>))}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* DISPATCH MANIFEST MODAL */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[5000] p-4">
             <div className="bg-white w-full max-w-7xl h-[90vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
                <div className="p-8 sm:p-10 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                   <div>
                      <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">Dispatch Manifest</h2>
                      <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mt-1">Operational Asset Movement</p>
                   </div>
                   <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-3xl"></i></button>
                </div>
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                   <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar border-r border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-inner">
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Source Node</label>
                            <input disabled value={currentStore?.name || ''} className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase italic shadow-sm opacity-50" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Target Node</label>
                            <select value={targetStoreId} onChange={e => setTargetStoreId(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase italic shadow-sm outline-none focus:border-sky-500">
                               <option value="">Select Target...</option>
                               {stores.filter(s => s.id !== user.selectedStoreId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                         {/* 1. Dispatch Source */}
                         <div className="space-y-6">
                            <div className="flex justify-between items-center">
                               <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                  <span className="w-6 h-6 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center text-[10px]">1</span> Dispatch Source
                               </h3>
                            </div>
                            <div className="relative">
                               <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
                               <input 
                                 value={assetSearch} 
                                 onChange={e => setAssetSearch(e.target.value)} 
                                 placeholder="Search Hub Assets..." 
                                 className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-sky-500 transition-all" 
                               />
                               {assetSearch && (
                                 <button onClick={() => setAssetSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400">
                                   <i className="fas fa-times-circle"></i>
                                 </button>
                               )}
                            </div>
                            <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-3">
                               {products.filter(p => (p.type === 'Refill' || p.type === 'Spare Parts' || p.type === 'Cylinders') && p.name.toLowerCase().includes(assetSearch.toLowerCase())).map(p => {
                                  const avail = getStock(p.id);
                                  const inDraft = dispatchDraft.find(i => i.productId === p.id)?.qty || 0;
                                  return (
                                    <div key={p.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-sky-200 transition-all">
                                       <div className="leading-tight"><p className="text-[10px] font-black uppercase italic text-slate-800">{p.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Hub Avail: {avail}</p></div>
                                       <div className="flex items-center gap-2">
                                          <button onClick={() => updateDraft(p.id, -1, 'dispatch')} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors"><i className="fas fa-minus text-[10px]"></i></button>
                                          <input type="number" value={inDraft} onChange={e => setDraftQty(p.id, parseInt(e.target.value)||0, 'dispatch')} className="w-12 text-center bg-white border border-slate-200 rounded-lg text-[11px] font-black py-1 shadow-inner outline-none" />
                                          <button onClick={() => updateDraft(p.id, 1, 'dispatch')} className="w-8 h-8 rounded-lg bg-sky-600 text-white shadow-lg shadow-sky-200 flex items-center justify-center"><i className="fas fa-plus text-[10px]"></i></button>
                                       </div>
                                    </div>
                                  );
                               })}
                            </div>
                         </div>
                         {/* 2. Return Source */}
                         <div className="space-y-6">
                            <div className="flex justify-between items-center">
                               <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-[10px]">2</span> Return Source
                               </h3>
                            </div>
                            <div className="relative">
                               <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
                               <input 
                                 value={emptySearch} 
                                 onChange={e => setEmptySearch(e.target.value)} 
                                 placeholder="Search Empties..." 
                                 className="w-full pl-10 pr-10 py-3 bg-emerald-50/30 border border-emerald-100 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-emerald-500 transition-all" 
                               />
                               {emptySearch && (
                                 <button onClick={() => setEmptySearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400">
                                   <i className="fas fa-times-circle"></i>
                                 </button>
                               )}
                            </div>
                            <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-3">
                               {products.filter(p => p.type === 'Empty Cylinders' && p.name.toLowerCase().includes(emptySearch.toLowerCase())).map(p => {
                                  const inDraft = returnDraft.find(i => i.productId === p.id)?.qty || 0;
                                  return (
                                    <div key={p.id} className="flex justify-between items-center p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl hover:border-emerald-300 transition-all">
                                       <div className="leading-tight"><p className="text-[10px] font-black uppercase italic text-slate-800">{p.name}</p><p className="text-[8px] font-bold text-emerald-400 uppercase tracking-tighter">Assets for return</p></div>
                                       <div className="flex items-center gap-2">
                                          <button onClick={() => updateDraft(p.id, -1, 'return')} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-colors"><i className="fas fa-minus text-[10px]"></i></button>
                                          <input type="number" value={inDraft} onChange={e => setDraftQty(p.id, parseInt(e.target.value)||0, 'return')} className="w-12 text-center bg-white border border-slate-200 rounded-lg text-[11px] font-black py-1 shadow-inner outline-none" />
                                          <button onClick={() => updateDraft(p.id, 1, 'return')} className="w-8 h-8 rounded-lg bg-emerald-600 text-white shadow-lg shadow-emerald-200 flex items-center justify-center"><i className="fas fa-plus text-[10px]"></i></button>
                                       </div>
                                    </div>
                                  );
                               })}
                            </div>
                         </div>
                      </div>
                   </div>
                   
                   {/* ENHANCED MANIFEST REGISTRY PANEL */}
                   <div className="w-full lg:w-[440px] p-8 shrink-0 flex flex-col">
                      <div className="flex-1 bg-slate-950 flex flex-col rounded-[48px] p-10 relative overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]">
                         <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-emerald-500/5 pointer-events-none"></div>
                         <div className="relative z-10 flex flex-col h-full">
                            <div className="mb-10 text-center">
                               <i className="fas fa-file-invoice text-white/20 text-5xl mb-4"></i>
                               <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Manifest Registry</h3>
                               <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">DRAFT VALIDATION</p>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                               {dispatchDraft.length === 0 && returnDraft.length === 0 ? (
                                  <div className="py-20 text-center opacity-30 grayscale"><p className="text-[10px] font-black text-white uppercase tracking-widest">Empty Registry</p></div>
                               ) : (
                                  <>
                                     {dispatchDraft.length > 0 && (
                                        <div className="space-y-2"><p className="text-[8px] font-black text-sky-400 uppercase tracking-widest border-b border-white/10 pb-1 mb-3">Outbound Assets</p>
                                           {dispatchDraft.map(i => <div key={i.productId} className="flex justify-between items-center text-white text-[10px] font-bold italic uppercase"><span>{i.productName}</span><span>x{i.qty}</span></div>)}
                                        </div>
                                     )}
                                     {returnDraft.length > 0 && (
                                        <div className="space-y-2 mt-6"><p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest border-b border-white/10 pb-1 mb-3">Returned Empties</p>
                                           {returnDraft.map(i => <div key={i.productId} className="flex justify-between items-center text-white text-[10px] font-bold italic uppercase"><span>{i.productName}</span><span>x{i.qty}</span></div>)}
                                        </div>
                                     )}
                                  </>
                               )}
                            </div>
                            <button disabled={!targetStoreId || (dispatchDraft.length === 0 && returnDraft.length === 0) || isProcessing} onClick={handleFinalizeDispatch} className="w-full mt-10 py-6 bg-[#2d89c8] hover:bg-sky-500 text-white rounded-[32px] font-black uppercase text-[12px] tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-20 disabled:grayscale">Finalize Dispatch</button>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* VIEW MANIFEST MODAL */}
        {manifestToView && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[5000] p-4 no-print" onClick={() => setManifestToView(null)}>
            <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Manifest Details</h2>
                  <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mt-2">Registry ID: {manifestToView.id.slice(-8)}</p>
                </div>
                <button onClick={() => setManifestToView(null)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-3xl"></i></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/30">
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex justify-between">
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Source Node</label><p className="text-[12px] font-black text-slate-800 uppercase italic">{stores.find(s=>s.id===manifestToView.fromStoreId)?.name || 'N/A'}</p></div>
                    <div className="text-right"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Target Node</label><p className="text-[12px] font-black text-sky-600 uppercase italic">{stores.find(s=>s.id===manifestToView.toStoreId)?.name || 'N/A'}</p></div>
                  </div>
                  <div className="pt-2 border-t border-slate-50 flex justify-between">
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Operator</label><p className="text-[11px] font-bold text-slate-600 uppercase italic">{manifestToView.initiatedBy || 'SYSTEM'}</p></div>
                    <div className="text-right"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Date</label><p className="text-[11px] font-bold text-slate-600 uppercase italic">{new Date(manifestToView.createdAt).toLocaleDateString()}</p></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Movement Assets</h3>
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[8px] font-black uppercase text-slate-400 border-b border-slate-100">
                        <tr><th className="px-6 py-3">Asset SKU</th><th className="px-6 py-3 text-right">Qty</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {manifestToView.items.map((item, i) => (
                          <tr key={i}><td className="px-6 py-3 text-[11px] font-black uppercase italic text-slate-800">{products.find(p=>p.id===item.productId)?.name || item.productId}</td><td className="px-6 py-3 text-right text-[11px] font-black text-slate-900">x{item.qty}</td></tr>
                        ))}
                        {manifestToView.returnedItems && manifestToView.returnedItems.length > 0 && manifestToView.returnedItems.map((item, i) => (
                          <tr key={`ret-${i}`} className="bg-emerald-50/30"><td className="px-6 py-3 text-[11px] font-black uppercase italic text-emerald-700">{products.find(p=>p.id===item.productId)?.name || item.productId} (RETURN)</td><td className="px-6 py-3 text-right text-[11px] font-black text-emerald-700">x{item.qty}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="p-8 border-t bg-white flex gap-4 shrink-0">
                <button onClick={() => window.print()} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"><i className="fas fa-print"></i> Print Manifest</button>
                <button onClick={() => setManifestToView(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95">Dismiss</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar bg-slate-50 text-slate-900 relative">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0mm; }
          body * { visibility: hidden !important; }
          #inventory-snapshot-root, #inventory-snapshot-root * { visibility: visible !important; display: block !important; }
          #inventory-snapshot-root { 
             position: absolute !important; 
             left: 0; top: 0; 
             width: 80mm !important; 
             background: white; 
             color: black; 
             padding: 0;
             margin: 0;
             display: block !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      
      {/* PRINT ROOT: STOCK REGISTRY (80MM OPTIMIZED) */}
      <div id="inventory-snapshot-root" className="hidden">
        <div className="receipt-container font-mono text-black text-center text-[8.5px] w-[68mm] mx-auto pt-2 pb-12">
           <h2 className="text-lg font-black uppercase italic leading-none mb-1 text-black">{currentStore?.name || 'ACECORP'}</h2>
           <p className="text-[10px] uppercase font-bold border-y border-black border-dashed py-2 my-4 text-black">STOCK REGISTRY SNAPSHOT</p>
           <div className="text-left space-y-1 mb-3 font-bold uppercase text-[8.5px] text-black">
              <div className="flex justify-between"><span>Registry Date:</span> <span>{new Date().toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span>Audit Operator:</span> <span>{user.username}</span></div>
           </div>
           <table className="w-full text-left">
              <thead className="border-b border-black"><tr className="font-black text-[9px]"><th className="py-1">Asset SKU</th><th className="py-1 text-right">Qty</th></tr></thead>
              <tbody className="text-[8.5px]">{storeStockGrid.map(s => (<tr key={s.id} className="border-b border-black border-dotted"><td className="py-2 font-bold text-black uppercase">{s.productName}</td><td className="py-2 text-right font-black text-black">{s.quantity}</td></tr>))}</tbody>
           </table>
           <div className="mt-8 pt-4 border-t border-black border-dashed text-center text-black">
               <p className="font-bold uppercase text-[8.5px]">OFFICIAL REGISTRY COPY</p>
               <p className="font-bold uppercase text-[7.5px] mt-1">System Timestamp: {new Date().toLocaleTimeString()}</p>
           </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 mb-8 px-1 no-print">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter italic uppercase">{view === 'brands' ? 'Brand Registry' : view === 'types' ? 'Category Ledger' : view === 'products' ? 'Product Catalog' : 'Stock Hub'}</h2>
          <div className="flex gap-3">
             {view === 'stocks' && (
               <>
                 <button onClick={() => { setIsEnrollModalOpen(true); setEnrollSearch(''); }} className="bg-sky-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-sky-700 transition-all shadow-xl"><i className="fas fa-link"></i> Enroll Product</button>
                 <button onClick={() => window.print()} className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl"><i className="fas fa-print"></i> Print Snapshot</button>
               </>
             )}
             {isAdmin && view !== 'stocks' && view !== 'transfers' && (
               <button onClick={() => { setIsModalOpen(true); if(view === 'brands') setEditingBrand({id:'', name:''}); else if(view === 'types') setEditingCategory({id:'', name:''}); else setEditingProduct({id:'', name:'', brand:brands[0]?.name||'', type:categories[0]?.name||'', price:0, status:'Active', size:'N/A'}); }} className="bg-sky-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-sky-700 transition-all">+ Add {view === 'brands' ? 'Brand' : view === 'types' ? 'Type' : 'Product'}</button>
             )}
          </div>
        </div>
        <div className="w-full md:max-w-xl">
           <div className="relative group">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={`Search ${view}...`} className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200 rounded-[20px] text-xs font-black uppercase tracking-wide focus:border-sky-400 transition-all outline-none shadow-sm text-slate-900" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400">
                  <i className="fas fa-times-circle"></i>
                </button>
              )}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden no-print">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
            {view === 'brands' && <tr><th className="px-8 py-5">Brand Identifier</th><th className="px-8 py-5 text-right">Control</th></tr>}
            {view === 'types' && <tr><th className="px-8 py-5">Category Name</th><th className="px-8 py-5 text-right">Control</th></tr>}
            {view === 'products' && <tr><th className="px-8 py-5">Product SKU</th><th className="px-8 py-5">Brand</th><th className="px-8 py-5">Type</th><th className="px-8 py-5 text-right">Settlement</th><th className="px-8 py-5 text-right">Control</th></tr>}
            {view === 'stocks' && <tr><th className="px-8 py-5">Product SKU</th><th className="px-8 py-5 text-center">Brand</th><th className="px-8 py-5 text-center">Quantity</th><th className="px-8 py-5 text-center">State</th><th className="px-8 py-5 text-right">Control</th></tr>}
          </thead>
          <tbody className="divide-y divide-slate-50">
            {view === 'brands' && filteredBrands.map(b => (<tr key={b.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-8 py-5 font-black uppercase text-slate-800 italic text-[12px]">{b.name}</td><td className="px-8 py-5 text-right">{isAdmin && (<div className="flex justify-end gap-3"><button onClick={() => { setEditingBrand(b); setIsModalOpen(true); }} className="bg-sky-50 text-sky-600 px-4 py-1.5 rounded-xl font-black text-[10px] uppercase hover:bg-sky-100 transition-all shadow-sm">Edit</button><button onClick={() => handleDeleteBrand(b.id)} className="text-rose-400 font-black text-[10px] uppercase px-4">Delete</button></div>)}</td></tr>))}
            {view === 'types' && filteredCategories.map(c => (<tr key={c.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-8 py-5 font-black uppercase text-slate-800 italic text-[12px]">{c.name}</td><td className="px-8 py-5 text-right">{isAdmin && (<div className="flex justify-end gap-3"><button onClick={() => { setEditingCategory(c); setIsModalOpen(true); }} className="bg-sky-50 text-sky-600 px-4 py-1.5 rounded-xl font-black text-[10px] uppercase hover:bg-sky-100 transition-all shadow-sm">Edit</button><button onClick={() => handleDeleteCategory(c.id)} className="text-rose-400 font-black text-[10px] uppercase px-4">Delete</button></div>)}</td></tr>))}
            {view === 'products' && filteredProducts.map(p => (<tr key={p.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-8 py-5 font-black uppercase text-slate-800 italic text-[11px]">{p.name}</td><td className="px-8 py-5 font-bold uppercase text-[9px] text-slate-500">{p.brand}</td><td className="px-8 py-5 font-bold uppercase text-[9px] text-slate-500">{p.type}</td><td className="px-8 py-5 text-right font-black text-slate-900">₱{p.price.toLocaleString(undefined, {minimumFractionDigits:2})}</td><td className="px-8 py-5 text-right">{isAdmin && (<div className="flex justify-end gap-3"><button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="bg-sky-50 text-sky-600 px-4 py-1.5 rounded-xl font-black text-[10px] uppercase hover:bg-sky-100 transition-all shadow-sm">Edit</button><button onClick={() => handleDeleteProduct(p.id)} className="text-rose-400 font-black text-[10px] uppercase px-4">Delete</button></div>)}</td></tr>))}
            {view === 'stocks' && storeStockGrid.map(s => (<tr key={s.id} className="hover:bg-slate-50/30 transition-colors"><td className="px-8 py-5 font-black text-slate-800 uppercase italic text-[11px]">{s.productName}</td><td className="px-8 py-5 text-center"><span className="text-[9px] px-2 py-0.5 bg-sky-50 text-sky-600 font-black rounded-md">{s.brand}</span></td><td className="px-8 py-5 text-center font-black text-lg italic text-slate-900">{s.quantity}</td><td className="px-8 py-5 text-center"><span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${s.quantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>{s.quantity > 0 ? 'READY' : 'DEPLETED'}</span></td><td className="px-8 py-5 text-right">{isAdmin && <button onClick={() => setEditingStock(s)} className="bg-sky-50 text-sky-600 px-4 py-1.5 rounded-xl font-black text-[10px] uppercase hover:bg-sky-100 transition-all shadow-sm">Calibrate</button>}</td></tr>))}
          </tbody>
        </table>
      </div>

      {/* MODAL SYSTEM */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[5000] p-4 no-print">
          <div className="bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-xl border-4 border-white animate-in zoom-in duration-300 text-gray-900">
             <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-8 text-center">{editingBrand ? 'Brand Identity' : editingCategory ? 'Category Config' : 'SKU Configuration'}</h3>
             <form onSubmit={editingBrand ? handleSaveBrand : editingCategory ? handleSaveCategory : handleSaveProduct} className="space-y-6">
                {editingBrand && (<input autoFocus value={editingBrand.name} onChange={e => setEditingBrand({...editingBrand, name: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 rounded-2xl font-black italic outline-none border border-slate-100 uppercase" placeholder="BRAND NAME" />)}
                {editingCategory && (<input autoFocus value={editingCategory.name} onChange={e => setEditingCategory({...editingCategory, name: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 rounded-2xl font-black italic outline-none border border-slate-100 uppercase" placeholder="CATEGORY NAME" />)}
                {editingProduct && (
                  <div className="space-y-4">
                    <input autoFocus value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 rounded-2xl font-black italic outline-none border border-slate-100 uppercase" placeholder="SKU NAME" />
                    <div className="grid grid-cols-2 gap-4">
                       <select value={editingProduct.brand} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl font-black italic outline-none border border-slate-100">{brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}</select>
                       <select value={editingProduct.type} onChange={e => setEditingProduct({...editingProduct, type: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl font-black italic outline-none border border-slate-100">{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <input type="number" value={editingProduct.price || ''} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})} className="w-full p-5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-100" placeholder="PRICE (₱)" />
                       <input value={editingProduct.size || ''} onChange={e => setEditingProduct({...editingProduct, size: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 rounded-2xl font-black outline-none border border-slate-100" placeholder="SIZE (E.G. 11KG)" />
                    </div>
                  </div>
                )}
                <div className="flex gap-4 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black uppercase text-slate-400 text-[10px]">Discard</button><button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Confirm Entry</button></div>
             </form>
          </div>
        </div>
      )}

      {isEnrollModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[5000] p-4 no-print">
          <div className="bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-2xl border-4 border-white animate-in zoom-in duration-300 flex flex-col max-h-[80vh] text-gray-900">
             <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-6 text-center">Enroll Active SKUs</h3>
             <div className="relative mb-6">
                <input value={enrollSearch} onChange={e => setEnrollSearch(e.target.value)} className="w-full p-4 pr-12 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold uppercase text-xs" placeholder="Filter Available Products..." />
                {enrollSearch && (
                  <button onClick={() => setEnrollSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400">
                    <i className="fas fa-times-circle"></i>
                  </button>
                )}
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {availableToEnroll.map(p => (<button key={p.id} onClick={() => handleEnrollProduct(p)} className="w-full p-5 bg-slate-50 hover:bg-sky-50 rounded-2xl border border-slate-100 text-left group transition-all"><p className="font-black uppercase italic text-slate-800 group-hover:text-sky-600">{p.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">{p.brand} • {p.type}</p></button>))}
             </div>
             <button onClick={() => setIsEnrollModalOpen(false)} className="w-full mt-6 py-4 text-slate-400 font-black uppercase text-[10px]">Dismiss</button>
          </div>
        </div>
      )}

      {editingStock && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[5000] p-4 no-print">
          <div className="bg-white p-10 rounded-[48px] shadow-2xl w-full max-md border-4 border-white animate-in zoom-in duration-300 text-center text-gray-900">
             <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6"><i className="fas fa-balance-scale"></i></div>
             <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">Calibration Protocol</h3>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-8">{editingStock.productName}</p>
             <input type="number" value={editingStock.quantity} onChange={e => setEditingStock({...editingStock, quantity: parseInt(e.target.value) || 0})} className="w-full p-6 bg-slate-50 rounded-3xl text-center text-4xl font-black italic shadow-inner outline-none mb-6" />
             <div className="flex gap-4"><button onClick={() => setEditingStock(null)} className="flex-1 py-5 text-slate-400 font-black uppercase text-[10px]">Discard</button><button onClick={handleSaveStockCalibration} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Update Count</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
