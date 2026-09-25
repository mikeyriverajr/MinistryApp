import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, BookOpen, Plus, Save, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { toast } from 'react-hot-toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const [showAddHoursModal, setShowAddHoursModal] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState<Date | null>(new Date());
  const [newEntryHours, setNewEntryHours] = useState<string>('');
  const [isCredit, setIsCredit] = useState(false);
  const [creditType, setCreditType] = useState('Betel');
  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const visits = useLiveQuery(() => db.visits.toArray());
  const timeEntries = useLiveQuery(() => db.timeEntries.toArray());
  const { t } = useLanguage();

  const monthlyStats = useLiveQuery(() => db.monthlyStats.toArray());

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
      setShowAddHoursModal(false);
      toast.success(t('addHoursSuccess'));
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar horas.');
    }
  };

  const name = userProfile?.[0]?.name || 'Publicador';

  const currentMonthString = format(new Date(), 'yyyy-MM');

  const cursosBiblicos = useMemo(() => {
    if (!monthlyStats) return 0;
    const currentStats = monthlyStats.find(s => s.month === currentMonthString);
    return currentStats ? currentStats.studyCount : 0;
  }, [monthlyStats, currentMonthString]);

  const currentMonthHours = useMemo(() => {
    if (!timeEntries) return 0;
    return timeEntries
      .filter(e => format(new Date(e.date), 'yyyy-MM') === currentMonthString && !e.isCredit)
      .reduce((sum, e) => sum + e.hours, 0);
  }, [timeEntries, currentMonthString]);


  const backupReminder = localStorage.getItem('backupReminder') || 'monthly';
  const lastBackupDate = localStorage.getItem('lastBackupDate');

  const showBackupReminder = React.useMemo(() => {
    if (backupReminder === 'never') return false;
    if (!lastBackupDate) return true;

    const last = new Date(lastBackupDate).getTime();
    const now = new Date().getTime();
    const daysSince = (now - last) / (1000 * 60 * 60 * 24);

    if (backupReminder === 'monthly' && daysSince > 30) return true;
    if (backupReminder === '3months' && daysSince > 90) return true;
    return false;
  }, [backupReminder, lastBackupDate]);

  const todaysVisits = React.useMemo(() => {
    if (!visits) return [];

    const today = new Date();

    return visits.filter(visit => {
      let isToday = false;

      if (visit.nextVisitDate) {
        const nextDate = new Date(visit.nextVisitDate);
        if (nextDate.getDate() === today.getDate() &&
            nextDate.getMonth() === today.getMonth() &&
            nextDate.getFullYear() === today.getFullYear()) {
          isToday = true;
        }
      }

      if (visit.isRecurringStudy && visit.recurringStudyDayOfWeek === today.getDay()) {
        isToday = true;
      }

      // Check exceptions
      if (visit.customDates && visit.customDates.length > 0) {
         const hasExceptionToday = visit.customDates.some(d => {
            const excDate = new Date(d.newDate);
            return excDate.getDate() === today.getDate() &&
                   excDate.getMonth() === today.getMonth() &&
                   excDate.getFullYear() === today.getFullYear();
         });
         const hasSkippedToday = visit.customDates.some(d => {
            const origDate = new Date(d.originalDate);
            return origDate.getDate() === today.getDate() &&
                   origDate.getMonth() === today.getMonth() &&
                   origDate.getFullYear() === today.getFullYear();
         });

         if (hasExceptionToday) isToday = true;
         if (hasSkippedToday) isToday = false; // Override if it was skipped/moved
      }

      return isToday;
    }).sort((a, b) => {
      // Sort chronologically
      const getTime = (v: any) => {
         // Check custom date first for today
         if (v.customDates) {
            const todayExc = v.customDates.find((d: any) => {
              const excDate = new Date(d.newDate);
              return excDate.getDate() === today.getDate() && excDate.getMonth() === today.getMonth();
            });
            if (todayExc) {
               const d = new Date(todayExc.newDate);
               return d.getHours() * 60 + d.getMinutes();
            }
         }

         if (v.isRecurringStudy && v.recurringStudyDayOfWeek === today.getDay() && v.recurringStudyTime && v.recurringStudyTime.includes(':')) {
            const [h, m] = v.recurringStudyTime.split(':').map(Number);
            return h * 60 + m;
         }

         if (v.nextVisitDate) {
            const d = new Date(v.nextVisitDate);
            if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth()) {
               return d.getHours() * 60 + d.getMinutes();
            }
         }

         return 9999;
      };

      return getTime(a) - getTime(b);
    });
  }, [visits]);



  return (
    <div className="space-y-6 pb-20">
      {showBackupReminder && (
        <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100 flex items-start justify-between">
          <div>
            <h4 className="font-bold text-blue-800 text-sm">Recordatorio de Copia de Seguridad</h4>
            <p className="text-xs text-blue-600 mt-1">Hace tiempo que no haces una copia de tus registros.</p>
          </div>
          <Link to="/settings" className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 font-medium transition-colors">
            Ir a Ajustes
          </Link>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-700">{t('hello', { name })}</h2>
        <p className="text-gray-500 mt-1">{t('ministrySummary')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div
          onClick={() => navigate('/informe')}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <Clock className="text-blue-600 mb-2" size={32} />
          <span className="text-3xl font-bold text-gray-700">{currentMonthHours}</span>
          <span className="text-sm text-gray-500">{t('hours')}</span>
        </div>
        <div
          onClick={() => navigate('/personas?filter=cursos')}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <BookOpen className="text-green-600 mb-2" size={32} />
          <span className="text-3xl font-bold text-gray-700">{cursosBiblicos}</span>
          <span className="text-sm text-gray-500">{t('bibleCourses')}</span>
        </div>
      </div>

      <div className="flex flex-col space-y-3">
        <Link 
          to="/add" 
          className="bg-[#e07a5f] text-white text-center py-3 rounded-lg font-medium shadow-sm hover:bg-[#c45b42] transition-colors"
        >
          {t('registerNewVisit')}
        </Link>
        <button
          onClick={() => setShowAddHoursModal(true)}
          className="bg-white border border-[#e07a5f] text-[#e07a5f] flex justify-center items-center py-3 rounded-lg font-medium shadow-sm hover:bg-orange-50 transition-colors w-full"
        >
          <Plus size={18} className="mr-2" />
          {t('addHours')}
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-700 mb-4">{t('todaysVisits')}</h3>
        {todaysVisits.length === 0 ? (
           <p className="text-gray-500 text-sm">{t('noVisitsToday')}</p>
        ) : (
           <div className="space-y-3">
             {todaysVisits.map(visit => {
                let timeStr = t('hourToBeDefined');
                const today = new Date();

                if (visit.customDates) {
                   const todayExc = visit.customDates.find((d: any) => {
                     const excDate = new Date(d.newDate);
                     return excDate.getDate() === today.getDate() && excDate.getMonth() === today.getMonth();
                   });
                   if (todayExc) {
                      const d = new Date(todayExc.newDate);
                      timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                   }
                }

                if (timeStr === t('hourToBeDefined') && visit.isRecurringStudy && visit.recurringStudyDayOfWeek === today.getDay() && visit.recurringStudyTime) {
                   timeStr = visit.recurringStudyTime;
                }

                if (timeStr === t('hourToBeDefined') && visit.nextVisitDate) {
                   const d = new Date(visit.nextVisitDate);
                   if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth()) {
                      timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                   }
                }

                return (
                   <div key={`today-${visit.id}`} onClick={() => navigate(`/person/${visit.id}`)} className="bg-blue-50 border border-blue-100 p-3 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors flex justify-between items-center">
                     <div>
                       <h4 className="font-bold text-blue-900">{visit.name}</h4>
                       <p className="text-xs text-blue-800 mt-1 line-clamp-1">{visit.generalNotes || t('withoutNotes')}</p>
                     </div>
                     <span className="text-blue-800 font-bold bg-white px-2 py-1 rounded shadow-sm text-sm whitespace-nowrap ml-2">{timeStr}</span>
                   </div>
                );
             })}
           </div>
        )}
      </div>

      {showAddHoursModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-700 flex items-center">
                <Plus size={20} className="mr-2" />
                {t('addHours')}
              </h3>
              <button onClick={() => setShowAddHoursModal(false)} className="text-gray-500 hover:bg-gray-200 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
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
                  id="isCreditCheckboxDashboard"
                  checked={isCredit}
                  onChange={(e) => setIsCredit(e.target.checked)}
                  className="h-4 w-4 text-[#e07a5f] focus:ring-[#e07a5f] border-gray-300 rounded"
                />
                <label htmlFor="isCreditCheckboxDashboard" className="text-sm font-medium text-gray-700">
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
        </div>
      )}
    </div>
  );
}
