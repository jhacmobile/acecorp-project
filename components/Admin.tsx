
import React, { useState, useRef } from 'react';
import { User, UserRole, AccessRights, Store, AppSettings, Product, Stock } from '../types';
import { DEFAULT_USER_ACCESS } from '../constants';
import { supabase, hasValidConfig } from '../supabaseClient';

interface AdminProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  stores: Store[];
  setStores: React.Dispatch<React.SetStateAction<Store[]>>;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  onSync: (orders?: any, stocks?: any, users?: User[], products?: any, brands?: any, categories?: any, transfers?: any, stores?: Store[], settings?: AppSettings) => Promise<boolean>;
  products: Product[];
  stocks: Stock[];
}

const Admin: React.FC<AdminProps> = ({ users, setUsers, stores, setStores, settings, setSettings, onSync, products, stocks }) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordInput, setPasswordInput] = useState(''); 
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isSyncingLogo, setIsSyncingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  const visibleUsers = users.filter(u => u.username.toLowerCase() !== 'jhacace');

  const formatPhone = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  };

  const formatMobile = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 4) return d;
    if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
    return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  };

  const handleToggleAccess = (module: keyof AccessRights) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      accessRights: { ...editingUser.accessRights, [module]: !editingUser.accessRights[module] }
    });
  };

  const handleSetRole = (role: UserRole) => {
    if (!editingUser) return;
    const newAccess = role === UserRole.ADMIN 
      ? { dashboard: true, pos: true, sales: true, inventory: true, hrManagement: true, adminPage: true, storeManagement: true, bandiPage: true }
      : { ...editingUser.accessRights, adminPage: false };

    setEditingUser({
      ...editingUser,
      role: role,
      accessRights: newAccess
    });
  };

  const handleToggleStore = (storeId: string) => {
    if (!editingUser) return;
    const currentIds = editingUser.assignedStoreIds || [];
    const nextIds = currentIds.includes(storeId)
      ? currentIds.filter(id => id !== storeId)
      : [...currentIds, storeId];
    
    const finalIds = nextIds.filter(id => id !== 'all');
    setEditingUser({ ...editingUser, assignedStoreIds: finalIds });
  };

  const handleSetGlobalAccess = () => {
    if (!editingUser) return;
    setEditingUser({ ...editingUser, assignedStoreIds: ['all'] });
  };

  const handleSaveUser = async () => {
    if (!editingUser?.username) return alert('Username required');
    if (!editingUser.assignedStoreIds || editingUser.assignedStoreIds.length === 0) {
      return alert('At least one authorized node must be assigned.');
    }
    
    const finalPassword = passwordInput.trim() ? passwordInput : editingUser.password;
    if (!finalPassword) return alert("Security Access Token (Password) is required.");

    const normalizedUser = { 
      ...editingUser, 
      username: editingUser.username.toLowerCase(),
      password: finalPassword
    };

    let updatedUsersList: User[] = [];
    if (users.some(u => u.id === normalizedUser.id)) {
      updatedUsersList = users.map(u => u.id === normalizedUser.id ? normalizedUser : u);
    } else {
      const newUser = { ...normalizedUser, id: 'u-' + Date.now() };
      updatedUsersList = [...users, newUser];
    }
    
    setUsers(updatedUsersList);
    setIsUserModalOpen(false);
    setPasswordInput('');
    await onSync(undefined, undefined, updatedUsersList);
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm("Permanently revoke this operator's credentials?")) {
      const updatedUsersList = users.filter(u => u.id !== id);
      setUsers(updatedUsersList);
      await onSync(undefined, undefined, updatedUsersList);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setIsSyncingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      const filePath = `brand/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      const newSettings = { ...settings, logoUrl: publicUrl };
      setSettings(newSettings);
      
      const success = await onSync(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, newSettings);
      if (!success) alert("Logo uploaded but failed to update registry.");
      
    } catch (err: any) {
      console.error("Logo Sync Failure:", err.message);
      alert("Failed to synchronize logo with cloud storage. Please ensure 'assets' bucket exists.");
    } finally {
      setIsSyncingLogo(false);
    }
  };

  const handleSaveStore = async () => {
    if (!editingStore?.name || !editingStore?.code) return alert('Name and Unique Code required');
    
    let updatedStoresList: Store[] = [];
    let isNewStore = false;
    let finalStoreId = editingStore.id;

    if (editingStore.id && stores.some(s => s.id === editingStore.id)) {
      updatedStoresList = stores.map(s => s.id === editingStore.id ? editingStore : s);
    } else {
      isNewStore = true;
      finalStoreId = 'st-' + Date.now();
      const newStore = { ...editingStore, id: finalStoreId };
      updatedStoresList = [...stores, newStore];
    }
    
    setStores(updatedStoresList);
    setIsStoreModalOpen(false);

    let updatedStocksList = stocks;
    if (isNewStore) {
      const initialStocksForNewNode: Stock[] = products.map(p => ({
        id: `${finalStoreId}-${p.id}`,
        productId: String(p.id).trim(),
        storeId: String(finalStoreId).trim(),
        quantity: 0,
        initialStock: 0,
        status: 'Active'
      }));
      updatedStocksList = [...stocks, ...initialStocksForNewNode];
    }

    const success = await onSync(undefined, updatedStocksList, undefined, undefined, undefined, undefined, undefined, updatedStoresList);
    if (!success) alert("System failed to link the operational node to the cloud.");
  };

  const handleDeleteStore = async (id: string) => {
    if (stores.length <= 1) return alert("System requires at least one operational node.");
    if (confirm("Permanently decommission this operational node?")) {
      const updatedStoresList = stores.filter(s => s.id !== id);
      const updatedStocksList = stocks.filter(s => s.storeId !== id);
      setStores(updatedStoresList);
      await onSync(undefined, updatedStocksList, undefined, undefined, undefined, undefined, undefined, updatedStoresList);
    }
  };

  const accessModules: { key: keyof AccessRights, label: string, icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'fa-home' },
    { key: 'pos', label: 'Terminal (POS)', icon: 'fa-shopping-cart' },
    { key: 'sales', label: 'Audit Ledger', icon: 'fa-chart-line' },
    { key: 'inventory', label: 'Inventory Hub', icon: 'fa-boxes' },
    { key: 'hrManagement', label: 'HR Management', icon: 'fa-users' },
    { key: 'bandiPage', label: 'Bandi Terminal', icon: 'fa-clock' },
    { key: 'adminPage', label: 'Admin Settings', icon: 'fa-cog' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10 pb-12 font-sans text-slate-900 h-full overflow-y-auto custom-scrollbar p-6">
      <div className="lg:col-span-2 space-y-10">
        
        <div className="bg-slate-900 rounded-3xl px-8 py-6 text-white shadow-2xl relative overflow-hidden border border-white/5">
           <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-500/20">
                  <i className="fas fa-satellite text-lg"></i>
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 leading-none mb-2">Cloud Core Environment</h3>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black uppercase italic tracking-tight ${hasValidConfig ? 'text-emerald-400' : 'text-red-400'}`}>
                      {hasValidConfig ? 'iwnrckpwruufcniqydqt - ONLINE' : 'DISCONNECTED'}
                    </span>
                    {hasValidConfig && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>}
                  </div>
                </div>
              </div>
           </div>
           <i className="fas fa-microchip absolute -bottom-10 -right-10 text-white/[0.03] text-9xl pointer-events-none rotate-12"></i>
        </div>

        <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-10 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/20">
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tighter italic text-xl">Operational Nodes</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registry Network Configuration</p>
            </div>
            <button 
              onClick={() => { setEditingStore({ id: '', name: '', code: '', address: '', phone: '', mobile: '' }); setIsStoreModalOpen(true); }} 
              className="bg-[#2d89c8] text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#2574ab] transition shadow-xl w-full sm:w-auto active:scale-95"
            >
              + Enroll Node
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-10 py-6">Node Descriptor</th>
                  <th className="px-8 py-6">Node Identifier</th>
                  <th className="px-8 py-6">Contacts</th>
                  <th className="px-10 py-6 text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stores.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition group">
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 font-black italic uppercase text-xs">
                          <i className="fas fa-store"></i>
                        </div>
                        <div>
                          <p className="font-black text-slate-900 uppercase text-xs italic">{s.name}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{s.address || 'NO ADDRESS'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6"><span className="font-mono font-black text-sky-600 bg-sky-50 px-3 py-1 rounded-lg text-[10px] uppercase">{s.code}</span></td>
                    <td className="px-8 py-6"><div className="flex flex-col leading-tight"><span className="text-[9px] font-bold text-slate-600 uppercase">{s.phone || 'N/A'}</span><span className="text-[9px] font-bold text-sky-600 uppercase">{s.mobile || 'N/A'}</span></div></td>
                    <td className="px-10 py-6 text-right"><div className="flex justify-end gap-2"><button onClick={() => { setEditingStore({...s}); setIsStoreModalOpen(true); }} className="text-sky-600 p-2 hover:bg-sky-50 rounded-lg transition-all"><i className="fas fa-edit"></i></button><button onClick={() => handleDeleteStore(s.id)} className="text-red-400 p-2 hover:bg-red-50 rounded-lg transition-all"><i className="fas fa-trash"></i></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-10 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/20">
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tighter italic text-xl">Authorized Operators</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registry Access & Authority Control</p>
            </div>
            <button 
              onClick={() => { 
                setEditingUser({ id: '', username: '', password: '', role: UserRole.CASHIER, assignedStoreIds: [], selectedStoreId: '', accessRights: { ...DEFAULT_USER_ACCESS } }); 
                setPasswordInput('password'); 
                setIsUserModalOpen(true); 
              }} 
              className="bg-sky-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 transition shadow-xl w-full sm:w-auto active:scale-95"
            >
              + Enroll Operator
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-10 py-6">Operator Profile</th>
                  <th className="px-8 py-6">Assigned Nodes</th>
                  <th className="px-8 py-6">Authority Level</th>
                  <th className="px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibleUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition group">
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 font-black italic uppercase text-xs">{u.username?.[0] || 'O'}</div>
                        <div>
                          <p className="font-black text-slate-900 uppercase text-xs italic">{u.username}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">ID: {u.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap gap-1">
                        {u.assignedStoreIds?.includes('all') ? <span className="text-[8px] font-black px-2 py-0.5 bg-slate-950 text-white rounded-md uppercase">GLOBAL_ACCESS</span> : u.assignedStoreIds?.map(sid => <span key={sid} className="text-[8px] font-black px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md uppercase border border-slate-200">{stores.find(st => String(st.id) === String(sid))?.code || sid}</span>)}
                      </div>
                    </td>
                    <td className="px-8 py-6"><span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${u.role === UserRole.ADMIN ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{u.role}</span></td>
                    <td className="px-10 py-6 text-right"><div className="flex justify-end gap-2"><button onClick={() => { setEditingUser({...u}); setPasswordInput(''); setIsUserModalOpen(true); }} className="text-sky-600 p-2 hover:bg-sky-50 rounded-lg transition-all"><i className="fas fa-edit"></i></button><button onClick={() => handleDeleteUser(u.id)} className="text-red-400 p-2 hover:bg-red-50 rounded-lg transition-all"><i className="fas fa-trash"></i></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-10">
         <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 p-10">
            <h3 className="font-black text-slate-900 uppercase tracking-tighter italic text-xl mb-6">Identity Brand</h3>
            <div className="relative group mx-auto w-44 h-44">
               <div className="w-full h-full bg-slate-50 border-4 border-dashed border-slate-200 rounded-[40px] flex items-center justify-center relative overflow-hidden group-hover:border-sky-300 transition-all">
                  {settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain p-6" alt="Logo" /> : <i className="fas fa-image text-3xl text-slate-200"></i>}
                  {isSyncingLogo && <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center"><i className="fas fa-circle-notch animate-spin text-white text-2xl"></i></div>}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm" onClick={() => !isSyncingLogo && fileInputRef.current?.click()}><i className="fas fa-upload text-white"></i></div>
               </div>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </div>
            <p className="text-center mt-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest">{isSyncingLogo ? 'UPLOADING TO STORAGE...' : 'Enterprise Logo (Cloud Storage)'}</p>
         </div>
      </div>

      {isStoreModalOpen && editingStore && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[5000] p-6" onClick={() => setIsStoreModalOpen(false)}>
          <div className="bg-white p-12 rounded-[56px] shadow-2xl w-full max-lg border-4 border-white animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10">
               <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Node Profile</h3>
                  <p className="text-[9px] font-black text-sky-600 uppercase tracking-widest mt-1">Network Definition Protocol</p>
               </div>
               <button onClick={() => setIsStoreModalOpen(false)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <i className="fas fa-times-circle text-3xl"></i>
               </button>
            </div>
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Node Descriptor (Full Name)</label>
                <input value={editingStore.name} onChange={e => setEditingStore({...editingStore, name: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black italic outline-none focus:border-sky-500 transition-all shadow-inner uppercase" placeholder="E.G. ACECORP BRANCH 1" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Node Identifier (3-Char Code)</label>
                <input maxLength={3} value={editingStore.code} onChange={e => setEditingStore({...editingStore, code: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black italic outline-none focus:border-sky-500 transition-all shadow-inner text-center text-xl uppercase" placeholder="E.G. AC1" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Address</label>
                <input value={editingStore.address || ''} onChange={e => setEditingStore({...editingStore, address: e.target.value.toUpperCase()})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black italic outline-none focus:border-sky-500 transition-all shadow-inner uppercase" placeholder="STREET, CITY, PROVINCE" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone (XX-XXXX-XXXX)</label>
                    <input 
                      value={editingStore.phone || ''} 
                      onChange={e => setEditingStore({...editingStore, phone: formatPhone(e.target.value)})} 
                      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black italic outline-none focus:border-sky-500 transition-all shadow-inner" 
                      placeholder="02-1234-5678" 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile (XXXX-XXX-XXXX)</label>
                    <input 
                      value={editingStore.mobile || ''} 
                      onChange={e => setEditingStore({...editingStore, mobile: formatMobile(e.target.value)})} 
                      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black italic outline-none focus:border-sky-500 transition-all shadow-inner" 
                      placeholder="0917-123-4567" 
                    />
                 </div>
              </div>
              <button onClick={handleSaveStore} className="w-full py-5 bg-sky-600 text-white rounded-[24px] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl hover:bg-sky-500 transition-all active:scale-95">Authorize Node Link</button>
            </div>
          </div>
        </div>
      )}

      {isUserModalOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[5000] p-6 overflow-y-auto" onClick={() => setIsUserModalOpen(false)}>
          <div className="bg-white p-12 rounded-[64px] shadow-2xl w-full max-w-5xl border-4 border-white my-auto animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10"><div><h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Operator Configuration</h3><p className="text-[9px] font-black text-sky-600 uppercase tracking-widest mt-1">Registry Access Authorization</p></div><button onClick={() => setIsUserModalOpen(false)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-3xl"></i></button></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="space-y-8">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">1. Identity & Authority</h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label><input value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black italic outline-none focus:bg-white" /></div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Token</label><input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder={editingUser.id ? "••••••••" : "Required"} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none focus:bg-white" /></div>
                    <div className="space-y-2 mt-6">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Classification</label>
                      <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                        <button onClick={() => handleSetRole(UserRole.ADMIN)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${editingUser.role === UserRole.ADMIN ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Admin</button>
                        <button onClick={() => handleSetRole(UserRole.CASHIER)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${editingUser.role === UserRole.CASHIER ? 'bg-white text-sky-600 shadow-md' : 'text-slate-400'}`}>Cashier</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">2. Modules</h4>
                <div className="grid grid-cols-1 gap-2.5">
                  {accessModules.map(mod => (
                    <button key={mod.key} onClick={() => handleToggleAccess(mod.key)} disabled={editingUser.role === UserRole.ADMIN} className={`px-5 py-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${editingUser.accessRights[mod.key] ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-white border-slate-50 text-slate-300'}`}>
                      <div className="flex items-center gap-3"><i className={`fas ${mod.icon} text-xs opacity-60`}></i><span className="text-[10px] font-black uppercase tracking-tight italic">{mod.label}</span></div>
                      {editingUser.accessRights[mod.key] && <i className="fas fa-check text-sky-500"></i>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-6 flex flex-col h-full">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">3. Nodes</h4>
                <div className="flex-1 bg-slate-50 rounded-3xl p-6 border-2 border-slate-100 space-y-3 overflow-y-auto custom-scrollbar max-h-[400px]">
                  <button onClick={handleSetGlobalAccess} className={`w-full px-5 py-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${editingUser.assignedStoreIds.includes('all') ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-transparent text-slate-600'}`}>Global Hub Access</button>
                  {stores.map(store => <button key={store.id} disabled={editingUser.assignedStoreIds.includes('all')} onClick={() => handleToggleStore(store.id)} className={`w-full px-5 py-3.5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${editingUser.assignedStoreIds.includes(store.id) ? 'bg-white border-sky-500 text-sky-700 shadow-md' : 'bg-white border-transparent text-slate-600'}`}>{store.name}</button>)}
                </div>
                <button onClick={handleSaveUser} className="w-full py-5 bg-sky-600 text-white rounded-[24px] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl hover:bg-sky-500 active:scale-95 transition-all mt-auto">Confirm Registry Mirror</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
