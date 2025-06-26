import { AlertCircle, CheckCircle, Clock, Edit, RefreshCw, Server, Trash2 } from 'lucide-react';

/**
 * Composant d'affichage d'une carte serveur style macOS.
 * Affiche les infos, le statut, les actions et les erreurs éventuelles.
 * Deux modes : horizontal (liste) ou vertical (grille).
 *
 * Props :
 * - server : objet serveur à afficher
 * - onEdit : fonction appelée lors du clic sur modifier
 * - onDelete : fonction appelée lors du clic sur supprimer
 * - onManualCheck : fonction appelée lors du clic sur vérifier maintenant
 * - isHorizontal : booléen, mode d'affichage (liste ou grille)
 */
const ServerCard = ({ server, onEdit, onDelete, onManualCheck, isHorizontal = false }) => {
  // Retourne la couleur du texte selon le statut du serveur
  const getStatusColor = (isUp) => isUp ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';

  // Retourne la couleur du badge selon le statut
  const getStatusBadgeClasses = (isUp) => isUp
    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 ring-1 ring-green-200 dark:ring-green-500/30'
    : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-500/30';

  // Formate le temps de réponse en ms ou N/A
  const formatTime = (ms) => ms ? `${ms}ms` : '—';

  // Formate la date de dernière vérification
  const formatLastCheck = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Mode horizontal (liste)
  if (isHorizontal) {
    return (
      <div className={`
        bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl 
        rounded-xl border border-gray-200/50 dark:border-gray-700/50 
        shadow-sm hover:shadow-md
        transition-all duration-200 ease-out
        overflow-hidden
      `}>
        <div className="flex items-center p-4 gap-4">
          {/* Indicateur de statut sur le côté */}
          <div className={`w-1 h-12 rounded-full ${server.status?.is_up ? 'bg-green-500' : 'bg-red-500'}`} />

          {/* Informations principales */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${server.status?.is_up
                ? 'bg-green-100 dark:bg-green-500/20'
                : 'bg-red-100 dark:bg-red-500/20'
              }
            `}>
              <Server className={`w-5 h-5 ${server.status?.is_up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{server.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{server.url}</p>
            </div>
          </div>

          {/* Métriques */}
          <div className="flex items-center gap-6">
            {/* Badge de statut */}
            <div className={`
              px-2.5 py-1 rounded-full text-xs font-medium
              ${getStatusBadgeClasses(server.status?.is_up)}
            `}>
              {server.status?.is_up ? 'En ligne' : 'Hors ligne'}
            </div>

            {/* Temps de réponse */}
            <div className="text-center min-w-[60px]">
              <div className="text-2xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Latence</div>
              <div className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">
                {formatTime(server.status?.response_time_ms)}
              </div>
            </div>

            {/* Type */}
            <div className="text-center min-w-[50px]">
              <div className="text-2xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Type</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {server.type.toUpperCase()}
              </div>
            </div>

            {/* Dernière vérification */}
            <div className="text-center min-w-[80px]">
              <div className="text-2xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Dernière Verification</div>
              <div className="flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {server.status?.last_check ? formatLastCheck(server.status.last_check) : '—'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => onEdit(server)}
                className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                title="Modifier"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(server.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onManualCheck(server)}
                className="p-1.5 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition-colors"
                title="Vérifier maintenant"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Erreur (si présente) */}
        {server.status?.last_error && (
          <div className="px-4 pb-3">
            <div className="p-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
              <p className="text-xs text-red-600 dark:text-red-400">
                <span className="font-medium">Erreur :</span> {server.status.last_error}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mode vertical (grille)
  return (
    <div className={`
      bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl 
      rounded-xl border border-gray-200/50 dark:border-gray-700/50 
      shadow-sm hover:shadow-lg
      transition-all duration-200 ease-out
      overflow-hidden group
    `}>
      {/* Bande de statut en haut */}
      <div className={`h-1 ${server.status?.is_up ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`} />

      <div className="p-5">
        {/* En-tête */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${server.status?.is_up
                ? 'bg-green-100 dark:bg-green-500/20'
                : 'bg-red-100 dark:bg-red-500/20'
              }
            `}>
              <Server className={`w-5 h-5 ${server.status?.is_up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{server.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{server.url}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(server)}
              className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
              title="Modifier"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(server.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onManualCheck(server)}
              className="p-1.5 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition-colors"
              title="Vérifier maintenant"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Badge de statut */}
        <div className="mb-4">
          <div className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
            ${getStatusBadgeClasses(server.status?.is_up)}
          `}>
            {server.status?.is_up ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            {server.status?.is_up ? 'En ligne' : 'Hors ligne'}
          </div>
        </div>

        {/* Métriques */}
        <div className="space-y-3">
          {/* Temps de réponse */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Temps de réponse</span>
            <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">
              {formatTime(server.status?.response_time_ms)}
            </span>
          </div>

          {/* Dernière vérification */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Dernière vérification</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {server.status?.last_check ? formatLastCheck(server.status.last_check) : '—'}
              </span>
            </div>
          </div>

          {/* Séparateur */}
          <div className="h-px bg-gray-200 dark:bg-gray-700" />

          {/* Type et intervalle */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              Type: <span className="text-gray-600 dark:text-gray-300 font-medium">{server.type.toUpperCase()}</span>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Check: <span className="text-gray-600 dark:text-gray-300 font-medium">{server.interval}</span>
            </span>
          </div>
        </div>

        {/* Erreur (si présente) */}
        {server.status?.last_error && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
            <p className="text-xs text-red-600 dark:text-red-400">
              <span className="font-medium">Erreur :</span> {server.status.last_error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerCard;