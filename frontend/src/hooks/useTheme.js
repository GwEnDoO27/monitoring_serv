import { useState, useEffect, useCallback } from 'react';
import { GetSystemTheme, GetSettings } from '../../wailsjs/go/main/App';

/**
 * Retourne:
 *  - theme: "auto" | "light" | "dark"
 *  - isLoading: true tant que le hook n'a pas récupéré la préférence réelle
 *  - isDark: boolean (utile pour vos composants qui doivent savoir si on est en mode sombre)
 *  - setThemeManually: fonction pour forcer le thème ("auto", "light" ou "dark")
 */
export const useTheme = () => {
  const [theme, setTheme] = useState('auto');
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [systemPollingInterval, setSystemPollingInterval] = useState(null);

  // Applique vraiment la classe CSS sur <html> en fonction de `mode` ("light"|"dark")
  const applyCssTheme = useCallback((mode) => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setIsDark(mode === 'dark');
  }, []);

  // Exécute applyCssTheme() avec la valeur retournée.
  const detectSystemTheme = useCallback(async () => {
    try {
      const sys = await GetSystemTheme(); // renvoie "light" ou "dark"
      applyCssTheme(sys);
    } catch (e) {
      console.error('Failed to detect system theme:', e);
      applyCssTheme('light');
    }
  }, [applyCssTheme]);

  // Fonction à exposer pour forcer manuellement le thème.
  // (On l’utilisera quand l’utilisateur choisit "light" ou "dark" ou "auto".)
  const setThemeManually = useCallback(
    (mode) => {
      // Annule une éventuelle boucle de détection si elle existait
      if (systemPollingInterval) {
        clearInterval(systemPollingInterval);
        setSystemPollingInterval(null);
      }

      if (mode === 'auto') {
        // Si on repasse en "auto", on réactive la détection système
        detectSystemTheme();
        // On veut vérifier la préférence système toutes les 2s (comme avant)
        const intervalId = setInterval(detectSystemTheme, 2000);
        setSystemPollingInterval(intervalId);
      } else {
        // Si "light" ou "dark", on force sans plus écouter le système
        applyCssTheme(mode);
      }

      setTheme(mode);
    },
    [applyCssTheme, detectSystemTheme, systemPollingInterval]
  );

  // Au premier rendu, on va récupérer la préférence JSON via GetSettings()
  useEffect(() => {
    GetSettings()
      .then((s) => {
        // s.theme est "auto" | "light" | "dark"
        if (['auto', 'light', 'dark'].includes(s.theme)) {
          // On passe par setThemeManually pour que la logique se fasse proprement
          setThemeManually(s.theme);
        } else {
          // Valeur inattendue → fallback sur "auto"
          setThemeManually('auto');
        }
      })
      .catch((err) => {
        console.error('Impossible de récupérer les settings Wails (useTheme) :', err);
        // Au pire, on part sur "auto"
        setThemeManually('auto');
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Au démontage, on nettoie l’intervalle si besoin
    return () => {
      if (systemPollingInterval) clearInterval(systemPollingInterval);
    };
  }, []);

  return { theme, isLoading, isDark, setThemeManually };
};
