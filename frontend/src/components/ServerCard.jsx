// File: components/ServerCard.jsx
import { AlertCircle, CheckCircle, Clock, Edit, Trash2, RefreshCw, Server } from 'lucide-react';

const ServerCard = ({ server, onEdit, onDelete, onManualCheck }) => {
  const getStatusColor = (isUp) => isUp ? 'text-emerald-400' : 'text-red-400';
  const formatTime = (ms) => ms ? `${ms}ms` : 'N/A';
  const formatLastCheck = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR');
  };

  return (
    <div className={`bg-slate-700 rounded-lg shadow-xl p-6 border-l-4 ${server.status?.is_up ? 'border-emerald-500' : 'border-red-500'} hover:bg-slate-600 transition-colors`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-slate-400" />
          <div>
            <h3 className="font-semibold text-white">{server.name}</h3>
            <p className="text-sm text-slate-400">{server.url}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(server)} className="p-1 text-slate-400 hover:text-blue-400 transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(server.id)} className="p-1 text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => onManualCheck(server)} className="p-1 text-slate-400 hover:text-yellow-400 transition-colors">
            <RefreshCw className="w-4 h-4" />
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
  );
};

export default ServerCard;
