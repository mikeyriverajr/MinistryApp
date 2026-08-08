import { useState } from 'react';
import { db } from '../db/database';

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [name, setName] = useState('');

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
        <h2 className="text-2xl font-bold text-center mb-6 text-[#26818E]">Bienvenido a Mi Ministerio</h2>
        <p className="text-gray-600 mb-6 text-center">Para comenzar, ¿cómo te llamas?</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Tu Nombre</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400
                         focus:outline-none focus:border-[#26818E] focus:ring-1 focus:ring-[#26818E]"
              placeholder="Ej. Juan Pérez"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#26818E] hover:bg-[#1d616a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#26818E]"
          >
            Comenzar
          </button>
        </form>
      </div>
    </div>
  );
}
