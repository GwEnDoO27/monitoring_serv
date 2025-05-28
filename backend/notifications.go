// notifications.go
package notifiactions

import (
	"fmt"
	"time"

	"github.com/gen2brain/beeep"
)

// Stocke le dernier envoi de notification par serveur
type NotificationManager struct {
	LastSent map[string]time.Time
	Cooldown time.Duration
}

func NewNotificationManager(cooldownMinutes int) *NotificationManager {
	return &NotificationManager{
		LastSent: make(map[string]time.Time),
		Cooldown: time.Duration(cooldownMinutes) * time.Minute,
	}
}

func (n *NotificationManager) ShouldNotify(serverName string) bool {
	last, exists := n.LastSent[serverName]
	if !exists || time.Since(last) > n.Cooldown {
		n.LastSent[serverName] = time.Now()
		return true
	}
	return false
}

func (n *NotificationManager) Send(serverName, status string) {
	if !n.ShouldNotify(serverName) {
		fmt.Println("Notification bloquée par le cooldown.")
		return
	}

	title := "Statut du serveur"
	message := fmt.Sprintf("Le serveur %s est maintenant %s", serverName, status)

	err := beeep.Notify(title, message, "")
	if err != nil {
		fmt.Println("Erreur d'envoi de notification :", err)
	}
}
