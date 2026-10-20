import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, FollowUpVisit, incrementPendingBackupChanges } from '../db/database';
import {
  ArrowLeft,
  Navigation,
  Save,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Clock,
  MessageCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { isSameDay } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { formatTime } from '../utils/timeFormat';
import { toast } from 'react-hot-toast';

export default function PersonRecord() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const personId = Number(id);

  const visit = useLiveQuery(() => db.visits.get(personId), [personId]);
  const { t } = useLanguage();
  const { timeFormat } = useSettings();

  const [showAddVisit, setShowAddVisit] = useState(false);
  const [newVisitDate, setNewVisitDate] = useState<Date | null>(new Date());
  const [newVisitNotes, setNewVisitNotes] = useState('');
  const [scheduledNextVisitDate, setScheduledNextVisitDate] = useState<Date | null>(null);

  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [editFollowUpDate, setEditFollowUpDate] = useState<Date | null>(new Date());
  const [editFollowUpNotes, setEditFollowUpNotes] = useState('');
  const [deletingFollowUpId, setDeletingFollowUpId] = useState<string | null>(null);

  const [showDeletePersonModal, setShowDeletePersonModal] = useState(false);

  const [isChangingSchedule, setIsChangingSchedule] = useState(false);
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [newScheduleDay, setNewScheduleDay] = useState(0);

  if (!visit) {
    return <div className="p-4 text-slate-600 dark:text-slate-300">{t('loading')}</div>;
  }

  const confirmDeletePerson = async () => {
    setShowDeletePersonModal(false);
    try {
      await db.visits.delete(personId);
      incrementPendingBackupChanges();
      toast.success(t('deleteEntry'));
      navigate('/');
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error(t('deleteError'));
    }
  };

  const handleAddFollowUp = async () => {
    if (!newVisitDate || !newVisitNotes.trim()) {
      toast.error(t('enterDateAndNotes'));
      return;
    }

    const newFollowUp: FollowUpVisit = {
      id: Date.now().toString(),
      date: newVisitDate,
      notes: newVisitNotes.trim()
    };

    const currentFollowUps = visit.followUpVisits || [];
    const updates: Partial<typeof visit> = {
      followUpVisits: [...currentFollowUps, newFollowUp],
      updatedAt: new Date()
    };

    if (scheduledNextVisitDate) {
      updates.nextVisitDate = scheduledNextVisitDate;
    }

    await db.visits.update(personId, updates);
    incrementPendingBackupChanges();

    setShowAddVisit(false);
    setNewVisitDate(new Date());
    setNewVisitNotes('');
    setScheduledNextVisitDate(null);
    toast.success(t('saveSuccess'));
  };

  const startEditFollowUp = (followUp: FollowUpVisit) => {
    setEditingFollowUpId(followUp.id);
    setEditFollowUpDate(new Date(followUp.date));
    setEditFollowUpNotes(followUp.notes);
  };

  const handleSaveEditFollowUp = async () => {
    if (!editingFollowUpId || !editFollowUpDate || !editFollowUpNotes.trim()) {
      toast.error(t('enterDateAndNotes'));
      return;
    }

    const updatedList = (visit.followUpVisits || []).map(f =>
      f.id === editingFollowUpId
        ? { ...f, date: editFollowUpDate, notes: editFollowUpNotes.trim() }
        : f
    );

    await db.visits.update(personId, {
      followUpVisits: updatedList,
      updatedAt: new Date()
    });
    incrementPendingBackupChanges();
    setEditingFollowUpId(null);
    toast.success(t('updateSuccess'));
  };

  const confirmDeleteFollowUp = async () => {
    if (!deletingFollowUpId) return;
    const updatedList = (visit.followUpVisits || []).filter(f => f.id !== deletingFollowUpId);
    await db.visits.update(personId, {
      followUpVisits: updatedList,
      updatedAt: new Date()
    });
    incrementPendingBackupChanges();
    setDeletingFollowUpId(null);
    toast.success(t('deleteEntry'));
  };

  const handleScheduleChange = async (onlyNextTime: boolean) => {
    if (!newScheduleTime) return;

    if (onlyNextTime) {
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Compute the upcoming occurrence of the original recurring study day
      const origDay = visit.recurringStudyDayOfWeek ?? 0;
      const daysUntilOrig = (origDay + 7 - todayMidnight.getDay()) % 7;
      const originalNextDate = new Date(todayMidnight);
      originalNextDate.setDate(todayMidnight.getDate() + daysUntilOrig);

      // Compute the upcoming occurrence of the newly selected exception day
      const daysUntilNew = (newScheduleDay + 7 - todayMidnight.getDay()) % 7;
      const nextDate = new Date(todayMidnight);
      nextDate.setDate(todayMidnight.getDate() + daysUntilNew);

      const [hours, minutes] = newScheduleTime.split(':').map(Number);
      nextDate.setHours(hours || 0, minutes || 0, 0, 0);

      if (nextDate < now) {
        nextDate.setDate(nextDate.getDate() + 7);
      }

      // Filter out expired exceptions and any existing exception for the same original date
      const existingValid = (visit.customDates || []).filter(
        d => new Date(d.newDate) >= todayMidnight && !isSameDay(new Date(d.originalDate), originalNextDate)
      );

      existingValid.push({ originalDate: originalNextDate, newDate: nextDate });

      await db.visits.update(personId, { customDates: existingValid, updatedAt: new Date() });
    } else {
      await db.visits.update(personId, {
        recurringStudyDayOfWeek: newScheduleDay,
        recurringStudyTime: newScheduleTime,
        updatedAt: new Date()
      });
    }

    incrementPendingBackupChanges();
    setIsChangingSchedule(false);
    toast.success(t('updateSuccess'));
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

    const endDate = new Date(nextDate.getTime() + 60 * 60 * 1000);

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatDate(nextDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${t('visit')}: ${visit.name}
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
    window.URL.revokeObjectURL(url);
  };

  const getWhatsAppShareUrl = () => {
    let text = `*${visit.name}*\n\n`;
    if (visit.generalNotes || visit.houseDescription) {
      text += `${visit.generalNotes || visit.houseDescription}\n\n`;
    }

    const dateFoundStr = new Date(visit.dateFound).toLocaleDateString();
    text += `${t('found')}: ${dateFoundStr}\n`;

    if (visit.latitude && visit.longitude) {
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`;
      text += `\n${t('gpsLocation')}:\n${mapsUrl}`;
    }

    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const getGoogleCalendarUrl = () => {
    const nextDate = getNextEventDate();
    if (!nextDate || !visit) return '#';

    const endDate = new Date(nextDate.getTime() + 60 * 60 * 1000);
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');

    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.append('action', 'TEMPLATE');
    url.searchParams.append('text', `${t('visit')}: ${visit.name}`);
    url.searchParams.append('dates', `${formatDate(nextDate)}/${formatDate(endDate)}`);
    url.searchParams.append('details', visit.generalNotes || visit.houseDescription || '');
    if (visit.latitude && visit.longitude) {
      url.searchParams.append('location', `${visit.latitude},${visit.longitude}`);
    }
    return url.toString();
  };

  const nextEventDate = getNextEventDate();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center mb-5">
          <button
            onClick={() => navigate(-1)}
            className="min-h-[44px] min-w-[44px] -ml-2 mr-1 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-full"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex-1 truncate">{visit.name}</h2>
          <div className="flex space-x-1">
            <button
              onClick={() => navigate(`/edit/${personId}`)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              title={t('edit')}
            >
              <Edit size={20} />
            </button>
            <button
              onClick={() => setShowDeletePersonModal(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-full transition-colors"
              title={t('delete')}
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {nextEventDate && (
            <>
              <a
                href={getGoogleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] flex items-center text-xs bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-xl hover:bg-red-100 font-medium transition-colors border border-red-200 dark:border-red-800/60"
              >
                <Calendar size={14} className="mr-1.5" />
                {t('googleCalendar')}
              </a>
              <button
                onClick={generateICS}
                className="min-h-[38px] flex items-center text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 px-3 py-1.5 rounded-xl hover:bg-blue-100 font-medium transition-colors border border-blue-200 dark:border-blue-800/60"
              >
                <Calendar size={14} className="mr-1.5" />
                {t('downloadICS')}
              </button>
            </>
          )}
          <a
            href={getWhatsAppShareUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] flex items-center text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-xl hover:bg-emerald-100 font-medium transition-colors border border-emerald-200 dark:border-emerald-800/60"
          >
            <MessageCircle size={14} className="mr-1.5" />
            {t('shareViaWhatsApp')}
          </a>
          {visit.latitude && visit.longitude && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[38px] flex items-center text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-200 font-medium transition-colors border border-slate-200 dark:border-slate-700"
            >
              <Navigation size={14} className="mr-1.5 text-primary" />
              {t('navigateMap')}
            </a>
          )}
        </div>

        <div className="space-y-4">
          {visit.phoneNumber && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('phoneNumber')}</h3>
              <div className="flex items-center gap-3">
                <p className="text-slate-800 dark:text-slate-100 tabular-nums">{visit.phoneNumber}</p>
                <a
                  href={`https://wa.me/${visit.phoneNumber.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 px-2.5 py-1 rounded-lg font-medium transition-colors"
                >
                  {t('sendWhatsApp')}
                </a>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('houseDescription')}</h3>
            <p className="text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-sm">
              {visit.houseDescription || t('noDescription')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('interestLevel')}</h3>
              <p className="text-slate-800 dark:text-slate-100 font-semibold">
                {visit.interestLevel === 'Alto' ? t('high') : visit.interestLevel === 'Medio' ? t('medium') : t('low')}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('bibleCourse')}</h3>
              <p className="text-slate-800 dark:text-slate-100 font-semibold">{visit.isRecurringStudy ? t('yes') : t('no')}</p>
            </div>
          </div>

          {visit.nextVisitDate && (
            <div className="pt-1">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('sortNextVisit')}</h3>
              <p className="text-primary font-semibold text-sm tabular-nums">
                {new Date(visit.nextVisitDate).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}

          {visit.isRecurringStudy && (
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center">
                  <Calendar size={14} className="mr-1.5 text-primary" />
                  {t('regularTime')}
                </h3>
                {!isChangingSchedule && (
                  <button
                    onClick={() => {
                      setNewScheduleDay(visit.recurringStudyDayOfWeek || 0);
                      setNewScheduleTime(visit.recurringStudyTime || '10:00');
                      setIsChangingSchedule(true);
                    }}
                    className="text-xs bg-white dark:bg-slate-800 text-primary border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg hover:border-primary font-medium"
                  >
                    {t('changeSchedule')}
                  </button>
                )}
              </div>

              {!isChangingSchedule ? (
                <div className="flex items-center text-slate-800 dark:text-slate-100 font-medium text-sm">
                  <Clock size={16} className="mr-2 text-primary" />
                  <span>
                    {visit.recurringStudyDayOfWeek === 0 ? t('sunday') :
                     visit.recurringStudyDayOfWeek === 1 ? t('monday') :
                     visit.recurringStudyDayOfWeek === 2 ? t('tuesday') :
                     visit.recurringStudyDayOfWeek === 3 ? t('wednesday') :
                     visit.recurringStudyDayOfWeek === 4 ? t('thursday') :
                     visit.recurringStudyDayOfWeek === 5 ? t('friday') : t('saturday')} {t('atTime')} {formatTime(visit.recurringStudyTime, timeFormat === '12h')}
                  </span>
                </div>
              ) : (
                <div className="mt-3 space-y-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newScheduleDay}
                      onChange={(e) => setNewScheduleDay(Number(e.target.value))}
                      className="w-full px-2.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
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
                      className="w-full px-2.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setIsChangingSchedule(false)}
                      className="min-h-[36px] text-xs px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={() => handleScheduleChange(true)}
                      className="min-h-[36px] text-xs px-3 py-1.5 bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 hover:bg-amber-200 rounded-lg font-medium"
                    >
                      {t('nextTimeOnly')}
                    </button>
                    <button
                      onClick={() => handleScheduleChange(false)}
                      className="min-h-[36px] text-xs px-3 py-1.5 bg-primary text-white hover:bg-primary-dark rounded-lg font-medium"
                    >
                      {t('allFutureEvents')}
                    </button>
                  </div>
                </div>
              )}

              {visit.customDates && visit.customDates.filter(d => new Date(d.newDate) >= new Date()).length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{t('exceptionDate')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {visit.customDates
                      .filter(d => new Date(d.newDate) >= new Date())
                      .map((d, i) => (
                        <span
                          key={i}
                          className="text-xs text-primary font-medium bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 tabular-nums"
                        >
                          {new Date(d.newDate).toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('visitHistory')}</h3>
          <button
            onClick={() => setShowAddVisit(!showAddVisit)}
            className="min-h-[40px] flex items-center text-sm bg-primary text-white px-3.5 py-2 rounded-xl hover:bg-primary-dark font-medium transition-colors"
          >
            <Plus size={16} className="mr-1.5" />
            {t('newVisit')}
          </button>
        </div>

        {showAddVisit && (
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('date')}</label>
              <DatePicker
                selected={newVisitDate}
                onChange={(date: Date | null) => setNewVisitDate(date)}
                showTimeSelect
                timeFormat={timeFormat === '12h' ? "h:mm aa" : "HH:mm"}
                timeIntervals={15}
                timeCaption={t('time')}
                dateFormat={timeFormat === '12h' ? "d MMMM yyyy, h:mm aa" : "d MMMM yyyy, HH:mm"}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('notes')}</label>
              <textarea
                value={newVisitNotes}
                onChange={(e) => setNewVisitNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t('visitNotesPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('nextVisitDateOptional')}
              </label>
              <DatePicker
                selected={scheduledNextVisitDate}
                onChange={(date: Date | null) => setScheduledNextVisitDate(date)}
                showTimeSelect
                isClearable
                placeholderText={t('selectDateAndTime')}
                timeFormat={timeFormat === '12h' ? "h:mm aa" : "HH:mm"}
                timeIntervals={15}
                timeCaption={t('time')}
                dateFormat={timeFormat === '12h' ? "d MMMM yyyy, h:mm aa" : "d MMMM yyyy, HH:mm"}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {!visit.isRecurringStudy && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-1">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    onChange={async (e) => {
                      if (e.target.checked) {
                        const now = new Date();
                        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

                        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                        const currentStats = await db.monthlyStats.get(monthStr);
                        const activeCount = await db.visits.filter(v => Boolean(v.isRecurringStudy)).count();
                        const newCount = currentStats ? currentStats.studyCount + 1 : activeCount + 1;
                        await db.monthlyStats.put({ month: monthStr, studyCount: newCount });

                        await db.visits.update(personId, {
                          isRecurringStudy: true,
                          recurringStudyDayOfWeek: now.getDay(),
                          recurringStudyTime: timeString,
                          updatedAt: new Date()
                        });
                        incrementPendingBackupChanges();
                        toast.success(t('startedBibleCourse'));
                      }
                    }}
                    className="mr-2 h-4 w-4 accent-primary border-slate-300 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('establishedBibleCourse')}</span>
                </label>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowAddVisit(false)}
                className="min-h-[40px] px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-700 hover:bg-slate-300 rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddFollowUp}
                className="min-h-[40px] px-4 py-2 flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg"
              >
                <Save size={16} className="mr-1.5" />
                {t('save')}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4 relative">
          <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 z-0"></div>

          {/* Initial Visit */}
          <div className="relative z-10 pl-10">
            <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 border-2 border-white dark:border-slate-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
              <span className="text-xs font-bold tabular-nums">1</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{t('initialVisit')}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {new Date(visit.dateFound).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{visit.generalNotes || t('withoutNotes')}</p>
            </div>
          </div>

          {/* Return Visits */}
          {(visit.followUpVisits || []).map((followUp, index) => {
            const isEditingThis = editingFollowUpId === followUp.id;

            return (
              <div key={followUp.id} className="relative z-10 pl-10">
                <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 border-2 border-white dark:border-slate-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
                  <span className="text-xs font-bold tabular-nums">{index + 2}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  {isEditingThis ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('date')}</label>
                        <DatePicker
                          selected={editFollowUpDate}
                          onChange={(d: Date | null) => setEditFollowUpDate(d)}
                          showTimeSelect
                          timeFormat={timeFormat === '12h' ? "h:mm aa" : "HH:mm"}
                          timeIntervals={15}
                          dateFormat={timeFormat === '12h' ? "d MMMM yyyy, h:mm aa" : "d MMMM yyyy, HH:mm"}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('notes')}</label>
                        <textarea
                          rows={2}
                          value={editFollowUpNotes}
                          onChange={(e) => setEditFollowUpNotes(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingFollowUpId(null)}
                          className="min-h-[36px] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          onClick={handleSaveEditFollowUp}
                          className="min-h-[36px] px-3 py-1 text-xs font-medium text-white bg-primary hover:bg-primary-dark rounded-lg flex items-center gap-1"
                        >
                          <Save size={14} />
                          {t('save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{t('returnVisit')}</span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {new Date(followUp.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center -mr-2">
                          <button
                            onClick={() => startEditFollowUp(followUp)}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full"
                            title={t('editVisit')}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingFollowUpId(followUp.id)}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-500 rounded-full"
                            title={t('deleteVisit')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{followUp.notes}</p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Person Confirmation Modal */}
      {showDeletePersonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center text-red-600 dark:text-red-400">
                <AlertTriangle size={20} className="mr-2" />
                <h3 className="font-bold">{t('delete')}</h3>
              </div>
              <button
                onClick={() => setShowDeletePersonModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">{t('deleteWarning')}</p>
            </div>
            <div className="flex border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowDeletePersonModal(false)}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmDeletePerson}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Follow-Up Visit Confirmation Modal */}
      {deletingFollowUpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center text-red-600 dark:text-red-400">
                <AlertTriangle size={20} className="mr-2" />
                <h3 className="font-bold">{t('deleteVisit')}</h3>
              </div>
              <button
                onClick={() => setDeletingFollowUpId(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">{t('deleteVisitWarning')}</p>
            </div>
            <div className="flex border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDeletingFollowUpId(null)}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmDeleteFollowUp}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
