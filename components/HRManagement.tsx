import React, { useState, useMemo, useEffect } from 'react';
import { Employee, EmployeeType, AttendanceRecord, User, Store, UserRole, PayrollHistoryRecord, AttendanceStatus, LoanFrequency, PayrollDraft } from '../types';
import CustomDatePicker from './CustomDatePicker';

interface HRProps {
  activeTab: string; // hr-personnel, hr-attendance, hr-payroll, hr-history
  user: User;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  payrollHistory: PayrollHistoryRecord[];
  setPayrollHistory: React.Dispatch<React.SetStateAction<PayrollHistoryRecord[]>>;
  payrollDrafts: PayrollDraft[];
  setPayrollDrafts: React.Dispatch<React.SetStateAction<PayrollDraft[]>>;
  stores: Store[];
  onSync: (immediateEmployees?: Employee[], immediateAttendance?: AttendanceRecord[], immediatePayrollHistory?: PayrollHistoryRecord[], immediatePayrollDraft?: PayrollDraft) => Promise<boolean>;
}

const HRManagement: React.FC<HRProps> = ({ activeTab, user, employees, setEmployees, attendance, setAttendance, payrollHistory, setPayrollHistory, payrollDrafts, setPayrollDrafts, stores, onSync }) => {
  const view = activeTab.split('-')[1] || 'personnel';
  const isAdmin = user.role === UserRole.ADMIN;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [isVaultEditMode, setIsVaultEditMode] = useState(false);

  const getPHDateISO = (date: Date = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
  };

  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  const [financeEmpId, setFinanceEmpId] = useState<string | null>(null);
  const [financeType, setFinanceType] = useState<'LOAN' | 'VALE' | 'SSS'>('LOAN');
  const [financeAmount, setFinanceAmount] = useState<number>(0);

  const [formData, setFormData] = useState<{
    name: string;
    type: EmployeeType;
    salary: number;
    assignedStoreIds: string[];
    shiftStart: string;
    shiftEnd: string;
    pin: string;
    loanBalance: number;
    loanWeeklyDeduction: number;
    sssLoanBalance: number;
    sssLoanWeeklyDeduction: number;
  }>({ 
    name: '', type: EmployeeType.STAFF, salary: 0, assignedStoreIds: [], 
    shiftStart: '08:00', shiftEnd: '17:00', pin: '',
    loanBalance: 0, loanWeeklyDeduction: 0,
    sssLoanBalance: 0, sssLoanWeeklyDeduction: 0
  });

  const [overrideDate, setOverrideDate] = useState(getPHDateISO());
  const [overrideEmployeeId, setOverrideEmployeeId] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<AttendanceStatus>('REGULAR');
  const [overrideTimeIn, setOverrideTimeIn] = useState('');
  const [overrideTimeOut, setOverrideTimeOut] = useState('');
  const [auditPersonnelFilter, setAuditPersonnelFilter] = useState('ALL');
  const [auditSortOrder, setAuditSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [auditStart, setAuditStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getPHDateISO(d);
  });
  const [auditEnd, setAuditEnd] = useState(getPHDateISO());

  useEffect(() => {
    if (overrideStatus === 'ABSENT') {
      setOverrideTimeIn('');
      setOverrideTimeOut('');
    }
  }, [overrideStatus]);

  const getWeekBounds = () => {
    const d = new Date();
    const phDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short' }).format(d);
    const dayIndices: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDayIdx = dayIndices[phDay] ?? d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - currentDayIdx);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: getPHDateISO(start), end: getPHDateISO(end) };
  };

  const [payrollStart, setPayrollStart] = useState(() => getWeekBounds().start);
  const [payrollEnd, setPayrollEnd] = useState(() => getWeekBounds().end);
  
  const [payrollManualAdjustments, setPayrollManualAdjustments] = useState<Record<string, { 
    loanPayment: string | null; 
    sssPayment: string | null;
    overtime: Record<string, string>; 
    incentive: string;
  }>>({});

  useEffect(() => {
    if (view === 'payroll') {
      const draft = payrollDrafts.find(d => 
        String(d.storeId) === String(user.selectedStoreId) && 
        d.periodStart === payrollStart && 
        d.periodEnd === payrollEnd
      );
      if (draft && draft.adjustments) {
        const sanitizedAdjustments: Record<string, any> = {};
        Object.keys(draft.adjustments).forEach(empId => {
           const adj = draft.adjustments[empId];
           const ot = adj.overtime;
           sanitizedAdjustments[empId] = {
              loanPayment: adj.loanPayment !== undefined ? adj.loanPayment : null,
              sssPayment: adj.sssPayment !== undefined ? adj.sssPayment : null,
              overtime: (ot && typeof ot === 'object') ? ot : {},
              incentive: adj.incentive || '0'
           };
        });
        setPayrollManualAdjustments(sanitizedAdjustments);
      } else {
        setPayrollManualAdjustments({});
      }
    }
  }, [payrollStart, payrollEnd, user.selectedStoreId, payrollDrafts, view]);

  const [printTarget, setPrintTarget] = useState<{ type: 'SINGLE' | 'ALL' | 'HISTORY_SINGLE' | 'HISTORY_ALL'; empId?: string } | null>(null);
  
  const selectedVault = useMemo(() => 
    payrollHistory.find(h => h.id === selectedVaultId),
    [payrollHistory, selectedVaultId]
  );

  const handlePayrollUpdate = (empId: string, field: 'loanPayment' | 'sssPayment' | 'overtime' | 'incentive', value: string, date?: string) => {
    setPayrollManualAdjustments(prev => {
      const current = prev[empId] || { loanPayment: null, sssPayment: null, overtime: {}, incentive: '0' };
      
      if (field === 'overtime' && date) {
        return {
          ...prev,
          [empId]: {
            ...current,
            overtime: {
              ...current.overtime,
              [date]: value
            }
          }
        };
      }

      return {
        ...prev,
        [empId]: {
          ...current,
          [field]: value === '' ? (field === 'loanPayment' || field === 'sssPayment' ? null : '0') : value
        }
      };
    });
  };

  const handleSaveDraft = async () => {
    const draftId = `DRF-${user.selectedStoreId}-${payrollStart}-${payrollEnd}`;
    const newDraft: PayrollDraft = {
      id: draftId,
      storeId: user.selectedStoreId,
      periodStart: payrollStart,
      periodEnd: payrollEnd,
      adjustments: payrollManualAdjustments,
      updatedAt: new Date().toISOString()
    };

    const nextDrafts = [newDraft, ...payrollDrafts.filter(d => d.id !== draftId)];
    setPayrollDrafts(nextDrafts);
    const success = await onSync(undefined, undefined, undefined, newDraft);
    if (success) {
      alert("Payroll manifest saved as draft. Principal balances preserved until finalization.");
    }
  };

  const triggerFullReportPrint = () => {
    setPrintTarget({ type: 'ALL' });
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 300);
  };

  const triggerSinglePayslipPrint = (empId: string) => {
    setPrintTarget({ type: 'SINGLE', empId });
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 300);
  };

  const triggerHistoryFullPrint = () => {
    if (!selectedVault) return;
    setPrintTarget({ type: 'HISTORY_ALL' });
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 300);
  };

  const triggerHistorySinglePrint = (empId: string) => {
    if (!selectedVault) return;
    setPrintTarget({ type: 'HISTORY_SINGLE', empId });
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 300);
  };

  const handleApplyPayroll = async () => {
    if (!isAdmin) return;
    if (!confirm("Finalize this payroll cycle? This will update principal balances in the cloud registry and reset current vale advances.")) return;

    const nextEmployees = employees.map(e => {
      const calc = calculateRow(e);
      return {
        ...e,
        loanBalance: Math.max(0, Number(e.loanBalance) - calc.loanPay),
        sssLoanBalance: Math.max(0, (Number(e.sssLoanBalance) || 0) - calc.sssPay),
        valeBalance: 0 
      };
    });

    const payrollData = filteredEmployees.map(e => {
      const calc = calculateRow(e);
      return {
        employeeId: e.id,
        name: e.name,
        days: calc.days,
        hours: calc.hours,
        rate: e.salary,
        gross: calc.basePay,
        ot: calc.otPay,
        incentive: calc.incentivePay,
        vale: calc.valePay,
        late: calc.lateDeduction,
        undertime: calc.utDeduction,
        loan: calc.loanPay,
        sss: calc.sssPay,
        net: calc.net
      };
    });

    const newRecord: PayrollHistoryRecord = {
      id: `PH-${Date.now()}`,
      periodStart: payrollStart,
      periodEnd: payrollEnd,
      generatedAt: new Date().toISOString(),
      generatedBy: user.username,
      totalDisbursement: Number(payrollTotals.net.toFixed(2)),
      payrollData
    };

    const nextHistory = [newRecord, ...payrollHistory];
    setEmployees(nextEmployees);
    setPayrollHistory(nextHistory);
    setPayrollManualAdjustments({});
    await onSync(nextEmployees, undefined, nextHistory);
    alert("Payroll finalized. Principal balances updated and snapshot vaulted.");
  };

  const handleSaveVaultEdit = async () => {
    if (!selectedVault || !isAdmin) return;
    const updatedHistory = payrollHistory.map(h => h.id === selectedVault.id ? selectedVault : h);
    setPayrollHistory(updatedHistory);
    await onSync(undefined, undefined, updatedHistory);
    setIsVaultEditMode(false);
    alert("Historical snapshot updated.");
  };

  const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const handleAuthorizeAttendanceOverride = async () => {
    if (!overrideEmployeeId || !overrideDate) return;
    const emp = employees.find(e => e.id === overrideEmployeeId);
    if (!emp) return;

    let lateMinutes = 0;
    let undertimeMinutes = 0;
    let isHalfDay = false;

    const scheduledTotal = timeToMinutes(emp.shiftEnd || '17:00') - timeToMinutes(emp.shiftStart || '08:00');
    const halfDayThreshold = (scheduledTotal / 2) + (scheduledTotal < 720 ? 30 : 0);

    if (overrideStatus === 'REGULAR') {
      const schedIn = timeToMinutes(emp.shiftStart || '08:00');
      const schedOut = timeToMinutes(emp.shiftEnd || '17:00');
      
      const actualIn = overrideTimeIn ? timeToMinutes(overrideTimeIn) : schedIn;
      const actualOut = overrideTimeOut ? timeToMinutes(overrideTimeOut) : schedOut;
      const workedMinutes = Math.max(0, actualOut - actualIn);
      
      isHalfDay = workedMinutes >= halfDayThreshold && workedMinutes <= (scheduledTotal * 0.75);
      
      if (isHalfDay) {
        lateMinutes = 0;
        undertimeMinutes = 0;
      } else {
        lateMinutes = overrideTimeIn ? Math.max(0, actualIn - schedIn) : 0;
        undertimeMinutes = overrideTimeOut ? Math.max(0, schedOut - actualOut) : 0;
      }
    }

    const existingIdx = attendance.findIndex(a => String(a.employeeId) === String(overrideEmployeeId) && a.date === overrideDate);
    const newRec: AttendanceRecord = {
      id: existingIdx > -1 ? attendance[existingIdx].id : `ATT-${Date.now()}`,
      employeeId: overrideEmployeeId,
      date: overrideDate,
      timeIn: overrideTimeIn,
      timeOut: overrideTimeOut,
      lateMinutes,
      undertimeMinutes,
      overtimeMinutes: 0,
      isHalfDay,
      status: overrideStatus
    };

    let nextAttendance = [...attendance];
    if (existingIdx > -1) nextAttendance[existingIdx] = newRec;
    else nextAttendance.push(newRec);

    setAttendance(nextAttendance);
    await onSync(undefined, nextAttendance);
    setOverrideEmployeeId(''); setOverrideTimeIn(''); setOverrideTimeOut('');
    alert(`Entry authorized with ${isHalfDay ? 'HALF DAY' : 'REGULAR'} status.`);
  };

  const handleEditAttendance = (a: AttendanceRecord) => {
    setOverrideDate(a.date);
    setOverrideEmployeeId(a.employeeId);
    setOverrideStatus(a.status);
    setOverrideTimeIn(a.timeIn || '');
    setOverrideTimeOut(a.timeOut || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredAttendanceAudit = useMemo(() => {
    return attendance.filter(a => {
      const matchesPersonnel = auditPersonnelFilter === 'ALL' || String(a.employeeId) === auditPersonnelFilter;
      const matchesWindow = a.date >= auditStart && a.date <= auditEnd;
      return matchesPersonnel && matchesWindow;
    }).sort((a,b) => {
      return auditSortOrder === 'ASC' 
        ? a.date.localeCompare(b.date) 
        : b.date.localeCompare(a.date);
    });
  }, [attendance, auditPersonnelFilter, auditStart, auditEnd, auditSortOrder]);

  useEffect(() => { setSearchQuery(''); }, [view]);

  const filteredEmployees = useMemo(() => 
    employees.filter(e => {
      const isAuthorized = user.assignedStoreIds.includes('all') || (e.assignedStoreIds && e.assignedStoreIds.includes(user.selectedStoreId));
      const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           e.employeeNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      return isAuthorized && matchesSearch;
    }), 
    [employees, user.selectedStoreId, user.assignedStoreIds, searchQuery]
  );

  const weekDates = useMemo(() => {
    const dates = [];
    const [sy, sm, sd] = payrollStart.split('-').map(Number);
    const [ey, em, ed] = payrollEnd.split('-').map(Number);
    const curr = new Date(sy, sm - 1, sd, 12, 0, 0);
    const end = new Date(ey, em - 1, ed, 12, 0, 0);
    let count = 0;
    while (curr <= end && count < 31) {
      const y = curr.getFullYear();
      const m = (curr.getMonth() + 1).toString().padStart(2, '0');
      const d = curr.getDate().toString().padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return dates;
  }, [payrollStart, payrollEnd]);

  const calculateRow = (emp: Employee) => {
    const adjFromState = payrollManualAdjustments[emp.id];
    const manuals = {
        loanPayment: adjFromState?.loanPayment ?? null,
        sssPayment: adjFromState?.sssPayment ?? null,
        overtime: (adjFromState?.overtime && typeof adjFromState.overtime === 'object') ? adjFromState.overtime : {},
        incentive: adjFromState?.incentive ?? '0'
    };

    const weekRecords = attendance.filter(a => String(a.employeeId) === String(emp.id) && weekDates.includes(a.date));
    const scheduledTotalMinutes = timeToMinutes(emp.shiftEnd) - timeToMinutes(emp.shiftStart);
    const totalShiftHours = scheduledTotalMinutes / 60;
    
    // Core Formula: Hourly Rate = Daily Salary / (Total Shift Hours - 1)
    // Rounded to 2 decimal places for protocol consistency
    const denominator = Math.max(0, totalShiftHours - 1);
    const hourlyRate = denominator > 0 ? Number((emp.salary / denominator).toFixed(2)) : 0;
    
    const halfDayThreshold = (scheduledTotalMinutes / 2) + (scheduledTotalMinutes < 720 ? 30 : 0);

    let presentDays = 0;
    let totalLateMinutes = 0;
    let totalUTMinutes = 0;

    weekDates.forEach(date => {
      const rec = weekRecords.find(r => r.date === date);
      const status = rec?.status || (rec ? 'REGULAR' : 'ABSENT');
      
      if (status !== 'ABSENT') {
        const actualIn = rec?.timeIn ? timeToMinutes(rec.timeIn) : 0;
        const actualOut = rec?.timeOut ? timeToMinutes(rec.timeOut) : 0;
        const workedMinutes = (actualIn && actualOut) ? (actualOut - actualIn) : 0;
        
        const isHalfDay = workedMinutes >= halfDayThreshold && workedMinutes <= (scheduledTotalMinutes * 0.75);

        if (isHalfDay) {
          presentDays += 0.5;
        } else {
          presentDays += 1;
          if (status === 'REGULAR') {
            if (rec?.timeIn) {
              const schedIn = timeToMinutes(emp.shiftStart);
              totalLateMinutes += Math.max(0, actualIn - schedIn);
            }
            if (rec?.timeOut) {
              const schedOut = timeToMinutes(emp.shiftEnd);
              totalUTMinutes += Math.max(0, schedOut - actualOut);
            }
          }
        }
      }
    });

    const basePay = presentDays * emp.salary;
    
    const lateDeduction = Number(((totalLateMinutes / 60) * hourlyRate).toFixed(2));
    const utDeduction = Number(((totalUTMinutes / 60) * hourlyRate).toFixed(2));
    
    // Daily Overtime Aggregation
    let otTotalHours = 0;
    Object.values(manuals.overtime).forEach(h => {
        otTotalHours += parseFloat(h as string) || 0;
    });
    const otPay = Number((otTotalHours * hourlyRate).toFixed(2));
    
    const incentivePay = parseFloat(manuals.incentive) || 0;
    const valePay = Number(emp.valeBalance) || 0; 
    
    const loanPay = manuals.loanPayment !== null 
        ? (parseFloat(manuals.loanPayment) || 0)
        : Math.min(Number(emp.loanWeeklyDeduction) || 0, Number(emp.loanBalance) || 0);
    
    const sssPay = manuals.sssPayment !== null
        ? (parseFloat(manuals.sssPayment) || 0)
        : Math.min(Number(emp.sssLoanWeeklyDeduction) || 0, Number(emp.sssLoanBalance) || 0);

    const totalDeductions = valePay + loanPay + sssPay + lateDeduction + utDeduction;
    const net = Number((basePay + otPay + incentivePay - totalDeductions).toFixed(2));

    return { 
      days: presentDays, hours: presentDays * (denominator), 
      basePay, otPay, incentivePay, valePay, loanPay, sssPay, totalDeductions, net, 
      weekRecords, manuals, hourlyRate, lateDeduction, utDeduction,
      totalLateMinutes, totalUTMinutes, otTotalHours
    };
  };

  const updateDayStatus = async (empId: string, date: string, status: AttendanceStatus) => {
    const existing = attendance.find(a => String(a.employeeId) === String(empId) && a.date === date);
    let nextAttendance: AttendanceRecord[] = [];
    if (existing) nextAttendance = attendance.map(a => a.id === existing.id ? { ...a, status } : a);
    else {
      nextAttendance = [...attendance, {
        id: `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        employeeId: empId, date: date, timeIn: '', timeOut: '', lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, isHalfDay: false, status
      }];
    }
    setAttendance(nextAttendance);
    await onSync(undefined, nextAttendance);
  };

  const openAddModal = () => {
    setEditingEmployeeId(null);
    setFormData({ 
      name: '', type: EmployeeType.STAFF, salary: 0, assignedStoreIds: [user.selectedStoreId], 
      shiftStart: '08:00', shiftEnd: '17:00', pin: '',
      loanBalance: 0, loanWeeklyDeduction: 0,
      sssLoanBalance: 0, sssLoanWeeklyDeduction: 0
    });
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setFormData({
      name: emp.name, type: emp.type, salary: emp.salary, assignedStoreIds: emp.assignedStoreIds || [],
      shiftStart: emp.shiftStart || '08:00', shiftEnd: emp.shiftEnd || '17:00', pin: emp.pin || '',
      loanBalance: Number(emp.loanBalance) || 0,
      loanWeeklyDeduction: Number(emp.loanWeeklyDeduction) || 0,
      sssLoanBalance: Number(emp.sssLoanBalance) || 0,
      sssLoanWeeklyDeduction: Number(emp.sssLoanWeeklyDeduction) || 0
    });
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async () => {
    if (!formData.name.trim()) return;
    
    const employeeData = {
      ...formData,
      salary: Number(formData.salary),
      loanBalance: Number(formData.loanBalance),
      loanWeeklyDeduction: Number(formData.loanWeeklyDeduction),
      sssLoanBalance: Number(formData.sssLoanBalance),
      sssLoanWeeklyDeduction: Number(formData.sssLoanWeeklyDeduction),
      loanTerms: "0",
      loanTermMonths: 0,
      sssLoanTermMonths: 0,
      loanFrequency: 'WEEKLY' as LoanFrequency,
      sssLoanFrequency: 'WEEKLY' as LoanFrequency
    };

    let nextEmployees: Employee[] = [];
    if (editingEmployeeId) {
      nextEmployees = employees.map(e => e.id === editingEmployeeId ? { ...e, ...employeeData } : e);
    } else {
      const newEmp: Employee = {
        id: `EMP-${Date.now()}`, 
        assignedStoreIds: employeeData.assignedStoreIds,
        employeeNumber: `ACE-${Math.floor(1000 + Math.random() * 9000)}`,
        name: employeeData.name, 
        type: employeeData.type, 
        salary: Number(employeeData.salary),
        shiftStart: employeeData.shiftStart, 
        shiftEnd: employeeData.shiftEnd,
        pin: employeeData.pin,
        loanTerms: "0", 
        loanBalance: Number(employeeData.loanBalance),
        loanWeeklyDeduction: Number(employeeData.loanWeeklyDeduction), 
        loanFrequency: 'WEEKLY', 
        loanTermMonths: 0,
        sssLoanBalance: Number(employeeData.sssLoanBalance), 
        sssLoanWeeklyDeduction: Number(editingEmployeeId ? 0 : employeeData.sssLoanWeeklyDeduction),
        sssLoanFrequency: 'WEEKLY', 
        sssLoanTermMonths: 0,
        valeBalance: 0, 
        loans: { salary: 0, sss: 0, vale: 0 }, 
        loanBalances: { salary: 0, sss: 0, vale: 0 }
      };
      nextEmployees = [...employees, newEmp];
    }
    setEmployees(nextEmployees);
    setIsModalOpen(false);
    await onSync(nextEmployees);
  };

  const payrollTotals = useMemo(() => {
    return filteredEmployees.reduce((acc, e) => {
      const calc = calculateRow(e);
      acc.days += calc.days; acc.basePay += calc.basePay; acc.ot += calc.otPay; acc.incentive += calc.incentivePay;
      acc.loan += calc.loanPay; acc.sss += calc.sssPay;
      acc.vale += calc.valePay;
      acc.late += calc.lateDeduction;
      acc.undertime += calc.utDeduction;
      acc.net += calc.net; return acc;
    }, { days: 0, basePay: 0, ot: 0, incentive: 0, loan: 0, sss: 0, vale: 0, late: 0, undertime: 0, net: 0 });
  }, [filteredEmployees, attendance, payrollStart, payrollEnd, payrollManualAdjustments]);

  const handleUpdateFinance = async () => {
    if (!financeEmpId || financeAmount <= 0) return;
    const nextEmployees = employees.map(e => {
        if (String(e.id) === String(financeEmpId)) {
            return {
                ...e,
                loanBalance: financeType === 'LOAN' ? Number(e.loanBalance || 0) + Number(financeAmount) : Number(e.loanBalance || 0),
                valeBalance: financeType === 'VALE' ? Number(e.valeBalance || 0) + Number(financeAmount) : Number(e.valeBalance || 0),
                sssLoanBalance: financeType === 'SSS' ? Number(e.sssLoanBalance || 0) + Number(financeAmount) : Number(e.sssLoanBalance || 0)
            };
        }
        return e;
    });
    setEmployees(nextEmployees);
    setIsFinanceModalOpen(false);
    setFinanceAmount(0);
    await onSync(nextEmployees);
  };

  return (
    <div className="space-y-8 font-sans text-slate-900 h-full overflow-y-auto custom-scrollbar p-4 md:p-8 relative">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #report-printable-area, #report-printable-area * { visibility: visible !important; }
          #payslip-printable-area, #payslip-printable-area * { visibility: visible !important; }
          #history-report-printable-area, #history-report-printable-area * { visibility: visible !important; }
          #history-payslip-printable-area, #history-payslip-printable-area * { visibility: visible !important; }
          
          #report-printable-area { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 10mm !important; background: white !important; color: black !important; display: block !important; }
          #history-report-printable-area { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 10mm !important; background: white !important; color: black !important; display: block !important; }
          
          #payslip-printable-area { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; display: flex !important; justify-content: center !important; }
          #history-payslip-printable-area { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; display: flex !important; justify-content: center !important; }
          
          .no-print { display: none !important; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      {/* LIVE PAYROLL REPORT PRINT VIEW */}
      {printTarget?.type === 'ALL' && (
        <div id="report-printable-area" className="hidden">
           <div className="text-center mb-8">
              <h2 className="text-2xl font-black uppercase italic">ACECORP ENTERPRISE</h2>
              <p className="text-xs uppercase font-bold tracking-widest opacity-60">Consolidated Weekly Payroll Registry manifest</p>
              <p className="text-sm font-black mt-2">PERIOD: {payrollStart} to {payrollEnd}</p>
           </div>
           <table className="w-full text-[9px] border-collapse border border-black text-center">
              <thead>
                 <tr className="bg-slate-100 font-black uppercase border-b border-black">
                    <th className="p-2 border-r border-black text-left">Personnel</th>
                    <th className="p-2 border-r border-black">Days</th>
                    <th className="p-2 border-r border-black">Base</th>
                    <th className="p-2 border-r border-black">OT</th>
                    <th className="p-2 border-r border-black">Incent.</th>
                    <th className="p-2 border-r border-black">Loan</th>
                    <th className="p-2 border-r border-black">SSS</th>
                    <th className="p-2 border-r border-black">Vale</th>
                    <th className="p-2 border-r border-black">Tardiness</th>
                    <th className="p-2 font-black text-sm">NET</th>
                 </tr>
              </thead>
              <tbody>
                 {filteredEmployees.map(e => {
                    const calc = calculateRow(e);
                    return (
                       <tr key={e.id} className="border-b border-slate-300 font-bold uppercase">
                          <td className="p-2 border-r border-slate-300 text-left italic">{e.name}</td>
                          <td className="p-2 border-r border-slate-300">{calc.days.toFixed(2)}</td>
                          <td className="p-2 border-r border-slate-300">₱{calc.basePay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                          <td className="p-2 border-r border-slate-300">₱{calc.otPay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                          <td className="p-2 border-r border-slate-300">₱{calc.incentivePay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                          <td className="p-2 border-r border-slate-300">₱{calc.loanPay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                          <td className="p-2 border-r border-slate-300">₱{calc.sssPay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                          <td className="p-2 border-r border-slate-300">₱{calc.valePay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                          <td className="p-2 border-r border-slate-300">₱{(calc.lateDeduction + calc.utDeduction).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                          <td className="p-2 font-black">₱{calc.net.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                       </tr>
                    );
                 })}
              </tbody>
              <tfoot>
                 <tr className="bg-slate-50 font-black uppercase border-t-2 border-black">
                    <td className="p-2 border-r border-black text-left">TOTAL DISBURSEMENT</td>
                    <td className="p-2 border-r border-black">{payrollTotals.days.toFixed(2)}</td>
                    <td className="p-2 border-r border-black">₱{payrollTotals.basePay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td className="p-2 border-r border-black">₱{payrollTotals.ot.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td className="p-2 border-r border-black">₱{payrollTotals.incentive.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td className="p-2 border-r border-black">₱{payrollTotals.loan.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td className="p-2 border-r border-black">₱{payrollTotals.sss.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td className="p-2 border-r border-black">₱{payrollTotals.vale.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td className="p-2 border-r border-black">₱{(payrollTotals.late + payrollTotals.undertime).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td className="p-2 text-base">₱{payrollTotals.net.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                 </tr>
              </tfoot>
           </table>
           <div className="mt-12 flex justify-between text-[8px] font-black uppercase">
              <p>Generated By: {user.username}</p>
              <p>Timestamp: {new Date().toLocaleString()}</p>
           </div>
        </div>
      )}

      {/* LIVE INDIVIDUAL PAYSLIP PRINT VIEW */}
      {printTarget?.type === 'SINGLE' && (
        <div id="payslip-printable-area" className="hidden">
           {(() => {
             const emp = employees.find(e => e.id === printTarget.empId);
             if (!emp) return null;
             const calc = calculateRow(emp);
             return (
                <div className="w-[140mm] bg-white border border-slate-300 p-10 font-mono text-black">
                   <div className="text-center mb-8 border-b-2 border-black pb-4">
                      <h2 className="text-2xl font-black uppercase italic">ACECORP ENTERPRISE</h2>
                      <p className="text-xs uppercase font-bold">Node Terminal Registry</p>
                      <p className="text-sm font-black uppercase mt-4 tracking-[0.3em]">Confidential Payslip</p>
                   </div>
                   <div className="grid grid-cols-2 gap-8 mb-8 text-xs font-bold uppercase">
                      <div className="space-y-1">
                         <p>Personnel: <span className="font-black italic">{emp.name}</span></p>
                         <p>ID: {emp.employeeNumber}</p>
                         <p>Position: {emp.type}</p>
                      </div>
                      <div className="text-right space-y-1">
                         <p>Period: {payrollStart} to {payrollEnd}</p>
                         <p>Days Worked: {calc.days.toFixed(2)}</p>
                         <p>Shift: {emp.shiftStart} - {emp.shiftEnd}</p>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-3">
                         <p className="border-b border-black font-black text-[10px] mb-1">EARNINGS</p>
                         <div className="flex justify-between text-xs"><span>Basic Pay:</span> <span>₱{calc.basePay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                         <div className="flex justify-between text-xs"><span>Overtime:</span> <span>₱{calc.otPay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                         <div className="flex justify-between text-xs"><span>Incentives:</span> <span>₱{calc.incentivePay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                         <div className="flex justify-between font-black text-sm pt-2 border-t border-black"><span>Gross:</span> <span>₱{(calc.basePay + calc.otPay + calc.incentivePay).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                      </div>
                      <div className="space-y-3">
                         <p className="border-b border-black font-black text-[10px] mb-1">DEDUCTIONS</p>
                         <div className="flex justify-between text-xs"><span>Vale/Cash:</span> <span>₱{calc.valePay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                         <div className="flex justify-between text-xs"><span>Company Loan:</span> <span>₱{calc.loanPay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                         <div className="flex justify-between text-xs"><span>SSS Loan:</span> <span>₱{calc.sssPay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                         <div className="flex justify-between text-xs"><span>Tardiness:</span> <span>₱{(calc.lateDeduction + calc.utDeduction).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                         <div className="flex justify-between font-black text-sm pt-2 border-t border-black"><span>Total:</span> <span>₱{calc.totalDeductions.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
                      </div>
                   </div>
                   <div className="mt-12 p-6 bg-slate-100 border-2 border-black flex justify-between items-center">
                      <span className="text-sm font-black uppercase tracking-widest">NET PAYROLL SETTLEMENT:</span>
                      <span className="text-2xl font-black italic">₱{calc.net.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                   </div>
                </div>
             );
           })()}
        </div>
      )}

      {/* HISTORICAL REPRINT VIEWS */}
      {printTarget?.type === 'HISTORY_ALL' && selectedVault && (
        <div id="history-report-printable-area" className="hidden">
           <div className="text-center mb-8">
              <h2 className="text-2xl font-black uppercase italic">ACECORP ENTERPRISE</h2>
              <p className="text-xs uppercase font-bold tracking-widest opacity-60">Archived Payroll Manifest (Reprint)</p>
              <p className="text-sm font-black mt-2">PERIOD: {selectedVault.periodStart} to {selectedVault.periodEnd}</p>
           </div>
           <table className="w-full text-[9px] border-collapse border border-black text-center">
              <thead>
                 <tr className="bg-slate-100 font-black uppercase border-b border-black">
                    <th className="p-2 border-r border-black text-left">Personnel</th>
                    <th className="p-2 border-r border-black">Days</th>
                    <th className="p-2 border-r border-black">Base</th>
                    <th className="p-2 border-r border-black">OT</th>
                    <th className="p-2 border-r border-black">Incent.</th>
                    <th className="p-2 border-r border-black">Loan</th>
                    <th className="p-2 border-r border-black">SSS</th>
                    <th className="p-2 border-r border-black">Vale</th>
                    <th className="p-2 border-r border-black">Tardiness</th>
                    <th className="p-2 font-black text-sm">NET</th>
                 </tr>
              </thead>
              <tbody>
                 {selectedVault.payrollData.map(d => (
                    <tr key={d.employeeId} className="border-b border-slate-300 font-bold uppercase">
                       <td className="p-2 border-r border-slate-300 text-left italic">{d.name}</td>
                       <td className="p-2 border-r border-slate-300">{d.days.toFixed(2)}</td>
                       <td className="p-2 border-r border-slate-300">₱{(d.gross || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                       <td className="p-2 border-r border-slate-300">₱{(d.ot || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                       <td className="p-2 border-r border-slate-300">₱{(d.incentive || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                       <td className="p-2 border-r border-slate-300">₱{(d.loan || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                       <td className="p-2 border-r border-slate-300">₱{(d.sss || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                       <td className="p-2 border-r border-slate-300">₱{(d.vale || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                       <td className="p-2 border-r border-slate-300">₱{((d.late || 0) + (d.undertime || 0)).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                       <td className="p-2 font-black">₱{(d.net || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    </tr>
                 ))}
              </tbody>
              <tfoot>
                 <tr className="bg-slate-50 font-black uppercase border-t-2 border-black">
                    <td colSpan={9} className="p-2 border-r border-black text-left">ARCHIVE DISBURSEMENT AGGREGATE</td>
                    <td className="p-2 text-base">₱{selectedVault.totalDisbursement.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                 </tr>
              </tfoot>
           </table>
        </div>
      )}

      {printTarget?.type === 'HISTORY_SINGLE' && selectedVault && (
         <div id="history-payslip-printable-area" className="hidden">
           {(() => {
             const d = selectedVault.payrollData.find(pd => pd.employeeId === printTarget.empId);
             if (!d) return null;
             return (
                <div className="w-[140mm] bg-white border border-slate-300 p-10 font-mono text-black">
                   <div className="text-center mb-8 border-b-2 border-black pb-4">
                      <h2 className="text-2xl font-black uppercase italic">ACECORP ENTERPRISE</h2>
                      <p className="text-xs uppercase font-bold">Archive Registry Mirror</p>
                      <p className="text-sm font-black uppercase mt-4 tracking-[0.3em]">Historical Payslip Reprint</p>
                   </div>
                   <div className="grid grid-cols-2 gap-8 mb-8 text-xs font-bold uppercase">
                      <div className="space-y-1"><p>Personnel: <span className="font-black italic">{d.name}</span></p></div>
                      <div className="text-right space-y-1"><p>Period: {selectedVault.periodStart} to {selectedVault.periodEnd}</p></div>
                   </div>
                   <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-3">
                         <p className="border-b border-black font-black text-[10px] mb-1">EARNINGS</p>
                         <div className="flex justify-between text-xs"><span>Basic:</span> <span>₱{(d.gross || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                         <div className="flex justify-between text-xs"><span>OT:</span> <span>₱{(d.ot || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                         <div className="flex justify-between text-xs"><span>Incent:</span> <span>₱{(d.incentive || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                      </div>
                      <div className="space-y-3">
                         <p className="border-b border-black font-black text-[10px] mb-1">DEDUCTIONS</p>
                         <div className="flex justify-between text-xs"><span>Vale:</span> <span>₱{(d.vale || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                         <div className="flex justify-between text-xs"><span>Loan/SSS:</span> <span>₱{((d.loan || 0) + (d.sss || 0)).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                         <div className="flex justify-between text-xs"><span>Tardiness:</span> <span>₱{((d.late || 0) + (d.undertime || 0)).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                      </div>
                   </div>
                   <div className="mt-12 p-6 bg-slate-100 border-2 border-black flex justify-between items-center"><span className="text-sm font-black uppercase">NET SETTLEMENT:</span><span className="text-2xl font-black italic">₱{(d.net || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                </div>
             );
           })()}
         </div>
      )}

      {view === 'personnel' && (
        <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden mb-12 animate-in fade-in no-print">
          <div className="p-10 border-b border-slate-50 flex flex-col gap-6 bg-slate-50/20">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tighter italic text-2xl">Workforce Ledger</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Enterprise Consolidated Database</p>
              </div>
              <button onClick={openAddModal} className="bg-[#2d89c8] text-white px-10 py-5 rounded-[24px] text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 shadow-xl transition-all">+ Enroll Personnel</button>
            </div>
            <div className="relative max-w-xl group">
               <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
               <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search Personnel Registry..." className="w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-[24px] text-sm font-bold shadow-inner outline-none focus:border-sky-400 uppercase text-slate-900" />
               {searchQuery && (
                 <button onClick={() => setSearchQuery('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400">
                   <i className="fas fa-times-circle"></i>
                 </button>
               )}
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-10 py-6">Operator Profile</th>
                  <th className="px-10 py-6">Protocol / Shift</th>
                  <th className="px-10 py-6">Authorization</th>
                  <th className="px-10 py-6">Running Balances</th>
                  <th className="px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEmployees.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition group">
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#dbeafe] flex items-center justify-center text-sky-600 font-black uppercase italic border border-sky-100">{e.name[0]}</div>
                        <div>
                          <p className="font-black text-slate-900 uppercase text-xs italic">{e.name}</p>
                          <p className="text-[9px] font-black text-slate-400 font-mono tracking-tighter uppercase">{e.employeeNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <p className="text-[10px] font-black uppercase italic text-slate-700">{e.type}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{e.shiftStart} - {e.shiftEnd}</p>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex flex-wrap gap-1">
                        {e.assignedStoreIds?.map(sid => (
                          <span key={sid} className="text-[8px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md uppercase border border-slate-200">
                            {stores.find(st => String(st.id) === String(sid))?.code || sid}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 min-w-[40px] text-center">LOAN</span>
                          <span className="text-[12px] font-black text-slate-700 italic">₱{Number(e.loanBalance).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] font-black text-sky-500 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 min-w-[40px] text-center">VALE</span>
                          <span className="text-[12px] font-black text-slate-700 italic">₱{Number(e.valeBalance).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] font-black text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 min-w-[40px] text-center">SSS</span>
                          <span className="text-[12px] font-black text-slate-700 italic">₱{Number(e.sssLoanBalance || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => { setFinanceEmpId(e.id); setFinanceType('LOAN'); setIsFinanceModalOpen(true); }} className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-all shadow-sm"><i className="fas fa-hand-holding-usd text-xs"></i></button>
                        <button onClick={() => { setFinanceEmpId(e.id); setFinanceType('VALE'); setIsFinanceModalOpen(true); }} className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-100 transition-all shadow-sm"><i className="fas fa-wallet text-xs"></i></button>
                        <button onClick={() => { setFinanceEmpId(e.id); setFinanceType('SSS'); setIsFinanceModalOpen(true); }} className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition-all shadow-sm"><i className="fas fa-shield-alt text-xs"></i></button>
                        <button onClick={() => openEditModal(e)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-all shadow-sm"><i className="fas fa-user-edit text-xs"></i></button>
                        <button onClick={() => { if(confirm("Permanently purge this personnel registry?")) { const next = employees.filter(emp => emp.id !== e.id); setEmployees(next); onSync(next); } }} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-100 transition-all shadow-sm"><i className="fas fa-trash-alt text-xs"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in no-print h-full overflow-hidden">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Override Registry</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manual Signal Entry</p>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Reporting Date</label>
                  <CustomDatePicker value={overrideDate} onChange={setOverrideDate} className="w-full" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Personnel Profile</label>
                  <select value={overrideEmployeeId} onChange={e => setOverrideEmployeeId(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black uppercase italic shadow-inner outline-none focus:border-sky-500">
                    <option value="">Select Personnel...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Status Classification</label>
                  <select value={overrideStatus} onChange={e => setOverrideStatus(e.target.value as any)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black uppercase italic shadow-inner outline-none focus:border-sky-500">
                    <option value="REGULAR">Regular Shift</option>
                    <option value="OB">Official Business (OB)</option>
                    <option value="PTO">Paid Time Off (PTO)</option>
                    <option value="ABSENT">Mark Absent</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Signal: In</label>
                    <input disabled={overrideStatus === 'ABSENT'} type="time" value={overrideTimeIn} onChange={e => setOverrideTimeIn(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black outline-none disabled:opacity-30" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Signal: Out</label>
                    <input disabled={overrideStatus === 'ABSENT'} type="time" value={overrideTimeOut} onChange={e => setOverrideTimeOut(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black outline-none disabled:opacity-30" />
                  </div>
                </div>
                <button onClick={handleAuthorizeAttendanceOverride} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 mt-4">Authorize Entry</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 flex flex-wrap items-center justify-between gap-6 bg-slate-50/10">
              <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Shift Audit Trail</h2>
              <div className="flex flex-wrap items-center gap-6">
                <button onClick={() => setAuditSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')} className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black uppercase italic hover:bg-slate-200 transition-all flex items-center gap-2">
                  <i className={`fas ${auditSortOrder === 'ASC' ? 'fa-sort-amount-up' : 'fa-sort-amount-down'}`}></i>
                  {auditSortOrder === 'ASC' ? 'Oldest First' : 'Newest First'}
                </button>
                <div className="flex items-center gap-4">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Personnel Filter:</label>
                  <select value={auditPersonnelFilter} onChange={e => setAuditPersonnelFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase italic outline-none">
                    <option value="ALL">All Employees</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Window:</label>
                  <CustomDatePicker value={auditStart} onChange={setAuditStart} className="w-36" />
                  <span className="text-slate-300 text-xs">→</span>
                  <CustomDatePicker value={auditEnd} onChange={setAuditEnd} className="w-36" />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-10 py-5">Personnel</th>
                    <th className="px-10 py-5">Date</th>
                    <th className="px-10 py-5 text-center">Protocol Loop</th>
                    <th className="px-10 py-5 text-center">Shift Signal</th>
                    <th className="px-10 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredAttendanceAudit.map(a => {
                    const emp = employees.find(e => e.id === a.employeeId);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition group">
                        <td className="px-10 py-5 font-black uppercase italic text-slate-800 text-[11px]">{emp?.name || 'Unknown'}</td>
                        <td className="px-10 py-5 font-mono text-[10px] text-slate-400">{a.date}</td>
                        <td className="px-10 py-5 text-center">
                          <div className="flex items-center justify-center gap-4">
                            <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] ${a.timeIn ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>{a.timeIn || '--:--'}</span>
                            <i className="fas fa-arrow-right text-[8px] text-slate-200"></i>
                            <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] ${a.timeOut ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-300'}`}>{a.timeOut || '--:--'}</span>
                          </div>
                        </td>
                        <td className="px-10 py-5 text-center">
                           <div className="flex flex-col gap-1 items-center">
                              {a.isHalfDay && <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase bg-amber-500 text-white shadow-sm mb-1">HALF DAY</span>}
                              {a.status !== 'REGULAR' ? (
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase shadow-sm ${a.status === 'ABSENT' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>{a.status}</span>
                              ) : (
                                <>
                                  {a.lateMinutes > 0 && !a.isHalfDay && <span className="text-[8px] font-black text-rose-500 uppercase">{a.lateMinutes}m Late</span>}
                                  {a.undertimeMinutes > 0 && !a.isHalfDay && <span className="text-[8px] font-black text-amber-500 uppercase">{a.undertimeMinutes}m UT</span>}
                                  {a.lateMinutes === 0 && a.undertimeMinutes === 0 && !a.isHalfDay && <span className="text-slate-200 text-xs">---</span>}
                                </>
                              )}
                           </div>
                        </td>
                        <td className="px-10 py-5 text-right">
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => handleEditAttendance(a)} className="text-[9px] font-black text-sky-500 hover:text-sky-700 uppercase tracking-widest">Edit</button>
                            <button onClick={async () => { if(confirm("Purge shift signal?")) { const next = attendance.filter(att => att.id !== a.id); setAttendance(next); onSync(undefined, next); } }} className="text-[9px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest">Revoke</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'payroll' && (
        <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in no-print">
          <div className="p-8 md:p-12 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-10">
             <div>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Weekly Timesheet Audit</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Fixed-Day Registry (Strict Attendance Mapping)</p>
             </div>
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                   <div className="flex flex-col"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Cycle Start</label><CustomDatePicker value={payrollStart} onChange={setPayrollStart} className="w-40" /></div>
                   <div className="pt-4"><i className="fas fa-arrow-right text-slate-200"></i></div>
                   <div className="flex flex-col"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Cycle End</label><CustomDatePicker value={payrollEnd} onChange={setPayrollEnd} className="w-40" /></div>
                </div>
                <div className="h-12 w-px bg-slate-100 mx-2"></div>
                <div className="flex gap-3">
                   <button onClick={handleSaveDraft} className="bg-amber-50 hover:bg-amber-100 text-amber-600 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm">Save Draft</button>
                   <button onClick={triggerFullReportPrint} className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm">Audit Report</button>
                   <button onClick={handleApplyPayroll} className="bg-slate-950 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">Finalize Cycle</button>
                </div>
             </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-center min-w-[1700px]">
               <thead className="bg-[#f8fafc] text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <tr>
                     <th rowSpan={2} className="px-8 py-6 border-b border-slate-100 text-left min-w-[220px]">Personnel Profile</th>
                     <th colSpan={weekDates.length} className="border-b border-l border-slate-100 py-3 text-[10px]">Weekly Registry Hub (Status / Punches / OT)</th>
                     <th rowSpan={2} className="px-4 border-b border-l border-slate-100 min-w-[80px]">Days</th>
                     <th rowSpan={2} className="px-4 border-b border-l border-slate-100 min-w-[120px]">Gross Pay</th>
                     <th rowSpan={2} className="px-4 border-b border-l border-slate-100 min-w-[100px] text-emerald-600">OT (Hours)</th>
                     <th rowSpan={2} className="px-4 border-b border-l border-slate-100 min-w-[100px] text-sky-600">Incentives</th>
                     <th colSpan={5} className="border-b border-l border-slate-100 py-3 text-rose-700 bg-rose-50/30">Deductions Hub (Tardiness & Repayments)</th>
                     <th rowSpan={2} className="px-8 border-b border-l border-slate-100 min-w-[160px] bg-[#111827] text-white">Grand Total</th>
                     <th rowSpan={2} className="px-4 border-b border-l border-slate-100">Actions</th>
                  </tr>
                  <tr>
                     {weekDates.map(date => {
                       const dObj = new Date(date.split('-').map(Number)[0], date.split('-').map(Number)[1] - 1, date.split('-').map(Number)[2], 12);
                       return (<th key={date} className="w-24 py-3 border-b border-l border-slate-100/50"><div>{dObj.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</div><div className="text-[7px] text-slate-400 font-bold mt-0.5">{dObj.toLocaleDateString('en-US',{month:'2-digit',day:'2-digit'})}</div></th>);
                     })}
                     <th className="px-4 py-3 border-b border-l border-slate-100 text-amber-600">Loan</th>
                     <th className="px-4 py-3 border-b border-l border-slate-100 text-blue-600">SSS</th>
                     <th className="px-4 py-3 border-b border-l border-slate-100 text-rose-600">Vale</th>
                     <th className="px-4 py-3 border-b border-l border-slate-100 text-rose-800">Late</th>
                     <th className="px-4 py-3 border-b border-l border-slate-100 text-rose-900">UT</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map(e => {
                     const calc = calculateRow(e);
                     return (
                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                           <td className="px-8 py-6 text-left border-r border-slate-50"><p className="text-[13px] font-black uppercase italic tracking-tighter text-slate-800">{e.name}</p></td>
                           {weekDates.map((date, idx) => {
                              const rec = calc.weekRecords.find(r => r.date === date);
                              const status = rec?.status || (rec ? 'REGULAR' : 'ABSENT');
                              const actualIn = rec?.timeIn ? timeToMinutes(rec.timeIn) : 0;
                              const actualOut = rec?.timeOut ? timeToMinutes(rec.timeOut) : 0;
                              const workedMinutes = (actualIn && actualOut) ? (actualOut - actualIn) : 0;
                              
                              const scheduledTotal = timeToMinutes(e.shiftEnd) - timeToMinutes(e.shiftStart);
                              const halfDayThreshold = (scheduledTotal / 2) + (scheduledTotal < 720 ? 30 : 0);
                              const isCalculatedHalfDay = workedMinutes >= halfDayThreshold && workedMinutes <= (scheduledTotal * 0.75);

                              return (
                                <td key={idx} className={`border-l border-slate-100 p-2 min-w-[100px] ${status === 'ABSENT' ? 'opacity-30' : ''}`}>
                                   <div className="flex flex-col items-center gap-1 relative group">
                                      <div className="relative">
                                         <select value={status} onChange={(ev) => updateDayStatus(e.id, date, ev.target.value as any)} className="appearance-none w-full text-[8px] font-black uppercase border-none bg-transparent outline-none text-center cursor-pointer hover:text-sky-600">
                                            <option value="REGULAR">REGULAR</option><option value="ABSENT">ABSENT</option><option value="OB">OB</option><option value="PTO">PTO</option>
                                         </select>
                                         <i className="fas fa-chevron-down absolute -right-3 top-1/2 -translate-y-1/2 text-[6px] opacity-20 pointer-events-none"></i>
                                      </div>
                                      <div className="flex gap-0.5 mb-1 h-3">
                                        {(rec?.isHalfDay || isCalculatedHalfDay) && <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[7px] font-black flex items-center justify-center shadow-sm" title="Half Day Mode Triggered">H</span>}
                                        {rec?.lateMinutes > 0 && !rec.isHalfDay && !isCalculatedHalfDay && <span className="w-3.5 h-3.5 rounded-full bg-rose-600 text-white text-[7px] font-black flex items-center justify-center shadow-sm" title={`${rec.lateMinutes}m Late`}>L</span>}
                                        {rec?.undertimeMinutes > 0 && !rec.isHalfDay && !isCalculatedHalfDay && <span className="w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[7px] font-black flex items-center justify-center shadow-sm" title={`${rec.undertimeMinutes}m UT`}>U</span>}
                                      </div>
                                      {status === 'REGULAR' && rec?.timeIn && (
                                        <div className="text-[8px] font-mono leading-tight py-1 space-y-0.5 border-b border-slate-100/50 mb-1">
                                          <div className="text-emerald-500 font-bold">{rec.timeIn}</div>
                                          <div className="text-rose-500 font-bold">{rec.timeOut || '--:--'}</div>
                                        </div>
                                      )}
                                      {status !== 'ABSENT' && (
                                        <div className="flex items-center justify-center gap-1 mt-1">
                                          <span className="text-[7px] font-black text-slate-400 uppercase">OT:</span>
                                          <input 
                                            type="number" 
                                            step="0.5" 
                                            value={calc.manuals.overtime[date] || '0'} 
                                            onChange={ev => handlePayrollUpdate(e.id, 'overtime', ev.target.value, date)}
                                            className="w-8 bg-transparent text-center text-[9px] font-black text-emerald-600 outline-none hover:bg-slate-100 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                          />
                                        </div>
                                      )}
                                   </div>
                                </td>
                              );
                           })}
                           <td className="border-l border-slate-100 font-black text-slate-900 italic text-[14px]">{calc.days.toFixed(2)}</td>
                           <td className="border-l border-slate-100 font-black text-slate-900 italic text-[14px]">₱{calc.basePay.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                           <td className="border-l border-slate-100 p-2 text-emerald-600 font-black text-[14px]">
                              <p className="w-full text-center">{calc.otTotalHours.toFixed(1)}</p>
                              <p className="text-[7px] font-bold text-slate-400 uppercase mt-1 leading-none">₱{(calc.otPay).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                           </td>
                           <td className="border-l border-slate-100 p-2 text-sky-600 font-black text-[14px]"><input type="number" value={calc.manuals.incentive} onChange={ev => handlePayrollUpdate(e.id, 'incentive', ev.target.value)} className="w-full text-center bg-transparent outline-none" /><p className="text-[7px] font-bold text-slate-400 uppercase mt-1 leading-none">INCENTIVES</p></td>
                           <td className="border-l border-slate-100 p-2">
                              <input type="number" value={calc.manuals.loanPayment !== null ? calc.manuals.loanPayment : calc.loanPay} onChange={ev => handlePayrollUpdate(e.id, 'loanPayment', ev.target.value)} className="w-full text-center text-[13px] font-black text-slate-800 bg-transparent outline-none" />
                              <p className="text-[7px] font-bold text-slate-400 uppercase mt-1 leading-none">BAL: {Number(e.loanBalance).toLocaleString()}</p>
                           </td>
                           <td className="border-l border-slate-100 p-2">
                              <input type="number" value={calc.manuals.sssPayment !== null ? calc.manuals.sssPayment : calc.sssPay} onChange={ev => handlePayrollUpdate(e.id, 'sssPayment', ev.target.value)} className="w-full text-center text-[13px] font-black text-slate-800 bg-transparent outline-none" />
                              <p className="text-[7px] font-bold text-slate-400 uppercase mt-1 leading-none">BAL: {Number(e.sssLoanBalance || 0).toLocaleString()}</p>
                           </td>
                           <td className="border-l border-slate-100 p-2 bg-rose-50/5">
                              <p className="text-[13px] font-black text-rose-700 italic">₱{Number(calc.valePay).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                              <p className="text-[7px] font-bold text-rose-300 uppercase mt-1 leading-none">CASH</p>
                           </td>
                           <td className="border-l border-slate-100 p-2 bg-rose-100/5">
                              <p className="text-[12px] font-black text-rose-800 italic">₱{calc.lateDeduction.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                              <p className="text-[7px] font-bold text-rose-400 uppercase mt-1 leading-none">LATE</p>
                           </td>
                           <td className="border-l border-slate-100 p-2 bg-rose-100/10">
                              <p className="text-[12px] font-black text-rose-900 italic">₱{calc.utDeduction.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                              <p className="text-[7px] font-bold text-rose-50 uppercase mt-1 leading-none">UT</p>
                           </td>
                           <td className="border-l border-slate-100 font-black text-slate-900 italic text-[18px] bg-slate-50 tracking-tighter">₱{calc.net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                           <td className="border-l border-slate-100 p-2">
                             <button onClick={() => triggerSinglePayslipPrint(e.id)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-all flex items-center justify-center mx-auto" title="Generate Payslip"><i className="fas fa-file-invoice-dollar text-[10px]"></i></button>
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
               <tfoot className="bg-[#111827] text-white">
                  <tr className="font-black italic uppercase text-[11px] tracking-widest">
                     <td className="px-8 py-6 text-left">Aggregate Totals</td><td colSpan={weekDates.length} className="border-l border-white/5"></td><td className="px-4 border-l border-white/5">{payrollTotals.days.toFixed(2)}</td><td className="px-4 border-l border-white/5 text-sky-400">₱{payrollTotals.basePay.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="px-4 border-l border-white/5 text-emerald-400">₱{payrollTotals.ot.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="px-4 border-l border-white/5 text-sky-300">₱{payrollTotals.incentive.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="px-4 border-l border-white/5 text-amber-400">₱{payrollTotals.loan.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="px-4 border-l border-white/5 text-blue-400">₱{payrollTotals.sss.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="px-4 border-l border-white/5 text-rose-400">₱{payrollTotals.vale.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="px-4 border-l border-white/5 text-rose-200">₱{payrollTotals.late.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="px-4 border-l border-white/5 text-rose-100">₱{payrollTotals.undertime.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="px-8 border-l border-white/10 text-2xl tracking-tighter bg-black">₱{payrollTotals.net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td className="border-l border-white/5"></td>
                  </tr>
               </tfoot>
            </table>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full overflow-hidden no-print">
           <div className="lg:col-span-1 bg-white p-8 rounded-[48px] shadow-sm border border-slate-100 flex flex-col">
              <h3 className="text-xl font-black uppercase italic tracking-tighter mb-6">Archive Registry</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                 {payrollHistory.map(h => (
                    <button 
                      key={h.id} 
                      onClick={() => { setSelectedVaultId(h.id); setIsVaultEditMode(false); }}
                      className={`w-full text-left p-6 rounded-[28px] border-2 transition-all group ${selectedVaultId === h.id ? 'bg-sky-50 border-sky-200' : 'bg-white border-transparent hover:bg-slate-50'}`}
                    >
                       <p className="text-[11px] font-black uppercase italic text-slate-900 leading-none mb-2">{h.periodStart} → {h.periodEnd}</p>
                       <div className="flex justify-between items-center opacity-60">
                          <span className="text-[8px] font-bold uppercase tracking-widest">DISB: ₱{h.totalDisbursement.toLocaleString()}</span>
                          <i className="fas fa-chevron-right text-[8px] group-hover:translate-x-1 transition-transform"></i>
                       </div>
                    </button>
                 ))}
                 {payrollHistory.length === 0 && <p className="text-center py-20 text-[9px] font-black text-slate-300 uppercase tracking-widest">No historical snapshots</p>}
              </div>
           </div>

           <div className="lg:col-span-3 bg-white rounded-[48px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
              {selectedVault ? (
                 <>
                    <div className="p-8 border-b border-slate-50 bg-slate-50/10 flex justify-between items-center shrink-0">
                       <div>
                          <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Manifest Snapshot</h2>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Authenticated Archive ID: {selectedVault.id}</p>
                       </div>
                       <div className="flex gap-3">
                          <button onClick={triggerHistoryFullPrint} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl"><i className="fas fa-print mr-2"></i> Reprint Report</button>
                          {isAdmin && (
                            <button 
                              onClick={() => setIsVaultEditMode(!isVaultEditMode)} 
                              className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${isVaultEditMode ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-600'}`}
                            >
                               {isVaultEditMode ? 'Discard Changes' : 'Modify Record'}
                            </button>
                          )}
                       </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                       <table className="w-full text-left border-collapse min-w-[1200px]">
                          <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                             <tr>
                                <th className="px-8 py-5">Personnel</th>
                                <th className="px-4 py-5 text-center">Days</th>
                                <th className="px-4 py-5 text-center">Base</th>
                                <th className="px-4 py-5 text-center">OT</th>
                                <th className="px-4 py-5 text-center text-sky-600">Incent</th>
                                <th className="px-4 py-5 text-center text-amber-600">Loans</th>
                                <th className="px-4 py-5 text-center text-rose-600">Vale</th>
                                <th className="px-4 py-5 text-center text-rose-800">Tardiness</th>
                                <th className="px-8 py-5 text-right bg-slate-900 text-white">Net Total</th>
                                <th className="px-4 py-5 text-center">Actions</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {selectedVault.payrollData.map((d, idx) => (
                                <tr key={d.employeeId} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="px-8 py-5 font-black uppercase italic text-[11px] text-slate-800">{d.name}</td>
                                   <td className="px-4 py-5 text-center font-bold text-slate-500">
                                      {isVaultEditMode ? <input type="number" step="0.01" className="w-16 bg-slate-100 p-1 rounded font-black text-center" value={d.days} onChange={e => {
                                         const val = parseFloat(e.target.value) || 0;
                                         const updated = [...selectedVault.payrollData];
                                         updated[idx] = { ...updated[idx], days: val };
                                         setPayrollHistory(payrollHistory.map(h => h.id === selectedVault.id ? { ...selectedVault, payrollData: updated } : h));
                                      }} /> : d.days.toFixed(2)}
                                   </td>
                                   <td className="px-4 py-5 text-center font-black italic text-slate-900">₱{(d.gross || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                   <td className="px-4 py-5 text-center text-emerald-600 font-bold">₱{(d.ot || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                   <td className="px-4 py-5 text-center text-sky-600 font-bold">
                                      {isVaultEditMode ? <input type="number" className="w-20 bg-slate-100 p-1 rounded font-black text-center" value={d.incentive || 0} onChange={e => {
                                         const val = parseFloat(e.target.value) || 0;
                                         const updated = [...selectedVault.payrollData];
                                         updated[idx] = { ...updated[idx], incentive: val, net: (d.gross||0) + (d.ot||0) + val - (d.vale||0) - (d.loan||0) - (d.sss||0) - (d.late||0) - (d.undertime||0) };
                                         setPayrollHistory(payrollHistory.map(h => h.id === selectedVault.id ? { ...selectedVault, payrollData: updated } : h));
                                      }} /> : `₱${(d.incentive || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}
                                   </td>
                                   <td className="px-4 py-5 text-center text-amber-600 font-bold">₱{((d.loan || 0) + (d.sss || 0)).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                   <td className="px-4 py-5 text-center text-rose-600 font-bold">₱{(d.vale || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                   <td className="px-4 py-5 text-center text-rose-800 font-bold">₱{((d.late || 0) + (d.undertime || 0)).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                   <td className="px-8 py-5 text-right font-black italic text-[16px] text-slate-900 bg-slate-50 tracking-tighter">₱{(d.net || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                                   <td className="px-4 py-5 text-center">
                                      <button onClick={() => triggerHistorySinglePrint(d.employeeId)} className="text-sky-500 hover:text-sky-700 transition-colors p-2" title="Reprint Payslip"><i className="fas fa-print"></i></button>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                    {isVaultEditMode && (
                      <div className="p-8 border-t bg-slate-50 flex justify-end">
                         <button onClick={handleSaveVaultEdit} className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-emerald-500 active:scale-95 transition-all">Authorize Snapshot Update</button>
                      </div>
                    )}
                 </>
              ) : (
                 <div className="flex-1 flex flex-col items-center justify-center opacity-10 py-32"><i className="fas fa-shield-alt text-[100px] mb-8"></i><p className="text-xl font-black uppercase tracking-[0.4em]">Select Vault Entry</p></div>
              )}
           </div>
        </div>
      )}

      {isFinanceModalOpen && (
         <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[6000] p-4 no-print" onClick={() => { setIsFinanceModalOpen(false); setFinanceAmount(0); }}>
            <div className="bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-md border-4 border-white animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
               <div className="text-center mb-10">
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4 ${financeType === 'LOAN' ? 'bg-amber-100 text-amber-600' : financeType === 'SSS' ? 'bg-purple-100 text-purple-600' : 'bg-sky-100 text-sky-600'}`}>
                    <i className={`fas ${financeType === 'LOAN' ? 'fa-hand-holding-usd' : financeType === 'SSS' ? 'fa-shield-alt' : 'fa-wallet'}`}></i>
                  </div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Add {financeType} Credit</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Personnel Disbursement Ledger</p>
               </div>
               <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Disbursement Amount (₱)</label>
                    <input autoFocus type="number" value={financeAmount || ''} onChange={e => setFinanceAmount(parseFloat(e.target.value) || 0)} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[28px] text-center text-2xl font-black italic shadow-inner outline-none focus:border-sky-500" placeholder="0.00" />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button onClick={() => { setIsFinanceModalOpen(false); setFinanceAmount(0); }} className="flex-1 py-5 text-slate-400 font-black uppercase text-[10px] tracking-widest">Discard</button>
                    <button onClick={handleUpdateFinance} className="flex-[2] py-5 bg-slate-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-[24px] shadow-xl hover:bg-slate-800 transition-all">Authorize Credit</button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[5000] p-4 text-slate-900 no-print" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white p-12 rounded-[56px] shadow-2xl w-full max-w-4xl border-4 border-white animate-in zoom-in duration-300 max-h-[95vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-10 flex flex-col items-center"><h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{editingEmployeeId ? 'Modify Profile' : 'Enroll Personnel'}</h3><p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mt-2">Enterprise Identity Configuration</p></div>
            <div className="space-y-10">
              <div className="space-y-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Personnel Legal Name</label><input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} className="w-full p-6 bg-white border-2 border-slate-100 rounded-[28px] outline-none font-black text-slate-900 uppercase italic shadow-sm" /></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Account Position</label><select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full p-6 bg-slate-50 border-none rounded-[28px] outline-none font-black text-slate-900 italic shadow-inner"><option value={EmployeeType.STAFF}>OFFICE STAFF</option><option value={EmployeeType.RIDER}>DELIVERY RIDER</option></select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Daily Salary Rate (₱)</label><input type="number" value={formData.salary || ''} onChange={e => setFormData({...formData, salary: parseFloat(e.target.value) || 0})} className="w-full p-6 bg-slate-50 border-none rounded-[28px] outline-none font-black text-slate-900 shadow-inner" placeholder="0.00" /></div>
                </div>
                <div className="space-y-2"><label className="text-[10px] font-black text-sky-600 uppercase tracking-widest ml-2">Security Access PIN (4-Digits)</label><input type="password" maxLength={4} value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} className="w-full p-6 bg-white border-2 border-sky-100 rounded-[28px] outline-none font-black text-sky-600 tracking-[0.8em] text-center text-2xl shadow-sm" placeholder="XXXX" /></div>
              </div>

              <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                <h4 className="text-[10px] font-black text-sky-600 uppercase tracking-widest border-b border-sky-100 pb-2">Multi-Node Registry Authorization</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {stores.map(store => (
                    <label key={store.id} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 cursor-pointer hover:border-sky-300 transition-all group">
                       <input 
                         type="checkbox" 
                         checked={formData.assignedStoreIds.includes(store.id)} 
                         onChange={(e) => {
                           const nextIds = e.target.checked 
                             ? [...formData.assignedStoreIds, store.id]
                             : formData.assignedStoreIds.filter(id => id !== store.id);
                           setFormData({...formData, assignedStoreIds: nextIds});
                         }}
                         className="w-5 h-5 rounded border-slate-200 text-sky-600 focus:ring-sky-500"
                       />
                       <div className="flex flex-col leading-none">
                          <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-sky-600">{store.name}</span>
                          <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">{store.code}</span>
                       </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                <div className="flex justify-between items-center border-b border-amber-100 pb-2">
                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Salary Loan Repayment Protocol</h4>
                    <div className="flex items-center gap-3">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Running Balance:</label>
                        <input type="number" value={formData.loanBalance} onChange={e => setFormData({...formData, loanBalance: Number(e.target.value) || 0})} className="w-24 p-2 bg-white border border-amber-200 rounded-lg outline-none font-black text-slate-900 text-xs" />
                    </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fixed Deduction Amount (Per Cycle)</label>
                  <input type="number" value={formData.loanWeeklyDeduction} onChange={e => setFormData({...formData, loanWeeklyDeduction: Number(e.target.value) || 0})} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none font-black text-slate-900 shadow-sm" placeholder="₱ 0.00" />
                </div>
              </div>

              <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                <div className="flex justify-between items-center border-b border-purple-100 pb-2">
                    <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest">SSS Loan Repayment Protocol</h4>
                    <div className="flex items-center gap-3">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Running Balance:</label>
                        <input type="number" value={formData.sssLoanBalance} onChange={e => setFormData({...formData, sssLoanBalance: Number(e.target.value) || 0})} className="w-24 p-2 bg-white border border-purple-200 rounded-lg outline-none font-black text-slate-900 text-xs" />
                    </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fixed Deduction Amount (Per Cycle)</label>
                  <input type="number" value={formData.sssLoanWeeklyDeduction} onChange={e => setFormData({...formData, sssLoanWeeklyDeduction: Number(e.target.value) || 0})} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none font-black text-slate-900 shadow-sm" placeholder="₱ 0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Shift Start</label><input type="time" value={formData.shiftStart} onChange={e => setFormData({...formData, shiftStart: e.target.value})} className="w-full p-6 bg-slate-50 border-none rounded-[28px] outline-none font-black text-slate-900 shadow-inner" /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Shift End</label><input type="time" value={formData.shiftEnd} onChange={e => setFormData({...formData, shiftEnd: e.target.value})} className="w-full p-6 bg-slate-50 border-none rounded-[28px] outline-none font-black text-slate-900 shadow-inner" /></div></div>
              <div className="flex gap-4 pt-10 border-t border-slate-50"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-6 text-slate-400 font-black uppercase text-[11px] tracking-widest">Discard</button><button type="button" onClick={handleSaveEmployee} className="flex-[2] py-6 bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-[32px] shadow-2xl transition-all active:scale-95">Confirm Profile Sync</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRManagement;