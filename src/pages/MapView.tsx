import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { X, Navigation, Eye, Crosshair, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { interestMapIcons, userLocationIcon, partnerVisitIcon } from '../utils/mapIcons';
import { toast } from 'react-hot-toast';

function MapUpdater({ center, zoom }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
}

type PinFilter = 'all' | 'mine' | 'partner';

export default function MapView() {
  const navigate = useNavigate();
  const visits = useLiveQuery(() => db.visits.toArray());
  const { t } = useLanguage();
  const { linkedPartnerCode, partnerName, partnerVisits, showPartnerData } = useCloudSync();

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-27.33056, -55.86667]);
  const [zoomLevel, setZoomLevel] = useState(14);
  const [pinFilter, setPinFilter] = useState<PinFilter>('all');

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(loc);
          setMapCenter(loc);
        },
        (error) => console.error("Error obtaining location", error)
      );
    }
  }, []);

  const validVisits = visits?.filter(v => v.latitude !== null && v.longitude !== null) || [];
  const validPartnerVisits =
    linkedPartnerCode && showPartnerData
      ? partnerVisits.filter(v => v.latitude !== null && v.longitude !== null)
      : [];

  const showMyPins = pinFilter === 'all' || pinFilter === 'mine';
  const showPartnerPins =
    Boolean(linkedPartnerCode && showPartnerData) && (pinFilter === 'all' || pinFilter === 'partner');

  const handleCenterOnUser = () => {
    if (userLocation) {
      setMapCenter([...userLocation]);
      setZoomLevel(15);
    } else {
      toast.error(t('locationError'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 flex flex-col">
      <div className="bg-slate-800 dark:bg-slate-900 border-b border-primary text-white h-14 px-4 shadow-sm flex justify-between items-center gap-3">
        <h2 className="font-bold text-lg truncate">{t('territoryMap')}</h2>

        {linkedPartnerCode && showPartnerData && (
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setPinFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                pinFilter === 'all'
                  ? 'bg-primary text-white font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t('filterAllPins')}
            </button>
            <button
              type="button"
              onClick={() => setPinFilter('mine')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                pinFilter === 'mine'
                  ? 'bg-primary text-white font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t('filterMyPins')}
            </button>
            <button
              type="button"
              onClick={() => setPinFilter('partner')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                pinFilter === 'partner'
                  ? 'bg-violet-600 text-white font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t('filterPartnerPins', { name: partnerName || 'Compañero' })}
            </button>
          </div>
        )}

        <button
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-700 rounded-full transition-colors shrink-0"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 w-full relative">
        <button
          onClick={handleCenterOnUser}
          className="absolute bottom-6 right-6 z-[400] min-h-[48px] min-w-[48px] flex items-center justify-center bg-white dark:bg-slate-800 p-3 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-primary hover:bg-slate-50 transition-colors"
          title={t('myLocation')}
        >
          <Crosshair size={24} />
        </button>

        <MapContainer center={mapCenter} zoom={zoomLevel} style={{ height: '100%', width: '100%' }}>
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
          <MapUpdater center={mapCenter} zoom={zoomLevel} />

          {userLocation && (
            <Marker position={userLocation} icon={userLocationIcon}>
              <Popup>{t('yourCurrentLocation')}</Popup>
            </Marker>
          )}

          {showMyPins &&
            validVisits.map((visit) => (
              <Marker
                key={`mine-${visit.id}`}
                position={[visit.latitude as number, visit.longitude as number]}
                icon={interestMapIcons[visit.interestLevel] || interestMapIcons.Medio}
              >
                <Popup className="custom-popup">
                  <div className="p-1 min-w-[200px]">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">{visit.name}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{visit.generalNotes || visit.houseDescription}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      {t('interest')}: <span className="font-semibold ml-1">{visit.interestLevel === 'Alto' ? t('high') : visit.interestLevel === 'Medio' ? t('medium') : t('low')}</span>
                    </p>
                    {visit.nextVisitDate && (
                      <p className="text-xs text-primary mt-1 font-medium tabular-nums">
                        {t('visit')}: {new Date(visit.nextVisitDate).toLocaleDateString()}
                      </p>
                    )}
                    <div className="flex flex-col space-y-2 mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => navigate(`/person/${visit.id}`)}
                        className="min-h-[38px] flex items-center justify-center w-full px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark"
                      >
                        <Eye size={14} className="mr-1.5" />
                        {t('openRecord')}
                      </button>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] flex items-center justify-center w-full px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 no-underline"
                      >
                        <Navigation size={14} className="mr-1.5" />
                        {t('navigateMap')}
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {showPartnerPins &&
            validPartnerVisits.map((pVisit, idx) => (
              <Marker
                key={`partner-${pVisit.id}-${idx}`}
                position={[pVisit.latitude as number, pVisit.longitude as number]}
                icon={partnerVisitIcon}
              >
                <Popup className="custom-popup">
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400 mb-1">
                      <Users size={13} />
                      <span>{t('partnerPinBadge', { name: partnerName || 'Compañero' })}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                      {pVisit.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {pVisit.houseDescription || pVisit.generalNotes || t('withoutNotes')}
                    </p>
                    {pVisit.isRecurringStudy && (
                      <p className="text-xs text-violet-600 dark:text-violet-400 font-medium mt-1">
                        {t('bibleCourse')}
                        {pVisit.recurringStudyTime ? ` · ${pVisit.recurringStudyTime}` : ''}
                      </p>
                    )}
                    <div className="flex flex-col space-y-2 mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${pVisit.latitude},${pVisit.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] flex items-center justify-center w-full px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 no-underline"
                      >
                        <Navigation size={14} className="mr-1.5" />
                        {t('navigateMap')}
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </div>
  );
}
