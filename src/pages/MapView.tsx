import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import L from 'leaflet';

// Fix for leaflet's default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapView() {
  const visits = useLiveQuery(() => db.visits.toArray());
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation([position.coords.latitude, position.coords.longitude]),
        (error) => console.error("Error obtaining location", error)
      );
    }
  }, []);

  const defaultCenter: [number, number] = [-25.5134, -54.6111]; // Default
  const center = userLocation || defaultCenter;

  const validVisits = visits?.filter(v => v.latitude !== null && v.longitude !== null) || [];

  return (
    <div className="h-[calc(100vh-160px)] w-full rounded-xl overflow-hidden shadow-sm border border-gray-200">
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={center} />

        {validVisits.map((visit) => (
          <Marker
            key={visit.id}
            position={[visit.latitude as number, visit.longitude as number]}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-bold text-gray-800">{visit.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{visit.houseDescription}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Interés: <span className="font-medium">{visit.interestLevel}</span>
                </p>
                {visit.nextVisitDate && (
                  <p className="text-xs text-blue-600 mt-1">
                    Próxima visita: {new Date(visit.nextVisitDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
