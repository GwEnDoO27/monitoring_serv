import { CirclePlus, Cog, Plus } from 'lucide-react';
import { TestEmailAlert } from '../../wailsjs/go/main/App';

const ServerHeader = ({ upServers, totalServers, onAddClick, OpenSettings }) => {
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
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-white">Monitoring des Serveurs</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${upServers === totalServers ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          <span className="text-slate-300">
            {upServers}/{totalServers} serveurs en ligne
          </span>
        </div>
        <button
          onClick={onAddClick}
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
        <button
          onClick={testEmailAlert}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow lg"
        >
          <CirclePlus className="w-4 h-4" />
          Tester
        </button>
        <button
          onClick={OpenSettings}
        >
          <Cog className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ServerHeader;
