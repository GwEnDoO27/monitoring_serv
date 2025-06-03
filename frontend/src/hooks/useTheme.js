import { useState, useEffect } from 'react';
//import { GetSystemTheme } from '../wailsjs/go/main/App';
import { GetSystemTheme } from '../../wailsjs/go/main/App';

export const useTheme = () => {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(true);

  const detectTheme = async () => {
    try {
      const systemTheme = await GetSystemTheme();
      setTheme(systemTheme);
      // Appliquer le thème au document
      if (systemTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (error) {
      console.error('Failed to detect system theme:', error);
      setTheme('light');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Détection initiale
    detectTheme();

    // Vérifier le thème toutes les 2 secondes pour détecter les changements
    const interval = setInterval(detectTheme, 2000);

    return () => clearInterval(interval);
  }, []);

  return { theme, isLoading, isDark: theme === 'dark' };
};