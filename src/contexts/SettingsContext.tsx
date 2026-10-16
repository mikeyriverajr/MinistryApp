import React, { createContext, useContext, useState, ReactNode } from 'react';

type TimeFormat = '12h' | '24h';

interface SettingsContextType {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(() => {
    const saved = localStorage.getItem('appTimeFormat');
    return (saved === '12h' || saved === '24h') ? saved : '24h';
  });

  const setTimeFormat = (format: TimeFormat) => {
    localStorage.setItem('appTimeFormat', format);
    setTimeFormatState(format);
  };

  return (
    <SettingsContext.Provider value={{ timeFormat, setTimeFormat }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
