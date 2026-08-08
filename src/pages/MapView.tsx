import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import L from 'leaflet';
import { X, Navigation, Eye, Crosshair } from 'lucide-react';

const createColoredIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const icons = {
  Alto: createColoredIcon('red'),
  Medio: createColoredIcon('blue'),
  Bajo: createColoredIcon('yellow')
};

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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-25.5134, -54.6111]);
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
      setMapCenter(userLocation);
      setZoomLevel(15);
    } else {
      alert("No se ha podido obtener tu ubicación actual.");
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-gray-100 flex flex-col">
      <div className="bg-[#26818E] text-white p-4 shadow-md flex justify-between items-center">
        <h2 className="font-bold text-lg">Mapa de Territorio</h2>
        <button
          onClick={() => navigate('/')}
          className="p-1.5 hover:bg-[#1d616a] rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 w-full relative">
        <button
          onClick={handleCenterOnUser}
          className="absolute bottom-6 right-6 z-[400] bg-white p-3 rounded-full shadow-lg border border-gray-200 text-[#26818E] hover:bg-gray-50 transition-colors"
          title="Mi ubicación"
        >
          <Crosshair size={24} />
        </button>

        <MapContainer center={mapCenter} zoom={zoomLevel} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={mapCenter} zoom={zoomLevel} />

          {userLocation && (
             <Marker
                position={userLocation}
                icon={new L.Icon({
                  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
                  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  popupAnchor: [1, -34],
                  shadowSize: [41, 41]
                })}
             >
                <Popup>Tu ubicación actual</Popup>
             </Marker>
          )}
        
          {validVisits.map((visit) => (
            <Marker
              key={visit.id}
              position={[visit.latitude as number, visit.longitude as number]}
              icon={icons[visit.interestLevel]}
            >
              <Popup className="custom-popup">
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-bold text-gray-800 text-lg">{visit.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{visit.houseDescription}</p>
                  <p className="text-xs text-gray-500 mt-2 flex items-center">
                    Interés: <span className="font-medium ml-1">{visit.interestLevel}</span>
                  </p>
                  {visit.nextVisitDate && (
                    <p className="text-xs text-[#26818E] mt-1 font-medium">
                      Visita: {new Date(visit.nextVisitDate).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex flex-col space-y-2 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/person/${visit.id}`)}
                      className="flex items-center justify-center w-full px-3 py-1.5 bg-[#26818E] text-white rounded-md text-sm font-medium hover:bg-[#1d616a]"
                    >
                      <Eye size={14} className="mr-1.5" />
                      Abrir Registro
                    </button>
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`, '_blank')}
                      className="flex items-center justify-center w-full px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100"
                    >
                      <Navigation size={14} className="mr-1.5" />
                      Navegar
                    </button>
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
