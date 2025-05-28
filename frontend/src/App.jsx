import { AlertCircle, CheckCircle, Clock, Edit, Plus, Server, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AddServer, DeleteServer, GetServers, UpdateServer } from '../wailsjs/go/main/App';


const ServerMonitor = () => {
  const [servers, setServers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
    type: 'http',
    interval: '30s',
    timeout: '10s'
  });

  useEffect(() => {
    loadServers();
    // Set up real-time updates
    const interval = setInterval(loadServers, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadServers = async () => {
    try {
      const serverList = await GetServers();
      setServers(serverList);
    } catch (error) {
      console.error('Failed to load servers: ', error)
    }
  }

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.url) return;
    try {
      await AddServer(newServer);
      setNewServer({ name: '', url: '', type: 'http', interval: '30s', timeout: '10s' });
      setShowAddForm(false);
      loadServers();
    } catch (error) {
      console.error('Failed to add server:', error);
    }
  };

  const handleDeleteServer = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce serveur ?')) {
      try {
        await DeleteServer(id);
        loadServers();
      } catch (error) {
        console.error('Failed to delete server:', error);
      }
    }
  };

  const handleEditServer = (server) => {
    setEditingServer(server);
    setNewServer({
      name: server.name,
      url: server.url,
      type: server.type,
      interval: server.interval,
      timeout: server.timeout
    });
    setShowAddForm(true);
  };

  const handleUpdateServer = async (e) => {
    e.preventDefault();
    try {
      await UpdateServer({ ...newServer, id: editingServer.id });
      setEditingServer(null);
      setNewServer({ name: '', url: '', type: 'http', interval: '30s', timeout: '10s' });
      setShowAddForm(false);
      loadServers();
    } catch (error) {
      console.error('Failed to update server:', error);
    }
  };

  const getStatusColor = (isUp) => isUp ? 'text-emerald-400' : 'text-red-400';
  const getStatusBg = (isUp) => isUp ? 'bg-emerald-500/10' : 'bg-red-500/10';
  const formatTime = (ms) => ms ? `${ms}ms` : 'N/A';
  const formatLastCheck = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR');
  };

  const upServers = servers.filter(s => s.status?.is_up).length;
  const totalServers = servers.length;

  function testNotification() {
    window.go.notifications.NotificationManager.Send("Test", "Notification de test")
      .then(() => console.log("Test envoyé"))
      .catch(err => console.error("Erreur:", err));
  }


  return (
    <div className="min-h-screen bg-slate-800 p-6 text-white font-nunito">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Monitoring des Serveurs</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${upServers === totalServers ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-slate-300">
                {upServers}/{totalServers} serveurs en ligne
              </span>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Ajouter un serveur
            </button>
            <button
              onClick={testNotification}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow lg"
            >
              <Plus className="w-4 h-4" />
              Tester
            </button>
          </div>
        </div>

        {/* Server Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {servers.map((server) => (
            <div key={server.id} className={`bg-slate-700 rounded-lg shadow-xl p-6 border-l-4 ${server.status?.is_up ? 'border-emerald-500' : 'border-red-500'} hover:bg-slate-600 transition-colors`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-slate-400" />
                  <div>
                    <h3 className="font-semibold text-white">{server.name}</h3>
                    <p className="text-sm text-slate-400">{server.url}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditServer(server)}
                    className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteServer(server.id)}
                    className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Statut</span>
                  <div className="flex items-center gap-2">
                    {server.status?.is_up ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`text-sm font-medium ${getStatusColor(server.status?.is_up)}`}>
                      {server.status?.is_up ? 'En ligne' : 'Hors ligne'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Temps de réponse</span>
                  <span className="text-sm font-mono text-slate-300">
                    {formatTime(server.status?.response_time_ms)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Dernière vérification</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-sm text-slate-300">
                      {server.status?.last_check ? formatLastCheck(server.status.last_check) : 'N/A'}
                    </span>
                  </div>
                </div>

                {server.status?.last_error && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                    Erreur: {server.status.last_error}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Type: {server.type.toUpperCase()}</span>
                  <span>Intervalle: {server.interval}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add/Edit Server Modal */}
        {showAddForm && (
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
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingServer(null);
                      setNewServer({ name: '', url: '', type: 'http', interval: '30s', timeout: '10s' });
                    }}
                    className="flex-1 px-4 py-2 text-slate-300 bg-slate-600 rounded-md hover:bg-slate-500 transition-colors border border-slate-500"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={editingServer ? handleUpdateServer : handleAddServer}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
                  >
                    {editingServer ? 'Modifier' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {servers.length === 0 && (
          <div className="text-center py-12">
            <Server className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Aucun serveur configuré</h3>
            <p className="text-slate-400 mb-4">Commencez par ajouter un serveur à monitorer</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              Ajouter votre premier serveur
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerMonitor;