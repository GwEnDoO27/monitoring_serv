// File: components/ServerCard.jsx
import { AlertCircle, CheckCircle, Clock, Edit, Trash2, RefreshCw, Server } from 'lucide-react';

const ServerCard = ({ server, onEdit, onDelete, onManualCheck, isHorizontal = false }) => {
  const getStatusColor = (isUp) => isUp ? 'text-green-400' : 'text-red-400';
  const formatTime = (ms) => ms ? `${ms}ms` : 'N/A';
  const formatLastCheck = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR');
  };

  // Mode horizontal (liste)
  if (isHorizontal) {
    return (
      <div className={`bg-white dark:bg-slate-700 rounded-lg shadow-lg p-4 border-l-4 ${
        server.status?.is_up ? 'border-green-500' : 'border-red-500'
      } hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors`}>
        <div className="flex items-center justify-between">
          {/* Informations principales */}
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{server.name}</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">{server.url}</p>
              </div>
            </div>
          </div>

          {/* Statut */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              {server.status?.is_up ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm font-medium ${getStatusColor(server.status?.is_up)}`}>
                {server.status?.is_up ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>

            {/* Temps de réponse */}
            <div className="text-center min-w-[80px]">
              <span className="text-xs text-gray-500 dark:text-slate-500 block">Réponse</span>
              <span className="text-sm font-mono text-gray-900 dark:text-slate-300">
                {formatTime(server.status?.response_time_ms)}
              </span>
            </div>

            {/* Type et intervalle */}
            <div className="text-center min-w-[100px]">
              <span className="text-xs text-gray-500 dark:text-slate-500 block">Type</span>
              <span className="text-sm text-gray-900 dark:text-slate-300">
                {server.type.toUpperCase()}
              </span>
            </div>

            {/* Dernière vérification */}
            <div className="text-center min-w-[100px]">
              <span className="text-xs text-gray-500 dark:text-slate-500 block">Dernière check</span>
              <div className="flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-gray-500 dark:text-slate-500" />
                <span className="text-sm text-gray-900 dark:text-slate-300">
                  {server.status?.last_check ? formatLastCheck(server.status.last_check) : 'N/A'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1 ml-4">
              <button 
                onClick={() => onEdit(server)} 
                className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Modifier"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onDelete(server.id)} 
                className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onManualCheck(server)} 
                className="p-2 text-gray-500 dark:text-slate-400 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                title="Vérifier maintenant"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Erreur (si présente) */}
        {server.status?.last_error && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
            Erreur: {server.status.last_error}
          </div>
        )}
      </div>
    );
  }

  // Mode vertical (grille) - version originale améliorée
  return (
    <div className={`bg-white dark:bg-slate-700 rounded-lg shadow-xl p-6 border-l-4 ${
      server.status?.is_up ? 'border-green-500' : 'border-red-500'
    } hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{server.name}</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">{server.url}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => onEdit(server)} 
            className="p-1 text-gray-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onDelete(server.id)} 
            className="p-1 text-gray-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onManualCheck(server)} 
            className="p-1 text-gray-500 dark:text-slate-400 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-slate-400">Statut</span>
          <div className="flex items-center gap-2">
            {server.status?.is_up ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-medium ${getStatusColor(server.status?.is_up)}`}>
              {server.status?.is_up ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-slate-400">Temps de réponse</span>
          <span className="text-sm font-mono text-gray-900 dark:text-slate-300">
            {formatTime(server.status?.response_time_ms)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-slate-400">Dernière vérification</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-500 dark:text-slate-500" />
            <span className="text-sm text-gray-900 dark:text-slate-300">
              {server.status?.last_check ? formatLastCheck(server.status.last_check) : 'N/A'}
            </span>
          </div>
        </div>

        {server.status?.last_error && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
            Erreur: {server.status.last_error}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-500">
          <span>Type: {server.type.toUpperCase()}</span>
          <span>Intervalle: {server.interval}</span>
        </div>
      </div>
    </div>
  );
};

export default ServerCard;