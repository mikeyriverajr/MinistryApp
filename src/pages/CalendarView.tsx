import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { format, startOfWeek, addDays, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarView() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const visits = useLiveQuery(() => db.visits.toArray());

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

      return isEventToday;
    });
  };

  const selectedEvents = getEventsForDate(selectedDate);

  const handlePrevWeek = () => {
    setSelectedDate(prev => subDays(prev, 7));
  };

  const handleNextWeek = () => {
    setSelectedDate(prev => addDays(prev, 7));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <button onClick={handlePrevWeek} className="p-1 text-gray-500 hover:text-gray-800">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-bold text-gray-800 capitalize text-center">
            {format(selectedDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <button onClick={handleNextWeek} className="p-1 text-gray-500 hover:text-gray-800">
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
          {weekDays.map(day => {
            const isSelected = isSameDay(day, selectedDate);
            const hasEvents = getEventsForDate(day).length > 0;

            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center p-2 rounded-lg min-w-[40px] ${
                  isSelected ? 'bg-[#26818E] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="text-xs font-medium uppercase mb-1">
                  {format(day, 'E', { locale: es }).substring(0, 3)}
                </span>
                <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                  {format(day, 'd')}
                </span>
                {hasEvents && !isSelected && (
                  <span className="w-1.5 h-1.5 bg-[#26818E] rounded-full mt-1"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-bold text-gray-700 mb-3 ml-1">
          Agenda para el {format(selectedDate, "d 'de' MMMM", { locale: es })}
        </h3>

        {selectedEvents.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
            No tienes revisitas ni estudios programados para este día.
          </div>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map(event => {
              const isRecurringToday = event.isRecurringStudy && selectedDate.getDay() === event.recurringStudyDayOfWeek;
              const time = isRecurringToday && event.recurringStudyTime
                ? event.recurringStudyTime
                : (event.nextVisitDate ? format(new Date(event.nextVisitDate), 'HH:mm') : 'Hora por definir');

              return (
                <div key={event.id} className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-[#26818E] flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-800">{event.name}</h4>
                    <p className="text-sm text-gray-500">{event.houseDescription}</p>
                    {isRecurringToday && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                        Estudio Bíblico
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[#26818E]">{time}</span>
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
