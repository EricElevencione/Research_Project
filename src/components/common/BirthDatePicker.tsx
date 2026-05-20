import React, { useState, useRef, useEffect, useCallback } from "react";
import "./BirthDatePicker.css";

interface BirthDatePickerProps {
  value: string; // "YYYY-MM-DD" format
  onChange: (value: string) => void;
  hasError?: boolean;
  minYear?: number;
  maxYear?: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const getDaysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (year: number, month: number): number =>
  new Date(year, month, 1).getDay();

type ViewMode = "calendar" | "months" | "years";

const BirthDatePicker: React.FC<BirthDatePickerProps> = ({
  value,
  onChange,
  hasError = false,
  minYear = 1920,
  maxYear,
}) => {
  const currentYear = new Date().getFullYear();
  const effectiveMaxYear = maxYear ?? currentYear;
  const today = new Date();

  const parsedDate = value ? new Date(value + "T00:00:00") : null;
  const selectedYear = parsedDate ? parsedDate.getFullYear() : null;
  const selectedMonth = parsedDate ? parsedDate.getMonth() : null;
  const selectedDay = parsedDate ? parsedDate.getDate() : null;

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear ?? currentYear - 30);
  const [viewMonth, setViewMonth] = useState(selectedMonth ?? 0);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [yearRangeStart, setYearRangeStart] = useState(
    Math.floor((selectedYear ?? currentYear - 30) / 20) * 20,
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setViewMode("calendar");
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Sync view to selected date when opening
  useEffect(() => {
    if (isOpen) {
      if (selectedYear !== null && selectedMonth !== null) {
        setViewYear(selectedYear);
        setViewMonth(selectedMonth);
        setYearRangeStart(Math.floor(selectedYear / 20) * 20);
      }
      setViewMode("calendar");
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDayClick = useCallback(
    (day: number) => {
      const mm = String(viewMonth + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      onChange(`${viewYear}-${mm}-${dd}`);
      setIsOpen(false);
    },
    [viewYear, viewMonth, onChange],
  );

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      if (viewYear > minYear) { setViewYear(viewYear - 1); setViewMonth(11); }
    } else { setViewMonth(viewMonth - 1); }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      if (viewYear < effectiveMaxYear) { setViewYear(viewYear + 1); setViewMonth(0); }
    } else { setViewMonth(viewMonth + 1); }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  // Calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const isFutureDay = (day: number) => {
    const check = new Date(viewYear, viewMonth, day);
    return check > today;
  };

  const isSelected = (day: number) =>
    selectedYear === viewYear && selectedMonth === viewMonth && selectedDay === day;

  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();

  // Display text
  const displayValue = parsedDate
    ? `${MONTH_SHORT[parsedDate.getMonth()]} ${parsedDate.getDate()}, ${parsedDate.getFullYear()}`
    : "";

  // Year grid for year picker
  const yearGrid: number[] = [];
  for (let y = yearRangeStart; y < yearRangeStart + 20 && y <= effectiveMaxYear; y++) {
    if (y >= minYear) yearGrid.push(y);
  }

  return (
    <div className="jo-bdp" ref={containerRef}>
      {/* ── Trigger ── */}
      <div
        className={`jo-bdp-trigger${hasError ? " jo-bdp-error" : ""}${isOpen ? " jo-bdp-open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="jo-bdp-trigger-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <span className={`jo-bdp-text${!displayValue ? " jo-bdp-placeholder" : ""}`}>
          {displayValue || "Select date of birth"}
        </span>
        {value && (
          <button className="jo-bdp-clear-btn" onClick={handleClear} title="Clear">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
        <div className="jo-bdp-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* ── Dropdown ── */}
      {isOpen && (
        <div className="jo-bdp-dropdown">
          {/* Header */}
          <div className="jo-bdp-header">
            <button
              className="jo-bdp-arrow"
              onClick={() => {
                if (viewMode === "calendar") handlePrevMonth();
                else if (viewMode === "years") setYearRangeStart(Math.max(minYear, yearRangeStart - 20));
              }}
              disabled={viewMode === "months"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            <button
              className="jo-bdp-header-title"
              onClick={() => {
                if (viewMode === "calendar") setViewMode("months");
                else if (viewMode === "months") {
                  setYearRangeStart(Math.floor(viewYear / 20) * 20);
                  setViewMode("years");
                }
                else setViewMode("calendar");
              }}
            >
              {viewMode === "calendar" && (
                <span>{MONTH_NAMES[viewMonth]} {viewYear}</span>
              )}
              {viewMode === "months" && <span>{viewYear}</span>}
              {viewMode === "years" && (
                <span>{yearRangeStart} – {Math.min(yearRangeStart + 19, effectiveMaxYear)}</span>
              )}
              <svg className="jo-bdp-header-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            <button
              className="jo-bdp-arrow"
              onClick={() => {
                if (viewMode === "calendar") handleNextMonth();
                else if (viewMode === "years") setYearRangeStart(Math.min(effectiveMaxYear - 19, yearRangeStart + 20));
              }}
              disabled={viewMode === "months"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          {/* ── Calendar View ── */}
          {viewMode === "calendar" && (
            <>
              <div className="jo-bdp-weekdays">
                {DAY_LABELS.map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="jo-bdp-days">
                {calendarDays.map((day, idx) =>
                  day === null ? (
                    <span key={`e-${idx}`} className="jo-bdp-day-empty" />
                  ) : (
                    <button
                      key={day}
                      disabled={isFutureDay(day)}
                      className={[
                        "jo-bdp-day",
                        isSelected(day) && "jo-bdp-day--selected",
                        isToday(day) && !isSelected(day) && "jo-bdp-day--today",
                        isFutureDay(day) && "jo-bdp-day--disabled",
                      ].filter(Boolean).join(" ")}
                      onClick={() => !isFutureDay(day) && handleDayClick(day)}
                    >
                      {day}
                    </button>
                  ),
                )}
              </div>
            </>
          )}

          {/* ── Month Picker View ── */}
          {viewMode === "months" && (
            <div className="jo-bdp-months-grid">
              {MONTH_SHORT.map((m, idx) => (
                <button
                  key={m}
                  className={`jo-bdp-month-cell${viewMonth === idx ? " jo-bdp-month--active" : ""}`}
                  onClick={() => { setViewMonth(idx); setViewMode("calendar"); }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* ── Year Picker View ── */}
          {viewMode === "years" && (
            <div className="jo-bdp-years-grid">
              {yearGrid.map((y) => (
                <button
                  key={y}
                  className={`jo-bdp-year-cell${viewYear === y ? " jo-bdp-year--active" : ""}${y > currentYear ? " jo-bdp-year--disabled" : ""}`}
                  disabled={y > currentYear}
                  onClick={() => { setViewYear(y); setViewMode("months"); }}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* ── Footer ── */}
          <div className="jo-bdp-footer">
            <button
              className="jo-bdp-footer-btn"
              onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setViewMode("calendar"); }}
            >
              Today
            </button>
            {value && (
              <button className="jo-bdp-footer-btn jo-bdp-footer-clear" onClick={handleClear}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BirthDatePicker;
