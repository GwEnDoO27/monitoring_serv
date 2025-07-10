// Composant Settings - Interface de configuration de l'application
// Permet de configurer les thèmes, notifications, emails et SMTP

import { AlertCircle, CheckCircle, Mail, RefreshCw, TestTube, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GetGmailSMTPConfig, GetOutlookSMTPConfig, GetSettings, GetYahooSMTPConfig, SaveSettings, SendTestEmail } from '../../wailsjs/go/main/App';

/**
 * Composant Settings - Interface de configuration de l'application
 * @param {Function} onClose - Fonction appelée à la fermeture du modal
 * @param {Function} onSettingsChanged - Fonction appelée quand les paramètres changent
 */
const Settings = ({ onClose, onSettingsChanged }) => {
  // ===== États locaux pour les paramètres =====
  const [theme, setTheme] = useState('auto');                    // Thème de l'interface
  const [notificationMode, setNotificationMode] = useState('inapp'); // Mode de notification
  const [notificationCooldown, setNotificationCooldown] = useState(10); // Délai entre notifications
  const [refreshInterval, setRefreshInterval] = useState(60);    // Intervalle de rafraîchissement
  const [userEmail, setUserEmail] = useState('');               // Email utilisateur

  // ===== États pour la configuration SMTP =====
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',        // Serveur SMTP
    port: 587,       // Port SMTP
    username: '',    // Nom d'utilisateur
    password: '',    // Mot de passe
    from: '',        // Adresse expéditeur
    tls: true        // Utiliser TLS
  });

  // ===== États pour l'interface utilisateur =====
  const [isLoading, setIsLoading] = useState(true);           // Chargement initial
  const [isSaving, setIsSaving] = useState(false);            // Sauvegarde en cours
  const [isTestingSMTP, setIsTestingSMTP] = useState(false);  // Test SMTP en cours
  const [saveStatus, setSaveStatus] = useState(null);        // Statut de sauvegarde
  const [smtpTestStatus, setSmtpTestStatus] = useState(null); // Statut du test SMTP
  const [hasChanges, setHasChanges] = useState(false);       // Changements non sauvegardés
  const [initialSettings, setInitialSettings] = useState({}); // Paramètres initiaux

  // ===== Chargement des paramètres depuis le backend =====
  useEffect(() => {
    /**
     * Charge les paramètres depuis Wails et les valide
     * Applique des valeurs par défaut si nécessaire
     */
    const loadSettings = async () => {
      try {
        const settings = await GetSettings();

        // Validation et application des valeurs par défaut
        const validatedSettings = {
          theme: ['auto', 'light', 'dark'].includes(settings.theme) ? settings.theme : 'auto',
          notificationMode: ['inapp', 'email', 'none'].includes(settings.notificationMode) ? settings.notificationMode : 'inapp',
          notificationCooldown: typeof settings.notificationCooldown === 'number' && settings.notificationCooldown >= 0 ? settings.notificationCooldown : 10,
          refreshInterval: typeof settings.refreshInterval === 'number' && settings.refreshInterval >= 10 ? settings.refreshInterval : 60,
          userEmail: settings.userEmail || '',
          smtpConfig: settings.smtp_config || {
            host: '',
            port: 587,
            username: '',
            password: '',
            from: '',
            tls: true
          }
        };

        setTheme(validatedSettings.theme);
        setNotificationMode(validatedSettings.notificationMode);
        setNotificationCooldown(validatedSettings.notificationCooldown);
        setRefreshInterval(validatedSettings.refreshInterval);
        setUserEmail(validatedSettings.userEmail);
        setSmtpConfig(validatedSettings.smtpConfig);
        setInitialSettings(validatedSettings);

      } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
        setSaveStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // ===== Détection des changements =====
  useEffect(() => {
    /**
     * Compare les paramètres actuels avec les paramètres initiaux
     * pour déterminer s'il y a des changements non sauvegardés
     */
    const currentSettings = {
      theme,
      notificationMode,
      notificationCooldown,
      refreshInterval,
      userEmail,
      smtpConfig,
    };

    // Vérifier s'il y a des changements (comparaison spéciale pour smtpConfig)
    const changed = Object.keys(initialSettings).some(
      key => {
        if (key === 'smtpConfig') {
          // Comparaison profonde pour l'objet SMTP
          return JSON.stringify(initialSettings[key]) !== JSON.stringify(currentSettings[key]);
        }
        // Comparaison simple pour les autres propriétés
        return initialSettings[key] !== currentSettings[key];
      }
    );

    setHasChanges(changed);
  }, [theme, notificationMode, notificationCooldown, refreshInterval, userEmail, smtpConfig, initialSettings]);

  // ===== Gestionnaires d'événements =====
  
  /**
   * Remet tous les paramètres aux valeurs par défaut
   */
  const handleResetDefaults = useCallback(() => {
    setTheme('auto');
    setNotificationMode('inapp');
    setNotificationCooldown(10);
    setRefreshInterval(60);
    setUserEmail('');
    setSmtpConfig({
      host: '',
      port: 587,
      username: '',
      password: '',
      from: '',
      tls: true
    });
    // Réinitialiser les statuts
    setSaveStatus(null);
    setSmtpTestStatus(null);
  }, []);

  /**
   * Sélectionne et configure un fournisseur SMTP prédéfini
   * @param {string} provider - gmail, outlook, ou yahoo
   */
  const handleProviderSelect = async (provider) => {
    let config;
    try {
      switch (provider) {
        case 'gmail':
          config = await GetGmailSMTPConfig();
          break;
        case 'outlook':
          config = await GetOutlookSMTPConfig();
          break;
        case 'yahoo':
          config = await GetYahooSMTPConfig();
          break;
        default:
          return;
      }
      setSmtpConfig(prev => ({ ...prev, ...config }));
      setSmtpTestStatus(null);
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error);
    }
  };

  /**
   * Teste la configuration SMTP en envoyant un email de test
   * Vérifie que tous les champs requis sont remplis avant le test
   */
  const handleTestSMTP = async () => {
    // Vérifier que les champs requis sont remplis
    if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password) {
      setSmtpTestStatus('error');
      return;
    }

    setIsTestingSMTP(true);
    setSmtpTestStatus(null);

    try {
      // Envoyer un email de test à l'adresse utilisateur
      await SendTestEmail(userEmail);
      setSmtpTestStatus('success');
    } catch (error) {
      console.error('Erreur test SMTP:', error);
      setSmtpTestStatus('error');
    } finally {
      setIsTestingSMTP(false);
    }
  };

  /**
   * Annule les changements et remet les paramètres initiaux
   */
  const handleCancel = useCallback(() => {
    // Restaurer tous les paramètres initiaux
    setTheme(initialSettings.theme || 'auto');
    setNotificationMode(initialSettings.notificationMode || 'inapp');
    setNotificationCooldown(initialSettings.notificationCooldown || 10);
    setRefreshInterval(initialSettings.refreshInterval || 60);
    setUserEmail(initialSettings.userEmail || '');
    setSmtpConfig(initialSettings.smtpConfig || {
      host: '',
      port: 587,
      username: '',
      password: '',
      from: '',
      tls: true
    });
    // Réinitialiser les statuts
    setSaveStatus(null);
    setSmtpTestStatus(null);
  }, [initialSettings]);

  /**
   * Sauvegarde les paramètres modifiés
   * Envoie les données au backend et met à jour l'interface
   */
  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus(null);

    try {
      // Préparer les paramètres à sauvegarder
      const settingsToSave = {
        theme,
        notificationMode,
        notificationCooldown,
        refreshInterval,
        userEmail,
        smtp_config: smtpConfig
      };

      // Envoyer au backend
      await SaveSettings(settingsToSave);
      // Mettre à jour les paramètres initiaux
      setInitialSettings({ ...settingsToSave, smtpConfig });
      setSaveStatus('success');

      // Notifier le parent des changements
      if (onSettingsChanged) {
        onSettingsChanged(settingsToSave);
      }

      // Fermer le modal après un délai
      setTimeout(() => {
        if (onClose) onClose();
      }, 1000);

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [theme, notificationMode, notificationCooldown, refreshInterval, userEmail, smtpConfig, onClose, onSettingsChanged]);

  const handleIntervalChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 10 && val <= 3600) {
      setRefreshInterval(val);
    }
  }, []);

  const handleCooldownChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0 && val <= 1440) {
      setNotificationCooldown(val);
    }
  }, []);

  const updateSmtpConfig = (field, value) => {
    setSmtpConfig(prev => ({ ...prev, [field]: value }));
    setSmtpTestStatus(null);
  };

  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmClose = window.confirm('Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir fermer ?');
      if (!confirmClose) return;
    }
    if (onClose) onClose();
  }, [hasChanges, onClose]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl p-5 rounded-xl shadow-2xl flex items-center space-x-3">
          <RefreshCw className="animate-spin text-blue-500" size={16} />
          <span className="text-sm text-gray-900 dark:text-white">Chargement des paramètres...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl w-full max-w-2xl rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header macOS style */}
        <div className="h-14 px-5 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between bg-white/50 dark:bg-gray-800/50">
          <div className="flex items-center space-x-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Préférences</h2>
            {hasChanges && (
              <span className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded-full font-medium">
                Modifié
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
          >
            <X className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Message de statut */}
            {saveStatus && (
              <div className={`
                p-3 rounded-lg flex items-center space-x-2 text-sm
                ${saveStatus === 'success'
                  ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/20'
                  : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20'
                }
              `}>
                {saveStatus === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span className="font-medium">
                  {saveStatus === 'success' ? 'Paramètres sauvegardés' : 'Erreur lors de la sauvegarde'}
                </span>
              </div>
            )}

            {/* Section Apparence */}
            <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Apparence</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'auto', label: 'Auto', icon: '🌓' },
                  { value: 'light', label: 'Clair', icon: '☀️' },
                  { value: 'dark', label: 'Sombre', icon: '🌙' }
                ].map((mode) => (
                  <label key={mode.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      value={mode.value}
                      checked={theme === mode.value}
                      onChange={(e) => setTheme(e.target.value)}
                      className="sr-only"
                    />
                    <div className={`
                      p-3 rounded-lg border text-center transition-all
                      ${theme === mode.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20 dark:border-blue-400'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }
                    `}>
                      <div className="text-2xl mb-1">{mode.icon}</div>
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{mode.label}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Section Notifications */}
            <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Notifications</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Mode</label>
                  <div className="relative">
                    <select
                      value={notificationMode}
                      onChange={(e) => setNotificationMode(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none pr-8"
                    >
                      <option value="inapp">Notifications intégrées</option>
                      <option value="email">Notifications par email</option>
                      <option value="none">Aucune notification</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {notificationMode !== 'none' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Délai entre notifications
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={notificationCooldown}
                        onChange={handleCooldownChange}
                        className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        min="0"
                        max="1440"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">minutes</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Configuration Email */}
            {notificationMode === 'email' && (
              <div className="bg-blue-50/30 dark:bg-blue-500/10 rounded-lg p-4 border border-blue-200/50 dark:border-blue-500/20">
                <div className="flex items-center space-x-2 mb-3">
                  <Mail className="text-blue-600 dark:text-blue-400" size={16} />
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">Configuration Email</h3>
                </div>

                <div className="space-y-3">
                  {/* Email utilisateur */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Votre email</label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Boutons providers */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Configuration rapide</label>
                    <div className="flex space-x-2">
                      {[
                        { name: 'gmail', label: 'Gmail', color: 'bg-red-500 hover:bg-red-600' },
                        { name: 'outlook', label: 'Outlook', color: 'bg-blue-500 hover:bg-blue-600' },
                        { name: 'yahoo', label: 'Yahoo', color: 'bg-purple-500 hover:bg-purple-600' }
                      ].map(provider => (
                        <button
                          key={provider.name}
                          onClick={() => handleProviderSelect(provider.name)}
                          className={`flex-1 px-3 py-1.5 text-xs text-white rounded-md transition-colors ${provider.color}`}
                        >
                          {provider.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Configuration SMTP */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Serveur SMTP</label>
                      <input
                        type="text"
                        value={smtpConfig.host}
                        onChange={(e) => updateSmtpConfig('host', e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Port</label>
                      <input
                        type="number"
                        value={smtpConfig.port}
                        onChange={(e) => updateSmtpConfig('port', parseInt(e.target.value) || 587)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Username</label>
                      <input
                        type="text"
                        value={smtpConfig.username}
                        onChange={(e) => updateSmtpConfig('username', e.target.value)}
                        placeholder="votre@email.com"
                        className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mot de passe</label>
                      <input
                        type="password"
                        value={smtpConfig.password}
                        onChange={(e) => updateSmtpConfig('password', e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* Checkbox TLS */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="tls"
                      checked={smtpConfig.tls}
                      onChange={(e) => updateSmtpConfig('tls', e.target.checked)}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="tls" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Utiliser TLS
                    </label>
                  </div>

                  {/* Test SMTP */}
                  <div className="flex items-center space-x-3 pt-2">
                    <button
                      onClick={handleTestSMTP}
                      disabled={isTestingSMTP || !smtpConfig.host || !smtpConfig.username || !smtpConfig.password}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors text-xs font-medium"
                    >
                      {isTestingSMTP ? (
                        <RefreshCw className="animate-spin" size={12} />
                      ) : (
                        <TestTube size={12} />
                      )}
                      <span>{isTestingSMTP ? 'Test...' : 'Tester'}</span>
                    </button>

                    {smtpTestStatus && (
                      <div className={`flex items-center space-x-1 text-xs ${smtpTestStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {smtpTestStatus === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                        <span>{smtpTestStatus === 'success' ? 'Test réussi' : 'Test échoué'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer avec boutons */}
        <div className="h-16 px-5 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-end space-x-2 bg-gray-50/50 dark:bg-gray-900/50">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            disabled={isSaving}
          >
            Par défaut
          </button>

          {hasChanges && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
              disabled={isSaving}
            >
              Annuler
            </button>
          )}

          <button
            onClick={handleSaveSettings}
            disabled={isSaving || !hasChanges}
            className={`
              px-4 py-1.5 text-xs font-medium rounded-md transition-all
              ${hasChanges && !isSaving
                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;