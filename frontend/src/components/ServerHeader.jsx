import { Cog, LayoutGrid, List, Plus } from 'lucide-react';
import { TestEmailAlert } from '../../wailsjs/go/main/App';

const ServerHeader = ({ upServers, totalServers, onAddClick, OpenSettings, viewMode, onViewModeChange }) => {
  const testNotification = () => {
    window.go.notifications.NotificationManager.Send("Test", "ℹ️ Statut Serveur")
      .then(() => console.log("Test envoyé"))
      .catch(err => console.error("Erreur:", err));
  };

  const testEmailAlert = async () => {
    await TestEmailAlert("Test Email Alert", "Ceci est un test d'alerte par email");
    console.log("Envoi de l'alerte par email...");
  }

  return (
    <div className="
      bg-white/80 dark:bg-gray-800/80 
      backdrop-blur-xl 
      rounded-xl 
      border border-gray-200/60 dark:border-gray-700/60
      shadow-sm
      p-4
      mb-5
      -mx-auto
      px-5
    ">
      <div className="flex items-center justify-between ">
        {/* Section gauche avec titre et statut */}
        <div className="flex items-center gap-6">
          {/* Titre avec style macOS */}
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
              Monitoring des Serveurs
            </h1>

            {/* Sous-titre avec statut */}
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`
                relative w-1.5 h-1.5 rounded-full
                ${upServers === totalServers
                  ? 'bg-green-500'
                  : upServers > 0
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }
              `}>
                {/* Effet de pulsation */}
                <div className={`
                  absolute inset-0 rounded-full animate-ping
                  ${upServers === totalServers
                    ? 'bg-green-500'
                    : upServers > 0
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }
                `} />
              </div>

              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span className={`
                  ${upServers === totalServers
                    ? 'text-green-600 dark:text-green-400'
                    : upServers > 0
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                `}>{upServers}</span>
                <span> sur {totalServers}</span>
                <span className="text-gray-400 dark:text-gray-500"> • </span>
                <span>
                  {upServers === totalServers && totalServers > 0 && 'Tous opérationnels'}
                  {upServers < totalServers && upServers > 0 && 'Partiellement en ligne'}
                  {upServers === 0 && totalServers > 0 && 'Tous hors ligne'}
                  {totalServers === 0 && 'Aucun serveur'}
                </span>
              </span>
            </div>
          </div>

          {/* Statistiques rapides */}
          <div className="hidden lg:flex items-center gap-4 pl-6 border-l border-gray-200 dark:border-gray-700">
            <div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {totalServers > 0 ? Math.round((upServers / totalServers) * 100) : 0}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Disponibilité</div>
            </div>
          </div>
        </div>

        {/* Section droite avec contrôles de vue et actions */}
        <div className="flex items-center gap-3">
          {/* Contrôle de vue segmenté */}
          {viewMode !== undefined && onViewModeChange && (
            <div className="
              flex items-center
              bg-gray-100/50 dark:bg-gray-700/50
              rounded-lg
              p-0.5
              border border-gray-200/50 dark:border-gray-600/50
              mr-2
            ">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grille</span>
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste</span>
              </button>
            </div>
          )}

          {/* Groupe de boutons d'action */}
          <div className="
            flex items-center
            bg-gray-100/50 dark:bg-gray-700/50
            rounded-lg
            p-1
            border border-gray-200/50 dark:border-gray-600/50
          ">
            {/* Bouton principal - Nouveau serveur */}
            <button
              onClick={onAddClick}
              className="
                inline-flex items-center gap-2 px-3 py-1.5
                bg-blue-500 hover:bg-blue-600 active:bg-blue-700
                text-white text-xs font-medium
                rounded-md
                shadow-sm
                transition-all duration-150 ease-out
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-700
              "
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau</span>
            </button>

            {/* Bouton Paramètres */}
            <button
              onClick={OpenSettings}
              className="
                ml-1 p-1.5 rounded-md
                text-gray-500 dark:text-gray-400
                hover:text-gray-700 dark:hover:text-gray-200
                hover:bg-gray-200/70 dark:hover:bg-gray-600/70
                transition-all duration-150 ease-out
                focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-700
              "
              title="Paramètres"
            >
              <Cog className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerHeader;