
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Store, Product, Stock, Customer, Order, Employee, AttendanceRecord, Expense, UserRole, Brand, ProductCategory, StockTransfer, OrderStatus, TransferStatus, ChatMessage, AccessRights, AccountsReceivable, ReceivablePayment, PayrollHistoryRecord, AttendanceStatus, PayrollDraft, AppSettings, PaymentMethod } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard'; 
import POS from './components/POS';
import SalesReport from './components/SalesReport';
import Inventory from './components/Inventory';
import HRManagement from './components/HRManagement';
import Admin from './components/Admin';
import BandiPage from './components/BandiPage';
import HistoryRegistry from './components/HistoryRegistry';
import { supabase, hasValidConfig } from './supabaseClient';
import { DEFAULT_USER_ACCESS, PICKUP_CUSTOMER } from './constants';
import AceCorpLogo from './components/AceCorpLogo';

const SESSION_KEY = 'acecorp_auth_session';

const SUPER_ADMIN_ACCESS: AccessRights = {
  dashboard: true,
  pos: true,
  sales: true,
  inventory: true,
  hrManagement: true,
  adminPage: true,
  storeManagement: true,
  bandiPage: true
};

const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try { 
        const u = JSON.parse(saved);
        if (u && u.username.toLowerCase() === 'jhacace') {
          u.role = UserRole.ADMIN;
          u.accessRights = { ...SUPER_ADMIN_ACCESS };
          u.assignedStoreIds = ['all'];
        } else if (u && !u.accessRights) {
          u.accessRights = { ...DEFAULT_USER_ACCESS };
        }
        return u;
      } catch (e) { return null; }
    }
    return null;
  });

  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pos');
  
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
  const [receivablePayments, setReceivablePayments] = useState<ReceivablePayment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollHistoryRecord[]>([]);
  const [payrollDrafts, setPayrollDrafts] = useState<PayrollDraft[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [settings, setSettings] = useState({ logoUrl: '' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'pending'>('synced');
  const [showSyncToast, setShowSyncToast] = useState(false);
  const [showPOSHistory, setShowPOSHistory] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const isSyncingRef = useRef(false);
  const lastSyncRef = useRef(0);

  const performInventoryAdjustment = (items: OrderItem[], storeId: string, isReversal = false): Stock[] => {
    const updated = [...stocks];
    const factor = isReversal ? -1 : 1;

    items.forEach(item => {
      if (item.linkedReceivableId) return;
      
      const sIdx = updated.findIndex(s => String(s.productId) === String(item.productId) && String(s.storeId) === String(storeId));
      if (sIdx > -1) {
        updated[sIdx] = { 
          ...updated[sIdx], 
          quantity: updated[sIdx].quantity - (item.qty * factor) 
        };
      }

      if (item.isExchange && item.productType === 'Refill') {
        const refillProduct = products.find(p => String(p.id) === String(item.productId));
        if (refillProduct) {
          const targetEmptyName = (refillProduct.name + "-Emp").toLowerCase();
          const emptyProduct = products.find(p => p.type === 'Empty Cylinders' && p.name.toLowerCase() === targetEmptyName);
          if (emptyProduct) {
             const eIdx = updated.findIndex(s => String(s.productId) === String(emptyProduct.id) && String(s.storeId) === String(storeId));
             if (eIdx > -1) {
                updated[eIdx] = { 
                  ...updated[eIdx], 
                  quantity: updated[eIdx].quantity + (item.qty * factor) 
                };
             }
          }
        }
      }
    });
    return updated;
  };

  const handleVoidOrder = async (order: Order) => {
    if (currentUser?.role !== UserRole.ADMIN) return alert("UNAUTHORIZED: Only Administrators can void transactions.");
    if (order.status === OrderStatus.CANCELLED) return;
    
    if (window.confirm("VOID PROTOCOL: Permanently cancel this record and reverse inventory?")) {
        try {
            const nextStocks = performInventoryAdjustment(order.items, order.storeId, true);
            const success = await handleManualSync(
              orders.map(o => o.id === order.id ? { ...o, status: OrderStatus.CANCELLED, updatedAt: new Date().toISOString() } : o),
              nextStocks
            );
            if (success) alert("VOID SUCCESS: Transaction cancelled and inventory reversed.");
        } catch (err) {
            alert("VOID FAILURE: System error during reversal.");
        }
    }
  };

  const cleanData = (data: any): any => {
    return JSON.parse(JSON.stringify(data, (key, value) => 
      value === undefined ? null : value
    ));
  };

  const ensureUnique = <T extends { id: any }>(arr: T[]): T[] => {
    if (!arr || arr.length === 0) return [];
    const map = new Map<string, T>();
    arr.forEach(item => {
      const key = String(item.id || '').trim();
      if (key && key !== 'undefined' && key !== 'null') map.set(key, item);
    });
    return Array.from(map.values());
  };

  const fetchData = useCallback(async (tableFilters?: string[], isInitial: boolean = false, force: boolean = false) => {
    if (isSyncingRef.current && !force) return;
    
    // Throttle repeated background global fetches, but ALWAYS allow mount-load or forced re-validation
    if (!isInitial && !force && !tableFilters && Date.now() - lastSyncRef.current < 2000) return;

    if (!supabase || !hasValidConfig) {
      setSyncStatus('error');
      setIsAppLoading(false);
      return;
    }

    isSyncingRef.current = true;
    const shouldFetch = (tableName: string) => !tableFilters || tableFilters.includes(tableName);

    setSyncStatus('syncing');
    try {
      const fetchTable = async (table: string, orderCol?: string, ascending: boolean = false, limit?: number, columns: string = '*') => {
        try {
          if (!shouldFetch(table)) return null;
          await new Promise(r => setTimeout(r, 60)); // Serial spacing for network health
          
          let query = supabase.from(table).select(columns);
          if (orderCol) query = query.order(orderCol, { ascending });
          if (limit) query = query.limit(limit);
          
          if (table === 'attendance') {
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            query = query.gte('date', sixtyDaysAgo.toISOString().split('T')[0]);
          }
          
          const { data, error } = await query;
          if (error) throw error;
          return data || [];
        } catch (e: any) {
          if (e.code === '42P01' || e.message?.includes('schema cache')) {
            console.info(`AceCorp Core: Table [${table}] unavailable.`);
          } else {
            console.warn(`Hydration failure for table [${table}]:`, e.message);
          }
          return []; 
        }
      };

      const fetchOrdersOptimized = async () => {
        if (!shouldFetch('orders')) return null;
        try {
          await new Promise(r => setTimeout(r, 60));
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          
          // Request Fingerprinting: Defeat Chrome disk cache by ensuring the query URL is unique.
          // We use a redundant ID filter to break the cache without affecting the result set.
          const fingerprint = `bust_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          
          const { data, error } = await supabase.from('orders')
            .select('*') // Select all columns to ensure mapping doesn't miss new data
            .gte('created_at', ninetyDaysAgo.toISOString().split('.')[0])
            .neq('id', fingerprint) 
            .order('created_at', { ascending: false });
            
          return error ? [] : data;
        } catch (e: any) {
          console.warn(`Hydration failure for table [orders]:`, e.message);
          return [];
        }
      };

      const pData = await fetchTable('products', 'name', true, undefined, 'id, name, brand, type, price, status, size');
      const sData = await fetchTable('stocks', undefined, false, undefined, 'id, product_id, store_id, quantity, initial_stock, status');
      const stData = await fetchTable('stores', 'name', true, undefined, 'id, name, code, address, phone, mobile');
      const bData = await fetchTable('brands', 'name', true, undefined, 'id, name');
      const cData = await fetchTable('categories', 'name', true, undefined, 'id, name');
      const cuData = await fetchTable('customers', undefined, false, undefined, 'id, first_name, last_name, names, addresses, city, landmark, contact_number, discount_per_cylinder, notes');
      const oData = await fetchOrdersOptimized();
      const eData = await fetchTable('employees', 'name', true, undefined, 'id, assigned_store_ids, employee_number, name, type, salary, shift_start, shift_end, pin, loan_balance, loan_weekly_deduction, vale_balance, sss_loan_balance, sss_loan_weekly_deduction, loan_terms, loans, loan_balances');
      const exData = await fetchTable('expenses', 'date', false, 100, 'id, store_id, payee, particulars, amount, date');
      const tData = await fetchTable('stock_transfers', 'created_at', false, 50, 'id, from_store_id, to_store_id, items, returned_items, status, created_at, updated_at, initiated_by, accepted_by');
      const uData = await fetchTable('users', undefined, false, undefined, 'id, username, password, role, assigned_store_ids, selected_store_id, access_rights');
      const mData = await fetchTable('chat_messages', 'created_at', true, 50, 'id, sender_id, sender_name, recipient_id, content, is_read, created_at');
      const seData = await fetchTable('app_settings', undefined, false, 1, 'id, logo_url');
      const arData = await fetchTable('accounts_receivable', 'created_at', false, undefined, 'id, customer_id, order_id, original_amount, outstanding_amount, status, created_at, remarks');
      const rpData = await fetchTable('receivable_payments', 'paid_at', false, 100, 'id, receivable_id, amount, payment_method, paid_at');
      const atData = await fetchTable('attendance', 'date', false, undefined, 'id, employee_id, date, time_in, time_out, late_minutes, undertime_minutes, overtime_minutes, is_half_day, status');
      const phData = await fetchTable('payroll_history', 'generated_at', false, 20, 'id, period_start, period_end, generated_at, generated_by, total_disbursement, payroll_data');
      const pdData = await fetchTable('payroll_drafts', 'updated_at', false, undefined, 'id, store_id, period_start, period_end, adjustments, updated_at');

      if (pData) setProducts(pData.map((p:any) => ({ ...p, id: String(p.id).trim(), price: Number(p.price) || 0 })));
      if (sData) setStocks(sData.map((s:any) => ({ id: String(s.id).trim(), productId: String(s.product_id).trim(), storeId: String(s.store_id).trim(), quantity: Number(s.quantity) || 0, initialStock: Number(s.initial_stock) || 0, status: s.status || 'Active' })));
      if (stData) setStores(stData.map((s:any) => ({ ...s, id: String(s.id).trim() })));
      if (bData) setBrands(bData.map((b:any) => ({ ...b, id: String(b.id).trim() })));
      if (cData) setCategories(cData.map((c:any) => ({ ...c, id: String(c.id).trim() })));
      if (cuData) setCustomers(cuData.map((c:any) => ({ id: String(c.id).trim(), firstName: c.first_name || '', lastName: c.last_name || '', names: Array.isArray(c.names) ? c.names : [], addresses: Array.isArray(c.addresses) ? c.addresses : [], city: c.city || '', landmark: c.landmark || '', contactNumber: c.contact_number || '', discountPerCylinder: Number(c.discount_per_cylinder) || 0, notes: c.notes || '' })));
      
      if (oData) {
        // Critical Fix: Explicit mapping of snake_case (DB) to camelCase (State) 
        // to ensure Dashboard and Audit filters function correctly.
        setOrders(oData.map((o: any) => ({
          id: String(o.id).trim(),
          storeId: String(o.store_id || '').trim(),
          customerId: String(o.customer_id || '').trim(),
          customerName: o.customer_name || 'N/A',
          address: o.address || '',
          city: o.city || '',
          contact: o.contact || '',
          landmark: o.landmark || '',
          items: o.items || [],
          totalAmount: Number(o.total_amount || 0),
          totalDiscount: Number(o.total_discount || 0),
          status: o.status as OrderStatus,
          paymentMethod: o.payment_method as PaymentMethod,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
          createdBy: o.created_by || 'SYSTEM',
          modifiedBy: o.modified_by || 'SYSTEM',
          remark: o.remark || '',
          returnedCylinder: !!o.returned_cylinder,
          riderId: o.rider_id ? String(o.rider_id).trim() : undefined,
          riderName: o.rider_name || undefined
        })));
      }

      if (arData) {
        setReceivables(arData.map((ar:any) => ({ 
          id: String(ar.id).trim(), 
          customerId: String(ar.customer_id).trim(), 
          orderId: String(ar.order_id).trim(), 
          originalAmount: Number(ar.original_amount), 
          outstandingAmount: Number(ar.outstanding_amount), 
          status: ar.status, 
          createdAt: ar.created_at, 
          remarks: ar.remarks || '' 
        })));
      }

      if (rpData) {
        setReceivablePayments(rpData.map((rp:any) => ({ 
          id: String(rp.id).trim(), 
          receivableId: String(rp.receivable_id).trim(), 
          amount: Number(rp.amount), 
          paymentMethod: rp.payment_method, 
          paidAt: rp.paid_at 
        })));
      }

      if (eData) setEmployees(eData.map((e:any) => ({ id: String(e.id).trim(), assignedStoreIds: Array.isArray(e.assigned_store_ids) ? e.assigned_store_ids.map(id => String(id).trim()) : [String(e.store_id || '').trim()], employeeNumber: e.employee_number, name: e.name, type: e.type, salary: Number(e.salary) || 0, shiftStart: e.shift_start || '08:00', shiftEnd: e.shift_end || '17:00', pin: e.pin || '', loanBalance: Number(e.loan_balance) || 0, loanWeeklyDeduction: Number(e.loan_weekly_deduction) || 0, valeBalance: Number(e.vale_balance) || 0, sssLoanBalance: Number(e.sss_loan_balance) || 0, sssLoanWeeklyDeduction: Number(e.sss_loan_weekly_deduction) || 0, loanTerms: e.loan_terms || '0', loans: e.loans || { salary: 0, sss: 0, vale: 0 }, loanBalances: e.loan_balances || { salary: 0, sss: 0, vale: 0 } })));
      if (atData) setAttendance(atData.map((a:any) => ({ id: String(a.id).trim(), employeeId: String(a.employee_id).trim(), date: a.date, timeIn: a.time_in || '', timeOut: a.time_out || '', lateMinutes: Number(a.late_minutes) || 0, undertimeMinutes: Number(a.undertime_minutes) || 0, overtimeMinutes: Number(a.overtime_minutes) || 0, isHalfDay: !!a.is_half_day, status: (a.status as AttendanceStatus) || 'REGULAR' })));
      if (phData) setPayrollHistory(phData.map((ph:any) => ({ id: ph.id, periodStart: ph.period_start, periodEnd: ph.period_end, generatedAt: ph.generated_at || ph.generatedAt, generatedBy: ph.generated_by || ph.generatedBy, totalDisbursement: Number(ph.total_disbursement), payrollData: ph.payroll_data || [] })));
      if (pdData) setPayrollDrafts(pdData.map((pd:any) => ({ id: pd.id, storeId: pd.store_id, periodStart: pd.period_start, periodEnd: pd.period_end, adjustments: pd.adjustments || {}, updatedAt: pd.updated_at })));
      if (exData) setExpenses(exData.map((ex:any) => ({ ...ex, id: String(ex.id).trim(), storeId: String(ex.store_id).trim() })));
      
      if (tData) {
        setTransfers(tData.map((t:any) => ({ 
          id: String(t.id).trim(), 
          fromStoreId: String(t.from_store_id).trim(), 
          toStoreId: String(t.to_store_id).trim(), 
          items: Array.isArray(t.items) ? t.items : [], 
          returnedItems: Array.isArray(t.returned_items) ? t.returned_items : [], 
          status: t.status as TransferStatus, 
          createdAt: t.created_at, 
          updatedAt: t.updated_at, 
          initiatedBy: t.initiated_by, 
          acceptedBy: t.accepted_by 
        })));
      }
      
      if (uData) {
        const mappedUsers = uData.map((u:any) => {
          const isSuper = u.username.toLowerCase() === 'jhacace';
          return { id: String(u.id).trim(), username: u.username, password: u.password, role: isSuper ? UserRole.ADMIN : u.role as UserRole, assignedStoreIds: isSuper ? ['all'] : (Array.isArray(u.assigned_store_ids) ? u.assigned_store_ids.map(id => String(id).trim()) : []), selectedStoreId: String(u.selected_store_id || '').trim(), accessRights: isSuper ? { ...SUPER_ADMIN_ACCESS } : (u.access_rights || { ...DEFAULT_USER_ACCESS }) };
        });
        setUsers(mappedUsers);
      }

      if (mData) setMessages(mData.map((m:any) => ({ id: String(m.id).trim(), senderId: String(m.sender_id).trim(), senderName: String(m.sender_name), recipientId: String(m.recipient_id).trim(), content: String(m.content), isRead: !!m.is_read, createdAt: m.created_at })));
      if (seData && seData.length > 0) setSettings({ logoUrl: seData[0].logo_url || '' });

      setSyncStatus('synced');
      lastSyncRef.current = Date.now();
    } catch (error: any) {
      console.error("AceCorp Hydration Failure:", error);
      setSyncStatus('error');
    } finally {
      setIsAppLoading(false);
      isSyncingRef.current = false;
    }
  }, [currentUser?.id]);

  useEffect(() => { 
    // Perform critical hydration on mount (bypass throttle)
    fetchData(undefined, true, true); 
    
    const handleRevalidation = () => {
      if (document.visibilityState === 'visible') {
        // Trigger a forced re-validation when the user returns to the tab
        fetchData(undefined, false, true);
      }
    };

    window.addEventListener('visibilitychange', handleRevalidation);
    window.addEventListener('focus', handleRevalidation);
    
    return () => {
      window.removeEventListener('visibilitychange', handleRevalidation);
      window.removeEventListener('focus', handleRevalidation);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!supabase || !hasValidConfig) return;
    
    const channel = supabase.channel('acecorp_realtime_broadcast')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData(['orders'], false, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, () => fetchData(['stocks'], false, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_transfers' }, () => fetchData(['stock_transfers'], false, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => fetchData(['chat_messages'], false, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchData(['employees'], false, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchData(['customers'], false, true))
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
           console.warn('AceCorp: Real-time broadcast link unstable. Re-syncing...');
           fetchData(undefined, false, true);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleManualSync = async (
    immediateOrders?: Order[], 
    immediateStocks?: Stock[], 
    immediateUsers?: User[], 
    immediateProducts?: Product[], 
    immediateBrands?: Brand[], 
    immediateCategories?: ProductCategory[], 
    immediateTransfers?: StockTransfer[],
    immediateStores?: Store[],
    immediateEmployees?: Employee[],
    immediateCustomers?: Customer[],
    immediateReceivables?: AccountsReceivable[],
    immediateReceivablePayments?: ReceivablePayment[],
    immediateAttendance?: AttendanceRecord[],
    immediatePayrollHistory?: PayrollHistoryRecord[],
    immediatePayrollDraft?: PayrollDraft,
    immediateSettings?: AppSettings
  ) => {
    const isManualCall = !!(immediateOrders || immediateStocks || immediateUsers || immediateProducts || immediateBrands || immediateCategories || immediateTransfers || immediateStores || immediateEmployees || immediateCustomers || immediateReceivables || immediateReceivablePayments || immediateAttendance || immediatePayrollHistory || immediatePayrollDraft || immediateSettings);
    
    if (!supabase || !hasValidConfig || (isSyncingRef.current && !isManualCall)) return false;
    
    setSyncStatus('syncing');
    try {
      if (immediateSettings) {
        await supabase.from('app_settings').upsert({ id: 1, logo_url: immediateSettings.logoUrl });
      }
      if (immediateUsers && immediateUsers.length > 0) {
          const mappedUsers = immediateUsers.map(u => ({ id: String(u.id), username: u.username.toLowerCase(), password: u.password, role: u.role, assigned_store_ids: u.assignedStoreIds, selected_store_id: u.selectedStoreId, access_rights: u.accessRights }));
          await supabase.from('users').upsert(mappedUsers, { onConflict: 'id' });
      }
      if (immediateAttendance && immediateAttendance.length > 0) {
          const mappedAt = immediateAttendance.map(a => ({ id: String(a.id), employee_id: String(a.employeeId), date: a.date, time_in: a.timeIn, time_out: a.timeOut, late_minutes: Number(a.lateMinutes), undertime_minutes: Number(a.undertimeMinutes), overtime_minutes: Number(a.overtimeMinutes), is_half_day: !!a.isHalfDay, status: a.status }));
          await supabase.from('attendance').upsert(cleanData(ensureUnique(mappedAt)), { onConflict: 'id' });
      }
      if (immediatePayrollHistory && immediatePayrollHistory.length > 0) {
          const mappedPH = immediatePayrollHistory.map(ph => ({ id: ph.id, period_start: ph.periodStart, period_end: ph.periodEnd, generated_at: ph.generatedAt, generated_by: ph.generatedBy, total_disbursement: ph.totalDisbursement, payroll_data: ph.payrollData }));
          await supabase.from('payroll_history').upsert(cleanData(ensureUnique(mappedPH)), { onConflict: 'id' });
      }
      if (immediatePayrollDraft) {
          const mappedPD = { id: immediatePayrollDraft.id, store_id: immediatePayrollDraft.storeId, period_start: immediatePayrollDraft.periodStart, period_end: immediatePayrollDraft.periodEnd, adjustments: immediatePayrollDraft.adjustments, updated_at: new Date().toISOString() };
          await supabase.from('payroll_drafts').upsert(cleanData(mappedPD), { onConflict: 'id' });
      }
      if (immediateStores && immediateStores.length > 0) {
          const mappedStores = immediateStores.map(s => ({ id: String(s.id), name: s.name, code: s.code, address: s.address || '', phone: s.phone || '', mobile: s.mobile || '' }));
          await supabase.from('stores').upsert(mappedStores, { onConflict: 'id' });
      }
      if (immediateProducts && immediateProducts.length > 0) {
        const mappedProds = immediateProducts.map(p => ({ id: String(p.id).trim(), name: p.name, brand: p.brand, type: p.type, price: Number(p.price) || 0, status: p.status || 'Active', size: p.size || 'N/A' }));
        await supabase.from('products').upsert(cleanData(ensureUnique(mappedProds)), { onConflict: 'id' });
      }
      if (immediateEmployees && immediateEmployees.length > 0) {
        const mappedEmps = immediateEmployees.map(e => ({ id: String(e.id), assigned_store_ids: e.assignedStoreIds, employee_number: e.employeeNumber, name: e.name, type: e.type, salary: Number(e.salary), shift_start: e.shiftStart, shift_end: e.shiftEnd, pin: e.pin, loan_balance: Number(e.loanBalance) || 0, vale_balance: Number(e.valeBalance) || 0, sss_loan_balance: Number(e.sssLoanBalance) || 0, loan_terms: String(e.loanTerms || '0'), loan_weekly_deduction: Number(e.loanWeeklyDeduction) || 0, sss_loan_weekly_deduction: Number(e.sssLoanWeeklyDeduction) || 0, loans: e.loans, loan_balances: e.loanBalances }));
        await supabase.from('employees').upsert(cleanData(ensureUnique(mappedEmps)), { onConflict: 'id' });
      }
      if (immediateBrands && immediateBrands.length > 0) {
        const mappedBrands = immediateBrands.map(b => ({ id: String(b.id).trim(), name: b.name }));
        await supabase.from('brands').upsert(cleanData(ensureUnique(mappedBrands)), { onConflict: 'id' });
      }
      if (immediateCategories && immediateCategories.length > 0) {
        const mappedCats = immediateCategories.map(c => ({ id: String(c.id).trim(), name: c.name }));
        await supabase.from('categories').upsert(cleanData(ensureUnique(mappedCats)), { onConflict: 'id' });
      }
      if (immediateCustomers && immediateCustomers.length > 0) { 
        const mappedCustomers = immediateCustomers.map(c => ({ id: String(c.id).trim(), first_name: c.firstName, last_name: c.lastName, names: c.names, addresses: c.addresses, city: c.city, landmark: c.landmark, contact_number: c.contactNumber, discount_per_cylinder: Number(c.discountPerCylinder) || 0, notes: c.notes }));
        await supabase.from('customers').upsert(cleanData(ensureUnique(mappedCustomers)), { onConflict: 'id' });
      }
      if (immediateOrders && immediateOrders.length > 0) {
        const mappedOrders = immediateOrders.map(o => ({ id: String(o.id).trim(), store_id: String(o.storeId).trim(), customer_id: String(o.customerId).trim(), customer_name: o.customerName || 'N/A', address: o.address || '', city: o.city || '', contact: o.contact || '', landmark: o.landmark || '', items: o.items || [], total_amount: Number(o.totalAmount), total_discount: Number(o.totalDiscount), status: o.status, payment_method: o.paymentMethod, created_at: o.createdAt, updated_at: o.updatedAt, created_by: o.createdBy, modified_by: o.modifiedBy, remark: o.remark || '', returned_cylinder: !!o.returnedCylinder, rider_id: o.riderId ? String(o.riderId).trim() : null, rider_name: o.riderName || null }));
        await supabase.from('orders').upsert(cleanData(ensureUnique(mappedOrders)), { onConflict: 'id' });
      }
      if (immediateStocks && immediateStocks.length > 0) {
        const mappedStocks = immediateStocks.map(s => ({ id: String(s.id).trim(), product_id: String(s.productId).trim(), store_id: String(s.storeId).trim(), quantity: Number(s.quantity) || 0, initial_stock: Number(s.initialStock) || 0, status: s.status || 'Active' }));
        await supabase.from('stocks').upsert(cleanData(ensureUnique(mappedStocks)), { onConflict: 'id' });
      }
      if (immediateTransfers && immediateTransfers.length > 0) {
        const mappedTransfers = immediateTransfers.map(t => ({ id: String(t.id).trim(), from_store_id: String(t.fromStoreId).trim(), to_store_id: String(t.toStoreId).trim(), items: t.items, returned_items: t.returnedItems, status: t.status, created_at: t.createdAt, updated_at: t.updatedAt, initiated_by: t.initiatedBy, accepted_by: t.acceptedBy }));
        await supabase.from('stock_transfers').upsert(cleanData(ensureUnique(mappedTransfers)), { onConflict: 'id' });
      }
      if (immediateReceivables && immediateReceivables.length > 0) {
        const mappedAR = immediateReceivables.map(ar => ({ id: ar.id, customer_id: ar.customerId, order_id: ar.orderId, original_amount: ar.originalAmount, outstanding_amount: ar.outstandingAmount, status: ar.status, created_at: ar.createdAt, remarks: ar.remarks }));
        await supabase.from('accounts_receivable').upsert(cleanData(ensureUnique(mappedAR)), { onConflict: 'id' });
      }
      if (immediateReceivablePayments && immediateReceivablePayments.length > 0) {
        const mappedRP = immediateReceivablePayments.map(rp => ({ id: rp.id, receivable_id: rp.receivableId, amount: rp.amount, payment_method: rp.paymentMethod, paid_at: rp.paidAt }));
        await supabase.from('receivable_payments').upsert(cleanData(ensureUnique(mappedRP)), { onConflict: 'id' });
      }
      
      setSyncStatus('synced');
      
      if (isManualCall) { 
        setShowSyncToast(true); 
        setTimeout(() => setShowSyncToast(false), 3000); 
        
        // Protocol Implementation: Forced Registry Mirror Revalidation
        // Wait 500ms for DB write-ahead log to settle before read request
        await new Promise(r => setTimeout(r, 500));
        
        isSyncingRef.current = false;
        const tablesToRefresh = [];
        if (immediateOrders) tablesToRefresh.push('orders');
        if (immediateStocks) tablesToRefresh.push('stocks');
        if (immediateCustomers) tablesToRefresh.push('customers');
        if (immediateReceivables || immediateReceivablePayments) tablesToRefresh.push('accounts_receivable', 'receivable_payments');
        
        // Force fresh hydration from cloud to verify data integrity immediately
        await fetchData(tablesToRefresh.length > 0 ? tablesToRefresh : undefined, false, true); 
      }
      return true;
    } catch (err: any) {
      console.error("Master Sync Failure:", err.message);
      setSyncStatus('error');
      isSyncingRef.current = false;
      return false;
    }
  };

  const onSendMessage = async (content: string, recipientId: string) => {
    if (!currentUser || !supabase) return;
    const msg = { id: `MSG-${Date.now()}-${Math.floor(Math.random()*1000)}`, sender_id: String(currentUser.id), sender_name: currentUser.username, recipient_id: String(recipientId), content, is_read: false, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, { id: msg.id, senderId: msg.sender_id, senderName: msg.sender_name, recipientId: msg.recipient_id, content: msg.content, isRead: msg.is_read, createdAt: msg.created_at }]);
    try {
      const { error } = await supabase.from('chat_messages').insert([msg]);
      if (error) throw error;
    } catch (e) { setMessages(prev => prev.filter(m => m.id !== msg.id)); }
  };

  const onMarkAsRead = async (senderId: string) => {
    if (!currentUser || !supabase) return;
    try {
      const query = supabase.from('chat_messages').update({ is_read: true });
      if (senderId === 'global') query.eq('recipient_id', 'global');
      else query.eq('sender_id', String(senderId)).eq('recipient_id', String(currentUser.id));
      const { error } = await query;
      if (error) throw error;
      setMessages(prev => prev.map(m => {
        const isTarget = (senderId === 'global' && m.recipientId === 'global') || (String(m.senderId) === String(senderId) && String(m.recipientId) === String(currentUser.id));
        return isTarget ? { ...m, isRead: true } : m;
      }));
    } catch (e) {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      if (loginData.username.toLowerCase() === 'jhacace' && loginData.password === 'jhac1617') {
         const superUser: User = {
            id: 'superuser-jhacace',
            username: 'jhacace',
            role: UserRole.ADMIN,
            assignedStoreIds: ['all'],
            selectedStoreId: stores.length > 0 ? stores[0].id : '',
            accessRights: { ...SUPER_ADMIN_ACCESS }
         };
         setCurrentUser(superUser);
         localStorage.setItem(SESSION_KEY, JSON.stringify(superUser));
         setIsLoggingIn(false);
         return;
      }

      const u = users.find(usr => usr.username.toLowerCase() === loginData.username.toLowerCase() && usr.password === loginData.password);
      if (u) {
        const isSuper = u.username.toLowerCase() === 'jhacace';
        const assigned = (isSuper || u.assignedStoreIds.includes('all')) ? stores : stores.filter(s => u.assignedStoreIds.includes(s.id));
        let targetStoreId = u.selectedStoreId;
        if (!assigned.some(s => s.id === targetStoreId)) targetStoreId = assigned.length > 0 ? assigned[0].id : '';
        const sessionUser = { ...u, selectedStoreId: targetStoreId, role: isSuper ? UserRole.ADMIN : u.role, accessRights: isSuper ? { ...SUPER_ADMIN_ACCESS } : u.accessRights, assignedStoreIds: isSuper ? ['all'] : u.assignedStoreIds };
        setCurrentUser(sessionUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      } else {
        setLoginError("Invalid system credentials.");
      }
    } finally { setIsLoggingIn(false); }
  };

  const onSwitchStore = (storeId: string) => {
    if (!currentUser) return;
    const next = { ...currentUser, selectedStoreId: storeId };
    setCurrentUser(next);
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  };

  const renderContent = () => {
    if (!currentUser) return null;
    switch (activeTab) {
      case 'dashboard': return <Dashboard key="dashboard" user={currentUser} orders={orders} products={products} stocks={stocks} stores={stores} selectedStoreId={currentUser.selectedStoreId} receivables={receivables} receivablePayments={receivablePayments} logoUrl={settings.logoUrl} />;
      case 'pos': return <POS key="pos" user={currentUser} stores={stores} onSwitchStore={onSwitchStore} customers={customers} setCustomers={setCustomers} products={products} stocks={stocks} setStocks={setStocks} orders={orders} setOrders={setOrders} employees={employees} showHistoryPanel={showPOSHistory} setShowHistoryPanel={setShowPOSHistory} onCustomerSelect={setSelectedCustomerId} receivables={receivables} onSync={(o, s, c, ar, rp) => handleManualSync(o, s, undefined, undefined, undefined, undefined, undefined, undefined, undefined, c, ar, rp)} logoUrl={settings.logoUrl} />;
      case 'sales': return <SalesReport key="sales" user={currentUser} orders={orders} setOrders={setOrders} expenses={expenses} setExpenses={setExpenses} products={products} stores={stores} receivables={receivables} receivablePayments={receivablePayments} logoUrl={settings.logoUrl} />;
      case 'inventory-products':
      case 'inventory-stocks':
      case 'inventory-transfers':
      case 'inventory-brands':
      case 'inventory-types': return <Inventory key={activeTab} user={currentUser} products={products} setProducts={setProducts} stocks={stocks} setStocks={setStocks} stores={stores} transfers={transfers} setTransfers={setTransfers} brands={brands} setBrands={setBrands} categories={categories} setCategories={setCategories} activeTab={activeTab} onSwitchStore={onSwitchStore} onSync={handleManualSync} logoUrl={settings.logoUrl} />;
      case 'hr-personnel':
      case 'hr-attendance':
      case 'hr-payroll':
      case 'hr-history': return <HRManagement key={activeTab} activeTab={activeTab} user={currentUser} employees={employees} setEmployees={setEmployees} attendance={attendance} setAttendance={setAttendance} payrollHistory={payrollHistory} setPayrollHistory={setPayrollHistory} payrollDrafts={payrollDrafts} setPayrollDrafts={setPayrollDrafts} stores={stores} onSync={(immediateEmps, immediateAttendance, immediatePayrollHistory, immediatePayrollDraft) => handleManualSync(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, immediateEmps, undefined, undefined, undefined, immediateAttendance, immediatePayrollHistory, immediatePayrollDraft)} />;
      case 'hr': return <HRManagement key="hr" activeTab="hr-personnel" user={currentUser} employees={employees} setEmployees={setEmployees} attendance={attendance} setAttendance={setAttendance} payrollHistory={payrollHistory} setPayrollHistory={setPayrollHistory} payrollDrafts={payrollDrafts} setPayrollDrafts={setPayrollDrafts} stores={stores} onSync={(immediateEmps, immediateAttendance, immediatePayrollHistory, immediatePayrollDraft) => handleManualSync(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, immediateEmps, undefined, undefined, undefined, immediateAttendance, immediatePayrollHistory, immediatePayrollDraft)} />;
      case 'admin': return <Admin key="admin" users={users} setUsers={setUsers} stores={stores} setStores={setStores} settings={settings} setSettings={setSettings} onSync={(o, s, u, p, b, c, t, st, se) => handleManualSync(o, s, u, p, b, c, t, st, undefined, undefined, undefined, undefined, undefined, undefined, undefined, se)} products={products} stocks={stocks} />;
      case 'bandi': return <BandiPage user={currentUser} employees={employees} attendance={attendance} setAttendance={setAttendance} onSync={(at) => handleManualSync(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, at)} />;
      default: return null;
    }
  };

  if (isAppLoading) return <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white"><div className="w-20 h-20 mb-8 border-4 border-sky-50/20 border-t-sky-500 rounded-full animate-spin"></div><h1 className="text-xl font-black italic animate-pulse tracking-widest uppercase">Initializing Core...</h1></div>;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0f172a] to-[#0a0f1e] flex items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-xl flex flex-col items-center">
          <div className="bg-[#050810]/60 backdrop-blur-3xl w-full rounded-[64px] p-12 md:p-16 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden animate-in zoom-in duration-500">
             <div className="flex flex-col items-center mb-14 relative z-10">
                <div className="w-24 h-24 bg-[#0a0f1e] rounded-[32px] mb-8 flex items-center justify-center shadow-2xl border border-white/5 overflow-hidden p-4">
                  <AceCorpLogo className="w-full h-full" customUrl={settings.logoUrl} inverted />
                </div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">AceCorp Core</h2>
                <p className="text-[10px] font-black text-[#38bdf8] uppercase tracking-[0.5em] mt-3 opacity-90">Enterprise Logistics Gateway</p>
             </div>
             <form onSubmit={handleLogin} className="space-y-10 relative z-10">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Terminal Identifier</label>
                   <div className="relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-400 transition-colors"><i className="fas fa-fingerprint text-lg"></i></div>
                      <input required value={loginData.username} onChange={e => setLoginData({...loginData, username: e.target.value})} className="w-full pl-16 pr-6 py-6 bg-[#dbeafe] border-none rounded-[24px] focus:ring-4 focus:ring-sky-50/20 outline-none transition-all font-black text-slate-900 placeholder:text-slate-400 text-lg" placeholder="Operator Username" />
                   </div>
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Security Access Token</label>
                   <div className="relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-400 transition-colors"><i className="fas fa-key text-lg"></i></div>
                      <input type="password" required value={loginData.password} onChange={e => setLoginData({...loginData, password: e.target.value})} className="w-full pl-16 pr-6 py-6 bg-[#dbeafe] border-none rounded-[24px] focus:ring-4 focus:ring-sky-50/20 outline-none transition-all font-black text-slate-900 placeholder:text-slate-400 text-lg" placeholder="••••••••" />
                   </div>
                </div>
                {loginError && (<p className="text-red-400 text-[11px] font-black uppercase text-center tracking-widest animate-bounce"><i className="fas fa-exclamation-triangle mr-2"></i> {loginError}</p>)}
                <button disabled={isLoggingIn} className="w-full py-6 bg-gradient-to-r from-sky-600 to-blue-700 text-white rounded-[24px] font-black uppercase tracking-widest text-[13px] shadow-2xl shadow-sky-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4">
                  {isLoggingIn ? "Syncing..." : "Establish Session"}
                  {!isLoggingIn && <i className="fas fa-arrow-right text-xs"></i>}
                </button>
             </form>
             <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none"></div>
             <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
          </div>
          <p className="mt-10 text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] opacity-50">AceCorp Core V1.5.5 • Sovereign Registry Mirror</p>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      user={currentUser} users={users} messages={messages} stores={stores} activeTab={activeTab} setActiveTab={setActiveTab} 
      onLogout={() => { setCurrentUser(null); localStorage.removeItem(SESSION_KEY); window.location.reload(); }} 
      onSwitchStore={onSwitchStore} settings={settings} syncStatus={syncStatus} showSyncToast={showSyncToast} 
      onManualSync={() => handleManualSync()} onTogglePOSHistory={() => setShowPOSHistory(!showPOSHistory)} 
      isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} onSendMessage={onSendMessage} onMarkAsRead={onMarkAsRead}
    >
      {renderContent()}
      
      {currentUser && (
        <HistoryRegistry 
          isOpen={showPOSHistory}
          onClose={() => setShowPOSHistory(false)}
          orders={orders}
          stores={stores}
          user={currentUser}
          logoUrl={settings.logoUrl}
          selectedCustomerId={selectedCustomerId}
          onVoidOrder={handleVoidOrder}
          onModifyOrder={(order) => {
            setActiveTab('pos');
            setShowPOSHistory(false);
            // We can add more logic here to auto-load the order into POS if needed
          }}
        />
      )}
    </Layout>
  );
};

export default App;
