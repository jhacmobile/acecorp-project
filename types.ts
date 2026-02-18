// Exported enums and interfaces for the AceCorp Enterprise Core application

export enum UserRole {
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER'
}

export type PaymentMethod = 'CASH' | 'GCASH' | 'MAYA' | 'BANK' | 'OTHER';

export interface AccessRights {
  dashboard: boolean;
  pos: boolean;
  sales: boolean;
  inventory: boolean;
  hrManagement: boolean;
  adminPage: boolean;
  storeManagement: boolean;
  bandiPage: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string | 'global'; 
  content: string;
  createdAt: string;
  isRead?: boolean;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  assignedStoreIds: string[];
  selectedStoreId: string;
  accessRights: AccessRights;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  mobile?: string;
}

export interface AppSettings {
  logoUrl: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  names: string[]; // For legacy compatibility
  addresses: string[];
  city: string;
  landmark: string;
  contactNumber: string;
  discountPerCylinder: number | null;
  notes: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  type: string;
  price: number;
  status: 'Active' | 'Inactive';
  size?: string;
}

export interface Stock {
  id: string;
  productId: string;
  storeId: string;
  quantity: number;
  initialStock: number;
  status: 'Active' | 'Inactive';
}

export enum OrderStatus {
  ORDERED = 'ORDERED',
  DRAFT = 'DRAFT',
  CANCELLED = 'CANCELLED',
  RECEIVABLE = 'RECEIVABLE'
}

export interface OrderItem {
  productId: string;
  productName: string;
  productType?: string;
  size: string;
  qty: number;
  price: number;
  discount: number;
  total: number;
  isCylinder?: boolean;
  isExchange?: boolean;
  linkedReceivableId?: string; // Links this item to a specific debt payment
}

export interface Order {
  id: string;
  storeId: string;
  customerId: string;
  customerName: string;
  address: string;
  city: string;
  contact: string;
  landmark: string;
  items: OrderItem[];
  totalAmount: number;
  totalDiscount: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  modifiedBy: string;
  remark?: string;
  returnedCylinder?: boolean;
  riderId?: string;
  riderName?: string;
  receiptHtml?: string;
}

export interface AccountsReceivable {
  id: string;
  customerId: string;
  orderId: string;
  originalAmount: number;
  outstandingAmount: number;
  status: 'open' | 'paid';
  createdAt: string;
  remarks?: string;
}

export interface ReceivablePayment {
  id: string;
  receivableId: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
}

export enum EmployeeType {
  STAFF = 'STAFF',
  RIDER = 'RIDER'
}

export type LoanFrequency = 'WEEKLY' | 'BI_MONTHLY' | 'MONTHLY';

export interface Employee {
  id: string;
  assignedStoreIds: string[]; 
  employeeNumber: string;
  name: string;
  type: EmployeeType;
  salary: number; 
  shiftStart: string; // HH:mm
  shiftEnd: string;   // HH:mm
  pin?: string;       // 4-digit PIN for Bandi Terminal
  loanBalance: number;
  loanWeeklyDeduction: number;
  loanFrequency?: LoanFrequency;
  loanTermMonths?: number;
  sssLoanBalance: number;
  sssLoanWeeklyDeduction: number;
  sssLoanFrequency?: LoanFrequency;
  sssLoanTermMonths?: number;
  valeBalance: number;
  loanTerms: string; 
  loans: { salary: number; sss: number; vale: number }; 
  loanBalances: { salary: number; sss: number; vale: number }; 
}

export type AttendanceStatus = 'REGULAR' | 'OB' | 'PTO' | 'ABSENT';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  timeIn: string;
  timeOut: string;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  isHalfDay: boolean;
  status: AttendanceStatus;
}

export interface PayrollHistoryRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedBy: string;
  totalDisbursement: number;
  payrollData: {
    employeeId: string;
    name: string;
    days: number;
    hours: number;
    rate: number;
    gross: number;
    ot: number;
    incentive?: number; 
    vale: number;
    late: number;      
    undertime: number; 
    loan: number;
    sss: number;
    net: number;
  }[];
}

export interface PayrollDraft {
  id: string;
  storeId: string;
  periodStart: string;
  periodEnd: string;
  adjustments: Record<string, { 
    loanPayment: string | null; 
    sssPayment: string | null;
    overtime: any; // Can be string or Record<string, string>
    incentive: string;
  }>;
  updatedAt: string;
}

export interface Expense {
  id: string;
  storeId: string;
  payee: string;
  particulars: string;
  amount: number;
  date: string;
}

export enum TransferStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface TransferItem {
  productId: string;
  qty: number;
  productName?: string;
}

export interface StockTransfer {
  id: string;
  fromStoreId: string;
  toStoreId: string;
  items: TransferItem[];
  returnedItems: TransferItem[];
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
  initiatedBy?: string;
  acceptedBy?: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface ProductCategory {
  id: string;
  name: string;
}