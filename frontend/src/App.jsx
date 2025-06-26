// File: components/ServerMonitor.jsx
import { Grid3X3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  AddServer,
  DeleteServer,
  GetServers,
  GetSettings,
  ManualCheck,
  UpdateServer,
} from '../wailsjs/go/main/App';
import { useTheme } from './hooks/useTheme';

import ServerCard from './components/ServerCard';
import ServerForm from './components/ServerForm';
import ServerHeader from './components/ServerHeader';
import Settings from './components/Settings';

const ServerMonitor = () => {
  const [servers, setServers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [showSettings, setShowSettings] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
    type: 'http',
    interval: '30s',
    timeout: '10s'
  });

  const { theme, isLoading, isDark, setThemeManually } = useTheme();

  useEffect(() => {
    loadServers();

    GetSettings()
      .then((s) => {
        if (['auto', 'light', 'dark'].includes(s.theme)) {
          setThemeManually(s.theme);
        }
      })
      .catch((err) => {
        console.error('Impossible de charger les settings Wails :', err);
      });

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
      console.error('Erreur pendant le test manuel :', err);
    }
  };

  const handleSettingsClose = () => {
    setShowSettings(false);
    GetSettings()
      .then((s) => {
        if (['auto', 'light', 'dark'].includes(s.theme)) {
          setThemeManually(s.theme);
        }
      })
      .catch((err) =>
        console.error('Impossible de recharger les settings :', err)
      );
  };

  const upServers = servers.filter((s) => s.status?.is_up).length;
  const totalServers = servers.length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-['SF_Pro_Display','system-ui','-apple-system','BlinkMacSystemFont','Segoe_UI','Roboto','sans-serif']">
      {/* Barre de titre macOS style */}
      <div className="h-11 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 flex items-center px-5 select-none">
        <div className="flex-1 text-center">
          <h1 className="text-sm font-medium text-gray-700 dark:text-gray-300">Server Monitor</h1>
        </div>
      </div>

      <div className="p-5">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: isDark ? '#1f2937' : '#ffffff',
              color: isDark ? '#f3f4f6' : '#111827',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: `1px solid ${isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.5)'}`,
              backdropFilter: 'blur(20px)',
            }
          }}
        />

        {/* Header sur toute la largeur */}
        <ServerHeader
          upServers={upServers}
          totalServers={totalServers}
          onAddClick={() => setShowAddForm(true)}
          OpenSettings={() => setShowSettings(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Conteneur des serveurs */}
        <div
          className={`mb-8 ${viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-3'
            }`}
        >
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onEdit={handleEditServer}
              onDelete={handleDeleteServer}
              onManualCheck={handleManualCheck}
              isHorizontal={viewMode === 'list'}
            />
          ))}
        </div>

        {/* Panel de formulaire */}
        {showAddForm && (
          <ServerForm
            editingServer={editingServer}
            newServer={newServer}
            setNewServer={setNewServer}
            onClose={() => {
              setShowAddForm(false);
              setEditingServer(null);
              setNewServer({
                name: '',
                url: '',
                type: 'http',
                interval: '30s',
                timeout: '10s'
              });
            }}
            onSubmit={editingServer ? handleUpdateServer : handleAddServer}
          />
        )}

        {/* Modal des réglages */}
        {showSettings && <Settings onClose={handleSettingsClose} />}

        {/* Message si aucun serveur */}
        {servers.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-10 max-w-md w-full border border-gray-200/50 dark:border-gray-700/50 shadow-xl">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                <Grid3X3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
                Aucun serveur configuré
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 leading-relaxed">
                Commencez par ajouter un serveur à monitorer pour voir son statut en temps réel
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2.5 rounded-lg transition-all shadow-lg hover:shadow-xl font-medium text-sm"
              >
                Ajouter votre premier serveur
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerMonitor;