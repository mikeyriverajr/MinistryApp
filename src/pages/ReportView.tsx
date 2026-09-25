import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
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

  const currentMonthString = format(new Date(), 'yyyy-MM');

  const currentMonthStats = useMemo(() => {
    if (!monthlyStats) return { studyCount: 0 };
    return monthlyStats.find(s => s.month === currentMonthString) || { studyCount: 0 };
  }, [monthlyStats, currentMonthString]);

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

    // Aggregate hours
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

    // Aggregate studies
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
    if (!newEntryDate || !newEntryHours || isNaN(Number(newEntryHours))) {
      toast.error('Por favor ingresa una fecha y cantidad válida.');
      return;
    }

    try {
      await db.timeEntries.add({
        date: newEntryDate,
        hours: Number(newEntryHours),
        isCredit,
        creditType: isCredit ? creditType : undefined,
      });
      setNewEntryHours('');
      setIsCredit(false);
      setCreditType('Betel');
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

  const handleDeleteEntry = async (id: number) => {
    try {
      await db.timeEntries.delete(id);
      toast.success(t('deleteEntry') as string || 'Registro eliminado');
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-lg mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-2xl font-bold text-gray-700 capitalize">
            {format(new Date(), 'MMMM yyyy', { locale })}
          </h2>
          <button
            onClick={() => setEditingMonth(currentMonthString)}
            className="text-gray-400 hover:text-[#e07a5f] transition-colors"
            title={t('editEntries') as string || 'Editar registros'}
          >
            <History size={20} />
          </button>
        </div>
        <p className="text-gray-500 text-sm mb-6">{t('currentMonth')}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center h-full">
            <Clock className="text-blue-600 mb-2" size={28} />
            <span className="text-3xl font-bold text-gray-700">{currentMonthHours}</span>
            <span className="text-xs text-gray-500 font-medium text-center">{t('totalHours')}</span>
          </div>
          <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col items-center justify-center relative h-full">
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

        {currentMonthCreditHours.length > 0 && (
          <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100">
            <h4 className="text-sm font-bold text-orange-800 mb-2">{t('creditHours') as string || 'Horas de crédito'}</h4>
            <div className="space-y-1">
              {Object.entries(currentMonthCreditHours.reduce((acc, curr) => {
                const type = curr.creditType || 'Otro';
                acc[type] = (acc[type] || 0) + curr.hours;
                return acc;
              }, {} as Record<string, number>)).map(([type, total]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-orange-700 capitalize">{type === 'Betel' ? t('betel') as string || 'Betel' : type === 'LDC' ? t('ldc') as string || 'LDC' : t('other') as string || 'Otro'}</span>
                  <span className="font-semibold text-orange-900">{total}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="isCreditCheckbox"
              checked={isCredit}
              onChange={(e) => setIsCredit(e.target.checked)}
              className="h-4 w-4 text-[#e07a5f] focus:ring-[#e07a5f] border-gray-300 rounded"
            />
            <label htmlFor="isCreditCheckbox" className="text-sm font-medium text-gray-700">
              {t('creditHours') as string || 'Horas de crédito'}
            </label>
          </div>

          {isCredit && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('creditType') as string || 'Tipo'}</label>
              <select
                value={creditType}
                onChange={(e) => setCreditType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
              >
                <option value="Betel">{t('betel') as string || 'Betel'}</option>
                <option value="LDC">{t('ldc') as string || 'LDC'}</option>
                <option value="Otro">{t('other') as string || 'Otro'}</option>
              </select>
            </div>
          )}
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
                  <div key={entry.month} className="flex flex-col p-3 bg-gray-50 rounded-lg border border-gray-100 relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700 capitalize">
                        {format(dateObj, 'MMMM yyyy', { locale })}
                      </span>
                      <button
                        onClick={() => setEditingMonth(entry.month)}
                        className="text-gray-400 hover:text-[#e07a5f] transition-colors"
                        title={t('editEntries') as string || 'Editar registros'}
                      >
                        <History size={16} />
                      </button>
                    </div>

                    <div className="flex justify-between gap-4 pt-2 border-t border-gray-200">
                       <div className="text-right">
                         <span className="block text-xs text-gray-500">{t('hours')}</span>
                         <span className="font-bold text-gray-700">{entry.hours}</span>
                       </div>
                       <div className="text-right">
                         <span className="block text-xs text-gray-500">{t('bibleCourse')}</span>
                         <span className="font-bold text-gray-700">{entry.studies}</span>
                       </div>
                    </div>

                    {entry.creditHours && entry.creditHours.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200 border-dashed">
                        <span className="block text-xs text-gray-500 mb-1">{t('creditHours') as string || 'Horas de crédito'}</span>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(entry.creditHours.reduce((acc, curr) => {
                            const type = curr.type || 'Otro';
                            acc[type] = (acc[type] || 0) + curr.hours;
                            return acc;
                          }, {} as Record<string, number>)).map(([type, total]) => (
                            <span key={type} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-medium">
                              {type === 'Betel' ? t('betel') as string || 'Betel' : type === 'LDC' ? t('ldc') as string || 'LDC' : t('other') as string || 'Otro'}: {total}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
             })}
          </div>
        )}
      </div>

      {editingMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-700 capitalize">
                {t('editEntries') as string || 'Editar registros'} - {
                  format(new Date(Number(editingMonth.split('-')[0]), Number(editingMonth.split('-')[1]) - 1), 'MMMM yyyy', { locale })
                }
              </h3>
              <button onClick={() => setEditingMonth(null)} className="text-gray-500 hover:bg-gray-200 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {timeEntries?.filter(e => format(new Date(e.date), 'yyyy-MM') === editingMonth).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => (
                <div key={entry.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-lg">
                  <div>
                    <span className="block font-medium text-gray-700">{format(new Date(entry.date), 'dd MMM yyyy', { locale })}</span>
                    <span className="block text-sm text-gray-500">
                      {entry.hours} {t('hours')}
                      {entry.isCredit && <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-medium">{entry.creditType}</span>}
                    </span>
                  </div>
                  <button
                    onClick={() => entry.id && handleDeleteEntry(entry.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                    title={t('deleteEntry') as string || 'Eliminar registro'}
                  >
                    <Minus size={16} />
                  </button>
                </div>
              ))}

              {timeEntries?.filter(e => format(new Date(e.date), 'yyyy-MM') === editingMonth).length === 0 && (
                <p className="text-center text-gray-500 py-4">{t('noHistoryYet')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
