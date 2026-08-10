import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Visit } from '../db/database';
import { MapPin, Save, ArrowLeft, Link as LinkIcon, Maximize, X } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, LayersControl } from 'react-leaflet';
import { useLanguage } from '../contexts/LanguageContext';
import L from 'leaflet';
import { toast } from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';

// Fix for leaflet's default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

function MapUpdater({ center, isFullscreen }: { center: [number, number], isFullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  useEffect(() => {
    // Invalidate size when fullscreen mode toggles so the map center is recalculated correctly
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
  const personId = id ? Number(id) : null;

  const existingVisit = useLiveQuery(
    () => personId ? db.visits.get(personId) : undefined,
    [personId]
  );

  const { t } = useLanguage();
  const [isLocating, setIsLocating] = useState(false);
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const [formData, setFormData] = useState<Partial<Visit>>({
    name: '',
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

  const handleLinkExtract = () => {
    setLinkError('');
    if (!googleMapsLink) return;

    // Try to extract coordinates from URL like @-25.5134,-54.6111
    const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = googleMapsLink.match(regex);

    if (match && match[1] && match[2]) {
      setFormData(prev => ({
        ...prev,
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2])
      }));
      setGoogleMapsLink('');
    } else {
      setLinkError('No se pudieron extraer las coordenadas de este enlace. Por favor, usa un enlace largo que contenga "@lat,lng" o selecciona en el mapa.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const visitData = {
        ...formData,
        updatedAt: new Date()
      } as Visit;
      
      if (isEditing && personId) {
        // use an explicit update to avoid UpdateSpec typing issues with complex nested objects
        const record = await db.visits.get(personId);
        if (record) {
           await db.visits.put({ ...record, ...visitData, id: personId });
        }
        navigate(`/person/${personId}`);
      } else {
        visitData.createdAt = new Date();
        await db.visits.add(visitData);
        navigate('/');
      }
      toast.success(t('saveSuccess', { defaultValue: 'Registro guardado' }));
    } catch (error) {
      console.error('Error saving visit:', error);
      toast.error(t('saveError'));
    }
  };

  const defaultCenter: [number, number] = [-27.33056, -55.86667]; // Encarnación Default
  const mapCenter = formData.latitude && formData.longitude
    ? [formData.latitude, formData.longitude] as [number, number]
    : (userLocation || defaultCenter);

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
      <div className="flex items-center mb-6">
        <button type="button" onClick={() => navigate(-1)} className="mr-3 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold text-gray-700">{isEditing ? t('editRecord') : t('newRecord')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('nameOrNickname')}</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
            placeholder={t('nameInputPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('dateFound')}</label>
          <DatePicker
            selected={formData.dateFound as Date}
            onChange={(date: Date | null) => handleDateChange(date, 'dateFound')}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="Hora"
            dateFormat="d MMMM yyyy, h:mm aa"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
            required
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('gpsLocation')}</label>

          <div className="flex flex-col space-y-4 mb-4">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isLocating}
              className="flex items-center justify-center w-full px-4 py-2 bg-[#e07a5f] hover:bg-[#c45b42] text-white rounded-md text-sm font-medium transition-colors"
            >
              <MapPin size={16} className="mr-2" />
              {isLocating ? t('gettingLocation') : t('getLocation')}
            </button>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{t('orEnterGoogleMapsLink')}</span>
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={googleMapsLink}
                onChange={(e) => setGoogleMapsLink(e.target.value)}
                placeholder={t('googleMapsLinkPlaceholder')}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
              />
              <button
                type="button"
                onClick={handleLinkExtract}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm font-medium"
              >
                <LinkIcon size={16} />
              </button>
            </div>
            {linkError && <p className="text-xs text-red-500 mt-1">{linkError}</p>}
          </div>

          <div className={isMapFullscreen ? 'fixed inset-0 z-[99999] bg-white m-0 p-0 rounded-none w-screen h-screen max-w-none max-h-none' : 'w-full h-48 rounded-md overflow-hidden border border-gray-300 relative z-0'}>
             {isMapFullscreen && (
                <button
                   type="button"
                   onClick={() => setIsMapFullscreen(false)}
                   className="absolute top-4 right-4 z-[10000] bg-white p-3 rounded-full shadow-lg text-gray-700 hover:bg-gray-100 flex items-center justify-center border border-gray-300"
                >
                   <X size={24} />
                </button>
             )}
             {!isMapFullscreen && (
                <button
                   type="button"
                   onClick={() => setIsMapFullscreen(true)}
                   className="absolute bottom-6 right-6 z-[1000] bg-white p-3 rounded-full shadow-lg border border-gray-300 text-[#e07a5f] hover:bg-gray-50 flex items-center justify-center"
                   title={t('toggleFullscreenMap')}
                >
                   <Maximize size={24} />
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
                      attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
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
          <p className="text-xs text-gray-500 mt-2">{t('clickMapToAdjust')}</p>

          {formData.latitude && formData.longitude && (
            <p className="text-xs text-green-600 mt-2 font-medium">
              {t('locationSaved')} ({formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)})
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('houseDescription')}</label>
          <input
            type="text"
            name="houseDescription"
            value={formData.houseDescription || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
            placeholder={t('houseDescriptionPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('notesTopic')}</label>
          <textarea
            name="generalNotes"
            rows={3}
            value={formData.generalNotes || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
            placeholder={t('notesPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('interestLevel')}</label>
          <select
            name="interestLevel"
            value={formData.interestLevel}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
          >
            <option value="Bajo">{t('low')}</option>
            <option value="Medio">{t('medium')}</option>
            <option value="Alto">{t('high')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('nextVisitOptional')}</label>
          <DatePicker
            selected={formData.nextVisitDate as Date}
            onChange={(date: Date | null) => handleDateChange(date, 'nextVisitDate')}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption={t('time')}
            dateFormat="d MMMM yyyy, h:mm aa"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
            isClearable
            placeholderText={t('selectDateAndTime')}
          />
        </div>

        <div className="border-t border-gray-200 pt-4 mt-2">
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              name="isRecurringStudy"
              checked={formData.isRecurringStudy}
              onChange={handleChange}
              className="mr-2 h-4 w-4 text-[#e07a5f] focus:ring-[#e07a5f] border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">{t('establishedBibleCourse')}</span>
          </label>

          {formData.isRecurringStudy && (
            <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('dayOfWeek')}</label>
                <select
                  name="recurringStudyDayOfWeek"
                  value={formData.recurringStudyDayOfWeek || 0}
                  onChange={handleChange}
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
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('time')}</label>
                <input
                  type="time"
                  name="recurringStudyTime"
                  value={formData.recurringStudyTime || '10:00'}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-[#e07a5f] hover:bg-[#c45b42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e07a5f] mt-6"
        >
          <Save size={20} className="mr-2" />
          {t('saveRecord')}
        </button>
      </form>
    </div>
  );
}
