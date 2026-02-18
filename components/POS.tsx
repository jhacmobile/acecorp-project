
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Customer, Product, Stock, Order, OrderStatus, OrderItem, Employee, Store, EmployeeType, UserRole, AccountsReceivable, ReceivablePayment, PaymentMethod } from '../types';
import { PICKUP_CUSTOMER } from '../constants';
import CustomDatePicker from './CustomDatePicker';
import AceCorpLogo from './AceCorpLogo';

interface POSProps {
  user: User;
  stores: Store[];
  onSwitchStore: (id: string) => void;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  products: Product[];
  stocks: Stock[];
  setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  orders: Order[];
  employees: Employee[];
  showHistoryPanel: boolean;
  setShowHistoryPanel: React.Dispatch<React.SetStateAction<boolean>>;
  receivables?: AccountsReceivable[];
  onSync: (immediateOrders?: Order[], immediateStocks?: Stock[], immediateCustomers?: Customer[], immediateReceivables?: AccountsReceivable[], immediateReceivablePayments?: ReceivablePayment[]) => Promise<boolean>;
  logoUrl?: string;
}

type OrderType = 'pickup' | 'delivery';
type HistoryTab = 'store' | 'pickup' | 'delivery' | 'customer';

const POS: React.FC<POSProps> = ({ user, stores, onSwitchStore, customers, setCustomers, products, stocks, setStocks, orders, setOrders, employees, showHistoryPanel, setShowHistoryPanel, receivables = [], onSync, logoUrl }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeTab, setActiveTypeTab] = useState('ALL');
  const [activeCart, setActiveCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  
  // MODAL STATES
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [activeCustomerNotes, setActiveCustomerNotes] = useState('');
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [orderRemark, setOrderRemark] = useState('');
  const [pendingRefillProduct, setPendingRefillProduct] = useState<Product | null>(null);
  const [showCylinderPicker, setShowCylinderPicker] = useState(false);
  
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedRider, setSelectedRider] = useState<Employee | null>(null);
  const [riderSearchQuery, setRiderSearchQuery] = useState('');
  const [isRiderDropdownOpen, setIsRiderDropdownOpen] = useState(false);

  // Print Management
  const [printCopyType, setPrintCopyType] = useState<'CUSTOMER' | 'GATE' | 'STORE' | 'ALL'>('ALL');

  // History Registry State
  const [historyTab, setHistoryTab] = useState<HistoryTab>('store');
  const [historyDate, setHistoryDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<Order | null>(null);
  const [showHistoryReceipt, setShowHistoryReceipt] = useState(false);

  const suggestionContainerRef = useRef<HTMLDivElement>(null);
  const riderDropdownRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'phone' | 'firstName' | 'lastName' | null>(null);

  const LOW_STOCK_THRESHOLD = 3;
  const isAdmin = user.role === UserRole.ADMIN;

  const getPHTimestamp = () => new Date().toISOString();
  const formatCurrency = (amount: number) => amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const toPHDateString = (isoString: string) => {
    try {
      if (!isoString) return '';
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch (e) { return isoString?.split('T')[0] || ''; }
  };

  const formatMobile = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 4) return d;
    if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
    return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  };

  const [customerPhone, setCustomerPhone] = useState('N/A');
  const [customerData, setCustomerData] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    landmark: string;
    discount: string;
    notes: string;
  }>({ 
    id: '', firstName: 'PICKUP', lastName: 'CUSTOMER', address: 'WALK-IN TERMINAL', city: 'VARIOUS', landmark: 'STATION', discount: '0.00', notes: '' 
  });

  const customerReceivables = useMemo(() => {
    if (!customerData.id || customerData.id === PICKUP_CUSTOMER.id) return [];
    return receivables.filter(r => String(r.customerId) === String(customerData.id) && r.status === 'open');
  }, [receivables, customerData.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionContainerRef.current && !suggestionContainerRef.current.contains(event.target as Node)) {
        setSuggestions([]);
        setActiveSuggestionField(null);
      }
      if (riderDropdownRef.current && !riderDropdownRef.current.contains(event.target as Node)) {
        setIsRiderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetTerminal = () => {
    setActiveCart([]);
    setOrderType('pickup');
    setPaymentMethod('CASH');
    setCustomerPhone('N/A');
    setCustomerData({ id: '', firstName: 'PICKUP', lastName: 'CUSTOMER', address: 'WALK-IN TERMINAL', city: 'VARIOUS', landmark: 'STATION', discount: '0.00', notes: '' });
    setOrderRemark('');
    setSearchQuery('');
    setActiveTypeTab('ALL');
    setSelectedRider(null);
    setRiderSearchQuery('');
    setEditingOrderId(null);
    setSuggestions([]);
    setActiveSuggestionField(null);
    setPrintCopyType('ALL');
  };

  const getStockForStore = (productId: string) => {
    return stocks.find(s => String(s.productId) === String(productId) && String(s.storeId) === String(user.selectedStoreId))?.quantity || 0;
  };

  const selectCustomer = (match: Customer) => {
    setCustomerPhone(formatMobile(match.contactNumber));
    setCustomerData({
      id: String(match.id),
      firstName: (match.firstName || '').toUpperCase(),
      lastName: (match.lastName || '').toUpperCase(),
      address: (match.addresses[0] || '').toUpperCase(),
      city: (match.city || '').toUpperCase(),
      landmark: (match.landmark || '').toUpperCase(),
      discount: match.discountPerCylinder !== null ? match.discountPerCylinder.toFixed(2) : '0.00',
      notes: (match.notes || '').toUpperCase()
    });

    if (match.notes && match.notes.trim()) {
      setActiveCustomerNotes(String(match.notes).toUpperCase());
      setIsNotesModalOpen(true);
    }
    setSuggestions([]);
    setActiveSuggestionField(null);
  };

  const searchInRegistry = (query: string, field: 'phone' | 'firstName' | 'lastName') => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setActiveSuggestionField(null);
      return;
    }
    const qLower = query.toLowerCase().trim();
    const qClean = query.replace(/\D/g, '');
    const matches = customers.filter(c => {
      const fName = (c.firstName || '').toLowerCase();
      const lName = (c.lastName || '').toLowerCase();
      const contact = c.contactNumber.replace(/\D/g, '');
      if (field === 'phone') return contact.includes(qClean);
      if (field === 'firstName') return fName.includes(qLower);
      if (field === 'lastName') return lName.includes(qLower);
      return false;
    }).slice(0, 5);

    setSuggestions(matches);
    setActiveSuggestionField(field);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMobile(e.target.value);
    setCustomerPhone(formatted);
    searchInRegistry(formatted, 'phone');
  };

  const handleFieldChange = (field: 'firstName' | 'lastName' | 'city' | 'address' | 'landmark' | 'discount' | 'notes', val: string) => {
    const finalVal = (field === 'discount') ? val : String(val).toUpperCase();
    setCustomerData(prev => ({ ...prev, [field]: finalVal }));
    if (field === 'firstName' || field === 'lastName') {
      searchInRegistry(val, field);
    }
  };

  const handleOrderTypeSwitch = (type: OrderType) => {
    setOrderType(type);
    setSelectedRider(null);
    setRiderSearchQuery('');
    setSuggestions([]);
    setActiveSuggestionField(null);
    if (type === 'pickup') {
      setCustomerPhone('N/A');
      setCustomerData({ id: '', firstName: 'PICKUP', lastName: 'CUSTOMER', address: 'WALK-IN TERMINAL', city: 'VARIOUS', landmark: 'STATION', discount: '0.00', notes: '' });
    } else {
      setCustomerPhone('');
      setCustomerData({ id: '', firstName: '', lastName: '', address: '', city: '', landmark: '', discount: '0.00', notes: '' });
    }
  };

  const handleUpdateProfile = async (): Promise<{ success: boolean; finalId: string }> => {
    if (!customerPhone || !customerData.lastName.trim()) return { success: false, finalId: '' };
    setIsSyncingProfile(true);
    
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const existingByPhone = customers.find(c => c.contactNumber.replace(/\D/g, '') === cleanPhone);
    const finalId = customerData.id || existingByPhone?.id || `cust-${Date.now()}`;

    const newCustomer: Customer = {
      id: finalId,
      firstName: customerData.firstName.toUpperCase(),
      lastName: customerData.lastName.toUpperCase(),
      names: [`${customerData.firstName} ${customerData.lastName}`.toUpperCase()],
      addresses: [String(customerData.address).toUpperCase()],
      city: String(customerData.city).toUpperCase(),
      landmark: String(customerData.landmark).toUpperCase(),
      contactNumber: customerPhone,
      discountPerCylinder: parseFloat(customerData.discount) || 0,
      notes: String(customerData.notes).toUpperCase()
    };

    let nextCustomers: Customer[] = [];
    setCustomers(prev => {
      const existingIdx = prev.findIndex(c => String(c.id) === String(finalId));
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = newCustomer;
        nextCustomers = updated;
        return updated;
      }
      nextCustomers = [newCustomer, ...prev];
      return nextCustomers;
    });

    try {
      const syncSuccess = await onSync(undefined, undefined, nextCustomers);
      setIsSyncingProfile(false);
      if (syncSuccess) {
        setCustomerData(prev => ({ ...prev, id: finalId }));
        return { success: true, finalId };
      }
      return { success: false, finalId: '' };
    } catch (err) {
      setIsSyncingProfile(false);
      return { success: false, finalId: '' };
    }
  };

  const subtotal = useMemo(() => activeCart.reduce((s, i) => s + i.total, 0), [activeCart]);
  const profileUnitRate = useMemo(() => {
    const rate = parseFloat(customerData.discount);
    return isNaN(rate) ? 0 : rate;
  }, [customerData.discount]);

  const totalDiscount = useMemo(() => {
    return activeCart.reduce((total, item) => {
      if (item.isCylinder || item.productType === 'Refill') return total + (item.qty * profileUnitRate);
      return total;
    }, 0);
  }, [activeCart, profileUnitRate]);

  const finalTotal = useMemo(() => subtotal - totalDiscount, [subtotal, totalDiscount]);

  const isSubmitDisabled = useMemo(() => {
    const isCartEmpty = activeCart.length === 0;
    const hasPhysicalItems = activeCart.some(item => !item.linkedReceivableId);
    
    if (orderType === 'delivery') {
      const isCustomerMissing = !customerData.lastName.trim() || !customerPhone;
      const isRiderMissing = hasPhysicalItems && !selectedRider;
      return isCartEmpty || isCustomerMissing || isRiderMissing;
    }

    return isCartEmpty;
  }, [activeCart, orderType, selectedRider, customerData.lastName, customerPhone]);

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

  const finalizeOrder = async (status: OrderStatus = OrderStatus.ORDERED) => {
    if (isSubmitDisabled) return;
    const activeNodeId = String(user.selectedStoreId);
    const normalItems = activeCart.filter(i => !i.linkedReceivableId);
    const debtItems = activeCart.filter(i => i.linkedReceivableId);
    const ordersToUpsert: Order[] = [];
    const arUpdates: AccountsReceivable[] = [];
    const paymentInserts: ReceivablePayment[] = [];
    let receiptDisplayOrder: Order | null = null;
    let finalCustomerId = customerData.id || PICKUP_CUSTOMER.id;

    if (customerData.id && customerData.lastName !== 'CUSTOMER') {
        const profileResult = await handleUpdateProfile();
        if (profileResult.success) finalCustomerId = profileResult.finalId;
    }

    if (normalItems.length > 0) {
        const newOrderTotal = normalItems.reduce((s, i) => s + i.total, 0);
        const newOrderDiscount = normalItems.reduce((total, item) => {
             if (item.isCylinder || item.productType === 'Refill') return total + (item.qty * profileUnitRate);
             return total;
        }, 0);

        const newOrder: Order = {
            id: editingOrderId || `PHG-${Date.now()}`, 
            storeId: activeNodeId, 
            customerId: finalCustomerId,
            customerName: `${customerData.firstName} ${customerData.lastName}`,
            address: customerData.address,
            city: customerData.city,
            contact: customerPhone,
            landmark: customerData.landmark,
            items: normalItems, 
            totalAmount: newOrderTotal - newOrderDiscount, 
            totalDiscount: newOrderDiscount, 
            status: status,
            paymentMethod: paymentMethod,
            createdAt: getPHTimestamp(), 
            updatedAt: getPHTimestamp(), 
            createdBy: user.username, 
            modifiedBy: user.username, 
            remark: orderRemark || '', 
            returnedCylinder: normalItems.some(i => i.isExchange), 
            riderName: selectedRider?.name 
        };
        ordersToUpsert.push(newOrder);
        receiptDisplayOrder = newOrder;
        if (status === OrderStatus.RECEIVABLE) {
            arUpdates.push({
                id: `AR-${newOrder.id}`,
                customerId: finalCustomerId,
                orderId: newOrder.id,
                originalAmount: newOrder.totalAmount,
                outstandingAmount: newOrder.totalAmount,
                status: 'open',
                createdAt: newOrder.createdAt,
                remarks: orderRemark
            });
        }
    }

    if (debtItems.length > 0) {
        const processedOrderIds = new Set<string>();
        debtItems.forEach(item => {
            const ar = receivables.find(r => r.id === item.linkedReceivableId);
            if (!ar) return;
            arUpdates.push({ ...ar, status: 'paid', outstandingAmount: 0 });
            paymentInserts.push({
                id: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                receivableId: ar.id,
                amount: item.price,
                paymentMethod: paymentMethod,
                paidAt: getPHTimestamp()
            });
            if (!processedOrderIds.has(ar.orderId)) {
                const origOrder = orders.find(o => o.id === ar.orderId);
                if (origOrder) {
                    const updatedOrig = { 
                        ...origOrder, 
                        status: OrderStatus.ORDERED, 
                        paymentMethod: paymentMethod,
                        updatedAt: getPHTimestamp(),
                        modifiedBy: user.username,
                        remark: origOrder.remark ? `${origOrder.remark} | PAID ${new Date().toLocaleDateString()}` : `PAID ${new Date().toLocaleDateString()}`
                    };
                    ordersToUpsert.push(updatedOrig);
                    processedOrderIds.add(ar.orderId);
                    if (!receiptDisplayOrder) {
                        receiptDisplayOrder = {
                            ...updatedOrig,
                            id: `${updatedOrig.id}-V2`, 
                            items: debtItems, 
                            totalAmount: debtItems.reduce((s,i) => s + i.total, 0),
                            createdAt: getPHTimestamp(), 
                            createdBy: user.username 
                        };
                    } else {
                        receiptDisplayOrder = {
                            ...receiptDisplayOrder,
                            items: [...receiptDisplayOrder.items, ...debtItems],
                            totalAmount: receiptDisplayOrder.totalAmount + item.total
                        };
                    }
                }
            }
        });
    }

    const updatedStocksList = performInventoryAdjustment(normalItems, activeNodeId);
    setStocks(updatedStocksList);
    const nextOrders = [...orders];
    ordersToUpsert.forEach(u => {
        const idx = nextOrders.findIndex(o => o.id === u.id);
        if (idx > -1) nextOrders[idx] = u;
        else nextOrders.unshift(u);
    });

    const syncSuccess = await onSync(ordersToUpsert, updatedStocksList, undefined, arUpdates, paymentInserts);
    if (syncSuccess) {
        setOrders(nextOrders);
        if (receiptDisplayOrder) {
          setCompletedOrder(receiptDisplayOrder);
          setPrintCopyType('ALL');
          setIsReceiptPreviewOpen(true);
        }
        resetTerminal();
    }
  };

  const addToCart = (p: Product, isExchange = false) => {
    const stock = getStockForStore(p.id);
    if (stock <= 0 && !isExchange) return alert('Out of Stock at this terminal hub.');
    const existingIdx = activeCart.findIndex(item => String(item.productId) === String(p.id) && item.isExchange === isExchange);
    if (existingIdx > -1) {
      const newCart = [...activeCart];
      newCart[existingIdx].qty += 1;
      newCart[existingIdx].total = newCart[existingIdx].qty * newCart[existingIdx].price;
      setActiveCart(newCart);
    } else {
      setActiveCart([...activeCart, { 
        productId: p.id, productName: p.name, productType: p.type, size: p.size || 'N/A', qty: 1, price: p.price, discount: 0, total: p.price, 
        isCylinder: p.type.includes('Cylinder'), isExchange 
      }]);
    }
  };

  const addDebtToCart = (ar: AccountsReceivable) => {
    const existing = activeCart.find(i => i.linkedReceivableId === ar.id);
    if (existing) return alert("This debt is already in the payment queue.");
    const debtItem: OrderItem = {
      productId: 'DEBT-PAYMENT',
      productName: `PAYMENT: ${ar.orderId.slice(-8)}`,
      productType: 'Financial',
      size: 'N/A',
      qty: 1,
      price: ar.outstandingAmount,
      discount: 0,
      total: ar.outstandingAmount,
      isCylinder: false,
      isExchange: false,
      linkedReceivableId: ar.id
    };
    setActiveCart([...activeCart, debtItem]);
  };

  const handleModifyOrder = () => {
    const order = selectedHistoryOrder;
    if (!order || order.status === OrderStatus.CANCELLED) return;
    if (confirm(`MODIFY PROTOCOL: Reverse assets for ${order.id} and load into terminal?`)) {
        const nextStocks = performInventoryAdjustment(order.items, order.storeId, true);
        setStocks(nextStocks);
        setActiveCart(order.items);
        setPaymentMethod(order.paymentMethod);
        setOrderRemark(order.remark || '');
        setCustomerPhone(formatMobile(order.contact));
        setCustomerData({
            id: order.customerId,
            firstName: order.customerName.split(' ')[0] || '',
            lastName: order.customerName.split(' ').slice(1).join(' ') || '',
            address: order.address,
            city: order.city,
            landmark: order.landmark,
            discount: (order.totalDiscount / (order.items.filter(i => i.isCylinder || i.productType === 'Refill').reduce((s,i)=>s+i.qty,0) || 1)).toFixed(2),
            notes: ''
        });
        setEditingOrderId(order.id);
        setShowHistoryPanel(false);
    }
  };

  const handleReprint = () => {
    if (!selectedHistoryOrder) return;
    setCompletedOrder(selectedHistoryOrder);
    setPrintCopyType('ALL');
    setIsReceiptPreviewOpen(true);
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

  const handleVoidOrder = async () => {
    if (!isAdmin) return alert("UNAUTHORIZED: Only Administrators can void transactions.");
    
    const orderToVoid = selectedHistoryOrder;
    if (!orderToVoid || orderToVoid.status === OrderStatus.CANCELLED) return;
    
    if (window.confirm("VOID PROTOCOL: Permanently cancel this record and reverse inventory?")) {
        try {
            const nextStocks = performInventoryAdjustment(orderToVoid.items, orderToVoid.storeId, true);
            const affectedStockIds = new Set<string>();
            orderToVoid.items.forEach(item => {
               const s = stocks.find(st => st.productId === item.productId && st.storeId === orderToVoid.storeId);
               if (s) affectedStockIds.add(s.id);
            });
            
            const stocksToSync = nextStocks.filter(s => affectedStockIds.has(s.id));
            const cancelledOrder: Order = { 
                ...orderToVoid, 
                status: OrderStatus.CANCELLED, 
                updatedAt: getPHTimestamp(),
                modifiedBy: user.username,
                remark: orderToVoid.remark ? `${orderToVoid.remark} | VOIDED` : 'VOIDED'
            };
            
            const nextOrders = orders.map(o => o.id === orderToVoid.id ? cancelledOrder : o);
            setStocks(nextStocks);
            setOrders(nextOrders);
            setSelectedHistoryOrder(cancelledOrder);

            let arToSync: AccountsReceivable[] = [];
            const existingAR = receivables.find(r => r.orderId === orderToVoid.id);
            if (existingAR) {
                arToSync.push({ ...existingAR, status: 'paid', outstandingAmount: 0, remarks: 'ORDER_VOIDED' });
            }

            const syncSuccess = await onSync([cancelledOrder], stocksToSync, undefined, arToSync);
            if (!syncSuccess) {
                alert("VOID COMPLETED LOCALLY: Sync failed.");
            }
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            alert(`VOID OPERATION FAILED: ${errorMessage}`);
        }
    }
  };

  const productTypes = useMemo(() => {
    const types = Array.from(new Set(products.map(p => p.type)));
    const sorted = types.filter(t => t !== 'Refill').sort();
    const result = ['ALL'];
    if (types.includes('Refill')) result.push('Refill');
    return [...result, ...sorted];
  }, [products]);

  const filteredHistory = useMemo(() => {
    let base = orders.filter(o => String(o.storeId) === String(user.selectedStoreId) && toPHDateString(o.createdAt) === historyDate);
    if (historyStatusFilter !== 'ALL') base = base.filter(o => o.status === historyStatusFilter);
    if (historyTab === 'pickup') base = base.filter(o => o.customerId === PICKUP_CUSTOMER.id);
    else if (historyTab === 'delivery') base = base.filter(o => o.customerId !== PICKUP_CUSTOMER.id);
    return base.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, user.selectedStoreId, historyDate, historyTab, historyStatusFilter]);

  const filteredRiders = useMemo(() => {
    return employees.filter(e => {
      const isRider = e.type === EmployeeType.RIDER;
      const isAuthorized = e.assignedStoreIds && (e.assignedStoreIds.includes(String(user.selectedStoreId)) || e.assignedStoreIds.includes('all'));
      const matchesSearch = e.name.toLowerCase().includes(riderSearchQuery.toLowerCase());
      return isRider && isAuthorized && matchesSearch;
    });
  }, [employees, user.selectedStoreId, riderSearchQuery]);

  const hasDebtPayment = useMemo(() => activeCart.some(item => item.linkedReceivableId), [activeCart]);

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden relative text-slate-900 antialiased font-sans">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0mm; }
          body { 
            visibility: hidden !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important; 
          }
          .no-print { display: none !important; }
          #pos-receipt-print-root { 
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
          #pos-receipt-print-root { 
            visibility: visible !important; 
            box-sizing: border-box !important;
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
        }
      `}</style>

      {/* ROOT-LEVEL PRINTABLE AREA FOR CONTINUOUS ROLL */}
      <div id="pos-receipt-print-root" className="hidden">
        {completedOrder && (
          <div className="w-[80mm] bg-white">
             {(printCopyType === 'ALL' || printCopyType === 'CUSTOMER') && generateReceiptPart(completedOrder, 'CUSTOMER COPY')}
             {(printCopyType === 'ALL' || printCopyType === 'GATE') && generateReceiptPart(completedOrder, 'GATE PASS')}
             {(printCopyType === 'ALL' || printCopyType === 'STORE') && generateReceiptPart(completedOrder, 'STORE COPY')}
          </div>
        )}
      </div>

      {isNotesModalOpen && (
        <div className="fixed inset-0 z-[5001] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in zoom-in duration-300 no-print">
           <div className="bg-white w-full max-w-[480px] rounded-[56px] p-12 shadow-2xl text-center border-4 border-white text-gray-900">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6"><i className="fas fa-sticky-note"></i></div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter mb-4 text-slate-900">Customer Protocol Alert</h3>
              <div className="bg-slate-50 p-6 rounded-3xl mb-10">
                <p className="text-[14px] font-black italic text-slate-600 leading-relaxed uppercase">"{activeCustomerNotes}"</p>
              </div>
              <button onClick={() => setIsNotesModalOpen(false)} className="w-full py-5 bg-slate-950 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-lg active:scale-95 transition-all">Acknowledge Alert</button>
           </div>
        </div>
      )}

      {pendingRefillProduct && !showCylinderPicker && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 no-print">
           <div className="bg-white w-full max-w-[700px] rounded-[70px] p-16 shadow-2xl relative text-gray-900">
              <div className="flex flex-col items-center">
                <h3 className="text-[30px] font-black text-[#1e293b] uppercase italic tracking-tighter mb-4 text-center leading-tight">CYLINDER EXCHANGE?</h3>
                <p className="text-center mb-12 text-[#94a3b8] font-bold uppercase tracking-[0.2em] text-[10px]">REFILL SELECTION: {pendingRefillProduct.name.toUpperCase()}</p>
                <div className="w-full space-y-4">
                   <button onClick={() => { addToCart(pendingRefillProduct!, true); setPendingRefillProduct(null); }} className="w-full py-6 bg-[#10b981] hover:bg-[#059669] text-white rounded-full font-black uppercase text-[13px] shadow-xl hover:shadow-emerald-200 transition-all flex items-center justify-center gap-4 active:scale-95"><i className="fas fa-recycle text-xl"></i> YES, RETURNED EMPTY</button>
                   <button onClick={() => { addToCart(pendingRefillProduct!, false); setShowCylinderPicker(true); }} className="w-full py-6 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-full font-black uppercase text-[13px] shadow-xl hover:shadow-orange-200 transition-all flex items-center justify-center gap-4 active:scale-95"><i className="fas fa-plus-circle text-xl"></i> NO, BUY NEW EMPTY</button>
                </div>
                <button onClick={() => setPendingRefillProduct(null)} className="mt-10 text-[#94a3b8] hover:text-red-400 font-black uppercase text-[9px] tracking-[0.3em] transition-colors">CANCEL TRANSACTION</button>
              </div>
           </div>
        </div>
      )}

      {showCylinderPicker && (
        <div className="fixed inset-0 z-[1201] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in no-print">
          <div className="bg-white w-full max-w-[800px] rounded-[56px] p-12 shadow-2xl border-4 border-white h-[80vh] flex flex-col text-gray-900">
            <div className="flex justify-between items-center mb-10 shrink-0">
               <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Choose Cylinder Chassis</h3>
                  <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mt-1">Direct Sale Protocol</p>
               </div>
               <button onClick={() => { setShowCylinderPicker(false); setPendingRefillProduct(null); }} className="text-slate-400 hover:text-red-500"><i className="fas fa-times-circle text-3xl"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 md:grid-cols-3 gap-6 pr-2">
              {products.filter(p => p.type === 'Cylinders' && p.status === 'Active').map(p => {
                const stock = getStockForStore(p.id);
                return (
                  <button key={p.id} onClick={() => { addToCart(p, false); setShowCylinderPicker(false); setPendingRefillProduct(null); }} disabled={stock <= 0} className={`p-6 bg-white border rounded-[32px] text-left hover:border-sky-300 hover:shadow-xl transition-all flex flex-col group ${stock <= 0 ? 'opacity-30 grayscale cursor-not-allowed' : 'border-slate-100 shadow-sm'}`}><span className="text-[10px] font-black text-slate-800 uppercase italic leading-tight mb-2 group-hover:text-sky-600">{p.name}</span><span className="text-[14px] font-black text-slate-900 mt-auto">₱{formatCurrency(p.price)}</span><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{stock} Ready</p></button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isRemarkModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in no-print">
           <div className="bg-white w-full max-w-[440px] rounded-[48px] p-10 shadow-2xl text-gray-900">
              <h3 className="text-[14px] font-black uppercase italic tracking-[0.2em] mb-8 text-slate-900">Internal Order Remark</h3>
              <textarea autoFocus value={orderRemark} onChange={e => setOrderRemark(e.target.value)} placeholder="Operational notes for this session..." className="w-full h-[140px] p-6 bg-slate-50 border border-slate-100 rounded-[32px] text-[13px] font-black italic resize-none outline-none focus:border-sky-500 shadow-inner text-slate-900" />
              <button onClick={() => setIsRemarkModalOpen(false)} className="w-full mt-8 py-4 bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-sky-700 active:scale-95 transition-all">Set Remark</button>
           </div>
        </div>
      )}

      {isReceiptPreviewOpen && completedOrder && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 md:p-6 bg-slate-950/40 backdrop-blur-md no-print">
           <div className="bg-white w-full max-w-[440px] rounded-[48px] p-10 shadow-2xl animate-in zoom-in duration-300 relative flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">Receipt Preview</h3>
                 <button onClick={() => { setIsReceiptPreviewOpen(false); setCompletedOrder(null); }} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"><i className="fas fa-times"></i></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 bg-white border border-slate-200 shadow-inner rounded-xl p-6">
                 <div className="receipt-container font-mono text-black text-center text-[10px] w-full pt-2">
                    {generateReceiptPart(completedOrder, printCopyType === 'ALL' ? 'CUSTOMER COPY' : `${printCopyType} COPY`)}
                 </div>
              </div>
              <div className="p-4 border-t bg-white flex flex-col gap-3 shrink-0">
                 <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => handlePrintRequest('CUSTOMER')} className={`py-2.5 rounded-xl font-black uppercase text-[8px] transition-all ${printCopyType === 'CUSTOMER' ? 'bg-sky-50 text-sky-600 border-2 border-sky-400' : 'bg-white border-2 border-slate-200 text-slate-900 hover:bg-slate-50'}`}>Cust</button>
                    <button onClick={() => handlePrintRequest('GATE')} className={`py-2.5 rounded-xl font-black uppercase text-[8px] transition-all ${printCopyType === 'GATE' ? 'bg-sky-50 text-sky-600 border-2 border-sky-400' : 'bg-white border-2 border-slate-200 text-slate-900 hover:bg-slate-50'}`}>Gate</button>
                    <button onClick={() => handlePrintRequest('STORE')} className={`py-2.5 rounded-xl font-black uppercase text-[8px] transition-all ${printCopyType === 'STORE' ? 'bg-sky-50 text-sky-600 border-2 border-sky-400' : 'bg-white border-2 border-slate-200 text-slate-900 hover:bg-slate-50'}`}>Store</button>
                    <button onClick={() => handlePrintRequest('ALL')} className={`py-2.5 rounded-xl font-black uppercase text-[8px] shadow-xl transition-all ${printCopyType === 'ALL' ? 'bg-slate-950 text-white' : 'bg-slate-800 text-slate-200'}`}>ALL</button>
                 </div>
                 <button onClick={() => handlePrintRequest(printCopyType)} className="w-full py-4 bg-sky-600 text-white rounded-xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"><i className="fas fa-print"></i> Authorize Print</button>
                 <button onClick={() => { setIsReceiptPreviewOpen(false); setCompletedOrder(null); }} className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] active:scale-95 transition-all">Dismiss View</button>
              </div>
           </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden no-print">
        <aside className="w-full lg:w-[320px] bg-white border-r border-slate-200 flex flex-col shadow-2xl shrink-0">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/10">
            <span className="text-lg font-black italic uppercase tracking-tighter text-slate-800">Terminal Cart</span>
            <button onClick={resetTerminal} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-trash-alt text-xs"></i></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/20 custom-scrollbar">
            {activeCart.length === 0 && !orderRemark ? (
              <div className="flex flex-col items-center justify-center h-full opacity-20 text-slate-400">
                 <i className="fas fa-shopping-basket text-5xl mb-4"></i>
                 <p className="text-[10px] font-black uppercase tracking-widest italic">Node Standby</p>
              </div>
            ) : (
              <>
                {activeCart.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-[24px] bg-white border border-slate-100 shadow-sm flex flex-col hover:border-sky-200 transition-all text-gray-900">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black uppercase italic leading-tight flex-1 text-slate-800">{item.productName}</p>
                      {isAdmin ? (
                        <input 
                          type="number"
                          value={item.price}
                          step="any"
                          onChange={(e) => {
                            const newPrice = parseFloat(e.target.value);
                            const next = [...activeCart];
                            next[idx].price = isNaN(newPrice) ? 0 : newPrice;
                            next[idx].total = next[idx].qty * next[idx].price;
                            setActiveCart(next);
                          }}
                          className="w-20 bg-slate-50 border border-slate-200 rounded px-1 text-[10px] font-black text-right text-sky-600 outline-none"
                        />
                      ) : (
                        <span className="text-[10px] font-black text-sky-600">₱{formatCurrency(item.total)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">x{item.qty} @ ₱{formatCurrency(item.price)}</span>
                        {item.isExchange && <span className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter">Asset Exchange Active</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => {
                          const next = [...activeCart];
                          if (next[idx].qty > 1) { next[idx].qty--; next[idx].total = next[idx].qty * next[idx].price; setActiveCart(next); }
                          else setActiveCart(next.filter((_,i)=>i!==idx));
                        }} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-all"><i className="fas fa-minus text-[10px]"></i></button>
                        <button onClick={() => {
                          const next = [...activeCart];
                          next[idx].qty++; next[idx].total = next[idx].qty * next[idx].price; setActiveCart(next);
                        }} className="w-8 h-8 rounded-lg bg-sky-500 text-white hover:bg-sky-600 flex items-center justify-center transition-all shadow-sm shadow-sky-100 ml-1"><i className="fas fa-plus text-[10px]"></i></button>
                      </div>
                    </div>
                  </div>
                ))}
                {orderRemark && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-2xl border-2 border-amber-100 border-dashed relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                    <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1 leading-none">Remark Flag</p>
                    <p className="text-[10px] font-bold text-amber-800 italic uppercase leading-tight">{orderRemark}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-6 border-t bg-white space-y-4">
            {orderType === 'delivery' && (
              <div className="mb-4 relative" ref={riderDropdownRef}>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Logistics Dispatch</label>
                <div className="relative">
                  <i className="fas fa-motorcycle absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                  <input type="text" value={selectedRider ? selectedRider.name : riderSearchQuery} onChange={(e) => { setRiderSearchQuery(e.target.value); if (selectedRider) setSelectedRider(null); setIsRiderDropdownOpen(true); }} onFocus={() => setIsRiderDropdownOpen(true)} placeholder="Authorized Rider..." className={`w-full pl-11 pr-10 py-3 bg-[#f8fafc] border-none rounded-2xl text-[11px] font-black italic uppercase outline-none transition-all shadow-sm ${!selectedRider ? 'ring-2 ring-amber-400/20' : ''} text-slate-900`} />
                  {(riderSearchQuery || selectedRider) && (
                    <button 
                      onClick={() => { setRiderSearchQuery(''); setSelectedRider(null); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400"
                    >
                      <i className="fas fa-times-circle"></i>
                    </button>
                  )}
                </div>
                {isRiderDropdownOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[500] max-h-48 overflow-y-auto custom-scrollbar">
                     {filteredRiders.length > 0 ? filteredRiders.map((r) => (<button key={r.id} onClick={() => { setSelectedRider(r); setRiderSearchQuery(r.name); setIsRiderDropdownOpen(false); }} className="w-full px-5 py-3 text-left hover:bg-sky-50 border-b border-slate-50 flex flex-col group text-slate-900"><span className="text-[11px] font-black uppercase italic group-hover:text-sky-600">{r.name}</span><span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{r.employeeNumber}</span></button>)) : (<div className="px-5 py-4 text-center text-[9px] font-black text-slate-300 uppercase italic">No Riders found</div>)}
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Payment Protocol</label>
              <div className="relative">
                <select 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black uppercase outline-none focus:border-sky-500 transition-all shadow-sm appearance-none cursor-pointer text-slate-800"
                >
                  <option value="CASH">CASH</option>
                  <option value="GCASH">GCASH</option>
                  <option value="MAYA">MAYA</option>
                  <option value="BANK">BANK</option>
                  <option value="OTHER">OTHER</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <i className="fas fa-chevron-down text-[10px]"></i>
                </div>
              </div>
            </div>

            <div className="space-y-2 px-1">
              <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest"><span>Applied Discount</span><span className="text-emerald-500 font-bold">- ₱{formatCurrency(totalDiscount)}</span></div>
              <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>Net Settlement</span><span className="text-xl text-slate-900 italic font-black">₱{formatCurrency(finalTotal)}</span></div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               <button 
                disabled={isSubmitDisabled || hasDebtPayment} 
                onClick={() => finalizeOrder(OrderStatus.RECEIVABLE)} 
                className="py-4 bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-lg active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center"
              >
                Mark Receivable
              </button>
              <button 
                disabled={isSubmitDisabled} 
                onClick={() => finalizeOrder(OrderStatus.ORDERED)} 
                className="py-4 bg-sky-600 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] shadow-lg active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                AUTHORIZE <i className="fas fa-arrow-right text-[8px]"></i>
              </button>
            </div>
            <button onClick={() => setIsRemarkModalOpen(true)} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest text-[8px] hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
              <i className="fas fa-edit"></i> Order Remark
            </button>
          </div>
        </aside>

        <section className="flex-1 flex flex-col bg-[#f8fafc] overflow-hidden">
          <div className="p-6 bg-white border-b border-slate-200 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 group w-full text-gray-900">
                 <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                 <input 
                   type="text" 
                   value={searchQuery} 
                   onChange={e => setSearchQuery(e.target.value)} 
                   placeholder="Search Hub SKUs..." 
                   className="w-full pl-14 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-[24px] text-sm font-bold shadow-inner outline-none focus:bg-white focus:border-sky-400 transition-all text-slate-900" 
                 />
                 {searchQuery && (
                   <button 
                     onClick={() => setSearchQuery('')}
                     className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400"
                   >
                     <i className="fas fa-times-circle"></i>
                   </button>
                 )}
              </div>
              <div className="flex bg-slate-100 p-1 rounded-[24px] border border-slate-200 shadow-inner">
                <button onClick={() => handleOrderTypeSwitch('pickup')} className={`px-8 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'pickup' ? 'bg-white text-sky-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Pickup</button>
                <button onClick={() => handleOrderTypeSwitch('delivery')} className={`px-8 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${orderType === 'delivery' ? 'bg-white text-sky-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Delivery</button>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {productTypes.map(type => (
                <button key={type} onClick={() => setActiveTypeTab(type)} className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border-2 ${activeTypeTab === type ? 'bg-sky-600 border-sky-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>{type}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 custom-scrollbar content-start">
            {products.filter(p => p.status === 'Active' && (activeTypeTab === 'ALL' || p.type === activeTypeTab) && p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => {
               const stock = getStockForStore(p.id);
               return (
                 <button key={p.id} onClick={() => p.type === 'Refill' ? setPendingRefillProduct(p) : addToCart(p)} disabled={stock <= 0} className={`p-6 bg-white border rounded-[32px] text-left hover:border-sky-300 hover:shadow-xl transition-all flex flex-col group ${stock <= 0 ? 'opacity-40 grayscale border-transparent shadow-none' : 'border-slate-100 shadow-sm'}`}>
                    <h4 className="font-black text-slate-800 uppercase italic text-[11px] leading-tight group-hover:text-sky-600 transition-colors mb-2">{p.name}</h4>
                    <div className="mt-auto text-slate-900">
                       <p className="text-base font-black">₱{formatCurrency(p.price)}</p>
                       <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${stock <= LOW_STOCK_THRESHOLD ? 'text-amber-500' : 'text-slate-400'}`}>{stock} Units Ready</p>
                    </div>
                 </button>
               );
            })}
          </div>
        </section>

        <aside className="w-[380px] bg-white border-l border-slate-200 flex flex-col shadow-2xl shrink-0 text-gray-900" ref={suggestionContainerRef}>
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
            <div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CRM Database</h3><span className="text-2xl font-black italic text-slate-800 uppercase tracking-tighter">Registry</span></div>
            <button disabled={isSyncingProfile} onClick={() => handleUpdateProfile()} className="px-6 py-2.5 bg-[#f1f5f9] text-[#2d89c8] rounded-2xl flex items-center gap-3 hover:bg-sky-100 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 disabled:opacity-50">
              {isSyncingProfile ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-save"></i>} SYNC
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
             <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-3 relative">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Access</label>
                   <input value={customerPhone} onChange={handlePhoneChange} placeholder="09XX-XXX-XXXX" className="w-full px-8 py-6 bg-[#f8fafc] border-none rounded-[32px] text-[16px] font-black italic outline-none focus:ring-4 focus:ring-sky-50 transition-all text-slate-900 disabled:opacity-40 placeholder:text-slate-300 shadow-sm" />
                   {activeSuggestionField === 'phone' && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-[32px] shadow-2xl z-[500] overflow-hidden max-h-72 animate-in slide-in-from-top-4 duration-300">
                         {suggestions.map((s, i) => (
                            <button key={i} onClick={() => selectCustomer(s)} className="w-full px-8 py-5 text-left hover:bg-sky-50 border-b border-slate-50 flex flex-col group transition-colors">
                                <div className="flex justify-between items-center w-full">
                                    <span className="text-[14px] font-black uppercase italic group-hover:text-sky-600">{(s.firstName || s.lastName) ? `${s.firstName} ${s.lastName}` : (s.names?.[0] || 'Unknown')}</span>
                                    <span className="text-[12px] font-bold text-sky-500 tracking-widest font-mono">{s.contactNumber}</span>
                                </div>
                            </button>
                         ))}
                      </div>
                   )}
                </div>
                <div className="grid grid-cols-2 gap-5">
                   <div className="flex flex-col gap-3 relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                      <input value={customerData.firstName} onChange={e => handleFieldChange('firstName', e.target.value)} className="w-full px-6 py-5 bg-[#f8fafc] border-none rounded-[28px] text-[14px] font-black italic outline-none focus:ring-4 focus:ring-sky-50 transition-all text-slate-900 disabled:opacity-40 uppercase shadow-sm" />
                      {activeSuggestionField === 'firstName' && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-[32px] shadow-2xl z-[500] overflow-hidden max-h-72 animate-in slide-in-from-top-4 duration-300">
                           {suggestions.map((s, i) => (
                              <button key={i} onClick={() => selectCustomer(s)} className="w-full px-6 py-4 text-left hover:bg-sky-50 border-b border-slate-50 flex flex-col group transition-colors">
                                  <span className="text-[12px] font-black uppercase italic group-hover:text-sky-600">{s.firstName} {s.lastName}</span>
                                  <span className="text-[9px] font-bold text-slate-400">{s.contactNumber}</span>
                              </button>
                           ))}
                        </div>
                      )}
                   </div>
                   <div className="flex flex-col gap-3 relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                      <input value={customerData.lastName} onChange={e => handleFieldChange('lastName', e.target.value)} className="w-full px-6 py-5 bg-[#f8fafc] border-none rounded-[28px] text-[14px] font-black italic outline-none focus:ring-4 focus:ring-sky-50 transition-all text-slate-900 disabled:opacity-40 uppercase shadow-sm" />
                      {activeSuggestionField === 'lastName' && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-[32px] shadow-2xl z-[500] overflow-hidden max-h-72 animate-in slide-in-from-top-4 duration-300">
                           {suggestions.map((s, i) => (
                              <button key={i} onClick={() => selectCustomer(s)} className="w-full px-6 py-4 text-left hover:bg-sky-50 border-b border-slate-50 flex flex-col group transition-colors">
                                  <span className="text-[12px] font-black uppercase italic group-hover:text-sky-600">{s.firstName} {s.lastName}</span>
                                  <span className="text-[9px] font-bold text-slate-400">{s.contactNumber}</span>
                              </button>
                           ))}
                        </div>
                      )}
                   </div>
                </div>
                <div className="flex flex-col gap-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Disc. Rate (Protocol)</label><input type="number" value={customerData.discount === 'null' ? '' : customerData.discount} onChange={e => handleFieldChange('discount', e.target.value)} className="w-full px-8 py-6 bg-[#f8fafc] border-none rounded-[32px] text-[16px] font-black italic outline-none focus:ring-4 focus:ring-sky-50 transition-all text-slate-900 shadow-sm" placeholder="0.00" /></div>
                <div className="flex flex-col gap-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label><input value={customerData.address} onChange={e => handleFieldChange('address', e.target.value)} className="w-full px-8 py-5 bg-[#f8fafc] border-none rounded-[28px] text-[13px] font-black italic outline-none text-slate-900 uppercase shadow-sm" /></div>
                <div className="grid grid-cols-2 gap-5"><div className="flex flex-col gap-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label><input value={customerData.city} onChange={e => handleFieldChange('city', e.target.value)} className="w-full px-6 py-5 bg-[#f8fafc] border-none rounded-[28px] text-[13px] font-black italic outline-none text-slate-900 uppercase shadow-sm" /></div><div className="flex flex-col gap-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Landmark</label><input value={customerData.landmark} onChange={e => handleFieldChange('landmark', e.target.value)} className="w-full px-6 py-5 bg-[#f8fafc] border-none rounded-[28px] text-[13px] font-black italic outline-none text-slate-900 uppercase shadow-sm" /></div></div>
                <div className="flex flex-col gap-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Notes</label><textarea rows={4} value={customerData.notes} onChange={e => handleFieldChange('notes', e.target.value)} className="w-full px-8 py-6 bg-[#f8fafc] border-none rounded-[40px] text-[13px] font-black italic outline-none text-slate-900 uppercase resize-none shadow-inner" placeholder="SAVED NOTES FOR PROTOCOL ALERTS..." /></div>
                {customerReceivables.length > 0 && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-black text-red-400 uppercase tracking-widest ml-1 flex items-center gap-2"><i className="fas fa-exclamation-circle"></i> Outstanding Balance</label>
                    <div className="space-y-3">
                      {customerReceivables.map(ar => (
                        <div key={ar.id} className="p-5 bg-red-50 border border-red-100 rounded-[28px] relative overflow-hidden">
                           <div className="flex justify-between items-start mb-2"><div><p className="text-[9px] font-bold text-red-400 uppercase tracking-widest">Ref: {ar.orderId.slice(-8)}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{toPHDateString(ar.createdAt)}</p></div><span className="text-[14px] font-black text-red-600 italic">₱{formatCurrency(ar.outstandingAmount)}</span></div>
                           {ar.remarks && <p className="text-[9px] font-black text-slate-500 uppercase italic mb-3">"{ar.remarks}"</p>}
                           <button onClick={() => addDebtToCart(ar)} className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><i className="fas fa-wallet"></i> Pay Now</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </aside>
      </div>

      {showHistoryPanel && (
        <div className={`fixed inset-0 z-[4000] flex justify-end animate-in fade-in duration-300 text-gray-900 no-print`}>
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => { setShowHistoryPanel(false); setSelectedHistoryOrder(null); }}></div>
          <div className="w-full max-w-[1000px] bg-[#f8fafc] h-full shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-right duration-500 overflow-hidden rounded-l-[48px] border-l border-slate-200">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <div><h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-black">History Registry</h3><div className="flex gap-4 mt-3">{['store', 'pickup', 'delivery', 'customer'].map((tab) => (<button key={tab} onClick={() => { setHistoryTab(tab as any); setSelectedHistoryOrder(null); }} className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${historyTab === tab ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{tab}</button>))}</div></div>
                <button onClick={() => { setShowHistoryPanel(false); setSelectedHistoryOrder(null); }} className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-300 hover:text-red-500 transition-all flex items-center justify-center border border-slate-100"><i className="fas fa-times text-xl"></i></button>
             </div>
             <div className="flex-1 flex overflow-hidden">
                <div className={`flex-[1.2] flex flex-col border-r border-slate-200 bg-white overflow-hidden ${selectedHistoryOrder ? 'hidden md:flex' : 'flex'}`}>
                   <div className="px-6 py-5 bg-white border-b border-slate-100 sticky top-0 z-20 space-y-3"><CustomDatePicker value={historyDate} onChange={setHistoryDate} className="w-full" /><select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-sky-500 transition-all cursor-pointer text-slate-600"><option value="ALL">All Status</option><option value={OrderStatus.ORDERED}>Ordered</option><option value={OrderStatus.RECEIVABLE}>Receivable</option><option value={OrderStatus.CANCELLED}>Cancelled</option></select></div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#fcfdfe]">{filteredHistory.map(o => (<button key={o.id} onClick={() => { setSelectedHistoryOrder(o); setShowHistoryReceipt(false); }} className={`w-full flex flex-col p-4 rounded-[20px] transition-all text-left border-2 ${selectedHistoryOrder?.id === o.id ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-transparent hover:bg-slate-50'}`}><div className="flex justify-between items-start mb-2"><span className="text-[9px] font-black text-slate-800 uppercase italic">ID: {o.id.slice(-8)}</span><span className="text-[9px] font-bold text-slate-400 italic">{new Date(o.createdAt).toLocaleDateString()}</span></div><p className="text-[10px] font-black uppercase italic truncate">{o.customerName}</p><div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50"><span className="text-[11px] font-black italic">₱{formatCurrency(o.totalAmount)}</span><span className="text-[9px] font-bold text-sky-600 uppercase italic">BY: {o.createdBy}</span><span className={`text-[8px] font-black uppercase tracking-widest ${o.status === OrderStatus.CANCELLED ? 'text-red-500' : o.status === OrderStatus.RECEIVABLE ? 'text-orange-500' : 'text-emerald-500'}`}>{o.status}</span></div></button>))}</div>
                </div>
                <div className={`flex-[1.8] bg-[#f8fafc] flex flex-col overflow-hidden ${!selectedHistoryOrder ? 'hidden md:flex' : 'flex'}`}>
                   {selectedHistoryOrder ? (
                     <>
                        <div className="p-8 border-b bg-white flex justify-between items-center shrink-0"><div className="flex items-center gap-4"><h4 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900">{showHistoryReceipt ? 'Receipt Mirror' : 'Order Detail'}</h4><button onClick={() => setShowHistoryReceipt(!showHistoryReceipt)} className="px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-[9px] font-black uppercase hover:bg-sky-100 transition-all">{showHistoryReceipt ? 'View Data' : 'View Receipt'}</button></div></div>
                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                           {showHistoryReceipt ? (
                              <div className="bg-white p-8 shadow-sm border border-slate-200 mx-auto w-full max-w-[320px] thermal-preview text-black">
                                <div className="w-full bg-white">
                                  {generateReceiptPart(selectedHistoryOrder, 'CUSTOMER COPY')}
                                </div>
                              </div>
                           ) : (
                              <div className="space-y-8"><div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4"><div className="flex justify-between items-start"><div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer Profile</label><p className="text-[14px] font-black text-slate-800 uppercase italic">{selectedHistoryOrder.customerName}</p></div><div className="text-right">{selectedHistoryOrder.riderName && (<div className="mb-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logistics</label><p className="text-[12px] font-black text-sky-600 uppercase italic">{selectedHistoryOrder.riderName}</p></div>)}<div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator (User ID)</label><p className="text-[12px] font-black text-slate-700 uppercase italic">{selectedHistoryOrder.createdBy}</p></div></div></div><div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Address</label><p className="text-[11px] font-bold text-slate-600 uppercase italic">{selectedHistoryOrder.address}</p></div><div className="flex justify-between"><div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Settlement Method</label><p className="text-[11px] font-black text-emerald-600 uppercase italic">{selectedHistoryOrder.paymentMethod}</p></div></div>{selectedHistoryOrder.remark && (<div className="pt-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session Remarks</label><p className="text-[11px] font-black text-amber-600 uppercase italic bg-amber-50 p-2 rounded-lg border border-amber-100">{selectedHistoryOrder.remark}</p></div>)}</div><div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden"><table className="w-full text-left font-bold text-gray-900"><thead className="bg-slate-50/50 border-b border-slate-100"><tr className="text-[9px] font-black text-slate-400 uppercase"><th className="px-8 py-4">Asset Detail</th><th className="px-8 py-4 text-right">Value</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedHistoryOrder.items.map((item, idx) => (<tr key={idx}><td className="px-8 py-4"><span className="text-[12px] font-black uppercase italic text-slate-800">{item.productName} (x{item.qty})</span></td><td className="px-8 py-4 text-right text-[12px] font-black italic text-slate-900">₱{formatCurrency(item.total).replace('₱','')}</td></tr>))}</tbody></table></div><div className="space-y-2">{selectedHistoryOrder.totalDiscount > 0 && (<div className="flex justify-between items-center px-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest"><span>Applied Discount</span><span className="text-emerald-500">- ₱{formatCurrency(selectedHistoryOrder.totalDiscount)}</span></div>)}<div className="p-6 bg-slate-950 rounded-[32px] flex justify-between items-center text-white shadow-2xl"><span className="text-[11px] font-black uppercase tracking-widest italic">Settlement Total</span><span className="text-3xl font-black italic">₱{formatCurrency(selectedHistoryOrder.totalAmount)}</span></div></div></div>
                           )}
                        </div>
                        <div className="p-8 border-t bg-white grid grid-cols-3 gap-3 shrink-0 relative">
                           <button onClick={handleModifyOrder} disabled={selectedHistoryOrder.status === OrderStatus.CANCELLED} className="py-5 bg-[#2d5da7] text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all disabled:opacity-30">Modify Order</button>
                           <button onClick={handleReprint} className="py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><i className="fas fa-print"></i> Reprint</button>
                           {isAdmin && (
                              <button onClick={handleVoidOrder} disabled={selectedHistoryOrder.status === OrderStatus.CANCELLED} className="py-5 bg-white border-2 border-red-100 text-red-500 rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all hover:bg-red-50 disabled:opacity-30 disabled:border-slate-100 disabled:text-slate-300">Void Order</button>
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
      )}
    </div>
  );
};

export default POS;
