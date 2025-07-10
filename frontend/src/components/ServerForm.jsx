// Composant ServerForm - Formulaire d'ajout/modification de serveur
// Interface modale coulissante style macOS pour gérer les serveurs

import { X } from 'lucide-react';

/**
 * Composant de formulaire pour créer ou modifier un serveur
 * @param {Object} editingServer - Serveur en cours d'édition (null pour création)
 * @param {Object} newServer - Données du nouveau serveur
 * @param {Function} setNewServer - Fonction pour mettre à jour les données du serveur
 * @param {Function} onClose - Fonction de fermeture du formulaire
 * @param {Function} onSubmit - Fonction de soumission du formulaire
 */
const ServerForm = ({ editingServer, newServer, setNewServer, onClose, onSubmit }) => {
  return (
    <>
      {/* Overlay avec effet de flou macOS */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-all duration-300"
        onClick={onClose}
      />

      {/* Panel coulissant style macOS */}
      <div className="fixed top-0 right-0 h-full w-[400px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl shadow-2xl z-50 transform transition-transform duration-300 ease-out border-l border-gray-200/50 dark:border-gray-700/50">
        <div className="flex flex-col h-full">
          {/* Header du panel style macOS */}
          <div className="h-14 flex items-center justify-between px-5 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {editingServer ? 'Modifier le serveur' : 'Nouveau serveur'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
            >
              <X className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </button>
          </div>

          {/* Contenu du formulaire avec padding macOS */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-5">
              {/* Nom du serveur */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Nom du serveur
                </label>
                <input
                  type="text"
                  required
                  value={newServer.name}
                  onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                  placeholder="Mon serveur"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  URL ou adresse IP
                </label>
                <input
                  type="text"
                  required
                  value={newServer.url}
                  onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all font-mono"
                  placeholder="https://example.com"
                />
              </div>

              {/* Type de vérification */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Type de vérification
                </label>
                <div className="relative">
                  <select
                    value={newServer.type}
                    onChange={(e) => setNewServer({ ...newServer, type: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white transition-all appearance-none pr-8"
                  >
                    <option value="http">HTTP/HTTPS</option>
                    <option value="tcp">TCP</option>
                    <option value="ping">Ping</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Intervalle et Timeout */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Intervalle de vérification
                  </label>
                  <div className="relative">
                    <select
                      value={newServer.interval}
                      onChange={(e) => setNewServer({ ...newServer, interval: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white transition-all appearance-none pr-8"
                    >
                      <option value="15s">15 secondes</option>
                      <option value="30s">30 secondes</option>
                      <option value="60s">1 minute</option>
                      <option value="300s">5 minutes</option>
                      <option value="1800s">30 minutes</option>
                      <option value="3600s">1 heure</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Délai d'attente
                  </label>
                  <div className="relative">
                    <select
                      value={newServer.timeout}
                      onChange={(e) => setNewServer({ ...newServer, timeout: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 dark:text-white transition-all appearance-none pr-8"
                    >
                      <option value="3s">3 secondes</option>
                      <option value="5s">5 secondes</option>
                      <option value="10s">10 secondes</option>
                      <option value="30s">30 secondes</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section d'aide style macOS */}
              <div className="bg-blue-50/50 dark:bg-blue-500/10 backdrop-blur-sm border border-blue-200/50 dark:border-blue-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 dark:text-blue-400 text-xs">i</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                      Types de vérification
                    </h4>
                    <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-0.5">
                      <li>• <span className="font-medium">HTTP/HTTPS</span> : Sites web et APIs</li>
                      <li>• <span className="font-medium">TCP</span> : Services réseau (ports)</li>
                      <li>• <span className="font-medium">Ping</span> : Connectivité réseau</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer avec boutons style macOS */}
          <div className="border-t border-gray-200/50 dark:border-gray-700/50 p-4 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!newServer.name || !newServer.url}
                className="flex-1 px-3 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-sm hover:shadow-md disabled:shadow-none"
              >
                {editingServer ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ServerForm;