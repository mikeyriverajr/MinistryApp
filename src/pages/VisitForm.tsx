import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Visit } from '../db/database';
import { MapPin, Save, ArrowLeft, Link as LinkIcon } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
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

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function VisitForm() {
  const navigate = useNavigate();
  const [isLocating, setIsLocating] = useState(false);
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

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
          alert('No se pudo obtener la ubicación. Por favor revisa los permisos.');
          setIsLocating(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Tu navegador no soporta geolocalización.');
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
        createdAt: new Date(),
        updatedAt: new Date()
      } as Visit;
      
      await db.visits.add(visitData);
      navigate('/');
    } catch (error) {
      console.error('Error saving visit:', error);
      alert('Hubo un error al guardar el registro.');
    }
  };

  const defaultCenter: [number, number] = [-25.5134, -54.6111]; // Default
  const mapCenter = formData.latitude && formData.longitude
    ? [formData.latitude, formData.longitude] as [number, number]
    : (userLocation || defaultCenter);

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
      <div className="flex items-center mb-6">
        <button type="button" onClick={() => navigate(-1)} className="mr-3 text-gray-500 hover:text-gray-800">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Nuevo Registro</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (o apodo)</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
            placeholder="Ej. Señor del portón rojo"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha encontrado</label>
          <DatePicker
            selected={formData.dateFound as Date}
            onChange={(date: Date | null) => handleDateChange(date, 'dateFound')}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="Hora"
            dateFormat="d MMMM yyyy, h:mm aa"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
            required
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación GPS</label>

          <div className="flex flex-col space-y-4 mb-4">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isLocating}
              className="flex items-center justify-center w-full px-4 py-2 bg-[#26818E] hover:bg-[#1d616a] text-white rounded-md text-sm font-medium transition-colors"
            >
              <MapPin size={16} className="mr-2" />
              {isLocating ? 'Buscando...' : 'Obtener mi ubicación actual'}
            </button>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">O ingresa un enlace de Google Maps:</span>
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={googleMapsLink}
                onChange={(e) => setGoogleMapsLink(e.target.value)}
                placeholder="https://www.google.com/maps/place/..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
              />
              <button
                type="button"
                onClick={handleLinkExtract}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm font-medium"
              >
                <LinkIcon size={16} />
              </button>
            </div>
            {linkError && <p className="text-xs text-red-500 mt-1">{linkError}</p>}
          </div>

          <div className="h-48 w-full rounded-md overflow-hidden border border-gray-300 relative z-0">
             <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapUpdater center={mapCenter} />
                <LocationMarker
                  position={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : null}
                  setPosition={handleMapClick}
                />
             </MapContainer>
          </div>
          <p className="text-xs text-gray-500 mt-2">Haz clic en el mapa para ajustar la ubicación.</p>

          {formData.latitude && formData.longitude && (
            <p className="text-xs text-green-600 mt-2 font-medium">
              ✓ Ubicación guardada ({formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)})
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción de la casa</label>
          <input
            type="text"
            name="houseDescription"
            value={formData.houseDescription || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
            placeholder="Reja blanca, perro grande..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas / Tema conversado</label>
          <textarea
            name="generalNotes"
            rows={3}
            value={formData.generalNotes || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
            placeholder="Le dejé un tratado. Hablamos sobre..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de Interés</label>
          <select
            name="interestLevel"
            value={formData.interestLevel}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
          >
            <option value="Bajo">Bajo</option>
            <option value="Medio">Medio</option>
            <option value="Alto">Alto</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Próxima Visita (Opcional)</label>
          <DatePicker
            selected={formData.nextVisitDate as Date}
            onChange={(date: Date | null) => handleDateChange(date, 'nextVisitDate')}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="Hora"
            dateFormat="d MMMM yyyy, h:mm aa"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
            isClearable
            placeholderText="Seleccionar fecha y hora"
          />
        </div>

        <div className="border-t border-gray-200 pt-4 mt-2">
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              name="isRecurringStudy"
              checked={formData.isRecurringStudy}
              onChange={handleChange}
              className="mr-2 h-4 w-4 text-[#26818E] focus:ring-[#26818E] border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Se estableció un curso bíblico</span>
          </label>

          {formData.isRecurringStudy && (
            <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Día de la semana</label>
                <select
                  name="recurringStudyDayOfWeek"
                  value={formData.recurringStudyDayOfWeek || 0}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
                >
                  <option value="0">Domingo</option>
                  <option value="1">Lunes</option>
                  <option value="2">Martes</option>
                  <option value="3">Miércoles</option>
                  <option value="4">Jueves</option>
                  <option value="5">Viernes</option>
                  <option value="6">Sábado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hora</label>
                <input
                  type="time"
                  name="recurringStudyTime"
                  value={formData.recurringStudyTime || '10:00'}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-[#26818E] hover:bg-[#1d616a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#26818E] mt-6"
        >
          <Save size={20} className="mr-2" />
          Guardar Registro
        </button>
      </form>
    </div>
  );
}
