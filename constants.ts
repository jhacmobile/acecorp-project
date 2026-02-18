import { Customer, AccessRights } from './types';

// Default walk-in customer for pickup orders
export const PICKUP_CUSTOMER: Customer = {
  id: 'pickup-customer',
  firstName: 'PICKUP',
  lastName: 'CUSTOMER',
  names: ['PICKUP CUSTOMER'],
  addresses: ['WALK-IN TERMINAL'],
  city: 'VARIOUS',
  landmark: 'STATION',
  contactNumber: 'N/A',
  discountPerCylinder: 0,
  notes: ''
};

// Initial access rights for new cashier accounts
export const DEFAULT_USER_ACCESS: AccessRights = {
  dashboard: true,
  pos: true,
  sales: false,
  inventory: false,
  hrManagement: false,
  adminPage: false,
  storeManagement: false,
  bandiPage: false
};