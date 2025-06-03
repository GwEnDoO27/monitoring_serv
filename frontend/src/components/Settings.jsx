// File: components/Settings.jsx
import { useState, useEffect } from 'react';
import { Save, X, RefreshCw, RotateCw } from 'lucide-react';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';

const Settings = ({ onClose }) => {
  // 1. États locaux, initialisés « à blanc » en attendant GetSettings()
  const [theme, setTheme] = useState('auto');
  const [notificationMode, setNotificationMode] = useState('inapp');
  const [notificationCooldown, setNotificationCooldown] = useState(10);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [language, setLanguage] = useState('fr');
  const [fontSize, setFontSize] = useState(16);
  const [isLoading, setIsLoading] = useState(true);

  // 2. À l’ouverture, on va chercher les settings réels via Wails (GetSettings)
  useEffect(() => {
    GetSettings()
      .then((s) => {
        // s.theme est "auto" | "light" | "dark"
        if (['auto', 'light', 'dark'].includes(s.theme)) {
          setTheme(s.theme);
        }

        // s.notificationMode est "inapp" | "email" | "none"
        if (['inapp', 'email', 'none'].includes(s.notificationMode)) {
          setNotificationMode(s.notificationMode);
        }

        // s.notificationCooldown (nombre)
        if (typeof s.notificationCooldown === 'number') {
          setNotificationCooldown(s.notificationCooldown);
        }

        if (typeof s.refreshInterval === 'number') {
          setRefreshInterval(s.refreshInterval);
        }
      })
      .catch((err) => {
        console.error('GetSettings échoué :', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // 3. Tant que ce « GetSettings » n’est pas fini, on affiche un loader
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg">
          <span className="text-gray-900 dark:text-white">Chargement…</span>
        </div>
      </div>
    );
  }

  // 4. Réinitialiser aux valeurs par défaut (celles codées côté Go par defaultSettings())
  const handleResetDefaults = () => {
    setTheme('auto');
    setNotificationMode('inapp');
    setNotificationCooldown(10);
    setRefreshInterval(60);
    setLanguage('fr');
    setFontSize(16);
  };

  // 5. Sauvegarde : on remplace tout l’ancien localStorage + fetch par un simple SaveSettings(...)
  const handleSaveSettings = async () => {
    try {
      await SaveSettings({
        theme,
        notificationMode,
        notificationCooldown,
        refreshInterval,
        language,
        fontSize,
      });
      // On referme la modale. C’est le parent (ServerMonitor) qui relancera GetSettings() pour rafraîchir le thème.
      onClose && onClose();
    } catch (err) {
      console.error('SaveSettings échoué :', err);
      // (optionnel) Afficher un toast ou message d’erreur ici
    }
  };

  // 6. Validation minimale pour refreshInterval
  const handleIntervalChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 10) {
      setRefreshInterval(val);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl transform transition-all duration-300 p-6">
        {/* ----- En-tête ----- */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold dark:text-white">Paramètres</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
            aria-label="Fermer"
          >
            <X className="text-xl dark:text-white" />
          </button>
        </div>

        <div className="space-y-6">
          {/* ----- Thème (Auto / Light / Dark) ----- */}
          <div>
            <label className="block font-medium mb-2 dark:text-gray-200">Thème</label>
            <div className="flex space-x-4">
              {['auto', 'light', 'dark'].map((mode) => (
                <label key={mode} className="inline-flex items-center dark:text-gray-200">
                  <input
                    type="radio"
                    name="theme"
                    value={mode}
                    checked={theme === mode}
                    onChange={(e) => setTheme(e.target.value)}
                    className="form-radio h-4 w-4 text-blue-500"
                  />
                  <span className="ml-2 capitalize">
                    {mode === 'auto' ? 'Auto (système)' : mode}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ----- Notifications (In-app / Email / None) ----- */}
          <div>
            <label className="block font-medium mb-2 dark:text-gray-200">Notifications</label>
            <select
              value={notificationMode}
              onChange={(e) => setNotificationMode(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              aria-label="Mode notifications"
            >
              <option value="inapp">In-app</option>
              <option value="email">Email</option>
              <option value="none">Aucune</option>
            </select>
          </div>

          {/* ----- Cooldown notifications ----- */}
          <div>
            <label className="block font-medium mb-2 dark:text-gray-200">
              Cooldown notifications (minutes)
            </label>
            <input
              type="number"
              value={notificationCooldown}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0) {
                  setNotificationCooldown(val);
                }
              }}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              min="0"
              aria-label="Cooldown notifications en minutes"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Délai minimum entre deux notifications pour un même serveur
            </p>
          </div>

          {/* ----- Boutons Réinitialiser & Enregistrer ----- */}
          <div className="flex space-x-4 pt-4">
            <button
              onClick={handleResetDefaults}
              className="flex-1 flex items-center justify-center bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors duration-200 focus:outline-none"
            >
              <X className="mr-2" />
              Réinitialiser
            </button>
            <button
              onClick={handleSaveSettings}
              className="flex-1 flex items-center justify-center bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors duration-200 focus:outline-none"
            >
              <Save className="mr-2" />
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
