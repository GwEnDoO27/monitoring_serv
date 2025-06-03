// File: components/ServerMonitor.jsx
import { Grid3X3, LayoutGrid, List } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  AddServer,
  DeleteServer,
  GetServers,
  ManualCheck,
  UpdateServer,
  GetSettings,
  SaveSettings
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

  // Ce useEffect ne dépend plus de [theme, isDark], mais seulement du premier montage
  useEffect(() => {
    loadServers();

    // On récupère la préférence “theme” une seule fois au montage
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
  }, []); // <-- tableau de dépendances vide

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

  // Affiche l’écran de chargement tant qu’on détecte le thème
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-gray-900 dark:text-white">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-nunito transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--toast-bg)',
              color: 'var(--toast-color)'
            },
            className: 'dark:bg-gray-800 dark:text-white bg-white text-gray-900'
          }}
        />

        {/* Header avec boutons de basculement de vue */}
        <div className="flex items-center justify-between mb-6">
          <ServerHeader
            upServers={upServers}
            totalServers={totalServers}
            onAddClick={() => setShowAddForm(true)}
            OpenSettings={() => setShowSettings(true)}
          />

          {/* Boutons de basculement de vue */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm font-medium">Grille</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="text-sm font-medium">Liste</span>
            </button>
          </div>
        </div>

        {/* Conteneur des serveurs avec vue conditionnelle */}
        <div
          className={`mb-8 ${
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
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
          <div className="text-center py-12">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Grid3X3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucun serveur configuré
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Commencez par ajouter un serveur à monitorer pour voir son statut en
                temps réel
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors shadow-lg font-medium"
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
