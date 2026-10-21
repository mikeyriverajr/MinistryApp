import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, TimeEntry, incrementPendingBackupChanges } from '../db/database';
import { useLanguage } from '../contexts/LanguageContext';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
  Clock,
  BookOpen,
  Plus,
  Minus,
  History,
  Save,
  Trash2,
  Share2,
  Copy,
  Target,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const HOUR_PRESETS = [0.5, 1, 1.5, 2, 3, 4];
const PRESET_GOALS = [0, 15, 30, 50, 100];

export default function ReportView() {
  const { t, language } = useLanguage();
  const locale = language === 'es' ? es : enUS;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewedMonthDate, setViewedMonthDate] = useState<Date>(() => startOfMonth(new Date()));
  const [hoursInputStr, setHoursInputStr] = useState<string>('2');
  const [isCredit, setIsCredit] = useState(false);
  const [creditType, setCreditType] = useState('Betel');
  const [entryNote, setEntryNote] = useState('');

  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const saved = Number(localStorage.getItem('monthlyHourGoal') || '0');
    return isNaN(saved) ? 0 : saved;
  });

  const [isEditingCustomGoal, setIsEditingCustomGoal] = useState<boolean>(() => {
    const saved = Number(localStorage.getItem('monthlyHourGoal') || '0');
    return saved > 0 && !PRESET_GOALS.includes(saved);
  });

  const [customGoalInput, setCustomGoalInput] = useState<string>(() => {
    const saved = Number(localStorage.getItem('monthlyHourGoal') || '0');
    return saved > 0 && !PRESET_GOALS.includes(saved) ? String(saved) : '';
  });

  const parsedHoursValue = useMemo(() => {
    const num = parseFloat(hoursInputStr);
    return isNaN(num) || num < 0 ? 0 : num;
  }, [hoursInputStr]);

  const setHoursNumeric = (val: number) => {
    const clean = Math.max(0.5, Number(val.toFixed(2)));
    setHoursInputStr(String(clean));
  };

  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const timeEntries = useLiveQuery(() => db.timeEntries.toArray());
  const monthlyStats = useLiveQuery(() => db.monthlyStats.toArray());
  const visits = useLiveQuery(() => db.visits.toArray());

  const viewedMonthString = format(viewedMonthDate, 'yyyy-MM');
  const currentRealMonthString = format(new Date(), 'yyyy-MM');

  const activeRecurringStudiesCount = useMemo(() => {
    if (!visits) return 0;
    return visits.filter(v => v.isRecurringStudy).length;
  }, [visits]);

  const viewedMonthStats = useMemo(() => {
    const defaultCount = viewedMonthString === currentRealMonthString ? activeRecurringStudiesCount : 0;
    if (!monthlyStats) return { studyCount: defaultCount };
    const found = monthlyStats.find(s => s.month === viewedMonthString);
    return found || { studyCount: defaultCount };
  }, [monthlyStats, viewedMonthString, currentRealMonthString, activeRecurringStudiesCount]);

  // Map every date ("yyyy-MM-dd") to its regular hours, credit hours, and entries
  const dailyTotalsMap = useMemo(() => {
    const map = new Map<string, { regular: number; credit: number; entries: TimeEntry[] }>();
    if (!timeEntries) return map;

    timeEntries.forEach(entry => {
      const key = format(new Date(entry.date), 'yyyy-MM-dd');
      const current = map.get(key) || { regular: 0, credit: 0, entries: [] };
      if (entry.isCredit) {
        current.credit += entry.hours;
      } else {
        current.regular += entry.hours;
      }
      current.entries.push(entry);
      map.set(key, current);
    });

    return map;
  }, [timeEntries]);

  const viewedMonthHours = useMemo(() => {
    if (!timeEntries) return 0;
    return timeEntries
      .filter(e => format(new Date(e.date), 'yyyy-MM') === viewedMonthString && !e.isCredit)
      .reduce((sum, e) => sum + e.hours, 0);
  }, [timeEntries, viewedMonthString]);

  const viewedMonthCreditHours = useMemo(() => {
    if (!timeEntries) return [];
    return timeEntries.filter(e => format(new Date(e.date), 'yyyy-MM') === viewedMonthString && e.isCredit);
  }, [timeEntries, viewedMonthString]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewedMonthDate);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewedMonthDate]);

  const weekDayHeaders = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: endOfWeek(start, { weekStartsOn: 1 }) }).map(d =>
      format(d, 'EEEEEE', { locale })
    );
  }, [locale]);

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayData = dailyTotalsMap.get(selectedDateKey) || { regular: 0, credit: 0, entries: [] };

  const historyEntries = useMemo(() => {
    if (!timeEntries || !monthlyStats) return [];

    const monthsMap = new Map<string, { hours: number, studies: number, creditHours: { hours: number, type: string }[] }>();

    timeEntries.forEach(e => {
      const m = format(new Date(e.date), 'yyyy-MM');
      if (m === currentRealMonthString) return;
      const existing = monthsMap.get(m) || { hours: 0, studies: 0, creditHours: [] };
      if (e.isCredit) {
        existing.creditHours.push({ hours: e.hours, type: e.creditType || 'Otro' });
      } else {
        existing.hours += e.hours;
      }
      monthsMap.set(m, existing);
    });

    monthlyStats.forEach(s => {
      if (s.month === currentRealMonthString) return;
      const existing = monthsMap.get(s.month) || { hours: 0, studies: 0, creditHours: [] };
      existing.studies = s.studyCount;
      monthsMap.set(s.month, existing);
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, data]) => ({ month, ...data }));
  }, [timeEntries, monthlyStats, currentRealMonthString]);

  const handleSaveHours = async () => {
    if (parsedHoursValue <= 0) {
      toast.error(t('invalidHoursError'));
      return;
    }

    try {
      await db.timeEntries.add({
        date: selectedDate,
        hours: parsedHoursValue,
        isCredit,
        creditType: isCredit ? creditType : undefined,
        note: entryNote.trim() || undefined,
      });
      incrementPendingBackupChanges();
      setIsCredit(false);
      setCreditType('Betel');
      setEntryNote('');
      toast.success(t('addHoursSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('saveHoursError'));
    }
  };

  const handleUpdateStudies = async (increment: number) => {
    const newCount = Math.max(0, viewedMonthStats.studyCount + increment);

    try {
      await db.monthlyStats.put({
        month: viewedMonthString,
        studyCount: newCount
      });
      incrementPendingBackupChanges();
    } catch (e) {
      console.error(e);
      toast.error(t('updateError'));
    }
  };

  const handleDeleteEntry = async (id: number) => {
    try {
      await db.timeEntries.delete(id);
      incrementPendingBackupChanges();
      toast.success(t('deleteEntry'));
    } catch (e) {
      console.error(e);
      toast.error(t('deleteError'));
    }
  };

  const handlePresetGoalClick = (goal: number) => {
    setIsEditingCustomGoal(false);
    setMonthlyGoal(goal);
    localStorage.setItem('monthlyHourGoal', String(goal));
  };

  const handleCustomGoalButtonClick = () => {
    setIsEditingCustomGoal(true);
    if (!customGoalInput && monthlyGoal > 0) {
      setCustomGoalInput(String(monthlyGoal));
    }
  };

  const handleApplyCustomGoal = () => {
    const val = Number(customGoalInput);
    if (!isNaN(val) && val > 0) {
      setMonthlyGoal(val);
      localStorage.setItem('monthlyHourGoal', String(val));
    }
  };

  const buildReportText = () => {
    const publisherName = userProfile?.[0]?.name || '';
    const monthLabel = format(viewedMonthDate, 'MMMM yyyy', { locale });
    const title = t('reportShareTitle', { month: monthLabel });

    let lines = [`*${title}*`];
    if (publisherName) lines.push(`${t('yourName')}: ${publisherName}`);
    lines.push(`${t('hours')}: ${viewedMonthHours}`);

    if (viewedMonthCreditHours.length > 0) {
      const creditMap = viewedMonthCreditHours.reduce((acc, curr) => {
        const type = curr.creditType || 'Otro';
        acc[type] = (acc[type] || 0) + curr.hours;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(creditMap).forEach(([type, total]) => {
        const label = type === 'Betel' ? t('betel') : type === 'LDC' ? t('ldc') : t('other');
        lines.push(`${t('creditHours')} (${label}): ${total}`);
      });
    }

    lines.push(`${t('bibleCourses')}: ${viewedMonthStats.studyCount}`);
    return lines.join('\n');
  };

  const handleShareReport = async () => {
    const text = buildReportText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyReport = async () => {
    const text = buildReportText();
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('reportCopied'));
    } catch {
      toast.error(t('updateError'));
    }
  };

  const handlePrevMonth = () => {
    const prev = subMonths(viewedMonthDate, 1);
    setViewedMonthDate(prev);
    setSelectedDate(startOfMonth(prev));
  };

  const handleNextMonth = () => {
    const next = addMonths(viewedMonthDate, 1);
    setViewedMonthDate(next);
    const now = new Date();
    setSelectedDate(isSameMonth(next, now) ? now : startOfMonth(next));
  };

  const handleGoToCurrentMonth = () => {
    const now = new Date();
    setViewedMonthDate(startOfMonth(now));
    setSelectedDate(now);
  };

  const isViewingCurrentMonth = viewedMonthString === currentRealMonthString;
  const isCustomGoalActive = isEditingCustomGoal || (monthlyGoal > 0 && !PRESET_GOALS.includes(monthlyGoal));
  const goalProgressPercent = monthlyGoal > 0 ? Math.min(100, Math.round((viewedMonthHours / monthlyGoal) * 100)) : 0;
  const goalRemainingHours = Math.max(0, Number((monthlyGoal - viewedMonthHours).toFixed(1)));

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto">
      {/* 1. Monthly Summary & Goal Card */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="flex flex-col items-center">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 capitalize text-center">
              {format(viewedMonthDate, 'MMMM yyyy', { locale })}
            </h2>
            {!isViewingCurrentMonth ? (
              <button
                type="button"
                onClick={handleGoToCurrentMonth}
                className="mt-1 text-xs font-semibold text-primary bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
              >
                {t('goToToday')}
              </button>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('currentMonth')}</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Perfectly Aligned KPI Cards (Identical 3-Row Structure) */}
        <div className="grid grid-cols-2 gap-4 items-stretch">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-between">
            <Clock className="text-blue-600 dark:text-blue-400 mb-2" size={26} />
            <div className="h-10 flex items-center justify-center w-full">
              <span className="text-3xl font-bold leading-none text-slate-800 dark:text-slate-100 tabular-nums">
                {viewedMonthHours}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center mt-2">
              {t('totalHours')}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-between">
            <BookOpen className="text-emerald-600 dark:text-emerald-400 mb-2" size={26} />
            <div className="h-10 flex items-center justify-center gap-2.5 w-full">
              <button
                type="button"
                onClick={() => handleUpdateStudies(-1)}
                className="h-8 w-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg shadow-2xs transition-colors shrink-0"
              >
                <Minus size={15} />
              </button>
              <span className="text-3xl font-bold leading-none text-slate-800 dark:text-slate-100 tabular-nums min-w-[1.5ch] text-center">
                {viewedMonthStats.studyCount}
              </span>
              <button
                type="button"
                onClick={() => handleUpdateStudies(1)}
                className="h-8 w-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg shadow-2xs transition-colors shrink-0"
              >
                <Plus size={15} />
              </button>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center mt-2">
              {t('totalBibleStudies')}
            </span>
          </div>
        </div>

        {/* Credit Hours Breakdown (if any) */}
        {viewedMonthCreditHours.length > 0 && (
          <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-1.5">{t('creditHours')}</h4>
            <div className="space-y-1">
              {Object.entries(viewedMonthCreditHours.reduce((acc, curr) => {
                const type = curr.creditType || 'Otro';
                acc[type] = (acc[type] || 0) + curr.hours;
                return acc;
              }, {} as Record<string, number>)).map(([type, total]) => (
                <div key={type} className="flex justify-between text-xs tabular-nums">
                  <span className="text-amber-800 dark:text-amber-300 capitalize">
                    {type === 'Betel' ? t('betel') : type === 'LDC' ? t('ldc') : t('other')}
                  </span>
                  <span className="font-semibold text-amber-950 dark:text-amber-100">{total} h</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly Goal Progress Bar (Off | 15h | 30h | 50h | 100h | Custom) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Target size={15} className="text-primary" />
              {t('monthlyGoal')}
            </span>
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {PRESET_GOALS.map(g => {
                const isSelected = !isCustomGoalActive && monthlyGoal === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handlePresetGoalClick(g)}
                    className={`min-h-[32px] px-2.5 py-0.5 rounded-lg text-xs font-medium transition-colors tabular-nums whitespace-nowrap ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-semibold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {g === 0 ? t('goalOff') : `${g}h`}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleCustomGoalButtonClick}
                className={`min-h-[32px] px-2.5 py-0.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isCustomGoalActive
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t('goalCustom')}
              </button>
            </div>
          </div>

          {isCustomGoalActive && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min="1"
                step="1"
                value={customGoalInput}
                onChange={(e) => {
                  setCustomGoalInput(e.target.value);
                  const val = Number(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    setMonthlyGoal(val);
                    localStorage.setItem('monthlyHourGoal', String(val));
                  }
                }}
                placeholder={t('customGoalPlaceholder')}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary tabular-nums"
              />
              <button
                type="button"
                onClick={handleApplyCustomGoal}
                className="min-h-[34px] px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-dark flex items-center gap-1"
              >
                <Check size={14} />
                <span>{t('save')}</span>
              </button>
            </div>
          )}

          {monthlyGoal > 0 && (
            <div className="space-y-1.5">
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${goalProgressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  {goalRemainingHours > 0
                    ? t('goalRemaining', { hours: String(goalRemainingHours), goal: String(monthlyGoal) })
                    : t('goalReached', { goal: String(monthlyGoal) })}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{goalProgressPercent}%</span>
              </div>
            </div>
          )}
        </div>

        {/* 1-Tap Share / Copy Monthly Report */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleShareReport}
            className="flex-1 min-h-[42px] py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Share2 size={15} className="text-primary" />
            <span>{t('shareMonthlyReport')}</span>
          </button>
          <button
            type="button"
            onClick={handleCopyReport}
            className="min-h-[42px] px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            title={t('copyReport')}
          >
            <Copy size={15} />
            <span>{t('copyReport')}</span>
          </button>
        </div>
      </div>

      {/* 2. Inline Visual Monthly Calendar & Hybrid Hour Logger */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-5">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
            {t('dateOfHours')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('tapDayToLog')}
          </p>
        </div>

        {/* Visual Monthly Calendar Grid */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {weekDayHeaders.map((dayName, idx) => (
              <div
                key={idx}
                className="text-center text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500 py-1"
              >
                {dayName}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayTotals = dailyTotalsMap.get(dateKey);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonthDay = isSameMonth(day, viewedMonthDate);
              const isTodayDate = isSameDay(day, new Date());
              const hasRegular = (dayTotals?.regular || 0) > 0;
              const hasCredit = (dayTotals?.credit || 0) > 0;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day);
                    if (!isSameMonth(day, viewedMonthDate)) {
                      setViewedMonthDate(startOfMonth(day));
                    }
                  }}
                  className={`min-h-[54px] p-1 rounded-xl flex flex-col items-center justify-between transition-all relative tabular-nums ${
                    isSelected
                      ? 'bg-primary text-white shadow-xs ring-2 ring-primary'
                      : isCurrentMonthDay
                      ? hasRegular || hasCredit
                        ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-primary/40 hover:border-primary'
                        : 'bg-white/60 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                      : 'opacity-35 text-slate-400 dark:text-slate-600'
                  } ${isTodayDate && !isSelected ? 'ring-1 ring-primary' : ''}`}
                >
                  <span className={`text-xs font-semibold ${isSelected ? 'text-white' : ''}`}>
                    {format(day, 'd')}
                  </span>

                  <div className="flex flex-col items-center leading-none gap-0.5 mt-0.5">
                    {hasRegular && (
                      <span
                        className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'text-primary'
                        }`}
                      >
                        {dayTotals!.regular}h
                      </span>
                    )}
                    {hasCredit && (
                      <span
                        className={`text-[9px] font-semibold px-1 rounded ${
                          isSelected
                            ? 'bg-amber-300/30 text-white'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        +{dayTotals!.credit}c
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Inspector & Hour Input */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                {t('loggedOnThisDay')}
              </span>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 capitalize">
                {format(selectedDate, language === 'es' ? "EEEE, d 'de' MMMM" : 'EEEE, MMMM do', { locale })}
              </h4>
            </div>
            {(selectedDayData.regular > 0 || selectedDayData.credit > 0) && (
              <span className="text-sm font-bold text-primary tabular-nums">
                {selectedDayData.regular + selectedDayData.credit} {t('hours')}
              </span>
            )}
          </div>

          {/* Existing entries for the selected date */}
          {selectedDayData.entries.length > 0 ? (
            <div className="space-y-2">
              {selectedDayData.entries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                        {entry.hours} {t('hours')}
                      </span>
                      {entry.isCredit && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          · {entry.creditType}
                        </span>
                      )}
                    </div>
                    {entry.note && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {entry.note}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => entry.id && handleDeleteEntry(entry.id)}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                    title={t('deleteEntry')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              {t('noHoursOnThisDay')}
            </p>
          )}

          {/* Quick-Tap Hour Presets */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t('quickPresets')}
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {HOUR_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setHoursNumeric(preset)}
                  className={`min-h-[42px] rounded-xl text-xs font-bold tabular-nums transition-all border ${
                    parsedHoursValue === preset
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-primary'
                  }`}
                >
                  {preset}h
                </button>
              ))}
            </div>
          </div>

          {/* Hybrid Plus / Minus Stepper + Tappable Direct Input */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setHoursNumeric(parsedHoursValue - 0.5)}
              className="min-h-[48px] px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center gap-1 transition-colors tabular-nums shrink-0"
            >
              <Minus size={18} />
              <span>0.5</span>
            </button>

            <div className="flex flex-col items-center justify-center flex-1 px-2">
              <input
                type="number"
                step="0.5"
                min="0"
                value={hoursInputStr}
                onChange={(e) => setHoursInputStr(e.target.value)}
                aria-label={t('hoursAmount')}
                className="w-24 text-center text-2xl font-bold text-primary bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-primary focus:outline-none tabular-nums py-0.5"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {t('tapToTypeHours')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setHoursNumeric(parsedHoursValue + 0.5)}
              className="min-h-[48px] px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center gap-1 transition-colors tabular-nums shrink-0"
            >
              <Plus size={18} />
              <span>0.5</span>
            </button>
          </div>

          {/* Optional Note & Credit Hours Toggle */}
          <div className="space-y-3 pt-1">
            <input
              type="text"
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder={t('optionalDayNote')}
              className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCredit}
                  onChange={(e) => setIsCredit(e.target.checked)}
                  className="h-4 w-4 accent-primary border-slate-300 rounded"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('creditHours')}
                </span>
              </label>

              {isCredit && (
                <select
                  value={creditType}
                  onChange={(e) => setCreditType(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Betel">{t('betel')}</option>
                  <option value="LDC">{t('ldc')}</option>
                  <option value="Otro">{t('other')}</option>
                </select>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveHours}
            className="w-full min-h-[48px] flex justify-center items-center py-3 px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
          >
            <Save size={18} className="mr-2" />
            {t('save')} ({parsedHoursValue} h)
          </button>
        </div>
      </div>

      {/* 3. Previous Months History */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <History className="mr-2 text-primary" size={20} />
          {t('history')}
        </h3>

        {historyEntries.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">{t('noHistoryYet')}</p>
        ) : (
          <div className="space-y-3">
            {historyEntries.map(entry => {
              const [year, month] = entry.month.split('-');
              const dateObj = new Date(Number(year), Number(month) - 1, 1);

              return (
                <div
                  key={entry.month}
                  onClick={() => {
                    setViewedMonthDate(dateObj);
                    setSelectedDate(dateObj);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex flex-col p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 hover:border-primary cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100 capitalize">
                      {format(dateObj, 'MMMM yyyy', { locale })}
                    </span>
                    <span className="text-xs text-primary font-medium">
                      {t('editEntries')}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-700 tabular-nums">
                    <div>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{t('hours')}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{entry.hours}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{t('bibleCourse')}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{entry.studies}</span>
                    </div>
                  </div>

                  {entry.creditHours && entry.creditHours.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 border-dashed text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                      <span className="font-medium mr-2">{t('creditHours')}:</span>
                      {Object.entries(entry.creditHours.reduce((acc, curr) => {
                        const type = curr.type || 'Otro';
                        acc[type] = (acc[type] || 0) + curr.hours;
                        return acc;
                      }, {} as Record<string, number>)).map(([type, total], idx) => (
                        <span key={type}>
                          {idx > 0 && ' · '}
                          {type === 'Betel' ? t('betel') : type === 'LDC' ? t('ldc') : t('other')}: <strong>{total}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
