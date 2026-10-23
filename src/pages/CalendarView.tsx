import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { format, startOfWeek, addDays, subDays, isSameDay } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Users, Navigation } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { formatTimeFromDate, formatTime } from '../utils/timeFormat';

type AgendaFilter = 'all' | 'mine' | 'partner';

interface UnifiedAgendaEvent {
  uidKey: string;
  id?: number;
  name: string;
  houseDescription: string;
  generalNotes: string;
  isRecurringToday: boolean;
  timeDisplay: string;
  sortMinutes: number;
  isPartner: boolean;
  latitude: number | null;
  longitude: number | null;
}

export default function CalendarView() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>('all');

  const visits = useLiveQuery(() => db.visits.toArray());
  const { t, language } = useLanguage();
  const { timeFormat } = useSettings();
  const { linkedPartnerCode, partnerName, partnerVisits, showPartnerData } = useCloudSync();
  const locale = language === 'es' ? es : enUS;

  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const getEventsForDate = (date: Date): UnifiedAgendaEvent[] => {
    const results: UnifiedAgendaEvent[] = [];

    const includeMine = agendaFilter === 'all' || agendaFilter === 'mine';
    const includePartner =
      Boolean(linkedPartnerCode && showPartnerData) &&
      (agendaFilter === 'all' || agendaFilter === 'partner');

    if (includeMine && visits) {
      visits.forEach((visit) => {
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
          const hasExceptionToday = visit.customDates.some((d) =>
            isSameDay(new Date(d.newDate), date)
          );
          const hasSkippedToday = visit.customDates.some((d) =>
            isSameDay(new Date(d.originalDate), date)
          );

          if (hasExceptionToday) isEventToday = true;
          if (hasSkippedToday && !hasExceptionToday) isEventToday = false;
        }

        if (!isEventToday) return;

        let timeDisplay = t('hourToBeDefined');
        let sortMinutes = 9999;

        if (visit.customDates) {
          const exc = visit.customDates.find((d) => isSameDay(new Date(d.newDate), date));
          if (exc) {
            const d = new Date(exc.newDate);
            timeDisplay = formatTimeFromDate(d, timeFormat === '12h');
            sortMinutes = d.getHours() * 60 + d.getMinutes();
          }
        }

        if (
          timeDisplay === t('hourToBeDefined') &&
          visit.isRecurringStudy &&
          date.getDay() === visit.recurringStudyDayOfWeek &&
          visit.recurringStudyTime
        ) {
          timeDisplay = formatTime(visit.recurringStudyTime, timeFormat === '12h');
          if (visit.recurringStudyTime.includes(':')) {
            const [h, m] = visit.recurringStudyTime.split(':').map(Number);
            sortMinutes = h * 60 + m;
          }
        }

        if (
          timeDisplay === t('hourToBeDefined') &&
          visit.nextVisitDate &&
          isSameDay(new Date(visit.nextVisitDate), date)
        ) {
          const d = new Date(visit.nextVisitDate);
          timeDisplay = formatTimeFromDate(d, timeFormat === '12h');
          sortMinutes = d.getHours() * 60 + d.getMinutes();
        }

        const isRecurringToday = Boolean(
          visit.isRecurringStudy &&
            (date.getDay() === visit.recurringStudyDayOfWeek ||
              (visit.customDates &&
                visit.customDates.some((d) => isSameDay(new Date(d.newDate), date))))
        );

        results.push({
          uidKey: `mine-${visit.id}`,
          id: visit.id,
          name: visit.name,
          houseDescription: visit.houseDescription,
          generalNotes: visit.generalNotes,
          isRecurringToday,
          timeDisplay,
          sortMinutes,
          isPartner: false,
          latitude: visit.latitude,
          longitude: visit.longitude,
        });
      });
    }

    if (includePartner && partnerVisits.length > 0) {
      partnerVisits.forEach((pv, idx) => {
        let isEventToday = false;

        if (pv.nextVisitDate && isSameDay(new Date(pv.nextVisitDate), date)) {
          isEventToday = true;
        }

        if (pv.isRecurringStudy && pv.recurringStudyDayOfWeek !== null) {
          if (date.getDay() === pv.recurringStudyDayOfWeek) {
            isEventToday = true;
          }
        }

        if (pv.customDates && pv.customDates.length > 0) {
          const hasExceptionToday = pv.customDates.some((d) =>
            isSameDay(new Date(d.newDate), date)
          );
          const hasSkippedToday = pv.customDates.some((d) =>
            isSameDay(new Date(d.originalDate), date)
          );

          if (hasExceptionToday) isEventToday = true;
          if (hasSkippedToday && !hasExceptionToday) isEventToday = false;
        }

        if (!isEventToday) return;

        let timeDisplay = t('hourToBeDefined');
        let sortMinutes = 9999;

        if (pv.customDates) {
          const exc = pv.customDates.find((d) => isSameDay(new Date(d.newDate), date));
          if (exc) {
            const d = new Date(exc.newDate);
            timeDisplay = formatTimeFromDate(d, timeFormat === '12h');
            sortMinutes = d.getHours() * 60 + d.getMinutes();
          }
        }

        if (
          timeDisplay === t('hourToBeDefined') &&
          pv.isRecurringStudy &&
          date.getDay() === pv.recurringStudyDayOfWeek &&
          pv.recurringStudyTime
        ) {
          timeDisplay = formatTime(pv.recurringStudyTime, timeFormat === '12h');
          if (pv.recurringStudyTime.includes(':')) {
            const [h, m] = pv.recurringStudyTime.split(':').map(Number);
            sortMinutes = h * 60 + m;
          }
        }

        if (
          timeDisplay === t('hourToBeDefined') &&
          pv.nextVisitDate &&
          isSameDay(new Date(pv.nextVisitDate), date)
        ) {
          const d = new Date(pv.nextVisitDate);
          timeDisplay = formatTimeFromDate(d, timeFormat === '12h');
          sortMinutes = d.getHours() * 60 + d.getMinutes();
        }

        const isRecurringToday = Boolean(
          pv.isRecurringStudy &&
            (date.getDay() === pv.recurringStudyDayOfWeek ||
              (pv.customDates &&
                pv.customDates.some((d) => isSameDay(new Date(d.newDate), date))))
        );

        results.push({
          uidKey: `partner-${pv.id}-${idx}`,
          id: pv.id,
          name: pv.name,
          houseDescription: pv.houseDescription,
          generalNotes: pv.generalNotes,
          isRecurringToday,
          timeDisplay,
          sortMinutes,
          isPartner: true,
          latitude: pv.latitude,
          longitude: pv.longitude,
        });
      });
    }

    return results.sort((a, b) => a.sortMinutes - b.sortMinutes);
  };

  const combinedSelectedEvents = getEventsForDate(selectedDate);

  const handlePrevWeek = () => {
    setSelectedDate((prev) => subDays(prev, 7));
  };

  const handleNextWeek = () => {
    setSelectedDate((prev) => addDays(prev, 7));
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
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayReal = isSameDay(day, new Date());
            const dayEvents = getEventsForDate(day);
            const hasMine = dayEvents.some((e) => !e.isPartner);
            const hasPartner = dayEvents.some((e) => e.isPartner);

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
                <span
                  className={`text-base font-bold tabular-nums ${
                    isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {(hasMine || hasPartner) && !isSelected && (
                  <div className="flex items-center gap-1 mt-1">
                    {hasMine && <span className="w-1.5 h-1.5 bg-primary rounded-full" />}
                    {hasPartner && <span className="w-1.5 h-1.5 bg-violet-500 rounded-full" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 ml-1">
            {t('agendaFor', {
              date: format(selectedDate, language === 'es' ? "d 'de' MMMM" : 'MMMM do', { locale }),
            })}
          </h3>

          {linkedPartnerCode && showPartnerData && (
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAgendaFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  agendaFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('filterAllPins')}
              </button>
              <button
                type="button"
                onClick={() => setAgendaFilter('mine')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  agendaFilter === 'mine'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('filterMyPins')}
              </button>
              <button
                type="button"
                onClick={() => setAgendaFilter('partner')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  agendaFilter === 'partner'
                    ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('filterPartnerPins', { name: partnerName || 'Compañero' })}
              </button>
            </div>
          )}
        </div>

        {combinedSelectedEvents.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
            {t('noVisitsScheduled')}
          </div>
        ) : (
          <div className="space-y-3">
            {combinedSelectedEvents.map((event) => (
              <div
                key={event.uidKey}
                onClick={() => {
                  if (!event.isPartner && event.id) {
                    navigate(`/person/${event.id}`);
                  }
                }}
                className={`bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border transition-colors flex justify-between items-center gap-3 ${
                  event.isPartner
                    ? 'border-violet-200 dark:border-violet-900/60'
                    : 'border-slate-200 dark:border-slate-800 hover:border-primary cursor-pointer'
                }`}
              >
                <div className="min-w-0">
                  {event.isPartner && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 mb-0.5">
                      <Users size={12} />
                      <span>{t('partnerScheduleBadge', { name: partnerName || 'Compañero' })}</span>
                    </div>
                  )}
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">
                    {event.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                    <span className="truncate">
                      {event.houseDescription || event.generalNotes || t('withoutNotes')}
                    </span>
                    {event.isRecurringToday && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-medium ${
                            event.isPartner
                              ? 'text-violet-600 dark:text-violet-400'
                              : 'text-primary'
                          }`}
                        >
                          {t('bibleCourse')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {event.isPartner && event.latitude !== null && event.longitude !== null && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="min-h-[36px] px-2.5 py-1.5 bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300 rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-violet-100 no-underline"
                      title={t('navigateMap')}
                    >
                      <Navigation size={13} />
                      <span className="hidden sm:inline">{t('navigateMap')}</span>
                    </a>
                  )}
                  <span
                    className={`text-base font-bold tabular-nums ${
                      event.isPartner
                        ? 'text-violet-600 dark:text-violet-400'
                        : 'text-primary'
                    }`}
                  >
                    {event.timeDisplay}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
