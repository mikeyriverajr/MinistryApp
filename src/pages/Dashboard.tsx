import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Link } from 'react-router-dom';
import { Users, BookOpen } from 'lucide-react';

export default function Dashboard() {
  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const visits = useLiveQuery(() => db.visits.toArray());

  const name = userProfile?.[0]?.name || 'Publicador';
  const totalVisits = visits?.length || 0;
  const returnVisits = visits?.filter(v => v.isReturnVisit).length || 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">Hola, {name}!</h2>
        <p className="text-gray-500 mt-1">Resumen de tu ministerio</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
          <Users className="text-[#26818E] mb-2" size={32} />
          <span className="text-3xl font-bold text-gray-800">{totalVisits}</span>
          <span className="text-sm text-gray-500">Registros</span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
          <BookOpen className="text-green-600 mb-2" size={32} />
          <span className="text-3xl font-bold text-gray-800">{returnVisits}</span>
          <span className="text-sm text-gray-500">Revisitas</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col space-y-3">
        <Link 
          to="/add" 
          className="bg-[#26818E] text-white text-center py-3 rounded-lg font-medium shadow-sm hover:bg-[#1d616a] transition-colors"
        >
          Registrar Nueva Visita
        </Link>
      </div>
    </div>
  );
}
