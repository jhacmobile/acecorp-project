import React, { useState, useRef, useEffect, useMemo } from 'react';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, label = "Date", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Helper to get current PH date parts
  const getPHParts = (date: Date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(date);
    return {
      month: parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1,
      day: parseInt(parts.find(p => p.type === 'day')?.value || '1'),
      year: parseInt(parts.find(p => p.type === 'year')?.value || '2024')
    };
  };

  // Initialize view state based on existing value or current PH time
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const ph = getPHParts();
    return new Date(ph.year, ph.month, 1);
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);
    
    return days;
  }, [viewDate]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    // Format to YYYY-MM-DD in PH context
    const y = viewDate.getFullYear();
    const m = (viewDate.getMonth() + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ph = getPHParts();
    const formatted = `${ph.year}-${(ph.month + 1).toString().padStart(2, '0')}-${ph.day.toString().padStart(2, '0')}`;
    onChange(formatted);
    setViewDate(new Date(ph.year, ph.month, 1));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const parts = value.split('-');
    return parseInt(parts[2]) === day && (parseInt(parts[1]) - 1) === viewDate.getMonth() && parseInt(parts[0]) === viewDate.getFullYear();
  };

  const isToday = (day: number) => {
    const ph = getPHParts();
    return ph.day === day && ph.month === viewDate.getMonth() && ph.year === viewDate.getFullYear();
  };

  const formattedLabel = useMemo(() => {
    if (!value) return label;
    try {
      const [y, m, d] = value.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return label;
    }
  }, [value, label]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-5 py-3 bg-white border border-slate-200 rounded-[20px] hover:border-sky-400 transition-all shadow-sm outline-none"
      >
        <div className="flex items-center gap-3">
          <i className="far fa-calendar text-slate-400 text-sm"></i>
          <span className="text-[13px] font-bold text-slate-700">
            {formattedLabel}
          </span>
        </div>
        <i className={`fas fa-chevron-down text-[10px] text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[280px] bg-white border border-slate-200 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[1000] p-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-5 px-1">
            <div className="flex items-center gap-1.5 cursor-default">
              <span className="text-[15px] font-black text-slate-900">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <i className="fas fa-caret-down text-[10px] text-slate-900"></i>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handlePrevMonth} className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-all">
                <i className="fas fa-arrow-up text-[11px]"></i>
              </button>
              <button type="button" onClick={handleNextMonth} className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-all">
                <i className="fas fa-arrow-down text-[11px]"></i>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <div key={d} className="text-center text-[11px] font-black text-slate-800 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarData.map((day, idx) => (
              <div key={idx} className="aspect-square flex items-center justify-center">
                {day !== null ? (
                  <button
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl text-[12px] font-bold transition-all
                      ${isSelected(day) ? 'bg-sky-600 text-white font-black shadow-lg shadow-sky-100' : 
                        isToday(day) ? 'text-sky-600 font-black ring-1 ring-sky-200' : 
                        (idx % 7 === 0 || idx % 7 === 6) ? 'text-slate-300' : 'text-slate-700 hover:bg-slate-100'}
                    `}
                  >
                    {day}
                  </button>
                ) : <div className="w-9 h-9"></div>}
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center px-1">
            <button 
              type="button"
              onClick={handleClear} 
              className="text-[13px] font-black text-sky-600 hover:text-sky-700 transition-colors"
            >
              Clear
            </button>
            <button 
              type="button"
              onClick={handleToday} 
              className="text-[13px] font-black text-sky-600 hover:text-sky-700 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;