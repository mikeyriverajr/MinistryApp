import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Visit } from '../db/database';
import { format, startOfWeek, addDays, subDays, isSameDay } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function CalendarView() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const visits = useLiveQuery(() => db.visits.toArray());
  const { t, language } = useLanguage();
  const locale = language === 'es' ? es : enUS;

  // Generate a week view centered around the selected date
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  // Filter events for the selected date
  const getEventsForDate = (date: Date) => {
    if (!visits) return [];
    
    return visits.filter(visit => {
      let isEventToday = false;
      
      // Check nextVisitDate
      if (visit.nextVisitDate && isSameDay(new Date(visit.nextVisitDate), date)) {
        isEventToday = true;
      }
      
      // Check recurring studies
      if (visit.isRecurringStudy && visit.recurringStudyDayOfWeek !== null) {
        if (date.getDay() === visit.recurringStudyDayOfWeek) {
          isEventToday = true;
        }
      }

      // Check custom exceptions
      if (visit.customDates && visit.customDates.length > 0) {
        const hasExceptionToday = visit.customDates.some(d => isSameDay(new Date(d.newDate), date));
        const hasSkippedToday = visit.customDates.some(d => isSameDay(new Date(d.originalDate), date));

        if (hasExceptionToday) isEventToday = true;
        if (hasSkippedToday) isEventToday = false;
      }
      
      return isEventToday;
    }).sort((a, b) => {
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
          return 9999; // no specific time
       };
       return getTime(a) - getTime(b);
    });
  };

  const selectedEvents = getEventsForDate(selectedDate);
  
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
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4 relative">
          <button onClick={handlePrevWeek} className="p-1 text-gray-500 hover:text-gray-800">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold text-gray-800 capitalize text-center">
              {format(selectedDate, 'MMMM yyyy', { locale })}
            </h2>
            {!isTodaySelected && (
              <button
                onClick={handleGoToToday}
                className="text-xs text-[#e07a5f] hover:text-[#c45b42] font-medium absolute top-[-10px] right-0 bg-blue-50 px-2 py-1 rounded shadow-sm border border-blue-100"
              >
                {t('goToToday', { defaultValue: 'Hoy' })}
              </button>
            )}
          </div>
          <button onClick={handleNextWeek} className="p-1 text-gray-500 hover:text-gray-800">
            <ChevronRight size={24} />
          </button>
        </div>
        
        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
          {weekDays.map(day => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayReal = isSameDay(day, new Date());
            const hasEvents = getEventsForDate(day).length > 0;
            
            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center p-2 rounded-lg min-w-[40px] relative ${
                  isSelected ? 'bg-[#e07a5f] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
                } ${isTodayReal && !isSelected ? 'ring-2 ring-[#e07a5f] ring-inset' : ''}`}
              >
                <span className="text-xs font-medium uppercase mb-1">
                  {format(day, 'E', { locale }).substring(0, 3)}
                </span>
                <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                  {format(day, 'd')}
                </span>
                {hasEvents && !isSelected && (
                  <span className="w-1.5 h-1.5 bg-[#e07a5f] rounded-full mt-1"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-bold text-gray-700 mb-3 ml-1">
          {t('agendaFor', { date: format(selectedDate, language === 'es' ? "d 'de' MMMM" : 'MMMM do', { locale }) })}
        </h3>
        
        {selectedEvents.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
            {t('noVisitsScheduled')}
          </div>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map(event => {
              let time = t('hourToBeDefined');

              if (event.customDates) {
                 const exc = event.customDates.find(d => isSameDay(new Date(d.newDate), selectedDate));
                 if (exc) {
                    const d = new Date(exc.newDate);
                    time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                 }
              }

              if (time === t('hourToBeDefined') && event.isRecurringStudy && selectedDate.getDay() === event.recurringStudyDayOfWeek && event.recurringStudyTime) {
                 time = event.recurringStudyTime;
              }

              if (time === t('hourToBeDefined') && event.nextVisitDate && isSameDay(new Date(event.nextVisitDate), selectedDate)) {
                 const d = new Date(event.nextVisitDate);
                 time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
              }

              const isRecurringToday = event.isRecurringStudy &&
                (selectedDate.getDay() === event.recurringStudyDayOfWeek ||
                 (event.customDates && event.customDates.some(d => isSameDay(new Date(d.newDate), selectedDate))));

              return (
                <div key={event.id} className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-[#e07a5f] flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-800">{event.name}</h4>
                    <p className="text-sm text-gray-500">{event.houseDescription}</p>
                    {isRecurringToday && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                        {t('bibleCourse')}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[#e07a5f]">{time}</span>
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
