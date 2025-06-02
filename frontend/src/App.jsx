// File: components/ServerMonitor.jsx
import { useEffect, useState } from 'react';
import { AddServer, DeleteServer, GetServers, UpdateServer, ManualCheck } from '../wailsjs/go/main/App';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { useTheme } from './hooks/useTheme';

import ServerCard from './components/ServerCard';
import ServerForm from './components/ServerForm';
import ServerHeader from './components/ServerHeader';

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

  const { theme, isLoading, isDark } = useTheme();

  useEffect(() => {
    loadServers();
    const interval = setInterval(loadServers, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadServers = async () => {
    try {
      const serverList = await GetServers();
      setServers(serverList);
    } catch (error) {
      console.error('Failed to load servers: ', error);
    }
  };

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

  const handleManualCheck = async (server) => {
    const toastId = toast.loading(`Vérification de ${server.name}...`);
    try {
      const updatedStatus = await ManualCheck(server);
      setServers((prev) =>
        prev.map((s) => (s.id === server.id ? { ...s, status: updatedStatus } : s))
      );
      toast.success(`Statut mis à jour pour ${server.name}`, { id: toastId });
    } catch (err) {
      toast.error(`Erreur pour ${server.name}`, { id: toastId });
      console.error("Erreur pendant le test manuel :", err);
    }
  };

  const upServers = servers.filter(s => s.status?.is_up).length;
  const totalServers = servers.length;

  // Affichage de chargement pendant la détection du thème
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-gray-900 dark:text-white">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-nunito transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--toast-bg)',
              color: 'var(--toast-color)',
            },
            className: 'dark:bg-gray-800 dark:text-white bg-white text-gray-900',
          }}
        />
        <ServerHeader
          upServers={upServers}
          totalServers={totalServers}
          onAddClick={() => setShowAddForm(true)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onEdit={handleEditServer}
              onDelete={handleDeleteServer}
              onManualCheck={handleManualCheck}
            />
          ))}
        </div>

        {showAddForm && (
          <ServerForm
            editingServer={editingServer}
            newServer={newServer}
            setNewServer={setNewServer}
            onClose={() => {
              setShowAddForm(false);
              setEditingServer(null);
              setNewServer({ name: '', url: '', type: 'http', interval: '30s', timeout: '10s' });
            }}
            onSubmit={editingServer ? handleUpdateServer : handleAddServer}
          />
        )}

        {servers.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Aucun serveur configuré</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Commencez par ajouter un serveur à monitorer</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors shadow-lg"
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