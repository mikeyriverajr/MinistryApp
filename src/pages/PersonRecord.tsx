import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, FollowUpVisit } from '../db/database';
import { ArrowLeft, Navigation, Save, Plus, Edit, Trash2, Calendar, Clock } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useLanguage } from '../contexts/LanguageContext';

export default function PersonRecord() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const personId = Number(id);

  const visit = useLiveQuery(() => db.visits.get(personId), [personId]);
  const { t } = useLanguage();

  const [showAddVisit, setShowAddVisit] = useState(false);
  const [newVisitDate, setNewVisitDate] = useState<Date | null>(new Date());
  const [newVisitNotes, setNewVisitNotes] = useState('');

  const [isChangingSchedule, setIsChangingSchedule] = useState(false);
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [newScheduleDay, setNewScheduleDay] = useState(0);

  if (!visit) {
    return <div className="p-4">{t('loading')}</div>;
  }

  const handleNavigate = () => {
    if (visit.latitude && visit.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`, '_blank');
    } else {
      alert(t('noLocationSaved'));
    }
  };

  const handleDelete = async () => {
    if (window.confirm(t('deleteWarning'))) {
      try {
        await db.visits.delete(personId);
        navigate('/');
      } catch (error) {
        console.error('Error deleting record:', error);
      }
    }
  };

  const handleAddFollowUp = async () => {
    if (!newVisitDate || !newVisitNotes.trim()) {
      alert(t('enterDateAndNotes'));
      return;
    }

    const newFollowUp: FollowUpVisit = {
      id: Date.now().toString(),
      date: newVisitDate,
      notes: newVisitNotes.trim()
    };

    const currentFollowUps = visit.followUpVisits || [];

    await db.visits.update(personId, {
      followUpVisits: [...currentFollowUps, newFollowUp],
      updatedAt: new Date()
    });

    setShowAddVisit(false);
    setNewVisitDate(new Date());
    setNewVisitNotes('');
  };

  const handleScheduleChange = async (onlyNextTime: boolean) => {
    if (!newScheduleTime) return;

    if (onlyNextTime) {
      // Create a custom date exception for the next occurrence
      const today = new Date();
      let nextDate = new Date(today.getTime());

      // Find next occurrence of the *new* day
      nextDate.setDate(today.getDate() + (newScheduleDay + 7 - today.getDay()) % 7);
      if (nextDate.getDay() === today.getDay() && nextDate < today) {
        nextDate.setDate(nextDate.getDate() + 7);
      }

      // Add time
      const [hours, minutes] = newScheduleTime.split(':');
      nextDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Calculate original next date to map from
      let originalNextDate = new Date(today.getTime());
      const origDay = visit.recurringStudyDayOfWeek || 0;
      originalNextDate.setDate(today.getDate() + (origDay + 7 - today.getDay()) % 7);
      if (originalNextDate.getDay() === today.getDay() && originalNextDate < today) {
        originalNextDate.setDate(originalNextDate.getDate() + 7);
      }

      const customDates = visit.customDates || [];
      customDates.push({ originalDate: originalNextDate, newDate: nextDate });

      await db.visits.update(personId, { customDates, updatedAt: new Date() });
    } else {
      // Change for all future
      await db.visits.update(personId, {
        recurringStudyDayOfWeek: newScheduleDay,
        recurringStudyTime: newScheduleTime,
        updatedAt: new Date()
      });
    }

    setIsChangingSchedule(false);
  };

  const getNextEventDate = () => {
    if (!visit) return null;
    let nextDate: Date | null = null;

    if (visit.nextVisitDate) {
      nextDate = new Date(visit.nextVisitDate);
    } else if (visit.isRecurringStudy && visit.recurringStudyTime && visit.recurringStudyDayOfWeek !== null && visit.recurringStudyDayOfWeek !== undefined) {
      nextDate = new Date();
      let count = 0;
      while (nextDate.getDay() !== visit.recurringStudyDayOfWeek && count < 7) {
        nextDate.setDate(nextDate.getDate() + 1);
        count++;
      }
      if (visit.recurringStudyTime.includes(':')) {
        const [h, m] = visit.recurringStudyTime.split(':').map(Number);
        nextDate.setHours(h, m, 0, 0);
      }
    }

    // Check for exceptions
    if (visit.customDates) {
      const upcomingException = visit.customDates.find(d => new Date(d.newDate) >= new Date());
      if (upcomingException) {
        nextDate = new Date(upcomingException.newDate);
      }
    }
    return nextDate;
  };

  const generateICS = () => {
    const nextDate = getNextEventDate();
    if (!nextDate || !visit) return;

    const endDate = new Date(nextDate.getTime() + 60 * 60 * 1000); // 1 hour duration

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatDate(nextDate)}
DTEND:${formatDate(endDate)}
SUMMARY:Visita: ${visit.name}
DESCRIPTION:${visit.generalNotes || visit.houseDescription || ''}
LOCATION:${visit.latitude ? `${visit.latitude},${visit.longitude}` : ''}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `visita_${visit.name}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openGoogleCalendar = () => {
    const nextDate = getNextEventDate();
    if (!nextDate || !visit) return;

    const endDate = new Date(nextDate.getTime() + 60 * 60 * 1000); // 1 hour duration

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.append('action', 'TEMPLATE');
    url.searchParams.append('text', `Visita: ${visit.name}`);
    url.searchParams.append('dates', `${formatDate(nextDate)}/${formatDate(endDate)}`);
    url.searchParams.append('details', visit.generalNotes || visit.houseDescription || '');
    if (visit.latitude && visit.longitude) {
      url.searchParams.append('location', `${visit.latitude},${visit.longitude}`);
    }

    window.open(url.toString(), '_blank');
  };

  const nextEventDate = getNextEventDate();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate(-1)} className="mr-3 text-gray-500 hover:text-gray-700">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-700 flex-1">{visit.name}</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => navigate(`/edit/${personId}`)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              title={t('edit')}
            >
              <Edit size={20} />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title={t('delete')}
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {nextEventDate && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={openGoogleCalendar}
              className="flex items-center text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-100 font-medium transition-colors border border-red-200"
            >
              <Calendar size={14} className="mr-1.5" />
              {t('googleCalendar', { defaultValue: 'Google Calendar' })}
            </button>
            <button
              onClick={generateICS}
              className="flex items-center text-xs bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium transition-colors border border-blue-200"
            >
              <Calendar size={14} className="mr-1.5" />
              {t('downloadICS', { defaultValue: 'Descargar .ics' })}
            </button>
          </div>
        )}

        {visit.latitude && visit.longitude && (
          <div className="mb-4">
            <button
              onClick={handleNavigate}
              className="flex items-center text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium transition-colors"
            >
              <Navigation size={16} className="mr-1.5" />
              {t('navigateMap')}
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('houseDescription')}</h3>
            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">{visit.houseDescription || t('noDescription')}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('interestLevel')}</h3>
              <p className="text-gray-700 font-medium">{visit.interestLevel === 'Alto' ? t('high') : visit.interestLevel === 'Medio' ? t('medium') : t('low')}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('bibleCourse')}</h3>
              <p className="text-gray-700 font-medium">{visit.isRecurringStudy ? t('yes') : t('no')}</p>
            </div>
          </div>

          {visit.isRecurringStudy && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wider flex items-center">
                  <Calendar size={14} className="mr-1" />
                  {t('regularTime')}
                </h3>
                {!isChangingSchedule && (
                  <button
                    onClick={() => {
                      setNewScheduleDay(visit.recurringStudyDayOfWeek || 0);
                      setNewScheduleTime(visit.recurringStudyTime || '10:00');
                      setIsChangingSchedule(true);
                    }}
                    className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    {t('changeSchedule')}
                  </button>
                )}
              </div>

              {!isChangingSchedule ? (
                <div className="flex items-center text-blue-900 font-medium">
                  <Clock size={16} className="mr-2 text-blue-600" />
                  <span>
                    {visit.recurringStudyDayOfWeek === 0 ? t('sunday') :
                     visit.recurringStudyDayOfWeek === 1 ? t('monday') :
                     visit.recurringStudyDayOfWeek === 2 ? t('tuesday') :
                     visit.recurringStudyDayOfWeek === 3 ? t('wednesday') :
                     visit.recurringStudyDayOfWeek === 4 ? t('thursday') :
                     visit.recurringStudyDayOfWeek === 5 ? t('friday') : t('saturday')} a las {visit.recurringStudyTime}
                  </span>
                </div>
              ) : (
                <div className="mt-3 space-y-3 bg-white p-3 rounded-md border border-blue-200">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newScheduleDay}
                      onChange={(e) => setNewScheduleDay(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
                    >
                      <option value="0">{t('sunday')}</option>
                      <option value="1">{t('monday')}</option>
                      <option value="2">{t('tuesday')}</option>
                      <option value="3">{t('wednesday')}</option>
                      <option value="4">{t('thursday')}</option>
                      <option value="5">{t('friday')}</option>
                      <option value="6">{t('saturday')}</option>
                    </select>
                    <input
                      type="time"
                      value={newScheduleTime}
                      onChange={(e) => setNewScheduleTime(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setIsChangingSchedule(false)}
                      className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={() => handleScheduleChange(true)}
                      className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded font-medium"
                    >
                      {t('nextTimeOnly')}
                    </button>
                    <button
                      onClick={() => handleScheduleChange(false)}
                      className="text-xs px-2 py-1 bg-[#e07a5f] text-white hover:bg-[#c45b42] rounded font-medium"
                    >
                      {t('allFutureEvents')}
                    </button>
                  </div>
                </div>
              )}

              {visit.customDates && visit.customDates.length > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <h4 className="text-xs font-semibold text-blue-800 mb-1">{t('exceptionDate')}</h4>
                  {visit.customDates.filter(d => new Date(d.newDate) >= new Date()).map((d, i) => (
                    <div key={i} className="text-sm text-blue-900 bg-white px-2 py-1 rounded inline-block mr-2 mb-2 border border-blue-100">
                      {new Date(d.newDate).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-700">{t('visitHistory')}</h3>
          <button
            onClick={() => setShowAddVisit(!showAddVisit)}
            className="flex items-center text-sm bg-[#e07a5f] text-white px-3 py-1.5 rounded-lg hover:bg-[#c45b42] font-medium transition-colors"
          >
            <Plus size={16} className="mr-1" />
            {t('newVisit')}
          </button>
        </div>

        {showAddVisit && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('date')}</label>
              <DatePicker
                selected={newVisitDate}
                onChange={(date: Date | null) => setNewVisitDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                timeCaption={t('time')}
                dateFormat="d MMMM yyyy, h:mm aa"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
              <textarea
                value={newVisitNotes}
                onChange={(e) => setNewVisitNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
                placeholder={t('visitNotesPlaceholder')}
              />
            </div>

            {!visit.isRecurringStudy && (
              <div className="border-t border-gray-200 pt-3 mt-1">
                 <label className="flex items-center">
                    <input
                      type="checkbox"
                      onChange={async (e) => {
                        if (e.target.checked) {
                          const now = new Date();
                          const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                          await db.visits.update(personId, {
                            isRecurringStudy: true,
                            recurringStudyDayOfWeek: now.getDay(),
                            recurringStudyTime: timeString,
                            updatedAt: new Date()
                          });
                          alert(t('startedBibleCourse'));
                        }
                      }}
                      className="mr-2 h-4 w-4 text-[#e07a5f] focus:ring-[#e07a5f] border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">{t('establishedBibleCourse')}</span>
                 </label>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowAddVisit(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddFollowUp}
                className="px-4 py-2 flex items-center text-sm font-medium text-white bg-[#e07a5f] hover:bg-[#c45b42] rounded-md"
              >
                <Save size={16} className="mr-1.5" />
                {t('save')}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4 relative">
          <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200 z-0"></div>

          <div className="relative z-10 pl-10">
            <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-blue-600 shadow-sm">
              <span className="text-xs font-bold">1</span>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-gray-700">{t('initialVisit')}</span>
                <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">
                  {new Date(visit.dateFound).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-600">{visit.generalNotes || t('withoutNotes')}</p>
            </div>
          </div>

          {(visit.followUpVisits || []).map((followUp, index) => (
            <div key={followUp.id} className="relative z-10 pl-10">
              <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-green-100 border-2 border-white flex items-center justify-center text-green-600 shadow-sm">
                <span className="text-xs font-bold">{index + 2}</span>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-700">{t('returnVisit')}</span>
                  <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">
                    {new Date(followUp.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{followUp.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
