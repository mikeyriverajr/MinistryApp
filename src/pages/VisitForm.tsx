import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Visit, incrementPendingBackupChanges } from '../db/database';
import { MapPin, Save, ArrowLeft, Check, Maximize, X, AlertTriangle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, LayersControl } from 'react-leaflet';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { formatTime } from '../utils/timeFormat';
import { defaultSelectedIcon } from '../utils/mapIcons';
import { toast } from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';

function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={defaultSelectedIcon}></Marker>
  );
}

function MapUpdater({ center, isFullscreen }: { center: [number, number], isFullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
      map.setView(center, map.getZoom());
    }, 100);
  }, [isFullscreen, map, center]);

  return null;
}

export default function VisitForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const { timeFormat } = useSettings();
  const personId = id ? Number(id) : null;

  const existingVisit = useLiveQuery(
    () => personId ? db.visits.get(personId) : undefined,
    [personId]
  );

  const { t } = useLanguage();
  const [isLocating, setIsLocating] = useState(false);
  const [coordinatesInput, setCoordinatesInput] = useState('');
  const [linkError, setLinkError] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const [formData, setFormData] = useState<Partial<Visit>>({
    name: '',
    phoneNumber: '',
    dateFound: new Date(),
    latitude: null,
    longitude: null,
    houseDescription: '',
    generalNotes: '',
    nextVisitDate: null,
    interestLevel: 'Medio',
    isRecurringStudy: false,
    recurringStudyDayOfWeek: 0,
    recurringStudyTime: '10:00',
  });

  useEffect(() => {
    if (isEditing && existingVisit) {
      setFormData(existingVisit);
    }
  }, [isEditing, existingVisit]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation([position.coords.latitude, position.coords.longitude]),
        (error) => console.error("Error obtaining location", error)
      );
    }
  }, []);

  const handleGetLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
          setIsLocating(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error(t('locationError'));
          setIsLocating(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      toast.error(t('locationNotSupported'));
      setIsLocating(false);
    }
  };

  const handleMapClick = (pos: [number, number]) => {
    setFormData(prev => ({
      ...prev,
      latitude: pos[0],
      longitude: pos[1]
    }));
  };

  const handleCoordinatesApply = () => {
    setLinkError('');
    if (!coordinatesInput.trim()) return;

    const regex = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;
    const match = coordinatesInput.match(regex);

    if (match && match[1] && match[2]) {
      setFormData(prev => ({
        ...prev,
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2])
      }));
      setCoordinatesInput('');
    } else {
      setLinkError(t('linkError'));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'recurringStudyDayOfWeek') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDateChange = (date: Date | null, fieldName: 'dateFound' | 'nextVisitDate') => {
    setFormData(prev => ({ ...prev, [fieldName]: date }));
  };

  const incrementMonthlyStudyStat = async () => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentStats = await db.monthlyStats.get(monthStr);
    if (currentStats) {
      await db.monthlyStats.put({ month: monthStr, studyCount: currentStats.studyCount + 1 });
    } else {
      const activeCount = await db.visits.filter(v => Boolean(v.isRecurringStudy)).count();
      await db.monthlyStats.put({ month: monthStr, studyCount: activeCount + 1 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const visitData = {
        ...formData,
        updatedAt: new Date()
      } as Visit;
      
      if (isEditing && personId) {
        const record = await db.visits.get(personId);

        if (record && !record.isRecurringStudy && visitData.isRecurringStudy) {
          await incrementMonthlyStudyStat();
        }

        if (record) {
          await db.visits.put({ ...record, ...visitData, id: personId });
        }
        incrementPendingBackupChanges();
        navigate(`/person/${personId}`);
      } else {
        if (visitData.isRecurringStudy) {
          await incrementMonthlyStudyStat();
        }

        visitData.createdAt = new Date();
        await db.visits.add(visitData);
        incrementPendingBackupChanges();
        navigate('/');
      }
      toast.success(t('saveSuccess'));
    } catch (error) {
      console.error('Error saving visit:', error);
      toast.error(t('saveError'));
    }
  };

  const { findScheduleConflicts, partnerName } = useCloudSync();

  const scheduleConflicts = findScheduleConflicts(
    formData.nextVisitDate ? new Date(formData.nextVisitDate) : null,
    formData.isRecurringStudy ? (formData.recurringStudyDayOfWeek ?? 0) : null,
    formData.isRecurringStudy ? (formData.recurringStudyTime || '10:00') : null
  );

  const defaultCenter: [number, number] = [-27.33056, -55.86667];
  const mapCenter = formData.latitude && formData.longitude
    ? [formData.latitude, formData.longitude] as [number, number]
    : (userLocation || defaultCenter);

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 mb-8">
      <div className="flex items-center mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] -ml-2 mr-1 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-full"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isEditing ? t('editRecord') : t('newRecord')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('nameOrNickname')}</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('nameInputPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('phoneNumber')}</label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber || ''}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('phoneNumberPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dateFound')}</label>
          <DatePicker
            selected={formData.dateFound ? new Date(formData.dateFound) : new Date()}
            onChange={(date: Date | null) => handleDateChange(date, 'dateFound')}
            showTimeSelect
            timeFormat={timeFormat === '12h' ? "h:mm aa" : "HH:mm"}
            timeIntervals={15}
            timeCaption={t('time')}
            dateFormat={timeFormat === '12h' ? "d MMMM yyyy, h:mm aa" : "d MMMM yyyy, HH:mm"}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('gpsLocation')}</label>

          <div className="flex flex-col space-y-3 mb-4">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isLocating}
              className="min-h-[44px] flex items-center justify-center w-full px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-medium transition-colors"
            >
              <MapPin size={16} className="mr-2" />
              {isLocating ? t('gettingLocation') : t('getLocation')}
            </button>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('orEnterGoogleMapsLink')}</span>
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={coordinatesInput}
                onChange={(e) => setCoordinatesInput(e.target.value)}
                placeholder={t('googleMapsLinkPlaceholder')}
                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleCoordinatesApply}
                className="min-h-[40px] min-w-[40px] px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                title={t('save')}
              >
                <Check size={16} />
              </button>
            </div>
            {linkError && <p className="text-xs text-red-500 mt-1">{linkError}</p>}
          </div>

          <div className={isMapFullscreen ? 'fixed inset-0 z-[99999] bg-white dark:bg-slate-900 m-0 p-0 rounded-none w-screen h-screen max-w-none max-h-none' : 'w-full h-52 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 relative z-0'}>
            {isMapFullscreen && (
              <button
                type="button"
                onClick={() => setIsMapFullscreen(false)}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] bg-white dark:bg-slate-800 p-3 rounded-full shadow-lg text-slate-700 dark:text-slate-100 hover:bg-slate-100 flex items-center justify-center border border-slate-300 dark:border-slate-700"
              >
                <X size={24} />
              </button>
            )}
            {!isMapFullscreen && (
              <button
                type="button"
                onClick={() => setIsMapFullscreen(true)}
                className="absolute bottom-4 right-4 z-[1000] bg-white dark:bg-slate-800 p-2.5 rounded-full shadow-md border border-slate-300 dark:border-slate-700 text-primary hover:bg-slate-50 flex items-center justify-center"
                title={t('toggleFullscreenMap')}
              >
                <Maximize size={20} />
              </button>
            )}
            <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name={t('toggleStreetMap')}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name={t('toggleSatelliteMap')}>
                  <TileLayer
                    attribution='&copy; Google'
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              <MapUpdater center={mapCenter} isFullscreen={isMapFullscreen} />
              <LocationMarker
                position={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : null}
                setPosition={handleMapClick}
              />
            </MapContainer>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('clickMapToAdjust')}</p>

          {formData.latitude && formData.longitude && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium tabular-nums">
              {t('locationSaved')} ({formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)})
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('houseDescription')}</label>
          <input
            type="text"
            name="houseDescription"
            value={formData.houseDescription || ''}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('houseDescriptionPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('notesTopic')}</label>
          <textarea
            name="generalNotes"
            rows={3}
            value={formData.generalNotes || ''}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('notesPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('interestLevel')}</label>
          <select
            name="interestLevel"
            value={formData.interestLevel}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="Bajo">{t('low')}</option>
            <option value="Medio">{t('medium')}</option>
            <option value="Alto">{t('high')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('nextVisitOptional')}</label>
          <DatePicker
            selected={formData.nextVisitDate ? new Date(formData.nextVisitDate) : null}
            onChange={(date: Date | null) => handleDateChange(date, 'nextVisitDate')}
            showTimeSelect
            timeFormat={timeFormat === '12h' ? "h:mm aa" : "HH:mm"}
            timeIntervals={15}
            timeCaption={t('time')}
            dateFormat={timeFormat === '12h' ? "d MMMM yyyy, h:mm aa" : "d MMMM yyyy, HH:mm"}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            isClearable
            placeholderText={t('selectDateAndTime')}
          />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
          <label className="flex items-center mb-4 cursor-pointer">
            <input
              type="checkbox"
              name="isRecurringStudy"
              checked={Boolean(formData.isRecurringStudy)}
              onChange={handleChange}
              className="mr-2.5 h-4 w-4 accent-primary border-slate-300 rounded"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('establishedBibleCourse')}</span>
          </label>

          {formData.isRecurringStudy && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dayOfWeek')}</label>
                <select
                  name="recurringStudyDayOfWeek"
                  value={formData.recurringStudyDayOfWeek || 0}
                  onChange={handleChange}
                  className="w-full px-2.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="0">{t('sunday')}</option>
                  <option value="1">{t('monday')}</option>
                  <option value="2">{t('tuesday')}</option>
                  <option value="3">{t('wednesday')}</option>
                  <option value="4">{t('thursday')}</option>
                  <option value="5">{t('friday')}</option>
                  <option value="6">{t('saturday')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{t('time')}</label>
                <input
                  type="time"
                  name="recurringStudyTime"
                  value={formData.recurringStudyTime || '10:00'}
                  onChange={handleChange}
                  className="w-full px-2.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Live Partner Schedule Conflict Alert */}
          {scheduleConflicts.length > 0 && (
            <div className="mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {t('scheduleConflictTitle', { partner: partnerName || 'Compañero' })}
                </span>
              </div>
              <ul className="space-y-1 pl-6 list-disc text-xs text-amber-800 dark:text-amber-300 tabular-nums">
                {scheduleConflicts.map((c, idx) => (
                  <li key={idx}>
                    {t('scheduleConflictItem', {
                      partner: c.partnerName,
                      type: c.isRecurringStudy ? t('bibleCourse') : t('returnVisit'),
                      visit: c.visitName,
                      time: formatTime(c.timeStr, timeFormat === '12h'),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full min-h-[48px] flex justify-center items-center py-3 px-4 rounded-xl shadow-xs text-base font-medium text-white bg-primary hover:bg-primary-dark transition-colors mt-6"
        >
          <Save size={20} className="mr-2" />
          {t('saveRecord')}
        </button>
      </form>
    </div>
  );
}
