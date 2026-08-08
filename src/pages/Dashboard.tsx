import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Link, useNavigate } from 'react-router-dom';
import { Users, BookOpen, Search, Calendar as CalendarIcon, Clock } from 'lucide-react';

type SortOption = 'name' | 'dateFound' | 'interestLevel' | 'nextVisitDate';

export default function Dashboard() {
  const navigate = useNavigate();
  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const visits = useLiveQuery(() => db.visits.toArray());

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');

  const name = userProfile?.[0]?.name || 'Publicador';
  const totalVisits = visits?.length || 0;
  const cursosBiblicos = visits?.filter(v => v.isRecurringStudy).length || 0;

  const filteredAndSortedVisits = React.useMemo(() => {
    if (!visits) return [];

    let filtered = visits;
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.name.toLowerCase().includes(lowerQuery) ||
        (v.generalNotes && v.generalNotes.toLowerCase().includes(lowerQuery)) ||
        (v.houseDescription && v.houseDescription.toLowerCase().includes(lowerQuery))
      );
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'dateFound':
          return new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime();
        case 'interestLevel': {
          const interestOrder = { 'Alto': 3, 'Medio': 2, 'Bajo': 1 };
          return (interestOrder[b.interestLevel] || 0) - (interestOrder[a.interestLevel] || 0);
        }
        case 'nextVisitDate':
          const dateA = a.nextVisitDate ? new Date(a.nextVisitDate).getTime() : Infinity;
          const dateB = b.nextVisitDate ? new Date(b.nextVisitDate).getTime() : Infinity;
          return dateA - dateB;
        default:
          return 0;
      }
    });
  }, [visits, searchQuery, sortBy]);

  const interestColor = {
    Alto: 'text-red-500 bg-red-50',
    Medio: 'text-blue-500 bg-blue-50',
    Bajo: 'text-yellow-600 bg-yellow-50'
  };

  return (
    <div className="space-y-6 pb-20">
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
          <span className="text-3xl font-bold text-gray-800">{cursosBiblicos}</span>
          <span className="text-sm text-gray-500">Cursos Bíblicos</span>
        </div>
      </div>

      <div className="flex flex-col space-y-3">
        <Link 
          to="/add" 
          className="bg-[#26818E] text-white text-center py-3 rounded-lg font-medium shadow-sm hover:bg-[#1d616a] transition-colors"
        >
          Registrar Nueva Visita
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Personas Interesadas</h3>

        <div className="flex flex-col space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, casa, o notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#26818E]"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
             <span className="text-sm text-gray-500 whitespace-nowrap">Ordenar por:</span>
             <select
               value={sortBy}
               onChange={(e) => setSortBy(e.target.value as SortOption)}
               className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#26818E] bg-gray-50"
             >
                <option value="name">Nombre</option>
                <option value="dateFound">Fecha (Más reciente)</option>
                <option value="interestLevel">Interés (Alto a Bajo)</option>
                <option value="nextVisitDate">Próxima Visita</option>
             </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredAndSortedVisits.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No se encontraron registros.</p>
          ) : (
            filteredAndSortedVisits.map(visit => (
              <div
                key={visit.id}
                onClick={() => navigate(`/person/${visit.id}`)}
                className="block p-4 border border-gray-100 rounded-xl hover:border-[#26818E] hover:shadow-md transition-all cursor-pointer bg-white"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-gray-800 text-lg">{visit.name}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${interestColor[visit.interestLevel]}`}>
                    {visit.interestLevel}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {visit.generalNotes || visit.houseDescription || 'Sin notas.'}
                </p>

                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center">
                    <CalendarIcon size={14} className="mr-1" />
                    <span>Hallado: {new Date(visit.dateFound).toLocaleDateString()}</span>
                  </div>
                  {visit.nextVisitDate && (
                    <div className="flex items-center text-[#26818E] font-medium">
                      <Clock size={14} className="mr-1" />
                      <span>Visita: {new Date(visit.nextVisitDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
