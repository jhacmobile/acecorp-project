
import React, { useState, useMemo, useEffect } from 'react';
import { User, Store, AppSettings, UserRole, ChatMessage, AccessRights } from '../types';
import AceCorpLogo from './AceCorpLogo';
import ChatSystem from './ChatSystem';

interface LayoutProps {
  user: User | null;
  users: User[];
  messages: ChatMessage[];
  stores: Store[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onSwitchStore: (storeId: string) => void;
  children: React.ReactNode;
  settings: AppSettings;
  syncStatus: 'synced' | 'syncing' | 'error' | 'pending';
  showSyncToast: boolean;
  onManualSync: () => void;
  onTogglePOSHistory?: () => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  onSendMessage: (content: string, recipientId: string) => Promise<void>;
  onMarkAsRead: (senderId: string) => Promise<void>;
}

const RealTimeClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDay = time.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short' });
  const formattedDate = time.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
  const formattedTime = time.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  return (
    <div className="flex flex-col items-center justify-center px-4 border-l border-slate-800 h-10 shrink-0 no-print">
      <div className="flex items-baseline gap-2 leading-none mb-0.5">
        <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest">{formattedDay}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formattedDate}</span>
      </div>
      <span className="text-[12px] font-mono font-black text-slate-100 tracking-widest uppercase">{formattedTime}</span>
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ user, users, messages, stores, activeTab, setActiveTab, onLogout, onSwitchStore, children, settings, syncStatus, showSyncToast, onManualSync, onTogglePOSHistory, isChatOpen, setIsChatOpen, onSendMessage, onMarkAsRead }) => {
  const [showStoreSwitcher, setShowStoreSwitcher] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['inventory', 'hr']);

  if (!user) return null;

  const isAdmin = user.role === UserRole.ADMIN;
  const isDedicatedBandi = user.accessRights.bandiPage && !user.accessRights.dashboard && !user.accessRights.pos && !user.accessRights.sales && !user.accessRights.inventory && !user.accessRights.hrManagement && !user.accessRights.adminPage;
  const isCurrentlyBandi = activeTab === 'bandi';

  const menuItems = useMemo(() => {
    const rights = (user.accessRights || {}) as Partial<AccessRights>;
    
    return [
      { id: 'dashboard', label: 'Dashboard', icon: 'fa-home', access: rights.dashboard || isAdmin },
      { id: 'pos', label: 'Terminal', icon: 'fa-shopping-cart', access: rights.pos },
      { id: 'sales', label: 'Audit', icon: 'fa-chart-line', access: rights.sales },
      { id: 'bandi', label: 'Bandi Page', icon: 'fa-clock', access: rights.bandiPage },
      { 
        id: 'inventory', 
        label: 'Inventory', 
        icon: 'fa-th-list', 
        access: rights.inventory,
        subItems: [
          { id: 'inventory-brands', label: 'Brands', adminOnly: true },
          { id: 'inventory-types', label: 'Product Types', adminOnly: true },
          { id: 'inventory-products', label: 'Products', adminOnly: true },
          { id: 'inventory-stocks', label: 'Stocks', adminOnly: false },
          { id: 'inventory-transfers', label: 'Stock Transfers', adminOnly: false },
        ].filter(sub => !sub.adminOnly || isAdmin)
      },
      { 
        id: 'hr', 
        label: 'HR Hub', 
        icon: 'fa-users', 
        access: rights.hrManagement,
        subItems: [
          { id: 'hr-personnel', label: 'Personnel', adminOnly: false },
          { id: 'hr-attendance', label: 'Time & Attendance', adminOnly: false },
          { id: 'hr-payroll', label: 'Payroll Processing', adminOnly: true },
          { id: 'hr-history', label: 'Payroll Vault', adminOnly: true },
        ].filter(sub => !sub.adminOnly || isAdmin)
      },
      { id: 'admin', label: 'Settings', icon: 'fa-cog', access: rights.adminPage },
    ];
  }, [isAdmin, user.accessRights]);

  const hasUnreadMessages = useMemo(() => {
    return messages.some(m => !m.isRead && (String(m.recipientId) === String(user.id) || m.recipientId === 'global'));
  }, [messages, user.id]);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) ? prev.filter(m => m !== menuId) : [...prev, menuId]
    );
  };

  const assignedStores = useMemo(() => {
    if (!user.assignedStoreIds || user.assignedStoreIds.includes('all')) {
      return stores || [];
    }
    return (stores || []).filter(s => user.assignedStoreIds.includes(s.id));
  }, [user.assignedStoreIds, stores]);

  const activeStore = (stores || []).find(s => s.id === user.selectedStoreId) || 
                      (assignedStores && assignedStores.length > 0 ? assignedStores[0] : { name: 'Node Offline', code: 'OFF', id: '0' });

  const goToDashboard = () => {
    if (isDedicatedBandi) return;
    setActiveTab('dashboard');
    setShowNav(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans antialiased text-slate-900">
      
      {showSyncToast && (
        <div className="fixed top-20 sm:top-24 left-4 sm:left-6 z-[900] animate-in fade-in slide-in-from-left-8 duration-500 no-print">
           <div className="bg-[#0f172a]/95 backdrop-blur-md border border-emerald-500/30 px-4 sm:px-5 py-3 rounded-[20px] sm:rounded-[24px] shadow-2xl flex items-center gap-3 sm:gap-4">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] sm:text-xs shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse">
                 <i className="fas fa-check"></i>
              </div>
              <div>
                 <p className="text-[8px] sm:text-[10px] font-black text-white uppercase tracking-[0.2em] leading-none mb-1">Synchronized</p>
                 <p className="text-[6px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">MIRROR_LIVE</p>
              </div>
           </div>
        </div>
      )}

      {(!isDedicatedBandi || showNav) && (
        <div className={`fixed inset-0 z-[1400] flex no-print ${showNav ? 'visible' : 'invisible'}`}>
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowNav(false)}></div>
          <aside className={`w-72 sm:w-80 bg-slate-950 text-white flex flex-col shadow-2xl relative z-10 transition-transform duration-300 ${showNav ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-6 sm:p-8 border-b border-slate-900 cursor-pointer hover:bg-slate-900/50 transition-colors" onClick={goToDashboard}>
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-[#2d89c8] rounded-xl flex items-center justify-center p-2 shadow-inner border border-sky-500/30">
                   <AceCorpLogo className="w-full h-full" customUrl={settings.logoUrl} inverted />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black italic uppercase leading-none">AceCorp</h1>
                  <p className="text-[8px] font-black text-sky-400 uppercase tracking-widest mt-1">Enterprise Core</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto custom-scrollbar">
              {menuItems.filter(item => item.access).map(item => (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.subItems) toggleMenu(item.id);
                      else { setActiveTab(item.id); setShowNav(false); }
                    }}
                    className={`w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl transition-all ${activeTab.startsWith(item.id) ? 'text-white bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <div className="flex items-center">
                      <i className={`fas ${item.icon} w-5 text-xs sm:text-sm`}></i>
                      <span className="ml-3 text-[10px] sm:text-[12px] font-bold uppercase tracking-tight">{item.label}</span>
                    </div>
                    {item.subItems && <i className={`fas fa-chevron-down text-[8px] sm:text-[10px] transition-transform ${expandedMenus.includes(item.id) ? 'rotate-180' : ''}`}></i>}
                  </button>
                  {item.subItems && expandedMenus.includes(item.id) && (
                    <div className="mt-1 ml-4 space-y-1">
                      {item.subItems.map(sub => (
                        <button 
                          key={sub.id} 
                          type="button" 
                          onClick={() => { setActiveTab(sub.id); setShowNav(false); }}
                          className={`w-full text-left px-8 sm:px-10 py-2 sm:py-2.5 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase transition-all ${activeTab === sub.id ? 'text-white bg-white/10' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
            <div className="p-4 sm:p-6 border-t border-slate-900">
               <button onClick={onLogout} className="w-full flex items-center px-4 sm:px-5 py-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
                  <i className="fas fa-sign-out-alt w-5 text-xs sm:text-sm"></i>
                  <span className="ml-3 text-[10px] sm:text-[12px] font-bold uppercase tracking-tight">Logout</span>
               </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 sm:h-20 bg-slate-950 border-b border-white/5 flex items-center justify-between px-4 sm:px-8 shrink-0 z-40 no-print">
           <div className="flex items-center gap-3 sm:gap-6">
              <button onClick={() => setShowNav(true)} className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all">
                 <i className="fas fa-bars text-sm sm:text-base"></i>
              </button>
              
              {!isCurrentlyBandi && (
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-3">
                  <h2 className="text-sm sm:text-xl font-black italic uppercase tracking-tighter text-white truncate max-w-[120px] sm:max-w-none">{activeStore.name}</h2>
                  <span className="text-[7px] sm:text-[10px] font-bold text-sky-400 uppercase tracking-widest">{activeStore.code}</span>
                </div>
              )}
              
              {isCurrentlyBandi && (
                <div className="hidden sm:flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-[#2d89c8]/20 flex items-center justify-center border border-sky-500/20">
                      <AceCorpLogo className="w-4 h-4" customUrl={settings.logoUrl} inverted />
                   </div>
                   <span className="text-[10px] font-black text-sky-400 uppercase tracking-[0.3em] italic">Enterprise Relay Mode</span>
                </div>
              )}
           </div>

           <div className="flex items-center gap-2 sm:gap-4">
              <RealTimeClock />
              
              <div className="h-8 sm:h-10 w-px bg-slate-800 hidden sm:block"></div>

              <div className="flex items-center gap-1 sm:gap-3">
                 <button 
                  onClick={onManualSync} 
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${syncStatus === 'syncing' ? 'bg-sky-500/10 text-sky-500 animate-spin' : syncStatus === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-slate-400 hover:text-sky-400'}`}
                 >
                   <i className="fas fa-sync-alt text-[10px] sm:text-xs"></i>
                 </button>

                 {!isDedicatedBandi && !isCurrentlyBandi && (
                   <div className="relative">
                      <button 
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${hasUnreadMessages ? 'bg-amber-500/10 text-amber-500 shadow-sm shadow-amber-500/20' : 'bg-white/5 text-slate-400 hover:text-sky-400'}`}
                      >
                        <i className="fas fa-comment-alt text-[10px] sm:text-xs"></i>
                        {hasUnreadMessages && <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full border border-slate-950 animate-pulse"></span>}
                      </button>
                   </div>
                 )}

                 {onTogglePOSHistory && activeTab === 'pos' && (
                    <button 
                      onClick={onTogglePOSHistory}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center hover:text-sky-400 transition-all"
                    >
                      <i className="fas fa-history text-[10px] sm:text-xs"></i>
                    </button>
                 )}
              </div>

              <div className="h-8 sm:h-10 w-px bg-slate-800"></div>

              <div className="flex items-center gap-2 sm:gap-4">
                 <div className="flex flex-col items-end hidden md:flex">
                    <span className="text-[11px] font-black uppercase italic text-white leading-none">{user.username}</span>
                    <span className="text-[8px] font-black text-sky-500 uppercase tracking-widest mt-1">{user.role}</span>
                 </div>
                 <div className="relative">
                    {!isCurrentlyBandi ? (
                      <button 
                        onClick={() => setShowStoreSwitcher(!showStoreSwitcher)}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg border border-white/10 hover:border-sky-500/50 transition-all group overflow-hidden"
                      >
                        <AceCorpLogo className="w-4 h-4 sm:w-5 sm:h-5" customUrl={settings.logoUrl} inverted />
                      </button>
                    ) : (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sky-950 text-white flex items-center justify-center shadow-lg border border-sky-500/10">
                        <i className="fas fa-terminal text-xs text-sky-400"></i>
                      </div>
                    )}
                    
                    {showStoreSwitcher && !isCurrentlyBandi && (
                      <div className="absolute top-full right-0 mt-2 sm:mt-3 w-56 sm:w-64 bg-white border border-slate-100 rounded-[20px] sm:rounded-[28px] shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-4 duration-300 no-print">
                         <div className="px-4 py-2 border-b border-slate-50 mb-1">
                            <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest">Select Node</p>
                         </div>
                         <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {assignedStores.map(s => (
                              <button 
                                key={s.id}
                                onClick={() => { onSwitchStore(s.id); setShowStoreSwitcher(false); }}
                                className={`w-full text-left px-4 py-2.5 rounded-lg sm:rounded-xl transition-all flex items-center justify-between group ${String(user.selectedStoreId) === String(s.id) ? 'bg-sky-50 text-sky-600 font-black' : 'hover:bg-slate-50 text-slate-600'}`}
                              >
                                <div className="flex flex-col">
                                   <span className="text-[10px] sm:text-[11px] uppercase italic">{s.name}</span>
                                   <span className="text-[6px] sm:text-[8px] font-bold uppercase tracking-widest opacity-50">{s.code}</span>
                                </div>
                                {String(user.selectedStoreId) === String(s.id) && <i className="fas fa-check-circle text-sky-500 text-[10px]"></i>}
                              </button>
                            ))}
                         </div>
                         <div className="p-2 mt-1 border-t border-slate-50">
                            <button onClick={onLogout} className="w-full px-4 py-2.5 rounded-lg sm:rounded-xl text-red-500 hover:bg-red-50 transition-all flex items-center gap-3">
                               <i className="fas fa-power-off text-[10px]"></i>
                               <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Logout</span>
                            </button>
                         </div>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>

      {!isDedicatedBandi && !isCurrentlyBandi && (
        <ChatSystem 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)} 
          currentUser={user} 
          users={users} 
          messages={messages} 
          onSendMessage={onSendMessage} 
          onMarkAsRead={onMarkAsRead} 
        />
      )}
    </div>
  );
};

export default Layout;
