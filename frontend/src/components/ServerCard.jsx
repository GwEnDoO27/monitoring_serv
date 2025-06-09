import { AlertCircle, CheckCircle, Clock, Edit, RefreshCw, Server, Trash2 } from 'lucide-react';
/**
 * Composant d'affichage d'une carte serveur.
 * Affiche les infos, le statut, les actions et les erreurs éventuelles.
 * Deux modes : horizontal (liste) ou vertical (grille).
 *
 * Props :
 * - server : objet serveur à afficher
 * - onEdit : fonction appelée lors du clic sur modifier
 * - onDelete : fonction appelée lors du clic sur supprimer
 * - onManualCheck : fonction appelée lors du clic sur vérifier maintenant
 * - isHorizontal : booléen, mode d'affichage (liste ou grille)
 */
const ServerCard = ({ server, onEdit, onDelete, onManualCheck, isHorizontal = false }) => {
  // Retourne la couleur du texte selon le statut du serveur
  const getStatusColor = (isUp) => isUp ? 'text-green-400' : 'text-red-400';
  // Formate le temps de réponse en ms ou N/A
  const formatTime = (ms) => ms ? `${ms}ms` : 'N/A';
  // Formate la date de dernière vérification
  const formatLastCheck = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR');
  };

  // Mode horizontal (liste)
  if (isHorizontal) {
    return (
      <div className={`bg-white dark:bg-gray-700 rounded-lg shadow-lg p-4 border-l-4 ${server.status?.is_up ? 'border-green-500' : 'border-red-500'
        } hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors`}>
        <div className="flex items-center justify-between">
          {/* Informations principales */}
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{server.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-200">{server.url}</p>
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
              <span className="text-xs text-gray-500 dark:text-slate-00 block">Réponse</span>
              <span className="text-sm font-mono text-gray-900 dark:text-gray-200">
                {formatTime(server.status?.response_time_ms)}
              </span>
            </div>

            {/* Type et intervalle */}
            <div className="text-center min-w-[100px]">
              <span className="text-xs text-gray-500 dark:text-slate-500 block">Type</span>
              <span className="text-sm text-gray-900 dark:text-gray-200">
                {server.type.toUpperCase()}
              </span>
            </div>

            {/* Dernière vérification */}
            <div className="text-center min-w-[100px]">
              <span className="text-xs text-gray-500 dark:text-slate-500 block">Dernière check</span>
              <div className="flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-gray-500 dark:text-slate-500" />
                <span className="text-sm text-gray-900 dark:text-gray-200">
                  {server.status?.last_check ? formatLastCheck(server.status.last_check) : 'N/A'}
                </span>
              </div>
            </div>

            {/* Actions (éditer, supprimer, vérifier) */}
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

  // Mode vertical (grille) 
  return (
    <div className={`bg-white dark:bg-gray-700 rounded-lg shadow-xl p-6 border-l-4 ${server.status?.is_up ? 'border-green-500' : 'border-red-500'
      } hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{server.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-200">{server.url}</p>
          </div>
        </div>
        {/* Actions (éditer, supprimer, vérifier) */}
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
      {/* Statut */}
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
        {/* Temps de réponse */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-slate-400">Temps de réponse</span>
          <span className="text-sm font-mono text-gray-900 dark:text-gray-200">
            {formatTime(server.status?.response_time_ms)}
          </span>
        </div>
        {/* Dernière vérification */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-slate-200">Dernière vérification</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-500 dark:text-slate-700" />
            <span className="text-sm text-gray-900 dark:text-gray-200">
              {server.status?.last_check ? formatLastCheck(server.status.last_check) : 'N/A'}
            </span>
          </div>
        </div>
        {/* Affichage de l'erreur si présente */}
        {server.status?.last_error && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
            Erreur: {server.status.last_error}
          </div>
        )}
        {/* Type et intervalle */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-200">
          <span>Type: {server.type.toUpperCase()}</span>
          <span>Intervalle: {server.interval}</span>
        </div>
      </div>
    </div>
  );
};

export default ServerCard;