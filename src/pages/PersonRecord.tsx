import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, FollowUpVisit } from '../db/database';
import { ArrowLeft, Navigation, Save, Plus } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

export default function PersonRecord() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const personId = Number(id);

  const visit = useLiveQuery(() => db.visits.get(personId), [personId]);

  const [showAddVisit, setShowAddVisit] = useState(false);
  const [newVisitDate, setNewVisitDate] = useState<Date | null>(new Date());
  const [newVisitNotes, setNewVisitNotes] = useState('');

  if (!visit) {
    return <div className="p-4">Cargando o registro no encontrado...</div>;
  }

  const handleNavigate = () => {
    if (visit.latitude && visit.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`, '_blank');
    } else {
      alert("No hay ubicación guardada para este registro.");
    }
  };

  const handleAddFollowUp = async () => {
    if (!newVisitDate || !newVisitNotes.trim()) {
      alert("Por favor ingresa la fecha y las notas de la visita.");
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

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate(-1)} className="mr-3 text-gray-500 hover:text-gray-800">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-gray-800 flex-1">{visit.name}</h2>
          {visit.latitude && visit.longitude && (
            <button
              onClick={handleNavigate}
              className="flex items-center text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium transition-colors"
            >
              <Navigation size={16} className="mr-1.5" />
              Navegar
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Descripción de la casa</h3>
            <p className="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100">{visit.houseDescription || 'Sin descripción'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Interés</h3>
              <p className="text-gray-800 font-medium">{visit.interestLevel}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Curso Bíblico</h3>
              <p className="text-gray-800 font-medium">{visit.isRecurringStudy ? 'Sí' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">Historial de Visitas</h3>
          <button
            onClick={() => setShowAddVisit(!showAddVisit)}
            className="flex items-center text-sm bg-[#26818E] text-white px-3 py-1.5 rounded-lg hover:bg-[#1d616a] font-medium transition-colors"
          >
            <Plus size={16} className="mr-1" />
            Nueva Visita
          </button>
        </div>

        {showAddVisit && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <DatePicker
                selected={newVisitDate}
                onChange={(date: Date | null) => setNewVisitDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                timeCaption="Hora"
                dateFormat="d MMMM yyyy, h:mm aa"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={newVisitNotes}
                onChange={(e) => setNewVisitNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#26818E]"
                placeholder="Tema conversado, publicaciones dejadas..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddVisit(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddFollowUp}
                className="px-4 py-2 flex items-center text-sm font-medium text-white bg-[#26818E] hover:bg-[#1d616a] rounded-md"
              >
                <Save size={16} className="mr-1.5" />
                Guardar
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
                <span className="font-semibold text-gray-800">Visita Inicial</span>
                <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">
                  {new Date(visit.dateFound).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-600">{visit.generalNotes || 'Sin notas.'}</p>
            </div>
          </div>

          {(visit.followUpVisits || []).map((followUp, index) => (
            <div key={followUp.id} className="relative z-10 pl-10">
              <div className="absolute left-0 top-1.5 w-8 h-8 rounded-full bg-green-100 border-2 border-white flex items-center justify-center text-green-600 shadow-sm">
                <span className="text-xs font-bold">{index + 2}</span>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800">Revisita</span>
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
