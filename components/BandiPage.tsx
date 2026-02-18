import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employee, AttendanceRecord, User } from '../types';

interface BandiPageProps {
  user: User;
  employees: Employee[];
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  onSync: (at: AttendanceRecord[]) => Promise<boolean>;
}

const BandiPage: React.FC<BandiPageProps> = ({ employees, attendance, setAttendance, onSync }) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitor PIN input to auto-select employee
  useEffect(() => {
    if (pinInput.length === 4) {
      const matched = employees.find(e => e.pin === pinInput);
      if (matched) {
        setSelectedEmployeeId(matched.id);
        setStatusMsg(null);
      } else {
        setStatusMsg({ type: 'error', text: 'INVALID SECURITY PIN' });
        setTimeout(() => {
          setPinInput('');
          setStatusMsg(null);
          setSelectedEmployeeId('');
        }, 2000);
      }
    }
  }, [pinInput, employees]);

  const handlePinChange = (index: number, val: string) => {
    const newVal = val.slice(-1).replace(/\D/g, '');
    if (!newVal && val !== '') return;
    
    const nextPin = pinInput.split('');
    nextPin[index] = newVal;
    const finalPin = nextPin.join('');
    setPinInput(finalPin);

    // Auto-focus next
    if (newVal && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinInput[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const getPHDate = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  };

  const getPHTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  };

  const today = getPHDate();
  const timeStr = getPHTime(currentTime);

  const selectedEmployee = useMemo(() => 
    employees.find(e => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId]
  );

  const todayRecord = useMemo(() => 
    attendance.find(a => String(a.employeeId) === String(selectedEmployeeId) && a.date === today),
    [attendance, selectedEmployeeId, today]
  );

  const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const handleTimeIn = async () => {
    if (!selectedEmployee) return;
    setIsProcessing(true);

    const shiftStart = selectedEmployee.shiftStart || '08:00';
    const minutesIn = timeToMinutes(timeStr);
    const minutesShift = timeToMinutes(shiftStart);
    
    const lateMinutes = Math.max(0, minutesIn - minutesShift);

    const newRecord: AttendanceRecord = {
      id: `ATT-${Date.now()}`,
      employeeId: selectedEmployee.id,
      date: today,
      timeIn: timeStr,
      timeOut: '',
      lateMinutes,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      isHalfDay: false,
      status: 'REGULAR'
    };

    const nextAttendance = [...attendance, newRecord];
    setAttendance(nextAttendance);
    const success = await onSync(nextAttendance);
    
    if (success) {
      setStatusMsg({ type: 'success', text: `PROTOCOL SUCCESS: TIME-IN LOGGED FOR ${selectedEmployee.name}` });
      setTimeout(() => {
        setStatusMsg(null);
        setPinInput('');
        setSelectedEmployeeId('');
      }, 5000);
    } else {
      setStatusMsg({ type: 'error', text: 'SYNC FAILURE: TERMINAL SIGNAL NOT RECORDED' });
    }
    setIsProcessing(false);
  };

  const handleTimeOut = async () => {
    if (!selectedEmployee || !todayRecord) return;
    setIsProcessing(true);

    const shiftStart = selectedEmployee.shiftStart || '08:00';
    const shiftEnd = selectedEmployee.shiftEnd || '17:00';
    
    const minutesIn = timeToMinutes(todayRecord.timeIn);
    const minutesOut = timeToMinutes(timeStr);
    const minutesShiftStart = timeToMinutes(shiftStart);
    const minutesShiftEnd = timeToMinutes(shiftEnd);
    
    const workedMinutes = Math.max(0, minutesOut - minutesIn);
    
    const isHalfDay = workedMinutes >= 240 && workedMinutes <= 300;
    
    let finalLate = 0;
    let finalUT = 0;
    let finalOT = 0;

    if (isHalfDay) {
      finalLate = 0;
      finalUT = 0;
    } else {
      finalLate = Math.max(0, minutesIn - minutesShiftStart);
      finalUT = Math.max(0, minutesShiftEnd - minutesOut);
      finalOT = Math.max(0, minutesOut - minutesShiftEnd);
    }

    const updatedRecord: AttendanceRecord = {
      ...todayRecord,
      timeOut: timeStr,
      overtimeMinutes: finalOT,
      undertimeMinutes: finalUT,
      lateMinutes: finalLate,
      isHalfDay,
      status: 'REGULAR'
    };

    const nextAttendance = attendance.map(a => a.id === todayRecord.id ? updatedRecord : a);
    setAttendance(nextAttendance);
    const success = await onSync(nextAttendance);

    if (success) {
      setStatusMsg({ type: 'success', text: `PROTOCOL SUCCESS: TIME-OUT LOGGED FOR ${selectedEmployee.name}` });
      setTimeout(() => {
        setStatusMsg(null);
        setPinInput('');
        setSelectedEmployeeId('');
      }, 5000);
    } else {
      setStatusMsg({ type: 'error', text: 'SYNC FAILURE: TERMINAL SIGNAL NOT RECORDED' });
    }
    setIsProcessing(false);
  };

  const resetEntry = () => {
    setPinInput('');
    setSelectedEmployeeId('');
    setStatusMsg(null);
    setTimeout(() => pinRefs.current[0]?.focus(), 100);
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-12 md:p-16 font-sans overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      
      <div className="w-full max-w-4xl lg:max-w-5xl flex flex-col items-center animate-in fade-in zoom-in duration-700 relative z-10 pt-4">
        
        {/* Title Group - Larger Visualization */}
        <div className="text-center mb-8 sm:mb-12">
           <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-2">
              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-sky-600 rounded-2xl flex items-center justify-center shadow-2xl border border-sky-400/30">
                <i className="fas fa-fingerprint text-white text-2xl sm:text-4xl"></i>
              </div>
              <h2 className="text-[36px] sm:text-[56px] md:text-[72px] font-black italic uppercase tracking-tighter text-white leading-none">Bandi Terminal</h2>
           </div>
           <p className="text-sky-500 font-black uppercase tracking-[0.4em] sm:tracking-[0.8em] text-[8px] sm:text-[11px] md:text-[13px]">Enterprise Core Attendance Relay</p>
        </div>

        {/* Main Terminal Card - Substantially Larger */}
        <div className="bg-slate-900/70 backdrop-blur-3xl border border-white/5 p-8 sm:p-12 md:p-20 rounded-[48px] sm:rounded-[64px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.8)] w-full flex flex-col gap-8 sm:gap-12">
           
           {/* Identity Section */}
           <div className="space-y-6">
              <div className="flex justify-between items-end px-4">
                <label className="text-[9px] sm:text-[12px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Verification Protocol</label>
                {pinInput && <button onClick={resetEntry} className="text-[8px] sm:text-[11px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-400 bg-rose-500/10 px-4 py-1.5 rounded-full border border-rose-500/20 transition-all">Clear Signal</button>}
              </div>
              
              {/* PIN INPUT GRID - Scaled for high visibility */}
              <div className="flex justify-center gap-4 sm:gap-6">
                 {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      // Added curly braces to ref callback to ensure it returns void and fix TS error
                      ref={el => { pinRefs.current[i] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={pinInput[i] || ''}
                      onChange={e => handlePinChange(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      className="w-16 h-24 sm:w-20 sm:h-32 md:w-24 md:h-40 bg-slate-950/40 border-2 border-slate-800 rounded-[18px] sm:rounded-[28px] text-center text-4xl sm:text-6xl font-black text-white focus:border-sky-500 focus:bg-slate-950 focus:ring-4 focus:ring-sky-50/10 outline-none transition-all shadow-inner"
                      autoFocus={i === 0}
                    />
                 ))}
              </div>

              {/* Manual Registry - Larger Select UI */}
              <div className="relative group">
                <select 
                  value={selectedEmployeeId}
                  onChange={e => { setSelectedEmployeeId(e.target.value); setStatusMsg(null); }}
                  className="w-full bg-slate-950/20 text-slate-400 py-5 sm:py-7 px-10 rounded-[24px] sm:rounded-[36px] text-sm sm:text-xl font-black italic uppercase outline-none focus:ring-4 focus:ring-sky-500/10 transition-all border border-white/5 shadow-inner appearance-none cursor-pointer text-center"
                >
                  <option value="">MANUAL IDENTITY LOOKUP</option>
                  {employees.sort((a,b) => a.name.localeCompare(b.name)).map(e => (
                    <option key={e.id} value={e.id} className="bg-slate-900 text-white">{e.name}</option>
                  ))}
                </select>
                <div className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-600 text-[10px] sm:text-[14px] pointer-events-none group-hover:text-sky-500 transition-colors"><i className="fas fa-chevron-down"></i></div>
              </div>
           </div>

           {/* Action Protocol Grid - Dynamic Idle/Action Switch */}
           <div className="min-h-[160px] sm:min-h-[280px] md:min-h-[380px]">
             {selectedEmployee ? (
               <div className="grid grid-cols-2 gap-6 sm:gap-10 h-full animate-in zoom-in duration-500">
                  <button 
                    disabled={!!todayRecord?.timeIn || isProcessing}
                    onClick={handleTimeIn}
                    className={`h-full rounded-[36px] sm:rounded-[48px] flex flex-col items-center justify-center gap-4 sm:gap-8 transition-all active:scale-95 shadow-2xl relative overflow-hidden group
                      ${!!todayRecord?.timeIn ? 'bg-slate-800/40 text-slate-700 grayscale cursor-not-allowed opacity-50' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'}
                    `}
                  >
                    <i className="fas fa-sign-in-alt text-4xl sm:text-6xl md:text-8xl"></i>
                    <span className="text-sm sm:text-2xl md:text-3xl font-black uppercase tracking-[0.2em] italic">Time In</span>
                    {!!todayRecord?.timeIn && (
                      <div className="absolute top-4 right-6 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-[8px] sm:text-[12px] font-black uppercase border border-emerald-500/30">
                        {todayRecord.timeIn}
                      </div>
                    )}
                  </button>
                  <button 
                    disabled={!todayRecord?.timeIn || !!todayRecord?.timeOut || isProcessing}
                    onClick={handleTimeOut}
                    className={`h-full rounded-[36px] sm:rounded-[48px] flex flex-col items-center justify-center gap-4 sm:gap-8 transition-all active:scale-95 shadow-2xl relative overflow-hidden group
                      ${(!todayRecord?.timeIn || !!todayRecord?.timeOut) ? 'bg-slate-800/40 text-slate-700 grayscale cursor-not-allowed opacity-50' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'}
                    `}
                  >
                    <i className="fas fa-sign-out-alt text-4xl sm:text-6xl md:text-8xl"></i>
                    <span className="text-sm sm:text-2xl md:text-3xl font-black uppercase tracking-[0.2em] italic">Time Out</span>
                    {!!todayRecord?.timeOut && (
                      <div className="absolute top-4 right-6 bg-rose-50/10 text-rose-400 px-3 py-1.5 rounded-xl text-[8px] sm:text-[12px] font-black uppercase border border-rose-500/20">
                        {todayRecord.timeOut}
                      </div>
                    )}
                  </button>
               </div>
             ) : (
               <div className="h-full rounded-[36px] sm:rounded-[48px] border-4 border-dashed border-slate-800/40 flex flex-col items-center justify-center gap-4 sm:gap-6 group bg-slate-950/20 transition-all animate-in fade-in duration-500">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[12px] sm:text-[16px] md:text-[20px] font-black text-slate-500 uppercase tracking-[0.5em] mb-4 italic">
                      {currentTime.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long' }).toUpperCase()}
                    </span>
                    <span className="text-5xl sm:text-8xl md:text-[120px] font-mono font-bold text-white tracking-tighter tabular-nums leading-none">
                      {currentTime.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-[10px] sm:text-[14px] md:text-[18px] font-black text-sky-500 uppercase tracking-[0.8em] mt-6">
                      {currentTime.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
                    </span>
                  </div>
               </div>
             )}
           </div>

           {/* Feedback Messaging - Large Notifications */}
           {statusMsg && (
             <div className={`py-6 sm:py-8 px-10 rounded-[24px] sm:rounded-[40px] text-center font-black uppercase tracking-widest text-[12px] sm:text-[18px] md:text-[22px] animate-in slide-in-from-bottom-4 duration-500 border-2 ${statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                <i className={`fas ${statusMsg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-4`}></i>
                {statusMsg.text}
             </div>
           )}
        </div>

        {/* Dynamic Atomic Clock & Registry Info - Forced Philippine Time (Asia/Manila) - Scaled Footer */}
        <div className="w-full flex justify-between items-end mt-10 sm:mt-16 px-6 sm:px-12 border-t border-white/5 pt-8 opacity-40">
           <div className="flex flex-col">
              <span className="text-[9px] sm:text-[12px] md:text-[14px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1 italic">Synchronized Relay (PH)</span>
              <span className="text-3xl sm:text-5xl md:text-6xl font-mono font-bold text-sky-500 tracking-tighter tabular-nums leading-none">
                {currentTime.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-[9px] sm:text-[12px] md:text-[14px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1 italic">Calendar Lock</span>
              <span className="text-lg sm:text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                {currentTime.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' }).toUpperCase()}
              </span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BandiPage;