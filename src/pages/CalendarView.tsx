import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Visit } from '../db/database';
import { format, startOfWeek, addDays, subDays, isSameDay } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { formatTimeFromDate, formatTime } from '../utils/timeFormat';

export default function CalendarView() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const visits = useLiveQuery(() => db.visits.toArray());
  const { t, language } = useLanguage();
  const { timeFormat } = useSettings();
  const locale = language === 'es' ? es : enUS;

  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const getEventsForDate = (date: Date) => {
    if (!visits) return [];

    return visits.filter(visit => {
      let isEventToday = false;

      if (visit.nextVisitDate && isSameDay(new Date(visit.nextVisitDate), date)) {
        isEventToday = true;
      }

      if (visit.isRecurringStudy && visit.recurringStudyDayOfWeek !== null) {
        if (date.getDay() === visit.recurringStudyDayOfWeek) {
          isEventToday = true;
        }
      }

      if (visit.customDates && visit.customDates.length > 0) {
        const hasExceptionToday = visit.customDates.some(d => isSameDay(new Date(d.newDate), date));
        const hasSkippedToday = visit.customDates.some(d => isSameDay(new Date(d.originalDate), date));

        if (hasExceptionToday) isEventToday = true;
        if (hasSkippedToday && !hasExceptionToday) isEventToday = false;
      }

      return isEventToday;
    });
  };

  const getCombinedEventsForDate = (date: Date) => {
    const myEvents = getEventsForDate(date);

    return [...myEvents].sort((a, b) => {
      const getTime = (v: Visit) => {
        if (v.customDates) {
          const exc = v.customDates.find(d => isSameDay(new Date(d.newDate), date));
          if (exc) {
            const d = new Date(exc.newDate);
            return d.getHours() * 60 + d.getMinutes();
          }
        }
        if (v.isRecurringStudy && v.recurringStudyDayOfWeek === date.getDay() && v.recurringStudyTime && v.recurringStudyTime.includes(':')) {
          const [h, m] = v.recurringStudyTime.split(':').map(Number);
          return h * 60 + m;
        }
        if (v.nextVisitDate && isSameDay(new Date(v.nextVisitDate), date)) {
          const d = new Date(v.nextVisitDate);
          return d.getHours() * 60 + d.getMinutes();
        }
        return 9999;
      };
      return getTime(a) - getTime(b);
    });
  };

  const combinedSelectedEvents = getCombinedEventsForDate(selectedDate);

  const handlePrevWeek = () => {
    setSelectedDate(prev => subDays(prev, 7));
  };

  const handleNextWeek = () => {
    setSelectedDate(prev => addDays(prev, 7));
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  const isTodaySelected = isSameDay(selectedDate, new Date());

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        <div className="flex justify-between items-center mb-4 relative">
          <button
            onClick={handlePrevWeek}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center justify-center relative flex-1">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 capitalize text-center">
              {format(selectedDate, 'MMMM yyyy', { locale })}
            </h2>
            {!isTodaySelected && (
              <button
                onClick={handleGoToToday}
                className="text-xs text-primary font-medium mt-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700"
              >
                {t('goToToday')}
              </button>
            )}
          </div>
          <button
            onClick={handleNextWeek}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg ml-2"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
          {weekDays.map(day => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayReal = isSameDay(day, new Date());
            const hasEvents = getEventsForDate(day).length > 0;

            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg min-h-[56px] relative transition-colors ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                } ${isTodayReal && !isSelected ? 'ring-2 ring-primary ring-inset' : ''}`}
              >
                <span className="text-[11px] font-medium uppercase mb-0.5">
                  {format(day, 'E', { locale }).substring(0, 3)}
                </span>
                <span className={`text-base font-bold tabular-nums ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                  {format(day, 'd')}
                </span>
                {hasEvents && !isSelected && (
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 ml-1">
            {t('agendaFor', { date: format(selectedDate, language === 'es' ? "d 'de' MMMM" : 'MMMM do', { locale }) })}
          </h3>
        </div>

        {combinedSelectedEvents.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
            {t('noVisitsScheduled')}
          </div>
        ) : (
          <div className="space-y-3">
            {combinedSelectedEvents.map(event => {
              let time = t('hourToBeDefined');

              if (event.customDates) {
                const exc = event.customDates.find(d => isSameDay(new Date(d.newDate), selectedDate));
                if (exc) {
                  const d = new Date(exc.newDate);
                  time = formatTimeFromDate(d, timeFormat === '12h');
                }
              }

              if (time === t('hourToBeDefined') && event.isRecurringStudy && selectedDate.getDay() === event.recurringStudyDayOfWeek && event.recurringStudyTime) {
                time = formatTime(event.recurringStudyTime, timeFormat === '12h');
              }

              if (time === t('hourToBeDefined') && event.nextVisitDate && isSameDay(new Date(event.nextVisitDate), selectedDate)) {
                const d = new Date(event.nextVisitDate);
                time = formatTimeFromDate(d, timeFormat === '12h');
              }

              const isRecurringToday = event.isRecurringStudy &&
                (selectedDate.getDay() === event.recurringStudyDayOfWeek ||
                 (event.customDates && event.customDates.some(d => isSameDay(new Date(d.newDate), selectedDate))));

              return (
                <div
                  key={`mine-${event.id}`}
                  onClick={() => navigate(`/person/${event.id}`)}
                  className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 hover:border-primary cursor-pointer transition-colors flex justify-between items-center gap-3"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">
                      {event.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                      <span className="truncate">{event.houseDescription || event.generalNotes || t('withoutNotes')}</span>
                      {isRecurringToday && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-primary font-medium">{t('bibleCourse')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-bold text-primary tabular-nums">{time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
