import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Visit } from '../db/database';
import { MapPin, Save, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default function VisitForm() {
  const navigate = useNavigate();
  const [isLocating, setIsLocating] = useState(false);
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
    isReturnVisit: false,
  });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'dateFound' | 'nextVisitDate') => {
    const date = e.target.value ? new Date(e.target.value) : null;
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

  const formatDateForInput = (date: Date | null | undefined) => {
    if (!date) return '';
    // Use date-fns format to keep local timezone
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

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
          <input
            type="datetime-local"
            name="dateFound"
            required
            value={formatDateForInput(formData.dateFound)}
            onChange={(e) => handleDateChange(e, 'dateFound')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación GPS</label>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isLocating}
              className="flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm font-medium transition-colors"
            >
              <MapPin size={16} className="mr-2" />
              {isLocating ? 'Buscando...' : 'Obtener mi ubicación actual'}
            </button>
          </div>
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

        <div className="grid grid-cols-2 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center h-full">
              <input
                type="checkbox"
                name="isReturnVisit"
                checked={formData.isReturnVisit}
                onChange={handleChange}
                className="mr-2 h-4 w-4 text-[#26818E] focus:ring-[#26818E] border-gray-300 rounded"
              />
              Es Revisita
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Próxima Visita (Opcional)</label>
          <input
            type="datetime-local"
            name="nextVisitDate"
            value={formatDateForInput(formData.nextVisitDate)}
            onChange={(e) => handleDateChange(e, 'nextVisitDate')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
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
            <span className="text-sm font-medium text-gray-700">Se estableció estudio bíblico regular</span>
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
