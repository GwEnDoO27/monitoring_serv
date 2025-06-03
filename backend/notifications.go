package backend

import (
	"fmt"
	"sync"
	"time"

	"github.com/gen2brain/beeep"
)

// Stocke le dernier envoi de notification par serveur et par type
type NotificationManager struct {
	LastSent map[string]map[string]time.Time // serveur -> type -> timestamp
	Cooldown time.Duration
	mutex    sync.RWMutex
	enabled  bool
}

func NewNotificationManager(cooldownMinutes int) *NotificationManager {
	return &NotificationManager{
		LastSent: make(map[string]map[string]time.Time),
		Cooldown: time.Duration(cooldownMinutes) * time.Minute,
		mutex:    sync.RWMutex{},
		enabled:  true,
	}
}

// ShouldNotify vérifie si on doit envoyer une notification
// en tenant compte du type de notification (UP/DOWN)
func (n *NotificationManager) ShouldNotify(serverName, notificationType string) bool {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	if !n.enabled {
		return false
	}

	// Initialiser la map pour ce serveur si elle n'existe pas
	if n.LastSent[serverName] == nil {
		n.LastSent[serverName] = make(map[string]time.Time)
	}

	// Vérifier le cooldown pour ce type de notification
	last, exists := n.LastSent[serverName][notificationType]
	if !exists || time.Since(last) > n.Cooldown {
		n.LastSent[serverName][notificationType] = time.Now()
		return true
	}

	return false
}

// Send envoie une notification avec un meilleur formatage
func (n *NotificationManager) Send(serverName, status string) {
	if !n.ShouldNotify(serverName, status) {
		fmt.Printf("Notification bloquée par le cooldown pour %s (%s)\n", serverName, status)
		return
	}

	var title, message, iconPath string

	switch status {
	case "DOWN":
		title = "🔴 Serveur Hors Ligne"
		message = fmt.Sprintf("Le serveur '%s' ne répond plus", serverName)
		iconPath = "../build/Icons-green.icns" // Vous pouvez ajouter un chemin vers une icône d'erreur
	case "UP":
		title = "🟢 Serveur En Ligne"
		message = fmt.Sprintf("Le serveur '%s' est de nouveau accessible", serverName)
		iconPath = "../build/Icons-green.icns" // Vous pouvez ajouter un chemin vers une icône de succès
	default:
		title = "ℹ️ Statut Serveur"
		message = fmt.Sprintf("Serveur '%s': %s", serverName, status)
		iconPath = "../build/Icons-green.icns"
	}

	err := beeep.Notify(title, message, iconPath)
	if err != nil {
		fmt.Printf("Erreur d'envoi de notification pour %s: %v\n", serverName, err)
	} else {
		fmt.Printf("Notification envoyée: %s - %s\n", title, message)
	}
}

// SendCritical envoie une notification critique (plus persistante)
func (n *NotificationManager) SendCritical(serverName, status string) {
	// Les notifications critiques ignorent le cooldown normal
	n.mutex.Lock()
	if n.LastSent[serverName] == nil {
		n.LastSent[serverName] = make(map[string]time.Time)
	}
	n.LastSent[serverName]["CRITICAL"] = time.Now()
	n.mutex.Unlock()

	if !n.enabled {
		return
	}

	title := "🚨 ALERTE CRITIQUE"
	message := fmt.Sprintf("Serveur '%s' est %s", serverName, status)

	// Utilise Alert pour les notifications critiques (plus visibles)
	err := beeep.Alert(title, message, "")
	if err != nil {
		fmt.Printf("Erreur d'envoi de notification critique pour %s: %v\n", serverName, err)
	} else {
		fmt.Printf("Notification critique envoyée: %s - %s\n", title, message)
	}
}

// SendSummary envoie un résumé des serveurs en panne
func (n *NotificationManager) SendSummary(downServers []string) {
	if len(downServers) == 0 {
		return
	}

	if !n.ShouldNotify("SUMMARY", "DOWN_SUMMARY") {
		return
	}

	title := "📊 Résumé des Pannes"
	var message string

	if len(downServers) == 1 {
		message = fmt.Sprintf("1 serveur en panne: %s", downServers[0])
	} else {
		message = fmt.Sprintf("%d serveurs en panne: %s", len(downServers),
			fmt.Sprintf("%s et %d autres", downServers[0], len(downServers)-1))
	}

	err := beeep.Notify(title, message, "../build/Icons-green.icns")
	if err != nil {
		fmt.Printf("Erreur d'envoi de résumé: %v\n", err)
	}
}

// SetEnabled active ou désactive les notifications
func (n *NotificationManager) SetEnabled(enabled bool) {
	n.mutex.Lock()
	defer n.mutex.Unlock()
	n.enabled = enabled
	fmt.Printf("Notifications %s\n", map[bool]string{true: "activées", false: "désactivées"}[enabled])
}

// IsEnabled retourne l'état des notifications
func (n *NotificationManager) IsEnabled() bool {
	n.mutex.RLock()
	defer n.mutex.RUnlock()
	return n.enabled
}

// SetCooldown modifie la durée du cooldown
func (n *NotificationManager) SetCooldown(minutes int) {
	n.mutex.Lock()
	defer n.mutex.Unlock()
	n.Cooldown = time.Duration(minutes) * time.Minute
	fmt.Printf("Cooldown mis à jour: %d minutes\n", minutes)
}

// GetCooldown retourne la durée actuelle du cooldown en minutes
func (n *NotificationManager) GetCooldown() int {
	n.mutex.RLock()
	defer n.mutex.RUnlock()
	return int(n.Cooldown.Minutes())
}

// ClearCooldowns efface tous les cooldowns (force la prochaine notification)
func (n *NotificationManager) ClearCooldowns() {
	n.mutex.Lock()
	defer n.mutex.Unlock()
	n.LastSent = make(map[string]map[string]time.Time)
	fmt.Println("Tous les cooldowns ont été effacés")
}

// GetLastNotificationTime retourne le dernier envoi pour un serveur
func (n *NotificationManager) GetLastNotificationTime(serverName, notificationType string) *time.Time {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	if serverTimes, exists := n.LastSent[serverName]; exists {
		if lastTime, exists := serverTimes[notificationType]; exists {
			return &lastTime
		}
	}
	return nil
}
