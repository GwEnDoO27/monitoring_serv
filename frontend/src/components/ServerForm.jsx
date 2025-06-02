// File: components/ServerForm.jsx

const ServerForm = ({ editingServer, newServer, setNewServer, onClose, onSubmit }) => {
  return (
    <>
      {/* Overlay pour fermer le panel en cliquant à l'extérieur */}
      <div
        className="fixed inset-0 bg-black bg-opacity-65 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Panel coulissant depuis la droite */}
      <div className="fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col h-full">
          {/* Header du panel */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingServer ? 'Modifier le serveur' : 'Ajouter un serveur'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contenu du formulaire */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom du serveur
                </label>
                <input
                  type="text"
                  required
                  value={newServer.name}
                  onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                  placeholder="Mon serveur"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL ou adresse IP
                </label>
                <input
                  type="text"
                  required
                  value={newServer.url}
                  onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                  placeholder="https://example.com ou 192.168.1.1:80"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type de vérification
                </label>
                <select
                  value={newServer.type}
                  onChange={(e) => setNewServer({ ...newServer, type: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="http">HTTP/HTTPS</option>
                  <option value="tcp">TCP</option>
                  <option value="ping">Ping</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Intervalle
                  </label>
                  <select
                    value={newServer.interval}
                    onChange={(e) => setNewServer({ ...newServer, interval: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white transition-colors"
                  >
                    <option value="15s">15 secondes</option>
                    <option value="30s">30 secondes</option>
                    <option value="60s">1 minute</option>
                    <option value="300s">5 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Timeout
                  </label>
                  <select
                    value={newServer.timeout}
                    onChange={(e) => setNewServer({ ...newServer, timeout: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white transition-colors"
                  >
                    <option value="3s">3 secondes</option>
                    <option value="5s">5 secondes</option>
                    <option value="10s">10 secondes</option>
                    <option value="30s">30 secondes</option>
                  </select>
                </div>
              </div>

              {/* Section d'aide */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  💡 Conseils d'utilisation
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• HTTP/HTTPS : Pour vérifier les sites web</li>
                  <li>• TCP : Pour vérifier les services réseau (ports)</li>
                  <li>• Ping : Pour vérifier la connectivité de base</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer avec les boutons d'action */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600 font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors shadow-lg font-medium"
              >
                {editingServer ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ServerForm;