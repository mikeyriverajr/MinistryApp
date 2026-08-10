import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Link, useNavigate } from 'react-router-dom';
import { Users, BookOpen } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const visits = useLiveQuery(() => db.visits.toArray());
  const { t } = useLanguage();

  const name = userProfile?.[0]?.name || 'Publicador';
  const totalVisits = visits?.length || 0;
  const cursosBiblicos = visits?.filter(v => v.isRecurringStudy).length || 0;

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

         if (v.isRecurringStudy && v.recurringStudyDayOfWeek === today.getDay() && v.recurringStudyTime) {
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
          <Link to="/settings" className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium transition-colors">
            Ir a Ajustes
          </Link>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">{t('hello', { name })}</h2>
        <p className="text-gray-500 mt-1">{t('ministrySummary')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
          <Users className="text-[#e07a5f] mb-2" size={32} />
          <span className="text-3xl font-bold text-gray-800">{totalVisits}</span>
          <span className="text-sm text-gray-500">{t('records')}</span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
          <BookOpen className="text-green-600 mb-2" size={32} />
          <span className="text-3xl font-bold text-gray-800">{cursosBiblicos}</span>
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
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">{t('todaysVisits')}</h3>
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
                       <p className="text-xs text-blue-700 mt-1 line-clamp-1">{visit.generalNotes || t('withoutNotes')}</p>
                     </div>
                     <span className="text-blue-800 font-bold bg-white px-2 py-1 rounded shadow-sm text-sm whitespace-nowrap ml-2">{timeStr}</span>
                   </div>
                );
             })}
           </div>
        )}
      </div>
    </div>
  );
}
