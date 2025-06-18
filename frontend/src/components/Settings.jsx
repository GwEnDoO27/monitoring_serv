import { AlertCircle, CheckCircle, Mail, RefreshCw, RotateCw, Save, TestTube, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GetGmailSMTPConfig, GetOutlookSMTPConfig, GetSettings, GetYahooSMTPConfig, SaveSettings, TestSMTPConfig } from '../../wailsjs/go/main/App';

const Settings = ({ onClose, onSettingsChanged }) => {
  // États locaux pour les paramètres
  const [theme, setTheme] = useState('auto');
  const [notificationMode, setNotificationMode] = useState('inapp');
  const [notificationCooldown, setNotificationCooldown] = useState(10);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [userEmail, setUserEmail] = useState('');

  // États pour la configuration SMTP
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    username: '',
    password: '',
    from: '',
    tls: true
  });

  // États pour l'interface utilisateur
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSMTP, setIsTestingSMTP] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const [smtpTestStatus, setSmtpTestStatus] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialSettings, setInitialSettings] = useState({});

  // Charger les paramètres depuis Wails
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await GetSettings();

        // Validation et application des paramètres
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

        // Sauvegarder les paramètres initiaux pour détecter les changements
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

  // Détecter les changements dans les paramètres
  useEffect(() => {
    const currentSettings = {
      theme,
      notificationMode,
      notificationCooldown,
      refreshInterval,
      userEmail,
      smtpConfig,
    };

    const changed = Object.keys(initialSettings).some(
      key => {
        if (key === 'smtpConfig') {
          return JSON.stringify(initialSettings[key]) !== JSON.stringify(currentSettings[key]);
        }
        return initialSettings[key] !== currentSettings[key];
      }
    );

    setHasChanges(changed);
  }, [theme, notificationMode, notificationCooldown, refreshInterval, userEmail, smtpConfig, initialSettings]);

  // Réinitialiser aux valeurs par défaut
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
    setSaveStatus(null);
    setSmtpTestStatus(null);
  }, []);

  // Configurations prédéfinies pour les fournisseurs populaires
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

  // Tester la configuration SMTP
  const handleTestSMTP = async () => {
    if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password) {
      setSmtpTestStatus('error');
      return;
    }

    setIsTestingSMTP(true);
    setSmtpTestStatus(null);

    try {
      await TestSMTPConfig(smtpConfig);
      setSmtpTestStatus('success');
    } catch (error) {
      console.error('Erreur test SMTP:', error);
      setSmtpTestStatus('error');
    } finally {
      setIsTestingSMTP(false);
    }
  };

  // Annuler les modifications
  const handleCancel = useCallback(() => {
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
    setSaveStatus(null);
    setSmtpTestStatus(null);
  }, [initialSettings]);

  // Sauvegarder les paramètres
  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const settingsToSave = {
        theme,
        notificationMode,
        notificationCooldown,
        refreshInterval,
        userEmail,
        smtp_config: smtpConfig
      };

      await SaveSettings(settingsToSave);

      // Mettre à jour les paramètres initiaux
      setInitialSettings({ ...settingsToSave, smtpConfig });
      setSaveStatus('success');

      // Informer le parent que les paramètres ont changé
      if (onSettingsChanged) {
        onSettingsChanged(settingsToSave);
      }

      // Auto-fermer après succès
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

  // Validation et mise à jour de l'intervalle de rafraîchissement
  const handleIntervalChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 10 && val <= 3600) {
      setRefreshInterval(val);
    }
  }, []);

  // Validation et mise à jour du cooldown
  const handleCooldownChange = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0 && val <= 1440) {
      setNotificationCooldown(val);
    }
  }, []);

  // Mise à jour de la configuration SMTP
  const updateSmtpConfig = (field, value) => {
    setSmtpConfig(prev => ({ ...prev, [field]: value }));
    setSmtpTestStatus(null); // Reset test status when config changes
  };

  // Gestion de la fermeture avec confirmation si des changements non sauvegardés
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmClose = window.confirm('Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir fermer ?');
      if (!confirmClose) return;
    }
    if (onClose) onClose();
  }, [hasChanges, onClose]);

  // Affichage du loader pendant le chargement initial
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg flex items-center space-x-3">
          <RefreshCw className="animate-spin text-blue-500" size={20} />
          <span className="text-gray-900 dark:text-white">Chargement des paramètres...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-xl transform transition-all duration-300 max-h-[90vh] overflow-y-auto">

        {/* En-tête avec indicateur de changements */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 p-6 border-b dark:border-gray-700 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-bold dark:text-white">Paramètres</h2>
              {hasChanges && (
                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded-full">
                  Non sauvegardé
                </span>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
              aria-label="Fermer"
            >
              <X className="text-xl dark:text-white" />
            </button>
          </div>
        </div>

        {/* Contenu des paramètres */}
        <div className="p-6 space-y-6">

          {/* Message de statut */}
          {saveStatus && (
            <div className={`p-3 rounded-lg flex items-center space-x-2 ${saveStatus === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
              {saveStatus === 'success' ? (
                <CheckCircle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span className="text-sm font-medium">
                {saveStatus === 'success'
                  ? 'Paramètres sauvegardés avec succès !'
                  : 'Erreur lors de la sauvegarde. Veuillez réessayer.'
                }
              </span>
            </div>
          )}

          {/* Thème */}
          <div>
            <label className="block font-medium mb-3 dark:text-gray-200">Thème d'apparence</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'auto', label: '🌓 Auto', desc: 'Suit le système' },
                { value: 'light', label: '☀️ Clair', desc: 'Toujours clair' },
                { value: 'dark', label: '🌙 Sombre', desc: 'Toujours sombre' }
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
                  <div className={`p-3 rounded-lg border-2 text-center transition-all duration-200 hover:scale-105 ${theme === mode.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}>
                    <div className="font-medium dark:text-white text-sm">{mode.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mode.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div>
            <label className="block font-medium mb-2 dark:text-gray-200">Mode de notifications</label>
            <select
              value={notificationMode}
              onChange={(e) => setNotificationMode(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors"
              aria-label="Mode notifications"
            >
              <option value="inapp">🔔 Notifications intégrées</option>
              <option value="email">📧 Notifications par email</option>
              <option value="none">🔕 Aucune notification</option>
            </select>
          </div>

          {/* Configuration Email - Seulement si mode email */}
          {notificationMode === 'email' && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 mb-4">
                <Mail className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="font-medium text-blue-900 dark:text-blue-100">Configuration Email</h3>
              </div>

              {/* Email utilisateur */}
              <div>
                <label className="block font-medium mb-2 dark:text-gray-200">Votre email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Sélection rapide de fournisseur */}
              <div>
                <label className="block font-medium mb-2 dark:text-gray-200">Configuration rapide</label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleProviderSelect('gmail')}
                    className="flex-1 px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    Gmail
                  </button>
                  <button
                    onClick={() => handleProviderSelect('outlook')}
                    className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Outlook
                  </button>
                  <button
                    onClick={() => handleProviderSelect('yahoo')}
                    className="flex-1 px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                  >
                    Yahoo
                  </button>
                </div>
              </div>

              {/* Configuration SMTP détaillée */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1 dark:text-gray-200">Serveur SMTP</label>
                  <input
                    type="text"
                    value={smtpConfig.host}
                    onChange={(e) => updateSmtpConfig('host', e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 dark:text-gray-200">Port</label>
                  <input
                    type="number"
                    value={smtpConfig.port}
                    onChange={(e) => updateSmtpConfig('port', parseInt(e.target.value) || 587)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 dark:text-gray-200">Username</label>
                  <input
                    type="text"
                    value={smtpConfig.username}
                    onChange={(e) => updateSmtpConfig('username', e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 dark:text-gray-200">Mot de passe</label>
                  <input
                    type="password"
                    value={smtpConfig.password}
                    onChange={(e) => updateSmtpConfig('password', e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 dark:text-gray-200">Email expéditeur (optionnel)</label>
                  <input
                    type="email"
                    value={smtpConfig.from}
                    onChange={(e) => updateSmtpConfig('from', e.target.value)}
                    placeholder="monitoring@votredomaine.com"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="tls"
                    checked={smtpConfig.tls}
                    onChange={(e) => updateSmtpConfig('tls', e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="tls" className="font-medium dark:text-gray-200">Utiliser TLS</label>
                </div>
              </div>

              {/* Test SMTP */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleTestSMTP}
                  disabled={isTestingSMTP || !smtpConfig.host || !smtpConfig.username || !smtpConfig.password}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isTestingSMTP ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <TestTube size={16} />
                  )}
                  <span>{isTestingSMTP ? 'Test en cours...' : 'Tester la configuration'}</span>
                </button>

                {smtpTestStatus && (
                  <div className={`flex items-center space-x-1 text-sm ${smtpTestStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {smtpTestStatus === 'success' ? (
                      <>
                        <CheckCircle size={16} />
                        <span>Test réussi !</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} />
                        <span>Test échoué</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cooldown notifications - seulement si les notifications sont activées */}
          {notificationMode !== 'none' && (
            <div>
              <label className="block font-medium mb-2 dark:text-gray-200">
                Délai entre notifications
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  value={notificationCooldown}
                  onChange={handleCooldownChange}
                  className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors"
                  min="0"
                  max="1440"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400 min-w-0">minutes</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Délai minimum entre deux notifications pour un même serveur (0 = aucun délai)
              </p>
            </div>
          )}

          {/* Informations sur les paramètres actuels */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Résumé des paramètres</h3>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Thème :</span>
                <span className="font-medium">
                  {theme === 'auto' && '🌓 Automatique'}
                  {theme === 'light' && '☀️ Clair'}
                  {theme === 'dark' && '🌙 Sombre'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Notifications :</span>
                <span className="font-medium">
                  {notificationMode === 'inapp' && '🔔 Intégrées'}
                  {notificationMode === 'email' && '📧 Email'}
                  {notificationMode === 'none' && '🔕 Désactivées'}
                </span>
              </div>
              {notificationMode === 'email' && smtpConfig.host && (
                <div className="flex justify-between">
                  <span>Serveur SMTP :</span>
                  <span className="font-medium">{smtpConfig.host}:{smtpConfig.port}</span>
                </div>
              )}
              {notificationMode !== 'none' && (
                <div className="flex justify-between">
                  <span>Délai notifications :</span>
                  <span className="font-medium">{notificationCooldown} min</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-6 border-t dark:border-gray-700 rounded-b-2xl">
          <div className="flex space-x-3">
            <button
              onClick={handleResetDefaults}
              className="flex-1 flex items-center justify-center bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
              disabled={isSaving}
            >
              <RotateCw className="mr-2" size={16} />
              Par défaut
            </button>

            {hasChanges && (
              <button
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                disabled={isSaving}
              >
                <X className="mr-2" size={16} />
                Annuler
              </button>
            )}

            <button
              onClick={handleSaveSettings}
              disabled={isSaving || !hasChanges}
              className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${hasChanges && !isSaving
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 animate-spin" size={16} />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2" size={16} />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;