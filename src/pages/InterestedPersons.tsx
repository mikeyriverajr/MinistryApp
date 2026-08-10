import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar as CalendarIcon, Clock, Map as MapIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type SortOption = 'name' | 'dateFound' | 'interestLevel' | 'nextVisitDate';

export default function InterestedPersons() {
  const navigate = useNavigate();
  const visits = useLiveQuery(() => db.visits.toArray());
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');

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
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">{t('interestedPersons')}</h3>
          <button
            onClick={() => navigate('/map')}
            className="flex items-center space-x-1 bg-[#e07a5f] text-white px-3 py-1.5 rounded-lg hover:bg-[#c45b42] transition-colors text-sm font-medium"
          >
            <MapIcon size={16} />
            <span>{t('navMap')}</span>
          </button>
        </div>

        <div className="flex flex-col space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e07a5f]"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
             <span className="text-sm text-gray-500 whitespace-nowrap">{t('sortBy')}</span>
             <select
               value={sortBy}
               onChange={(e) => setSortBy(e.target.value as SortOption)}
               className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#e07a5f] bg-gray-50"
             >
                <option value="name">{t('sortName')}</option>
                <option value="dateFound">{t('sortDateFound')}</option>
                <option value="interestLevel">{t('sortInterest')}</option>
                <option value="nextVisitDate">{t('sortNextVisit')}</option>
             </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredAndSortedVisits.length === 0 ? (
            <p className="text-center text-gray-500 py-4">{t('noRecordsFound')}</p>
          ) : (
            filteredAndSortedVisits.map(visit => (
              <div
                key={visit.id}
                onClick={() => navigate(`/person/${visit.id}`)}
                className="block p-4 border border-gray-100 rounded-xl hover:border-[#e07a5f] hover:shadow-md transition-all cursor-pointer bg-white"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-gray-800 text-lg">{visit.name}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${interestColor[visit.interestLevel]}`}>
                    {visit.interestLevel === 'Alto' ? t('high') : visit.interestLevel === 'Medio' ? t('medium') : t('low')}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {visit.generalNotes || visit.houseDescription || t('withoutNotes')}
                </p>

                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center">
                    <CalendarIcon size={14} className="mr-1" />
                    <span>{t('found')}: {new Date(visit.dateFound).toLocaleDateString()}</span>
                  </div>
                  {visit.nextVisitDate && (
                    <div className="flex items-center text-[#e07a5f] font-medium">
                      <Clock size={14} className="mr-1" />
                      <span>{t('visit')}: {new Date(visit.nextVisitDate).toLocaleDateString()}</span>
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
