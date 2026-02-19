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
    address: string;
    loanBalance: number;
    loanWeeklyDeduction: number;
    sssLoanBalance: number;
    sssLoanWeeklyDeduction: number;
  }>({ 
    name: '', type: EmployeeType.STAFF, salary: 0, assignedStoreIds: [], 
    shiftStart: '07:00', shiftEnd: '19:00', pin: '', address: '',
    loanBalance: 0, loanWeeklyDeduction: 0,
    sssLoanBalance: 0, sssLoanWeeklyDeduction: 0
  });

  // Attendance Page State
  const [overrideDate, setOverrideDate] = useState(getPHDateISO());
  const [overrideEmployeeId, setOverrideEmployeeId] = useState('');
  const [overrideStoreId, setOverrideStoreId] = useState(user.selectedStoreId);
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
        setPayrollManualAdjustments(draft.adjustments);
      } else {
        setPayrollManualAdjustments({});
      }
    }
  }, [payrollStart, payrollEnd, user.selectedStoreId, payrollDrafts, view]);

  // Auto-fill form when selecting employee or date to allow adding new entries or editing existing ones
  useEffect(() => {
    if (overrideEmployeeId && overrideDate) {
      const existing = attendance.find(a => String(a.employeeId) === String(overrideEmployeeId) && a.date === overrideDate);
      if (existing) {
        setOverrideStatus(existing.status);
        setOverrideTimeIn(existing.timeIn || '');
        setOverrideTimeOut(existing.timeOut || '');
      } else {
        // Reset to defaults if no record exists (Add Mode)
        setOverrideStatus('REGULAR');
        setOverrideTimeIn('');
        setOverrideTimeOut('');
      }
    }
  }, [overrideEmployeeId, overrideDate, attendance]);

  const [printTarget, setPrintTarget] = useState<{ type: 'SINGLE' | 'ALL'; empId?: string } | null>(null);
  
  const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const calculateRow = (emp: Employee) => {
    const adj = payrollManualAdjustments[emp.id] || { loanPayment: null, sssPayment: null, overtime: {}, incentive: '0' };
    const weekRecords = attendance.filter(a => String(a.employeeId) === String(emp.id) && weekDates.includes(a.date));
    const schedMins = timeToMinutes(emp.shiftEnd) - timeToMinutes(emp.shiftStart);
    const totalSchedHours = schedMins / 60;
    const denom = Math.max(0, totalSchedHours - 1);
    const hourly = denom > 0 ? Number((emp.salary / denom).toFixed(2)) : 0;
    
    const halfThreshold = (schedMins / 2) + (schedMins < 720 ? 30 : 0);

    let presentDays = 0;
    let totalLate = 0;
    let totalUT = 0;

    weekDates.forEach(date => {
      const rec = weekRecords.find(r => r.date === date);
      const status = rec?.status || (rec ? 'REGULAR' : 'ABSENT');
      if (status !== 'ABSENT') {
        const win = rec?.timeIn ? timeToMinutes(rec.timeIn) : 0;
        const wout = rec?.timeOut ? timeToMinutes(rec.timeOut) : 0;
        const worked = (win && wout) ? (wout - win) : 0;
        
        const isHalf = worked >= halfThreshold && worked < (schedMins * 0.8);
        
        if (isHalf) presentDays += 0.5;
        else {
          presentDays += 1;
          if (status === 'REGULAR') {
            if (rec?.timeIn) totalLate += Math.max(0, win - timeToMinutes(emp.shiftStart));
            if (rec?.timeOut) totalUT += Math.max(0, timeToMinutes(emp.shiftEnd) - wout);
          }
        }
      }
    });

    const basePay = presentDays * emp.salary;
    const lateDed = Number(((totalLate / 60) * hourly).toFixed(2));
    const utDed = Number(((totalUT / 60) * hourly).toFixed(2));
    let otHours = 0;
    Object.values(adj.overtime).forEach(h => { otHours += parseFloat(h as string) || 0; });
    const otPay = Number((otHours * hourly).toFixed(2));
    const incentive = parseFloat(adj.incentive) || 0;
    const vale = Number(emp.valeBalance) || 0;
    const loan = adj.loanPayment !== null ? (parseFloat(adj.loanPayment) || 0) : Math.min(Number(emp.loanWeeklyDeduction), Number(emp.loanBalance));
    const sss = adj.sssPayment !== null ? (parseFloat(adj.sssPayment) || 0) : Math.min(Number(emp.sssLoanWeeklyDeduction), Number(emp.sssLoanBalance));

    const totalDed = vale + loan + sss + lateDed + utDed;
    const net = Number((basePay + otPay + incentive - totalDed).toFixed(2));

    return { 
      days: presentDays, basePay, otPay, incentivePay: incentive, 
      valePay: vale, loanPay: loan, sssPay: sss, totalDeductions: totalDed, net, 
      weekRecords, manuals: adj, hourlyRate: hourly, lateDeduction: lateDed, utDeduction: utDed,
      totalLateMinutes: totalLate, totalUTMinutes: totalUT, otTotalHours: otHours
    };
  };

  const handlePayrollUpdate = (empId: string, field: 'loanPayment' | 'sssPayment' | 'overtime' | 'incentive', value: string, date?: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const calc = calculateRow(emp);
    const earnedPot = calc.basePay + calc.otPay + calc.incentivePay;
    
    if (field === 'loanPayment' || field === 'sssPayment') {
       const deductionVal = parseFloat(value) || 0;
       const otherDeduction = field === 'loanPayment' ? calc.sssPay : calc.loanPay;
       const runningTotalDeductions = deductionVal + otherDeduction + calc.valePay + calc.lateDeduction + calc.utDeduction;
       if (runningTotalDeductions > earnedPot) {
          alert(`VALIDATION FAILURE: Total deductions cannot exceed current earned income.`);
          return;
       }
    }

    setPayrollManualAdjustments(prev => {
      const current = prev[empId] || { loanPayment: null, sssPayment: null, overtime: {}, incentive: '0' };
      if (field === 'overtime' && date) {
        return { ...prev, [empId]: { ...current, overtime: { ...current.overtime, [date]: value } } };
      }
      return { ...prev, [empId]: { ...current, [field]: value === '' ? (field === 'loanPayment' || field === 'sssPayment' ? null : '0') : value } };
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
    if (success) alert("Draft saved to cloud.");
  };

  const handleApplyPayroll = async () => {
    if (!isAdmin) return;
    if (!confirm("Finalize cycle? This will update running balances.")) return;

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
        employeeId: e.id, name: e.name, days: calc.days, hours: 0, rate: e.salary,
        gross: calc.basePay, ot: calc.otPay, incentive: calc.incentivePay, vale: calc.valePay,
        late: calc.lateDeduction, undertime: calc.utDeduction, loan: calc.loanPay, sss: calc.sssPay, net: calc.net
      };
    });

    const newRecord: PayrollHistoryRecord = {
      id: `PH-${Date.now()}`, periodStart: payrollStart, periodEnd: payrollEnd,
      generatedAt: new Date().toISOString(), generatedBy: user.username,
      totalDisbursement: Number(payrollTotals.net.toFixed(2)), payrollData
    };

    const nextHistory = [newRecord, ...payrollHistory];
    setEmployees(nextEmployees);
    setPayrollHistory(nextHistory);
    setPayrollManualAdjustments({});
    await onSync(nextEmployees, undefined, nextHistory);
    alert("Payroll finalized.");
  };

  const handleAuthorizeAttendanceOverride = async () => {
    if (!overrideEmployeeId || !overrideDate) return;
    const emp = employees.find(e => e.id === overrideEmployeeId);
    if (!emp) return;

    let lateMinutes = 0;
    let undertimeMinutes = 0;
    let isHalfDay = false;

    const totalScheduled = timeToMinutes(emp.shiftEnd) - timeToMinutes(emp.shiftStart);
    const halfDayThreshold = (totalScheduled / 2) + (totalScheduled < 720 ? 30 : 0);

    if (overrideStatus === 'REGULAR') {
      const actualIn = overrideTimeIn ? timeToMinutes(overrideTimeIn) : timeToMinutes(emp.shiftStart);
      const actualOut = overrideTimeOut ? timeToMinutes(overrideTimeOut) : timeToMinutes(emp.shiftEnd);
      const workedMinutes = Math.max(0, actualOut - actualIn);
      
      isHalfDay = workedMinutes >= halfDayThreshold && workedMinutes < (totalScheduled * 0.8);
      
      if (isHalfDay) {
        lateMinutes = 0; undertimeMinutes = 0;
      } else {
        lateMinutes = overrideTimeIn ? Math.max(0, actualIn - timeToMinutes(emp.shiftStart)) : 0;
        undertimeMinutes = overrideTimeOut ? Math.max(0, timeToMinutes(emp.shiftEnd) - actualOut) : 0;
      }
    }

    const existingIdx = attendance.findIndex(a => String(a.employeeId) === String(overrideEmployeeId) && a.date === overrideDate);
    const newRec: AttendanceRecord = {
      id: existingIdx > -1 ? attendance[existingIdx].id : `ATT-${Date.now()}`,
      employeeId: overrideEmployeeId, 
      storeId: overrideStoreId,
      date: overrideDate, 
      timeIn: overrideTimeIn, 
      timeOut: overrideTimeOut,
      lateMinutes, undertimeMinutes, overtimeMinutes: 0, isHalfDay, status: overrideStatus
    };

    let nextAttendance = [...attendance];
    if (existingIdx > -1) nextAttendance[existingIdx] = newRec;
    else nextAttendance.push(newRec);

    setAttendance(nextAttendance);
    await onSync(undefined, nextAttendance);
    setOverrideEmployeeId(''); setOverrideTimeIn(''); setOverrideTimeOut('');
    alert("Attendance record synchronized.");
  };

  const handleEditAttendance = (a: AttendanceRecord) => {
    setOverrideDate(a.date); setOverrideEmployeeId(a.employeeId); setOverrideStoreId(a.storeId || user.selectedStoreId);
    setOverrideStatus(a.status); setOverrideTimeIn(a.timeIn || ''); setOverrideTimeOut(a.timeOut || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredAttendanceAudit = useMemo(() => {
    return attendance.filter(a => {
      const matchesPersonnel = auditPersonnelFilter === 'ALL' || String(a.employeeId) === auditPersonnelFilter;
      const matchesWindow = a.date >= auditStart && a.date <= auditEnd;
      return matchesPersonnel && matchesWindow;
    }).sort((a,b) => auditSortOrder === 'ASC' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  }, [attendance, auditPersonnelFilter, auditStart, auditEnd, auditSortOrder]);

  const filteredEmployees = useMemo(() => 
    employees.filter(e => {
      const isAuth = user.assignedStoreIds.includes('all') || e.assignedStoreIds?.includes(user.selectedStoreId);
      const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.employeeNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      return isAuth && matchesSearch;
    }), [employees, user.selectedStoreId, user.assignedStoreIds, searchQuery]
  );

  const weekDates = useMemo(() => {
    const dates = [];
    const [sy, sm, sd] = payrollStart.split('-').map(Number);
    const [ey, em, ed] = payrollEnd.split('-').map(Number);
    const curr = new Date(sy, sm - 1, sd, 12, 0, 0);
    const end = new Date(ey, em - 1, ed, 12, 0, 0);
    let count = 0;
    while (curr <= end && count < 31) {
      dates.push(getPHDateISO(curr));
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return dates;
  }, [payrollStart, payrollEnd]);

  const updateDayStatus = async (empId: string, date: string, status: AttendanceStatus) => {
    const existing = attendance.find(a => String(a.employeeId) === String(empId) && a.date === date);
    let next: AttendanceRecord[] = [];
    if (existing) next = attendance.map(a => a.id === existing.id ? { ...a, status } : a);
    else next = [...attendance, { id: `ATT-${Date.now()}`, employeeId: empId, storeId: user.selectedStoreId, date, timeIn: '', timeOut: '', lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, isHalfDay: false, status }];
    setAttendance(next);
    await onSync(undefined, next);
  };

  const triggerFullReportPrint = () => { window.print(); };

  const handleUpdateFinance = async () => {
    if (!financeEmpId || financeAmount <= 0) return;
    const nextEmployees = employees.map(e => {
      if (e.id === financeEmpId) {
        const next = { ...e };
        if (financeType === 'LOAN') next.loanBalance = (Number(next.loanBalance) || 0) + financeAmount;
        if (financeType === 'VALE') next.valeBalance = (Number(next.valeBalance) || 0) + financeAmount;
        if (financeType === 'SSS') next.sssLoanBalance = (Number(next.sssLoanBalance) || 0) + financeAmount;
        return next;
      }
      return e;
    });
    setEmployees(nextEmployees);
    setIsFinanceModalOpen(false);
    setFinanceAmount(0);
    await onSync(nextEmployees);
  };

  const handleSaveEmployee = async () => {
    if (!formData.name) return alert("Personnel name required.");
    const isNew = !editingEmployeeId;
    const employeeId = editingEmployeeId || `EMP-${Date.now()}`;
    const existing = employees.find(e => e.id === editingEmployeeId);

    const newEmp: Employee = {
      id: employeeId,
      name: formData.name,
      type: formData.type,
      salary: formData.salary,
      assignedStoreIds: formData.assignedStoreIds,
      shiftStart: formData.shiftStart,
      shiftEnd: formData.shiftEnd,
      pin: formData.pin,
      address: formData.address,
      employeeNumber: existing?.employeeNumber || `AC-${Math.floor(1000 + Math.random() * 9000)}`,
      loanBalance: formData.loanBalance,
      loanWeeklyDeduction: formData.loanWeeklyDeduction,
      sssLoanBalance: formData.sssLoanBalance,
      sssLoanWeeklyDeduction: formData.sssLoanWeeklyDeduction,
      valeBalance: existing?.valeBalance || 0,
      loanTerms: existing?.loanTerms || '0',
      loans: existing?.loans || { salary: 0, sss: 0, vale: 0 },
      loanBalances: existing?.loanBalances || { salary: 0, sss: 0, vale: 0 }
    };

    let nextEmployees: Employee[];
    if (isNew) nextEmployees = [newEmp, ...employees];
    else nextEmployees = employees.map(e => e.id === employeeId ? newEmp : e);

    setEmployees(nextEmployees);
    setIsModalOpen(false);
    await onSync(nextEmployees);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("PERMANENT REVOCATION: Purge this personnel record from the enterprise database? This action is irreversible.")) return;
    const next = employees.filter(e => e.id !== id);
    setEmployees(next);
    await onSync(next);
  };

  const payrollTotals = useMemo(() => {
    return filteredEmployees.reduce((acc, e) => {
      const calc = calculateRow(e);
      acc.days += calc.days; acc.basePay += calc.basePay; acc.ot += calc.otPay; acc.incentive += calc.incentivePay;
      acc.loan += calc.loanPay; acc.sss += calc.sssPay; acc.vale += calc.valePay; acc.late += calc.lateDeduction; acc.undertime += calc.utDeduction; acc.net += calc.net; return acc;
    }, { days: 0, basePay: 0, ot: 0, incentive: 0, loan: 0, sss: 0, vale: 0, late: 0, undertime: 0, net: 0 });
  }, [filteredEmployees, attendance, payrollStart, payrollEnd, payrollManualAdjustments]);

  return (
    <div className="space-y-10 font-sans text-slate-900 h-full overflow-y-auto custom-scrollbar p-6 md:p-12 relative bg-[#f8fafc]">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #report-printable-area, #report-printable-area * { visibility: visible !important; display: block !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {view === 'personnel' && (
        <div className="bg-white rounded-[64px] shadow-sm border border-slate-100 overflow-hidden mb-12 animate-in fade-in no-print">
          <div className="p-12 border-b border-slate-50 flex flex-col gap-10 bg-white">
            <div className="flex justify-between items-center">
              <div><h3 className="font-black text-slate-900 uppercase tracking-tighter italic text-4xl">Workforce Ledger</h3><p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Enterprise Consolidated Database</p></div>
              <button onClick={() => { setEditingEmployeeId(null); setFormData({ name: '', type: EmployeeType.STAFF, salary: 0, assignedStoreIds: [user.selectedStoreId], shiftStart: '07:00', shiftEnd: '19:00', pin: '', address: '', loanBalance: 0, loanWeeklyDeduction: 0, sssLoanBalance: 0, sssLoanWeeklyDeduction: 0 }); setIsModalOpen(true); }} className="bg-[#2d89c8] text-white px-12 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-widest hover:bg-sky-700 shadow-2xl transition-all active:scale-95">+ Enroll Personnel</button>
            </div>
            <div className="relative max-w-2xl">
              <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="SEARCH PERSONNEL REGISTRY..." className="w-full pl-14 pr-12 py-5 bg-[#f8fafc] border-none rounded-[28px] text-[12px] font-black uppercase tracking-widest shadow-inner outline-none focus:ring-4 focus:ring-sky-50 transition-all text-slate-900" />
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-[#f8fafc] text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] border-b border-slate-100">
                <tr>
                  <th className="px-12 py-8">Operator Profile</th>
                  <th className="px-10 py-8">Protocol / Shift</th>
                  <th className="px-10 py-8">Authorization</th>
                  <th className="px-10 py-8">Running Balances</th>
                  <th className="px-12 py-8 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEmployees.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition group">
                    <td className="px-12 py-8"><div className="flex items-center space-x-6"><div className="w-16 h-16 rounded-[24px] bg-[#dbeafe] flex items-center justify-center text-sky-600 font-black uppercase italic border border-sky-100 text-2xl">{e.name[0]}</div><div><p className="font-black text-slate-900 uppercase text-[15px] italic leading-none mb-1">{e.name}</p><p className="text-[11px] font-black text-slate-400 font-mono tracking-tighter uppercase">{e.employeeNumber}</p></div></div></td>
                    <td className="px-10 py-8"><p className="text-[11px] font-black uppercase italic text-slate-800 mb-1">{e.type === EmployeeType.RIDER ? 'RIDER' : 'STAFF'}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{e.shiftStart} - {e.shiftEnd}</p></td>
                    <td className="px-10 py-8"><div className="flex flex-wrap gap-1.5">{e.assignedStoreIds?.includes('all') ? <span className="text-[8px] font-black px-2 py-1 bg-slate-900 text-white rounded-md">GLOBAL</span> : e.assignedStoreIds?.map(sid => <span key={sid} className="text-[8px] font-black px-2 py-1 bg-slate-100 text-slate-500 rounded-md border border-slate-200">{stores.find(s=>String(s.id)===String(sid))?.code || sid}</span>)}</div></td>
                    <td className="px-10 py-8">
                       <div className="space-y-1">
                          <div className="flex items-center gap-4"><span className="text-[9px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 w-[40px] text-center">LOAN</span><span className="text-[13px] font-black text-slate-900">₱{Number(e.loanBalance).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                          <div className="flex items-center gap-4"><span className="text-[9px] font-black text-sky-500 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 w-[40px] text-center">VALE</span><span className="text-[13px] font-black text-slate-900">₱{Number(e.valeBalance).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                          <div className="flex items-center gap-4"><span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 w-[40px] text-center">SSS</span><span className="text-[13px] font-black text-slate-900">₱{Number(e.sssLoanBalance).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
                       </div>
                    </td>
                    <td className="px-12 py-8">
                       <div className="flex justify-center gap-2 transition-all">
                          <button onClick={() => { setFinanceEmpId(e.id); setFinanceType('LOAN'); setIsFinanceModalOpen(true); }} className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 shadow-sm transition-all" title="Add Salary Loan"><i className="fas fa-hand-holding-usd text-xs"></i></button>
                          <button onClick={() => { setFinanceEmpId(e.id); setFinanceType('VALE'); setIsFinanceModalOpen(true); }} className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-100 shadow-sm transition-all" title="Add Vale Advance"><i className="fas fa-wallet text-xs"></i></button>
                          <button onClick={() => { setFinanceEmpId(e.id); setFinanceType('SSS'); setIsFinanceModalOpen(true); }} className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 shadow-sm transition-all" title="Add SSS Loan"><i className="fas fa-shield-alt text-xs"></i></button>
                          <button onClick={() => { setEditingEmployeeId(e.id); setFormData({ name: e.name, type: e.type, salary: e.salary, assignedStoreIds: e.assignedStoreIds||[], shiftStart: e.shiftStart||'07:00', shiftEnd: e.shiftEnd||'19:00', pin: e.pin||'', address: e.address||'', loanBalance: Number(e.loanBalance), loanWeeklyDeduction: Number(e.loanWeeklyDeduction), sssLoanBalance: Number(e.sssLoanBalance), sssLoanWeeklyDeduction: Number(e.sssLoanWeeklyDeduction) }); setIsModalOpen(true); }} className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 shadow-sm transition-all" title="Edit Profile"><i className="fas fa-user-edit text-xs"></i></button>
                          <button onClick={() => handleDeleteEmployee(e.id)} className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 shadow-sm transition-all" title="Delete Personnel"><i className="fas fa-trash text-xs"></i></button>
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 animate-in fade-in no-print">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 space-y-10">
              <div><h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Override Protocol</h3><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">Manual Signal Entry</p></div>
              <div className="space-y-8">
                <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Reporting Date</label><CustomDatePicker value={overrideDate} onChange={setOverrideDate} className="w-full" /></div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Personnel Profile</label>
                  <select value={overrideEmployeeId} onChange={e => setOverrideEmployeeId(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl text-[11px] font-black uppercase outline-none focus:border-sky-500">
                    <option value="" disabled>SELECT PERSONNEL</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Signal In</label>
                    <input type="time" value={overrideTimeIn} onChange={e => setOverrideTimeIn(e.target.value)} className="w-full h-14 px-1 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none text-slate-900 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all text-center" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Signal Out</label>
                    <input type="time" value={overrideTimeOut} onChange={e => setOverrideTimeOut(e.target.value)} className="w-full h-14 px-1 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none text-slate-900 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all text-center" />
                  </div>
                </div>
                <button onClick={handleAuthorizeAttendanceOverride} className="w-full py-6 bg-slate-950 text-white rounded-[32px] font-black uppercase text-[12px] tracking-widest shadow-2xl active:scale-95 transition-all">Authorize Entry</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 bg-white rounded-[56px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-[#fcfdfe]"><h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Shift Audit Trail</h2><div className="flex items-center gap-6"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter Window:</label><CustomDatePicker value={auditStart} onChange={setAuditStart} className="w-40" /><span className="text-slate-300 text-xs">→</span><CustomDatePicker value={auditEnd} onChange={setAuditEnd} className="w-40" /></div></div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100"><tr><th className="px-10 py-6">Personnel</th><th className="px-10 py-6">Date / Node</th><th className="px-10 py-6 text-center">Protocol Loop</th><th className="px-10 py-6 text-center">Status Mirror</th><th className="px-10 py-6 text-right">Control</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredAttendanceAudit.map(a => {
                    const emp = employees.find(e => e.id === a.employeeId);
                    const store = stores.find(s => String(s.id) === String(a.storeId));
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition group">
                        <td className="px-10 py-6 font-black uppercase italic text-slate-800 text-[12px]">{emp?.name}</td>
                        <td className="px-10 py-6 font-mono text-[11px] text-slate-400"><div>{a.date}</div><div className="text-[8px] font-black text-sky-500 uppercase">{store?.name}</div></td>
                        <td className="px-10 py-6 text-center"><div className="flex items-center justify-center gap-5"><span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 font-black text-[11px] shadow-sm">{a.timeIn}</span><i className="fas fa-arrow-right text-[9px] text-slate-200"></i><span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 font-black text-[11px] shadow-sm">{a.timeOut || '--:--'}</span></div></td>
                        <td className="px-10 py-6 text-center"><div className="flex flex-col gap-1.5 items-center">{a.isHalfDay && <span className="text-[9px] font-black px-3 py-1 rounded-lg bg-amber-500 text-white uppercase shadow-sm">HALF DAY</span>}{a.lateMinutes > 0 && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest border border-rose-100 px-2 py-0.5 rounded">{a.lateMinutes}m LATE</span>}{a.undertimeMinutes > 0 && <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest border border-amber-100 px-2 py-0.5 rounded">{a.undertimeMinutes}m UT</span>}{!a.isHalfDay && a.lateMinutes === 0 && a.undertimeMinutes === 0 && <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">CLEAN_SHIFT</span>}</div></td>
                        <td className="px-10 py-6 text-right"><button onClick={() => handleEditAttendance(a)} className="text-[10px] font-black text-sky-500 hover:text-sky-700 uppercase tracking-widest">Edit</button></td>
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
        <div className="bg-white rounded-[64px] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in no-print">
          <div className="p-12 md:p-16 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-12 bg-white">
             <div><h2 className="text-5xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mb-3">WEEKLY TIMESHEET AUDIT</h2><p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em]">FIXED-DAY REGISTRY (STRICT ATTENDANCE MAPPING)</p></div>
             <div className="flex items-center gap-10">
                <div className="flex items-center gap-6">
                   <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CYCLE START</label><CustomDatePicker value={payrollStart} onChange={setPayrollStart} className="w-44" /></div>
                   <div className="pt-5"><i className="fas fa-arrow-right text-slate-200"></i></div>
                   <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CYCLE END</label><CustomDatePicker value={payrollEnd} onChange={setPayrollEnd} className="w-44" /></div>
                </div>
                <div className="flex gap-4">
                   <button onClick={handleSaveDraft} className="bg-amber-50 text-[#d97706] px-10 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-amber-100 transition-all">SAVE DRAFT</button>
                   <button onClick={triggerFullReportPrint} className="bg-slate-50 text-slate-500 px-10 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-100 transition-all">AUDIT REPORT</button>
                   <button onClick={handleApplyPayroll} className="bg-[#0f172a] text-white px-12 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">FINALIZE CYCLE</button>
                </div>
             </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-center min-w-[1900px]">
               <thead className="bg-[#f8fafc] text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th rowSpan={2} className="px-10 py-8 text-left min-w-[240px]">PERSONNEL PROFILE</th>
                    <th colSpan={weekDates.length} className="border-l border-slate-100 py-4 text-[11px]">WEEKLY REGISTRY HUB (STATUS / PUNCHES / OT)</th>
                    <th rowSpan={2} className="px-4 border-l border-slate-100 min-w-[100px]">DAYS</th>
                    <th rowSpan={2} className="px-4 border-l border-slate-100 min-w-[150px]">GROSS PAY</th>
                    <th rowSpan={2} className="px-4 border-l border-slate-100 min-w-[120px] text-emerald-600">OT (HOURS)</th>
                    <th rowSpan={2} className="px-4 border-l border-slate-100 min-w-[120px] text-sky-600">INCENTIVES</th>
                    <th colSpan={5} className="border-l border-slate-100 py-4 text-rose-700 bg-rose-50/30">DEDUCTIONS HUB (TARDINESS & REPAYMENTS)</th>
                    <th rowSpan={2} className="px-10 border-l border-slate-100 min-w-[200px] bg-[#111827] text-white italic text-xs">GRAND TOTAL</th>
                  </tr>
                  <tr>
                    {weekDates.map(d => (<th key={d} className="w-28 py-4 border-l border-slate-200/50"><div>{new Date(d).toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</div><div className="text-[8px] text-slate-400 font-bold mt-1">{new Date(d).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit'})}</div></th>))}
                    <th className="px-4 py-4 border-l border-slate-100 text-amber-600">LOAN</th>
                    <th className="px-4 py-4 border-l border-slate-100 text-blue-600">SSS</th>
                    <th className="px-4 py-4 border-l border-slate-100 text-rose-600">VALE</th>
                    <th className="px-4 py-4 border-l border-slate-100 text-rose-800">LATE</th>
                    <th className="px-4 py-4 border-l border-slate-100 text-rose-900">UT</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map(e => {
                     const calc = calculateRow(e);
                     return (
                        <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-10 py-8 text-left border-r border-slate-50"><p className="text-[15px] font-black uppercase italic tracking-tighter text-slate-800">{e.name}</p></td>
                           {weekDates.map((date, idx) => {
                              const rec = calc.weekRecords.find(r => r.date === date);
                              const status = rec?.status || (rec ? 'REGULAR' : 'ABSENT');
                              return (
                                <td key={idx} className={`p-3 border-l border-slate-100 ${status === 'ABSENT' ? 'opacity-20' : ''}`}>
                                   <div className="flex flex-col items-center gap-2 relative">
                                      <div className="relative">
                                         {/* Updated text size from text-[9px] to text-[8px] as requested */}
                                         <select value={status} onChange={(ev) => updateDayStatus(e.id, date, ev.target.value as any)} className="appearance-none w-full text-[8px] font-black uppercase border-none bg-transparent text-center cursor-pointer outline-none hover:text-sky-600">
                                            <option value="REGULAR">REGULAR</option><option value="ABSENT">ABSENT</option><option value="OB">OB</option><option value="PTO">PTO</option>
                                         </select>
                                         <i className="fas fa-chevron-down absolute -right-3 top-1/2 -translate-y-1/2 text-[7px] opacity-20"></i>
                                      </div>
                                      <div className="h-6 flex items-center justify-center">
                                         {rec?.lateMinutes > 0 && !rec.isHalfDay && <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center shadow-sm" title="Late Arrival">L</span>}
                                         {rec?.undertimeMinutes > 0 && !rec.isHalfDay && <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm" title="Undertime Departure">U</span>}
                                         {rec?.isHalfDay && <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm" title="Half-Day Protocol">H</span>}
                                      </div>
                                      {status === 'REGULAR' && rec?.timeIn && (
                                        <div className="text-[9px] font-mono leading-tight py-1 font-bold">
                                          <div className="text-emerald-500">{rec.timeIn}</div>
                                          <div className="text-rose-500">{rec.timeOut || '--:--'}</div>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1 mt-1"><span className="text-[8px] font-black text-slate-300">OT:</span><input type="number" step="0.5" value={calc.manuals.overtime[date] || '0'} onChange={ev => handlePayrollUpdate(e.id, 'overtime', ev.target.value, date)} className="w-6 bg-transparent text-center text-[10px] font-black text-emerald-600 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                                   </div>
                                </td>
                              );
                           })}
                           <td className="border-l border-slate-100 font-black text-slate-900 italic text-[16px]">{calc.days.toFixed(2)}</td>
                           <td className="border-l border-slate-100 font-black text-slate-900 italic text-[16px]">₱{calc.basePay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                           <td className="border-l border-slate-100 p-3 text-emerald-600 font-black text-[16px]"><div>{calc.otTotalHours.toFixed(1)}</div><div className="text-[8px] text-slate-400 font-bold mt-1 tracking-widest">₱{calc.otPay.toLocaleString()}</div></td>
                           <td className="border-l border-slate-100 p-3 text-sky-600 font-black text-[16px]"><input type="number" value={calc.manuals.incentive} onChange={ev => handlePayrollUpdate(e.id, 'incentive', ev.target.value)} className="w-full text-center bg-transparent outline-none" /><div className="text-[8px] text-slate-400 font-bold mt-1 tracking-widest uppercase">INCENTIVES</div></td>
                           <td className="border-l border-slate-100 p-3"><input type="number" value={calc.manuals.loanPayment !== null ? calc.manuals.loanPayment : calc.loanPay} onChange={ev => handlePayrollUpdate(e.id, 'loanPayment', ev.target.value)} className="w-full text-center text-[14px] font-black text-slate-800 bg-transparent outline-none" /><div className="text-[8px] text-slate-400 font-bold mt-1 tracking-widest">BAL: {e.loanBalance.toLocaleString()}</div></td>
                           <td className="border-l border-slate-100 p-3"><input type="number" value={calc.manuals.sssPayment !== null ? calc.manuals.sssPayment : calc.sssPay} onChange={ev => handlePayrollUpdate(e.id, 'sssPayment', ev.target.value)} className="w-full text-center text-[14px] font-black text-slate-800 bg-transparent outline-none" /><div className="text-[8px] text-slate-400 font-bold mt-1 tracking-widest">BAL: {e.sssLoanBalance.toLocaleString()}</div></td>
                           <td className="border-l border-slate-100 p-3 bg-rose-50/5"><p className="text-[14px] font-black text-rose-700 italic">₱{calc.valePay.toLocaleString()}</p><div className="text-[8px] text-rose-300 font-black tracking-widest mt-1">CASH</div></td>
                           <td className="border-l border-slate-100 p-3 bg-rose-100/5"><p className="text-[13px] font-black text-rose-800 italic">₱{calc.lateDeduction.toLocaleString()}</p><div className="text-[8px] text-rose-400 font-black tracking-widest mt-1">LATE</div></td>
                           {/* Improved UT (Undertime) visibility - Label set to rose-500 and value set to rose-950 as requested */}
                           <td className="border-l border-slate-100 p-3 bg-rose-100/10"><p className="text-[13px] font-black text-rose-950 italic">₱{calc.utDeduction.toLocaleString()}</p><div className="text-[8px] text-rose-500 font-black tracking-widest mt-1">UT</div></td>
                           <td className="border-l border-slate-100 font-black text-slate-900 italic text-[24px] bg-slate-50 tracking-tighter shadow-inner">₱{calc.net.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                        </tr>
                     );
                  })}
               </tbody>
               <tfoot className="bg-[#111827] text-white">
                  <tr className="font-black italic uppercase text-[12px] tracking-[0.2em]">
                     <td className="px-12 py-10 text-left">AGGREGATE TOTALS</td><td colSpan={weekDates.length} className="border-l border-white/5"></td><td className="px-4 border-l border-white/5">{payrollTotals.days.toFixed(2)}</td><td className="px-4 border-l border-white/5 text-sky-400 italic">₱{payrollTotals.basePay.toLocaleString()}</td><td className="px-4 border-l border-white/5 text-emerald-400 italic">₱{payrollTotals.ot.toLocaleString()}</td><td className="px-4 border-l border-white/5 text-sky-300 italic">₱{payrollTotals.incentive.toLocaleString()}</td><td className="px-4 border-l border-white/5 text-amber-400 italic">₱{payrollTotals.loan.toLocaleString()}</td><td className="px-4 border-l border-white/5 text-blue-400 italic">₱{payrollTotals.sss.toLocaleString()}</td><td className="px-4 border-l border-white/5 text-rose-400 italic">₱{payrollTotals.vale.toLocaleString()}</td><td className="px-4 border-l border-white/5 text-rose-200 italic">₱{payrollTotals.late.toLocaleString()}</td><td className="px-4 border-l border-white/5 text-rose-300 italic">₱{payrollTotals.undertime.toLocaleString()}</td><td className="px-12 border-l border-white/10 text-4xl tracking-tighter bg-black italic">₱{payrollTotals.net.toLocaleString()}</td>
                  </tr>
               </tfoot>
            </table>
          </div>
        </div>
      )}

      {isFinanceModalOpen && (
         <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[6000] p-4 no-print" onClick={() => { setIsFinanceModalOpen(false); setFinanceAmount(0); }}>
            <div className="bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-md border-4 border-white animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
               <div className="text-center mb-10"><div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4 ${financeType === 'LOAN' ? 'bg-amber-100 text-amber-600' : financeType === 'VALE' ? 'bg-sky-100 text-sky-600' : 'bg-purple-100 text-purple-600'}`}><i className={`fas ${financeType === 'LOAN' ? 'fa-hand-holding-usd' : financeType === 'VALE' ? 'fa-wallet' : 'fa-shield-alt'}`}></i></div><h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Add {financeType} Credit</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Personnel Disbursement Ledger</p></div>
               <div className="space-y-6"><div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Amount to Add (₱)</label><input autoFocus type="number" value={financeAmount || ''} onChange={e => setFinanceAmount(parseFloat(e.target.value) || 0)} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[28px] text-center text-2xl font-black italic shadow-inner outline-none focus:border-sky-500" placeholder="0.00" /></div><div className="flex gap-4 pt-4"><button onClick={() => { setIsFinanceModalOpen(false); setFinanceAmount(0); }} className="flex-1 py-5 text-slate-400 font-black uppercase text-[10px] tracking-widest">Discard</button><button onClick={handleUpdateFinance} className="flex-[2] py-5 bg-slate-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-[24px] shadow-xl hover:bg-slate-800 transition-all">Authorize Credit</button></div></div>
            </div>
         </div>
      )}
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[5000] p-6 overflow-y-auto" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white p-12 rounded-[56px] shadow-2xl w-full max-w-4xl border-4 border-white my-auto animate-in zoom-in duration-300 relative" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-12">
               <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">MODIFY PROFILE</h3>
               <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mt-2">Enterprise Identity Configuration</p>
            </div>
            
            <div className="space-y-10">
               {/* Identity */}
               <div className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Personnel Legal Name</label>
                     <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} className="w-full p-6 bg-white border border-slate-100 rounded-[20px] text-[16px] font-black italic outline-none shadow-sm text-slate-900" placeholder="BOY RIDER" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Position</label>
                        <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full p-6 bg-[#f8fafc] border border-slate-100 rounded-[20px] text-[14px] font-black italic uppercase outline-none shadow-sm">
                           <option value={EmployeeType.STAFF}>GIRL CASHIER</option>
                           <option value={EmployeeType.RIDER}>DELIVERY RIDER</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Daily Salary Rate (₱)</label>
                        <input type="number" value={formData.salary || ''} onChange={e => setFormData({...formData, salary: parseFloat(e.target.value) || 0})} className="w-full p-6 bg-[#f8fafc] border border-slate-100 rounded-[20px] text-[16px] font-black italic outline-none shadow-sm" placeholder="700" />
                     </div>
                  </div>
               </div>

               {/* PIN Security */}
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-sky-600 uppercase tracking-widest ml-1">Security Access PIN (4-Digits)</label>
                  <div className="w-full p-6 bg-white border border-sky-100 rounded-[20px] flex justify-center items-center gap-4">
                     {[0,1,2,3].map(i => (
                        <div key={i} className={`w-3 h-3 rounded-full ${formData.pin.length > i ? 'bg-sky-500' : 'bg-slate-200'}`}></div>
                     ))}
                     <input maxLength={4} value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g,'')})} className="absolute opacity-0 w-24 h-10 cursor-pointer" />
                  </div>
               </div>

               {/* Auth Grid */}
               <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-sky-600 uppercase tracking-[0.2em] border-b border-sky-50 pb-2">Multi-Node Registry Authorization</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {stores.map(s => {
                        const isChecked = formData.assignedStoreIds.includes(s.id);
                        return (
                           <button key={s.id} onClick={() => {
                              const next = isChecked ? formData.assignedStoreIds.filter(id => id !== s.id) : [...formData.assignedStoreIds, s.id];
                              setFormData({...formData, assignedStoreIds: next});
                           }} className={`flex items-center gap-4 p-5 rounded-[20px] border-2 transition-all ${isChecked ? 'bg-white border-sky-500 shadow-lg' : 'bg-[#f8fafc] border-transparent opacity-60'}`}>
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isChecked ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300'}`}>
                                 {isChecked && <i className="fas fa-check text-[10px]"></i>}
                              </div>
                              <div className="text-left">
                                 <p className="text-[10px] font-black uppercase italic leading-none mb-1 text-slate-800">{s.name}</p>
                                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{s.code}</p>
                              </div>
                           </button>
                        );
                     })}
                  </div>
               </div>

               {/* Financial Protocols */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="p-8 bg-[#fffbeb] rounded-[32px] border border-amber-100/50 space-y-6">
                     <div className="flex justify-between items-baseline">
                        <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest">Salary Loan Repayment Protocol</h4>
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase">TOTAL RUNNING BALANCE: <span className="text-[14px] text-slate-900 bg-white px-3 py-1 rounded-lg border border-amber-200">{(formData.loanBalance || 0)}</span></div>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fixed Deduction Amount (Per Cycle)</label>
                        <input type="number" value={formData.loanWeeklyDeduction || ''} onChange={e => setFormData({...formData, loanWeeklyDeduction: parseFloat(e.target.value) || 0})} className="w-full p-5 bg-white border border-amber-100 rounded-2xl font-black text-[18px] outline-none shadow-sm" placeholder="500" />
                     </div>
                  </div>
                  <div className="p-8 bg-[#f5f3ff] rounded-[32px] border border-blue-100/50 space-y-6">
                     <div className="flex justify-between items-baseline">
                        <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-widest">SSS Loan Repayment Protocol</h4>
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase">TOTAL RUNNING BALANCE: <span className="text-[14px] text-slate-900 bg-white px-3 py-1 rounded-lg border border-blue-200">{(formData.sssLoanBalance || 0)}</span></div>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fixed Deduction Amount (Per Cycle)</label>
                        <input type="number" value={formData.sssLoanWeeklyDeduction || ''} onChange={e => setFormData({...formData, sssLoanWeeklyDeduction: parseFloat(e.target.value) || 0})} className="w-full p-5 bg-white border border-blue-100 rounded-2xl font-black text-[18px] outline-none shadow-sm" placeholder="500" />
                     </div>
                  </div>
               </div>

               {/* Shift */}
               <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Shift Start</label>
                     <div className="relative group">
                        <input type="time" value={formData.shiftStart} onChange={e => setFormData({...formData, shiftStart: e.target.value})} className="w-full p-6 bg-[#f8fafc] border border-slate-100 rounded-[24px] text-[18px] font-black outline-none shadow-sm transition-all focus:border-sky-500" />
                        <i className="far fa-clock absolute right-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Shift End</label>
                     <div className="relative group">
                        <input type="time" value={formData.shiftEnd} onChange={e => setFormData({...formData, shiftEnd: e.target.value})} className="w-full p-6 bg-[#f8fafc] border border-slate-100 rounded-[24px] text-[18px] font-black outline-none shadow-sm transition-all focus:border-sky-500" />
                        <i className="far fa-clock absolute right-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex justify-between items-center mt-16 px-4">
               <button onClick={() => setIsModalOpen(false)} className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">DISCARD</button>
               <button onClick={handleSaveEmployee} className="px-20 py-6 bg-[#111827] text-white rounded-[24px] font-black uppercase text-[12px] tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">CONFIRM PROFILE SYNC</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRManagement;