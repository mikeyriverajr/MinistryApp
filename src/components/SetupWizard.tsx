import { useState } from 'react';
import { db } from '../db/database';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../i18n';

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [name, setName] = useState('');
  const { language, setLanguage, t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      await db.userProfile.add({ name: name.trim() });
      onComplete();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex justify-end mb-4">
           <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
           >
              <option value="es">Español</option>
              <option value="en">English</option>
           </select>
        </div>

        <h2 className="text-2xl font-bold text-center mb-6 text-[#e07a5f]">{t('welcome')}</h2>
        <p className="text-gray-600 mb-6 text-center">{t('whatsYourName')}</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">{t('yourName')}</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400
                         focus:outline-none focus:border-[#e07a5f] focus:ring-1 focus:ring-[#e07a5f]"
              placeholder={t('namePlaceholder')}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#e07a5f] hover:bg-[#c45b42] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e07a5f]"
          >
            {t('start')}
          </button>
        </form>
      </div>
    </div>
  );
}
