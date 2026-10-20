import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Map as MapIcon, LayoutGrid, List, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';

type SortOption = 'name' | 'dateFound' | 'interestLevel' | 'nextVisitDate';

export default function InterestedPersons() {
  const navigate = useNavigate();
  const location = useLocation();
  const visits = useLiveQuery(() => db.visits.toArray());
  const { t } = useLanguage();
  const { personsViewMode, setPersonsViewMode } = useSettings();

  const queryParams = new URLSearchParams(location.search);
  const filterParam = queryParams.get('filter');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(
    (localStorage.getItem('interestedPersonsSortBy') as SortOption) || 'name'
  );

  useEffect(() => {
    localStorage.setItem('interestedPersonsSortBy', sortBy);
  }, [sortBy]);

  const filteredAndSortedVisits = React.useMemo(() => {
    if (!visits) return [];

    let filtered = [...visits];

    if (filterParam === 'cursos') {
      filtered = filtered.filter(v => v.isRecurringStudy);
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.trim().toLowerCase();
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
        case 'nextVisitDate': {
          const dateA = a.nextVisitDate ? new Date(a.nextVisitDate).getTime() : Infinity;
          const dateB = b.nextVisitDate ? new Date(b.nextVisitDate).getTime() : Infinity;
          if (dateA === Infinity && dateB === Infinity) return 0;
          if (dateA === Infinity) return 1;
          if (dateB === Infinity) return -1;
          return dateA - dateB;
        }
        default:
          return 0;
      }
    });
  }, [visits, searchQuery, sortBy, filterParam]);

  const interestTextStyle = {
    Alto: 'text-red-600 dark:text-red-400 font-semibold',
    Medio: 'text-blue-600 dark:text-blue-400 font-medium',
    Bajo: 'text-amber-600 dark:text-amber-400 font-medium'
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('interestedPersons')}</h3>
          <div className="flex items-center gap-2">
            {/* Segmented View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPersonsViewMode('cards')}
                title={t('viewModeCards')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  personsViewMode === 'cards'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid size={15} />
                <span className="hidden sm:inline">{t('viewModeCards')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPersonsViewMode('list')}
                title={t('viewModeList')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  personsViewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <List size={15} />
                <span className="hidden sm:inline">{t('viewModeList')}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate('/map')}
              className="min-h-[38px] flex items-center gap-1.5 bg-primary text-white px-3.5 py-1.5 rounded-xl hover:bg-primary-dark transition-colors text-xs font-semibold whitespace-nowrap"
            >
              <MapIcon size={15} />
              <span>{t('navMap')}</span>
            </button>
          </div>
        </div>

        {filterParam === 'cursos' && (
          <div className="mb-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {t('filteringCourses')}
            </span>
            <button
              type="button"
              onClick={() => navigate('/personas')}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <X size={14} />
              <span>{t('clearFilter')}</span>
            </button>
          </div>
        )}

        <div className="flex flex-col space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{t('sortBy')}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="name">{t('sortName')}</option>
              <option value="dateFound">{t('sortDateFound')}</option>
              <option value="interestLevel">{t('sortInterest')}</option>
              <option value="nextVisitDate">{t('sortNextVisit')}</option>
            </select>
          </div>
        </div>

        {filteredAndSortedVisits.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-6 text-sm">{t('noRecordsFound')}</p>
        ) : personsViewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAndSortedVisits.map(visit => (
              <div
                key={visit.id}
                onClick={() => navigate(`/person/${visit.id}`)}
                className="p-4 border border-slate-200/80 dark:border-slate-800 rounded-2xl hover:border-primary transition-all cursor-pointer bg-white dark:bg-slate-900 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-baseline gap-2 mb-1.5">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base truncate">{visit.name}</h4>
                    <span className={`text-xs shrink-0 ${interestTextStyle[visit.interestLevel]}`}>
                      {visit.interestLevel === 'Alto' ? t('high') : visit.interestLevel === 'Medio' ? t('medium') : t('low')}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
                    {visit.generalNotes || visit.houseDescription || t('withoutNotes')}
                  </p>
                </div>

                <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <span>{t('found')}: {new Date(visit.dateFound).toLocaleDateString()}</span>
                  {visit.nextVisitDate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-primary font-medium">
                        {t('visit')}: {new Date(visit.nextVisitDate).toLocaleDateString()}
                      </span>
                    </>
                  )}
                  {visit.isRecurringStudy && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {t('bibleCourse')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
            {filteredAndSortedVisits.map(visit => (
              <div
                key={visit.id}
                onClick={() => navigate(`/person/${visit.id}`)}
                className="min-h-[60px] px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{visit.name}</h4>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                    <span className={`text-xs shrink-0 ${interestTextStyle[visit.interestLevel]}`}>
                      {visit.interestLevel === 'Alto' ? t('high') : visit.interestLevel === 'Medio' ? t('medium') : t('low')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {visit.houseDescription || visit.generalNotes || t('withoutNotes')}
                  </p>
                </div>

                <div className="text-right shrink-0 text-xs tabular-nums">
                  {visit.nextVisitDate ? (
                    <span className="text-primary font-medium">
                      {new Date(visit.nextVisitDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">
                      {new Date(visit.dateFound).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
