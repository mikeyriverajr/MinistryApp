import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  exportDatabase,
  shareDatabaseBackup,
  getPendingBackupChanges,
  incrementPendingBackupChanges,
} from '../db/database';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, BookOpen, Plus, Minus, Save, X, Download, Share2, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { format, isSameDay, subDays } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { formatTimeFromDate, formatTime } from '../utils/timeFormat';
import { toast } from 'react-hot-toast';

const QUICK_HOUR_PRESETS = [0.5, 1, 1.5, 2, 3, 4];

export default function Dashboard() {
  const navigate = useNavigate();
  const [showAddHoursModal, setShowAddHoursModal] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState<Date>(new Date());
  const [newEntryHoursStr, setNewEntryHoursStr] = useState<string>('2');
  const [isCredit, setIsCredit] = useState(false);
  const [creditType, setCreditType] = useState('Betel');
  const [pendingChanges, setPendingChanges] = useState<number>(() => getPendingBackupChanges());

  const parsedNewEntryHours = useMemo(() => {
    const num = parseFloat(newEntryHoursStr);
    return isNaN(num) || num < 0 ? 0 : num;
  }, [newEntryHoursStr]);

  const setModalHoursNumeric = (val: number) => {
    const clean = Math.max(0.5, Number(val.toFixed(2)));
    setNewEntryHoursStr(String(clean));
  };

  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const visits = useLiveQuery(() => db.visits.toArray());
  const timeEntries = useLiveQuery(() => db.timeEntries.toArray());
  const monthlyStats = useLiveQuery(() => db.monthlyStats.toArray());

  const { t, language } = useLanguage();
  const { timeFormat } = useSettings();
  const locale = language === 'es' ? es : enUS;

  useEffect(() => {
    const syncPending = () => setPendingChanges(getPendingBackupChanges());
    window.addEventListener('morfo-backup-changes', syncPending);
    return () => window.removeEventListener('morfo-backup-changes', syncPending);
  }, []);

  const recentSevenDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => subDays(today, 6 - i));
  }, []);

  const dailyHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!timeEntries) return map;
    timeEntries.forEach(e => {
      const key = format(new Date(e.date), 'yyyy-MM-dd');
      map.set(key, (map.get(key) || 0) + e.hours);
    });
    return map;
  }, [timeEntries]);

  const handleAddHours = async () => {
    if (!newEntryDate || parsedNewEntryHours <= 0) {
      toast.error(t('invalidHoursError'));
      return;
    }

    try {
      await db.timeEntries.add({
        date: newEntryDate,
        hours: parsedNewEntryHours,
        isCredit,
        creditType: isCredit ? creditType : undefined,
      });
      incrementPendingBackupChanges();
      setIsCredit(false);
      setCreditType('Betel');
      setShowAddHoursModal(false);
      toast.success(t('addHoursSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('saveHoursError'));
    }
  };

  const name = userProfile?.[0]?.name || 'Publicador';
  const currentMonthString = format(new Date(), 'yyyy-MM');

  const activeRecurringStudiesCount = useMemo(() => {
    if (!visits) return 0;
    return visits.filter(v => v.isRecurringStudy).length;
  }, [visits]);

  const cursosBiblicos = useMemo(() => {
    if (!monthlyStats) return activeRecurringStudiesCount;
    const currentStats = monthlyStats.find(s => s.month === currentMonthString);
    return currentStats ? currentStats.studyCount : activeRecurringStudiesCount;
  }, [monthlyStats, currentMonthString, activeRecurringStudiesCount]);

  const currentMonthHours = useMemo(() => {
    if (!timeEntries) return 0;
    return timeEntries
      .filter(e => format(new Date(e.date), 'yyyy-MM') === currentMonthString && !e.isCredit)
      .reduce((sum, e) => sum + e.hours, 0);
  }, [timeEntries, currentMonthString]);

  const backupReminder = localStorage.getItem('backupReminder') || 'monthly';
  const lastBackupDate = localStorage.getItem('lastBackupDate');
  const [isBackupDismissed, setIsBackupDismissed] = useState(false);

  const showBackupReminder = useMemo(() => {
    if (backupReminder === 'never' || isBackupDismissed) return false;
    if (!lastBackupDate) {
      return (visits?.length || 0) > 0 || (timeEntries?.length || 0) > 0;
    }

    const last = new Date(lastBackupDate).getTime();
    const now = new Date().getTime();
    const daysSince = (now - last) / (1000 * 60 * 60 * 24);

    if (backupReminder === 'monthly' && daysSince > 30) return true;
    if (backupReminder === '3months' && daysSince > 90) return true;
    return false;
  }, [backupReminder, lastBackupDate, isBackupDismissed, visits, timeEntries]);

  const handleDownloadBackup = async () => {
    try {
      await exportDatabase();
      toast.success(t('backupExported'));
      setIsBackupDismissed(true);
    } catch (error) {
      console.error('Error al exportar:', error);
      toast.error(t('backupError'));
    }
  };

  const handleShareBackup = async () => {
    try {
      const result = await shareDatabaseBackup();
      toast.success(result === 'shared' ? t('backupExported') : t('shareNotSupported'));
      setIsBackupDismissed(true);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error sharing backup:', error);
        toast.error(t('backupError'));
      }
    }
  };

  const todaysVisits = useMemo(() => {
    if (!visits) return [];
    const today = new Date();

    return visits
      .filter(visit => {
        let isToday = false;

        if (visit.nextVisitDate && isSameDay(new Date(visit.nextVisitDate), today)) {
          isToday = true;
        }

        if (visit.isRecurringStudy && visit.recurringStudyDayOfWeek === today.getDay()) {
          isToday = true;
        }

        if (visit.customDates && visit.customDates.length > 0) {
          const hasExceptionToday = visit.customDates.some(d => isSameDay(new Date(d.newDate), today));
          const hasSkippedToday = visit.customDates.some(d => isSameDay(new Date(d.originalDate), today));

          if (hasExceptionToday) isToday = true;
          if (hasSkippedToday && !hasExceptionToday) isToday = false;
        }

        return isToday;
      })
      .sort((a, b) => {
        const getTime = (v: any) => {
          if (v.customDates) {
            const todayExc = v.customDates.find((d: any) => isSameDay(new Date(d.newDate), today));
            if (todayExc) {
              const d = new Date(todayExc.newDate);
              return d.getHours() * 60 + d.getMinutes();
            }
          }

          if (v.isRecurringStudy && v.recurringStudyDayOfWeek === today.getDay() && v.recurringStudyTime && v.recurringStudyTime.includes(':')) {
            const [h, m] = v.recurringStudyTime.split(':').map(Number);
            return h * 60 + m;
          }

          if (v.nextVisitDate && isSameDay(new Date(v.nextVisitDate), today)) {
            const d = new Date(v.nextVisitDate);
            return d.getHours() * 60 + d.getMinutes();
          }

          return 9999;
        };

        return getTime(a) - getTime(b);
      });
  }, [visits]);

  return (
    <div className="space-y-6 pb-20">
      {showBackupReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg w-full max-w-md flex flex-col p-6 space-y-4">
            <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">{t('monthlyBackupPromptTitle')}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t('monthlyBackupPromptText')}
            </p>
            <div className="flex flex-col space-y-2.5 mt-4">
              <button
                onClick={handleShareBackup}
                className="w-full min-h-[44px] bg-primary text-white py-2.5 px-4 rounded-xl font-medium shadow-xs hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
              >
                <Share2 size={18} />
                <span>{t('shareBackup')}</span>
              </button>
              <button
                onClick={handleDownloadBackup}
                className="w-full min-h-[44px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-2.5 px-4 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                <span>{t('downloadBackup')}</span>
              </button>
              <button
                onClick={() => setIsBackupDismissed(true)}
                className="w-full min-h-[40px] text-slate-500 dark:text-slate-400 py-2 rounded-lg text-sm font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                {t('remindMeLater')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Unbacked-up Changes Protection Banner */}
      {pendingChanges >= 3 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {t('unsavedChangesBannerTitle')}
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                {t('unsavedChangesBannerText', { count: String(pendingChanges) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleShareBackup}
              className="min-h-[40px] px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Share2 size={15} />
              <span>{t('backupNow')}</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('hello', { name })}</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{t('ministrySummary')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 items-stretch">
        <button
          type="button"
          onClick={() => navigate('/informe')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-between cursor-pointer hover:border-primary transition-colors"
        >
          <Clock className="text-blue-600 dark:text-blue-400 mb-2" size={28} />
          <div className="h-10 flex items-center justify-center">
            <span className="text-3xl font-bold leading-none text-slate-800 dark:text-slate-100 tabular-nums">{currentMonthHours}</span>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('hours')}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/personas?filter=cursos')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-between cursor-pointer hover:border-primary transition-colors"
        >
          <BookOpen className="text-emerald-600 dark:text-emerald-400 mb-2" size={28} />
          <div className="h-10 flex items-center justify-center">
            <span className="text-3xl font-bold leading-none text-slate-800 dark:text-slate-100 tabular-nums">{cursosBiblicos}</span>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('bibleCourses')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link 
          to="/add" 
          className="min-h-[48px] bg-primary text-white flex items-center justify-center py-3 px-4 rounded-xl font-medium shadow-xs hover:bg-primary-dark transition-colors"
        >
          {t('registerNewVisit')}
        </Link>
        <button
          type="button"
          onClick={() => {
            setNewEntryDate(new Date());
            setShowAddHoursModal(true);
          }}
          className="min-h-[48px] bg-white dark:bg-slate-900 border border-primary text-primary flex justify-center items-center py-3 px-4 rounded-xl font-medium shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full"
        >
          <Plus size={18} className="mr-2" />
          {t('addHours')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">{t('todaysVisits')}</h3>
        {todaysVisits.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('noVisitsToday')}</p>
        ) : (
          <div className="space-y-3">
            {todaysVisits.map(visit => {
              let timeStr = t('hourToBeDefined');
              const today = new Date();

              if (visit.customDates) {
                const todayExc = visit.customDates.find((d: any) => isSameDay(new Date(d.newDate), today));
                if (todayExc) {
                  const d = new Date(todayExc.newDate);
                  timeStr = formatTimeFromDate(d, timeFormat === '12h');
                }
              }

              if (timeStr === t('hourToBeDefined') && visit.isRecurringStudy && visit.recurringStudyDayOfWeek === today.getDay() && visit.recurringStudyTime) {
                timeStr = formatTime(visit.recurringStudyTime, timeFormat === '12h');
              }

              if (timeStr === t('hourToBeDefined') && visit.nextVisitDate && isSameDay(new Date(visit.nextVisitDate), today)) {
                const d = new Date(visit.nextVisitDate);
                timeStr = formatTimeFromDate(d, timeFormat === '12h');
              }

              return (
                <div
                  key={`today-${visit.id}`}
                  onClick={() => navigate(`/person/${visit.id}`)}
                  className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 rounded-xl cursor-pointer hover:border-primary transition-colors flex justify-between items-center gap-3"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">{visit.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {visit.generalNotes || visit.houseDescription || t('withoutNotes')}
                    </p>
                  </div>
                  <span className="text-primary font-bold text-sm tabular-nums whitespace-nowrap shrink-0">
                    {timeStr}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hybrid Quick Add Hours Modal */}
      {showAddHoursModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg w-full max-w-md flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
                <Plus size={20} className="mr-2 text-primary" />
                {t('addHours')}
              </h3>
              <button
                onClick={() => setShowAddHoursModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Keyboard-free 7-day selector strip showing already-logged hours */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('dateOfHours')}
                  </label>
                  <span className="text-xs font-semibold text-primary capitalize">
                    {format(newEntryDate, language === 'es' ? "EEEE d 'de' MMM" : 'EEE, MMM d', { locale })}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  {recentSevenDays.map(day => {
                    const key = format(day, 'yyyy-MM-dd');
                    const logged = dailyHoursMap.get(key) || 0;
                    const isSelected = isSameDay(day, newEntryDate);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewEntryDate(day)}
                        className={`min-h-[52px] py-1 px-0.5 rounded-lg flex flex-col items-center justify-between transition-colors tabular-nums ${
                          isSelected
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        <span className="text-[10px] uppercase opacity-80">
                          {format(day, 'EEE', { locale }).substring(0, 2)}
                        </span>
                        <span className="text-xs font-bold">{format(day, 'd')}</span>
                        <span
                          className={`text-[9px] font-bold ${
                            logged > 0
                              ? isSelected
                                ? 'text-white'
                                : 'text-primary'
                              : 'opacity-0'
                          }`}
                        >
                          {logged > 0 ? `${logged}h` : '0h'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick-Tap Hour Presets */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  {t('quickPresets')}
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {QUICK_HOUR_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setModalHoursNumeric(preset)}
                      className={`min-h-[40px] rounded-xl text-xs font-bold tabular-nums transition-all border ${
                        parsedNewEntryHours === preset
                          ? 'bg-primary text-white border-primary'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-primary'
                      }`}
                    >
                      {preset}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Hybrid Stepper + Tappable Direct Input */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalHoursNumeric(parsedNewEntryHours - 0.5)}
                  className="min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center gap-1 shadow-2xs border border-slate-200 dark:border-slate-700 tabular-nums shrink-0"
                >
                  <Minus size={16} />
                  <span>0.5</span>
                </button>

                <div className="flex flex-col items-center justify-center flex-1 px-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={newEntryHoursStr}
                    onChange={(e) => setNewEntryHoursStr(e.target.value)}
                    aria-label={t('hoursAmount')}
                    className="w-24 text-center text-2xl font-bold text-primary bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-primary focus:outline-none tabular-nums py-0.5"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {t('tapToTypeHours')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setModalHoursNumeric(parsedNewEntryHours + 0.5)}
                  className="min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center gap-1 shadow-2xs border border-slate-200 dark:border-slate-700 tabular-nums shrink-0"
                >
                  <Plus size={16} />
                  <span>0.5</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="isCreditCheckboxDashboard"
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
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Betel">{t('betel')}</option>
                    <option value="LDC">{t('ldc')}</option>
                    <option value="Otro">{t('other')}</option>
                  </select>
                )}
              </div>

              <button
                onClick={handleAddHours}
                className="w-full min-h-[48px] flex justify-center items-center py-2.5 px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Save size={18} className="mr-2" />
                {t('save')} ({parsedNewEntryHours} h)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
