import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { X, Navigation, Eye, Crosshair } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { interestMapIcons, userLocationIcon } from '../utils/mapIcons';
import { toast } from 'react-hot-toast';

function MapUpdater({ center, zoom }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
}

export default function MapView() {
  const navigate = useNavigate();
  const visits = useLiveQuery(() => db.visits.toArray());
  const { t } = useLanguage();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-27.33056, -55.86667]);
  const [zoomLevel, setZoomLevel] = useState(14);

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
      <div className="bg-slate-800 dark:bg-slate-900 border-b border-primary text-white h-14 px-4 shadow-sm flex justify-between items-center">
        <h2 className="font-bold text-lg">{t('territoryMap')}</h2>
        <button
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-700 rounded-full transition-colors"
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
        
          {validVisits.map((visit) => (
            <Marker
              key={visit.id}
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
        </MapContainer>
      </div>
    </div>
  );
}
