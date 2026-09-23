import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useLanguage } from '../contexts/LanguageContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Clock, BookOpen, Plus, Minus, History, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ReportView() {
  const { t, language } = useLanguage();
  const locale = language === 'es' ? es : enUS;

  const [newEntryDate, setNewEntryDate] = useState<Date | null>(new Date());
  const [newEntryHours, setNewEntryHours] = useState<string>('');

  const timeEntries = useLiveQuery(() => db.timeEntries.toArray());
  const monthlyStats = useLiveQuery(() => db.monthlyStats.toArray());

  const currentMonthString = format(new Date(), 'yyyy-MM');

  const currentMonthStats = useMemo(() => {
    if (!monthlyStats) return { studyCount: 0 };
    return monthlyStats.find(s => s.month === currentMonthString) || { studyCount: 0 };
  }, [monthlyStats, currentMonthString]);

  const currentMonthHours = useMemo(() => {
    if (!timeEntries) return 0;
    return timeEntries
      .filter(e => format(new Date(e.date), 'yyyy-MM') === currentMonthString)
      .reduce((sum, e) => sum + e.hours, 0);
  }, [timeEntries, currentMonthString]);

  const historyEntries = useMemo(() => {
    if (!timeEntries || !monthlyStats) return [];

    const monthsMap = new Map<string, { hours: number, studies: number }>();

    // Aggregate hours
    timeEntries.forEach(e => {
       const m = format(new Date(e.date), 'yyyy-MM');
       if (m === currentMonthString) return;
       const existing = monthsMap.get(m) || { hours: 0, studies: 0 };
       existing.hours += e.hours;
       monthsMap.set(m, existing);
    });

    // Aggregate studies
    monthlyStats.forEach(s => {
       if (s.month === currentMonthString) return;
       const existing = monthsMap.get(s.month) || { hours: 0, studies: 0 };
       existing.studies = s.studyCount;
       monthsMap.set(s.month, existing);
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, data]) => ({ month, ...data }));
  }, [timeEntries, monthlyStats, currentMonthString]);

  const handleAddHours = async () => {
    if (!newEntryDate || !newEntryHours || isNaN(Number(newEntryHours))) {
      toast.error('Por favor ingresa una fecha y cantidad válida.');
      return;
    }

    try {
      await db.timeEntries.add({
        date: newEntryDate,
        hours: Number(newEntryHours)
      });
      setNewEntryHours('');
      toast.success(t('addHoursSuccess'));
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar horas.');
    }
  };

  const handleUpdateStudies = async (increment: number) => {
    const newCount = Math.max(0, currentMonthStats.studyCount + increment);

    try {
      await db.monthlyStats.put({
        month: currentMonthString,
        studyCount: newCount
      });
    } catch (e) {
      console.error(e);
      toast.error('Error al actualizar.');
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-lg mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-700 capitalize mb-2">
          {format(new Date(), 'MMMM yyyy', { locale })}
        </h2>
        <p className="text-gray-500 text-sm mb-6">{t('currentMonth')}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center">
            <Clock className="text-blue-600 mb-2" size={28} />
            <span className="text-3xl font-bold text-gray-700">{currentMonthHours}</span>
            <span className="text-xs text-gray-500 font-medium text-center">{t('totalHours')}</span>
          </div>
          <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col items-center justify-center relative">
            <BookOpen className="text-green-600 mb-2" size={28} />
            <span className="text-3xl font-bold text-gray-700">{currentMonthStats.studyCount}</span>
            <span className="text-xs text-gray-500 font-medium text-center">{t('totalBibleStudies')}</span>

            <div className="flex items-center gap-2 mt-3 bg-white rounded-full p-1 shadow-sm border border-green-200">
              <button onClick={() => handleUpdateStudies(-1)} className="p-1 text-red-500 hover:bg-red-50 rounded-full">
                <Minus size={16} />
              </button>
              <button onClick={() => handleUpdateStudies(1)} className="p-1 text-green-600 hover:bg-green-50 rounded-full">
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
          <h3 className="font-bold text-gray-700 text-sm flex items-center">
            <Plus size={16} className="mr-2" />
            {t('addHours')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="block text-xs font-medium text-gray-700 mb-1">{t('dateOfHours')}</label>
               <DatePicker
                 selected={newEntryDate}
                 onChange={(date: Date | null) => setNewEntryDate(date)}
                 dateFormat="dd/MM/yyyy"
                 className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
               />
             </div>
             <div>
               <label className="block text-xs font-medium text-gray-700 mb-1">{t('hoursAmount')}</label>
               <input
                 type="number"
                 step="0.5"
                 min="0"
                 value={newEntryHours}
                 onChange={(e) => setNewEntryHours(e.target.value)}
                 placeholder="0.0"
                 className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
               />
             </div>
          </div>
          <button
             onClick={handleAddHours}
             className="w-full flex justify-center items-center py-2.5 px-4 bg-[#e07a5f] hover:bg-[#c45b42] text-white rounded-md text-sm font-medium transition-colors"
          >
             <Save size={16} className="mr-2" />
             {t('save')}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-700 flex items-center border-b pb-2 mb-4">
          <History className="mr-2" size={20} />
          {t('history')}
        </h3>

        {historyEntries.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">{t('noHistoryYet')}</p>
        ) : (
          <div className="space-y-3">
             {historyEntries.map(entry => {
                const [year, month] = entry.month.split('-');
                const dateObj = new Date(Number(year), Number(month) - 1);

                return (
                  <div key={entry.month} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="font-medium text-gray-700 capitalize">
                       {format(dateObj, 'MMMM yyyy', { locale })}
                    </span>
                    <div className="flex gap-4">
                       <div className="text-right">
                         <span className="block text-xs text-gray-500">{t('hours')}</span>
                         <span className="font-bold text-gray-700">{entry.hours}</span>
                       </div>
                       <div className="text-right">
                         <span className="block text-xs text-gray-500">{t('bibleCourse')}</span>
                         <span className="font-bold text-gray-700">{entry.studies}</span>
                       </div>
                    </div>
                  </div>
                )
             })}
          </div>
        )}
      </div>
    </div>
  );
}
