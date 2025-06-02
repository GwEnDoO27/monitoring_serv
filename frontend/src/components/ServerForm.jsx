// File: components/ServerForm.jsx

const ServerForm = ({ editingServer, newServer, setNewServer, onClose, onSubmit }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-700 rounded-lg shadow-2xl p-6 w-full max-w-md border border-slate-600">
        <h2 className="text-xl font-bold mb-4 text-white">
          {editingServer ? 'Modifier le serveur' : 'Ajouter un serveur'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nom</label>
            <input
              type="text"
              required
              value={newServer.name}
              onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400"
              placeholder="Mon serveur"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">URL</label>
            <input
              type="text"
              required
              value={newServer.url}
              onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400"
              placeholder="https://example.com ou 192.168.1.1:80"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
              <select
                value={newServer.type}
                onChange={(e) => setNewServer({ ...newServer, type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              >
                <option value="http">HTTP</option>
                <option value="tcp">TCP</option>
                <option value="ping">Ping</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Intervalle</label>
              <select
                value={newServer.interval}
                onChange={(e) => setNewServer({ ...newServer, interval: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              >
                <option value="15s">15 secondes</option>
                <option value="30s">30 secondes</option>
                <option value="60s">1 minute</option>
                <option value="300s">5 minutes</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Timeout</label>
            <select
              value={newServer.timeout}
              onChange={(e) => setNewServer({ ...newServer, timeout: e.target.value })}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            >
              <option value="3s">3 secondes</option>
              <option value="5s">5 secondes</option>
              <option value="10s">10 secondes</option>
              <option value="30s">30 secondes</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-300 bg-slate-600 rounded-md hover:bg-slate-500 transition-colors border border-slate-500"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
            >
              {editingServer ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerForm;
