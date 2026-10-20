import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, incrementPendingBackupChanges } from '../db/database';
import { useLanguage } from '../contexts/LanguageContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Clock, BookOpen, Plus, Minus, History, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ReportView() {
  const { t, language } = useLanguage();
  const locale = language === 'es' ? es : enUS;

  const [newEntryDate, setNewEntryDate] = useState<Date | null>(new Date());
  const [newEntryHours, setNewEntryHours] = useState<string>('');
  const [isCredit, setIsCredit] = useState(false);
  const [creditType, setCreditType] = useState('Betel');
  const [editingMonth, setEditingMonth] = useState<string | null>(null);

  const timeEntries = useLiveQuery(() => db.timeEntries.toArray());
  const monthlyStats = useLiveQuery(() => db.monthlyStats.toArray());
  const visits = useLiveQuery(() => db.visits.toArray());

  const currentMonthString = format(new Date(), 'yyyy-MM');

  const activeRecurringStudiesCount = useMemo(() => {
    if (!visits) return 0;
    return visits.filter(v => v.isRecurringStudy).length;
  }, [visits]);

  const currentMonthStats = useMemo(() => {
    if (!monthlyStats) return { studyCount: activeRecurringStudiesCount };
    const found = monthlyStats.find(s => s.month === currentMonthString);
    return found || { studyCount: activeRecurringStudiesCount };
  }, [monthlyStats, currentMonthString, activeRecurringStudiesCount]);

  const currentMonthHours = useMemo(() => {
    if (!timeEntries) return 0;
    return timeEntries
      .filter(e => format(new Date(e.date), 'yyyy-MM') === currentMonthString && !e.isCredit)
      .reduce((sum, e) => sum + e.hours, 0);
  }, [timeEntries, currentMonthString]);

  const currentMonthCreditHours = useMemo(() => {
    if (!timeEntries) return [];
    return timeEntries.filter(e => format(new Date(e.date), 'yyyy-MM') === currentMonthString && e.isCredit);
  }, [timeEntries, currentMonthString]);

  const historyEntries = useMemo(() => {
    if (!timeEntries || !monthlyStats) return [];

    const monthsMap = new Map<string, { hours: number, studies: number, creditHours: { hours: number, type: string }[] }>();

    timeEntries.forEach(e => {
      const m = format(new Date(e.date), 'yyyy-MM');
      if (m === currentMonthString) return;
      const existing = monthsMap.get(m) || { hours: 0, studies: 0, creditHours: [] };
      if (e.isCredit) {
        existing.creditHours.push({ hours: e.hours, type: e.creditType || 'Otro' });
      } else {
        existing.hours += e.hours;
      }
      monthsMap.set(m, existing);
    });

    monthlyStats.forEach(s => {
      if (s.month === currentMonthString) return;
      const existing = monthsMap.get(s.month) || { hours: 0, studies: 0, creditHours: [] };
      existing.studies = s.studyCount;
      monthsMap.set(s.month, existing);
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, data]) => ({ month, ...data }));
  }, [timeEntries, monthlyStats, currentMonthString]);

  const handleAddHours = async () => {
    if (!newEntryDate || !newEntryHours || isNaN(Number(newEntryHours)) || Number(newEntryHours) <= 0) {
      toast.error(t('invalidHoursError'));
      return;
    }

    try {
      await db.timeEntries.add({
        date: newEntryDate,
        hours: Number(newEntryHours),
        isCredit,
        creditType: isCredit ? creditType : undefined,
      });
      incrementPendingBackupChanges();
      setNewEntryHours('');
      setIsCredit(false);
      setCreditType('Betel');
      toast.success(t('addHoursSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('saveHoursError'));
    }
  };

  const handleUpdateStudies = async (increment: number) => {
    const newCount = Math.max(0, currentMonthStats.studyCount + increment);

    try {
      await db.monthlyStats.put({
        month: currentMonthString,
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

  return (
    <div className="space-y-6 pb-20 max-w-xl mx-auto">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 relative">
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 capitalize">
            {format(new Date(), 'MMMM yyyy', { locale })}
          </h2>
          <button
            onClick={() => setEditingMonth(currentMonthString)}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-primary transition-colors rounded-full"
            title={t('editEntries')}
          >
            <History size={20} />
          </button>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{t('currentMonth')}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center h-full">
            <Clock className="text-blue-600 dark:text-blue-400 mb-2" size={28} />
            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{currentMonthHours}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center mt-0.5">{t('totalHours')}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center relative h-full">
            <BookOpen className="text-emerald-600 dark:text-emerald-400 mb-2" size={28} />
            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{currentMonthStats.studyCount}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center mt-0.5">{t('totalBibleStudies')}</span>

            <div className="flex items-center gap-2 mt-3 bg-white dark:bg-slate-900 rounded-xl p-1 shadow-2xs border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => handleUpdateStudies(-1)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg"
              >
                <Minus size={16} />
              </button>
              <button
                onClick={() => handleUpdateStudies(1)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {currentMonthCreditHours.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-2">{t('creditHours')}</h4>
            <div className="space-y-1">
              {Object.entries(currentMonthCreditHours.reduce((acc, curr) => {
                const type = curr.creditType || 'Otro';
                acc[type] = (acc[type] || 0) + curr.hours;
                return acc;
              }, {} as Record<string, number>)).map(([type, total]) => (
                <div key={type} className="flex justify-between text-sm tabular-nums">
                  <span className="text-amber-800 dark:text-amber-300 capitalize">
                    {type === 'Betel' ? t('betel') : type === 'LDC' ? t('ldc') : t('other')}
                  </span>
                  <span className="font-semibold text-amber-950 dark:text-amber-100">{total}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center">
            <Plus size={16} className="mr-2 text-primary" />
            {t('addHours')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dateOfHours')}</label>
              <DatePicker
                selected={newEntryDate}
                onChange={(date: Date | null) => setNewEntryDate(date)}
                dateFormat="dd/MM/yyyy"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hoursAmount')}</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={newEntryHours}
                onChange={(e) => setNewEntryHours(e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="isCreditCheckbox"
              checked={isCredit}
              onChange={(e) => setIsCredit(e.target.checked)}
              className="h-4 w-4 accent-primary border-slate-300 rounded"
            />
            <label htmlFor="isCreditCheckbox" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              {t('creditHours')}
            </label>
          </div>

          {isCredit && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{t('creditType')}</label>
              <select
                value={creditType}
                onChange={(e) => setCreditType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Betel">{t('betel')}</option>
                <option value="LDC">{t('ldc')}</option>
                <option value="Otro">{t('other')}</option>
              </select>
            </div>
          )}
          <button
            onClick={handleAddHours}
            className="w-full min-h-[44px] flex justify-center items-center py-2.5 px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Save size={16} className="mr-2" />
            {t('save')}
          </button>
        </div>
      </div>

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
              const dateObj = new Date(Number(year), Number(month) - 1);

              return (
                <div key={entry.month} className="flex flex-col p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 relative">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100 capitalize">
                      {format(dateObj, 'MMMM yyyy', { locale })}
                    </span>
                    <button
                      onClick={() => setEditingMonth(entry.month)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-primary transition-colors rounded-full"
                      title={t('editEntries')}
                    >
                      <History size={16} />
                    </button>
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

      {editingMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 capitalize">
                {t('editEntries')} — {
                  format(new Date(Number(editingMonth.split('-')[0]), Number(editingMonth.split('-')[1]) - 1), 'MMMM yyyy', { locale })
                }
              </h3>
              <button
                onClick={() => setEditingMonth(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {timeEntries
                ?.filter(e => format(new Date(e.date), 'yyyy-MM') === editingMonth)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(entry => (
                  <div key={entry.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <div className="tabular-nums">
                      <span className="block font-medium text-slate-800 dark:text-slate-100 text-sm">
                        {format(new Date(entry.date), 'dd MMM yyyy', { locale })}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {entry.hours} {t('hours')}
                        {entry.isCredit && ` · ${entry.creditType}`}
                      </span>
                    </div>
                    <button
                      onClick={() => entry.id && handleDeleteEntry(entry.id)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-full"
                      title={t('deleteEntry')}
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                ))}

              {timeEntries?.filter(e => format(new Date(e.date), 'yyyy-MM') === editingMonth).length === 0 && (
                <p className="text-center text-slate-500 dark:text-slate-400 py-4 text-sm">{t('noHistoryYet')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
