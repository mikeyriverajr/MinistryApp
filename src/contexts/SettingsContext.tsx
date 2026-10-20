import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type TimeFormat = '12h' | '24h';
export type ThemeColor = 'orange' | 'blue' | 'green' | 'purple';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';
export type PersonsViewMode = 'cards' | 'list';

export const THEME_PALETTES: Record<ThemeColor, { primary: string; primaryDark: string; hex: string }> = {
  orange: { primary: '#e07a5f', primaryDark: '#c45b42', hex: '#e07a5f' },
  blue: { primary: '#2563eb', primaryDark: '#1d4ed8', hex: '#2563eb' },
  green: { primary: '#059669', primaryDark: '#047857', hex: '#059669' },
  purple: { primary: '#7c3aed', primaryDark: '#6d28d9', hex: '#7c3aed' },
};

const FONT_SCALE_MAP: Record<FontScale, string> = {
  sm: '92%',
  md: '100%',
  lg: '112%',
  xl: '125%',
};

interface SettingsContextType {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  personsViewMode: PersonsViewMode;
  setPersonsViewMode: (mode: PersonsViewMode) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(() => {
    const saved = localStorage.getItem('appTimeFormat');
    return (saved === '12h' || saved === '24h') ? saved : '24h';
  });

  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    return localStorage.getItem('appDarkMode') === 'true';
  });

  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem('appThemeColor') as ThemeColor;
    return saved && THEME_PALETTES[saved] ? saved : 'orange';
  });

  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    const saved = localStorage.getItem('appFontScale') as FontScale;
    return saved && FONT_SCALE_MAP[saved] ? saved : 'md';
  });

  const [personsViewMode, setPersonsViewModeState] = useState<PersonsViewMode>(() => {
    const saved = localStorage.getItem('appPersonsViewMode');
    return (saved === 'cards' || saved === 'list') ? saved : 'cards';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const root = document.documentElement;
    const palette = THEME_PALETTES[themeColor] || THEME_PALETTES.orange;
    root.style.setProperty('--color-primary', palette.primary);
    root.style.setProperty('--color-primary-dark', palette.primaryDark);
  }, [themeColor]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = FONT_SCALE_MAP[fontScale] || '100%';
  }, [fontScale]);

  const setTimeFormat = (format: TimeFormat) => {
    localStorage.setItem('appTimeFormat', format);
    setTimeFormatState(format);
  };

  const setDarkMode = (dark: boolean) => {
    localStorage.setItem('appDarkMode', String(dark));
    setDarkModeState(dark);
  };

  const setThemeColor = (color: ThemeColor) => {
    localStorage.setItem('appThemeColor', color);
    setThemeColorState(color);
  };

  const setFontScale = (scale: FontScale) => {
    localStorage.setItem('appFontScale', scale);
    setFontScaleState(scale);
  };

  const setPersonsViewMode = (mode: PersonsViewMode) => {
    localStorage.setItem('appPersonsViewMode', mode);
    setPersonsViewModeState(mode);
  };

  return (
    <SettingsContext.Provider
      value={{
        timeFormat,
        setTimeFormat,
        darkMode,
        setDarkMode,
        themeColor,
        setThemeColor,
        fontScale,
        setFontScale,
        personsViewMode,
        setPersonsViewMode,
      }}
    >
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
