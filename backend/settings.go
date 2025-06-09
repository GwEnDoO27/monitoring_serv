package backend

import (
	"encoding/json"
	"os"
)

// Settings contient toutes les préférences utilisateur que l’on persiste
type Settings struct {
	Theme                string `json:"theme"`                // "auto" | "light" | "dark"
	NotificationMode     string `json:"notificationMode"`     // "inapp" | "email" | "none"
	NotificationCooldown int    `json:"notificationCooldown"` // en minutes
	RefreshInterval      int    `json:"refreshInterval"`      // en secondes
}

// defaultSettings renvoie une struct Settings avec les valeurs par défaut
func DefaultSettings() Settings {
	return Settings{
		Theme:                "auto",
		NotificationMode:     "inapp",
		NotificationCooldown: 10,
	}
}

// settingsFilePath returns the path to the settings file
func settingsFilePath() (string, error) {
	return "./settings.json", nil
}

// loadSettings lit le fichier JSON si présent, sinon renvoie les valeurs par défaut
func LoadSettings() (Settings, error) {
	path, err := settingsFilePath()
	if err != nil {
		return DefaultSettings(), err
	}

	// Si le fichier n'existe pas, on renvoie les valeurs par défaut
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return DefaultSettings(), nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return DefaultSettings(), err
	}

	var s Settings
	if err := json.Unmarshal(data, &s); err != nil {
		return DefaultSettings(), err
	}
	return s, nil
}

// saveSettings écrit les préférences dans le fichier JSON
func SaveSettings(s Settings) error {
	path, err := settingsFilePath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
