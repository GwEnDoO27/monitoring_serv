package main

import (
	"context"
	"encoding/json"
	"fmt"
	backend "monitoring_serv/backend"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

type App struct {
	ctx        context.Context
	monitor    *Monitor
	notifier   *backend.NotificationManager
	settings   backend.Settings
	settingsMu sync.RWMutex
}

// NewApp crée une nouvelle instance de App en se basant sur les settings chargés
func NewApp(notifier *backend.NotificationManager) *App {
	// Charger les settings (ou valeurs par défaut)
	s, err := backend.LoadSettings()
	if err != nil {
		fmt.Println("⚠️ Impossible de charger les settings :", err)
		s = backend.DefaultSettings()
	}

	// Configurer le NotificationManager selon settings
	switch s.NotificationMode {
	case "inapp":
		notifier.SetEnabled(true)
	case "email":
		// On désactive les notifs in-app, à étendre plus tard pour SMTP si besoin
		notifier.SetEnabled(false)
	case "none":
		notifier.SetEnabled(false)
	default:
		notifier.SetEnabled(true)
	}
	// Appliquer le cooldown
	notifier.SetCooldown(s.NotificationCooldown)

	app := &App{
		monitor: &Monitor{
			servers:    make(map[string]*Server),
			stopChans:  make(map[string]chan bool),
			statusChan: make(chan ServerStatusUpdate, 100),
			mutex:      sync.RWMutex{},
			Notifier:   notifier,
		},
		notifier: notifier,
		settings: s,
	}
	return app
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Charger les serveurs existants au démarrage
	a.monitor.LoadServersFromFile()
}

// onDomReady is called after front-end resources have been loaded
func (a *App) onDomReady(ctx context.Context) {
	// Démarrer le monitoring pour tous les serveurs chargés
	for _, server := range a.monitor.servers {
		a.monitor.StartMonitoring(server)
	}
}

func (a *App) onShutdown(ctx context.Context) {
	fmt.Println(">>> onShutdown called, saving servers to file")
	err := a.monitor.SaveServersToFile()
	if err != nil {
		fmt.Println(">>> Error saving servers:", err)
	}
}

type Server struct {
	ID       string       `json:"id"`
	Name     string       `json:"name"`
	URL      string       `json:"url"`
	Type     string       `json:"type"`     // http, tcp, ping
	Interval string       `json:"interval"` // Format string pour le frontend
	Timeout  string       `json:"timeout"`  // Format string pour le frontend
	Status   ServerStatus `json:"status"`
}

type ServerStatus struct {
	IsUp         bool      `json:"is_up"`
	ResponseTime int64     `json:"response_time_ms"`
	LastCheck    time.Time `json:"last_check"`
	LastError    string    `json:"last_error,omitempty"`
}

type Monitor struct {
	servers    map[string]*Server
	stopChans  map[string]chan bool
	statusChan chan ServerStatusUpdate
	mutex      sync.RWMutex
	Notifier   *backend.NotificationManager
}

type ServerStatusUpdate struct {
	ServerID string
	Status   ServerStatus
}

func NewMonitor() *Monitor {
	return &Monitor{
		servers:    make(map[string]*Server),
		stopChans:  make(map[string]chan bool),
		statusChan: make(chan ServerStatusUpdate, 100),
		mutex:      sync.RWMutex{},
	}
}

// Méthodes exposées au frontend
func (a *App) GetServers() []Server {
	a.monitor.mutex.RLock()
	defer a.monitor.mutex.RUnlock()

	servers := make([]Server, 0, len(a.monitor.servers))
	for _, server := range a.monitor.servers {
		servers = append(servers, *server)
	}
	return servers
}

func (a *App) AddServer(server Server) (Server, error) {
	// Générer un ID unique si pas fourni
	if server.ID == "" {
		server.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	// Valider les données
	if err := a.validateServer(&server); err != nil {
		return server, err
	}

	a.monitor.mutex.Lock()
	a.monitor.servers[server.ID] = &server
	a.monitor.mutex.Unlock()

	// Sauvegarder dans le fichier
	a.monitor.SaveServersToFile()

	// Démarrer le monitoring
	a.monitor.StartMonitoring(&server)

	return server, nil
}

func (a *App) UpdateServer(server Server) (Server, error) {
	fmt.Printf("UpdateServer reçu, interval = %q\n", server.Interval)
	if server.ID == "" {
		return server, fmt.Errorf("ID du serveur requis pour la mise à jour")
	}

	// Valider les données
	if err := a.validateServer(&server); err != nil {
		return server, err
	}

	a.monitor.mutex.Lock()
	// Arrêter l'ancien monitoring s'il existe
	if stopChan, exists := a.monitor.stopChans[server.ID]; exists {
		close(stopChan)
		delete(a.monitor.stopChans, server.ID)
	}

	// Mettre à jour le serveur
	a.monitor.servers[server.ID] = &server
	a.monitor.mutex.Unlock()

	// Sauvegarder dans le fichier
	a.monitor.SaveServersToFile()

	// Redémarrer le monitoring
	a.monitor.StartMonitoring(&server)

	return server, nil
}

func (a *App) DeleteServer(id string) error {
	a.monitor.mutex.Lock()
	defer a.monitor.mutex.Unlock()

	// Arrêter le monitoring
	if stopChan, exists := a.monitor.stopChans[id]; exists {
		close(stopChan)
		delete(a.monitor.stopChans, id)
	}

	// Supprimer le serveur
	delete(a.monitor.servers, id)

	// Sauvegarder dans le fichier
	a.monitor.SaveServersToFile()

	return nil
}

func (a *App) validateServer(server *Server) error {
	if server.Name == "" {
		return fmt.Errorf("nom du serveur requis")
	}
	if server.URL == "" {
		return fmt.Errorf("URL du serveur requise")
	}
	if server.Type != "http" && server.Type != "tcp" && server.Type != "ping" {
		return fmt.Errorf("type de serveur invalide")
	}
	return nil
}

// Version améliorée de StartMonitoring avec gestion intelligente des notifications
func (m *Monitor) StartMonitoring(server *Server) {
	interval, err := parseDuration(server.Interval)
	if err != nil {
		interval = 30 * time.Second
	}

	timeout, err := parseDuration(server.Timeout)
	if err != nil {
		timeout = 10 * time.Second
	}

	stopChan := make(chan bool)
	m.mutex.Lock()
	m.stopChans[server.ID] = stopChan
	m.mutex.Unlock()

	go func() {
		// État initial
		prevStatus := server.Status
		newStatus := m.CheckServer(server, timeout)
		m.updateServerStatus(server.ID, newStatus)

		// Notification pour le changement d'état initial
		if prevStatus.IsUp != newStatus.IsUp {
			statusLabel := "DOWN"
			if newStatus.IsUp {
				statusLabel = "UP"
			}
			m.Notifier.Send(server.Name, statusLabel)
		}

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		consecutiveFailures := 0

		for {
			select {
			case <-ticker.C:
				fmt.Printf("🔄 Tick pour %s à %s (interval=%v)\n", server.Name, time.Now().Format("15:04:05"), interval)
				m.mutex.RLock()
				serverCopy := *m.servers[server.ID]
				m.mutex.RUnlock()

				prevStatus := serverCopy.Status
				newStatus := m.CheckServer(&serverCopy, timeout)
				m.updateServerStatus(server.ID, newStatus)

				// Gestion intelligente des notifications
				if prevStatus.IsUp != newStatus.IsUp {
					if newStatus.IsUp {
						// Serveur de nouveau UP
						consecutiveFailures = 0
						m.Notifier.Send(server.Name, "UP")
					} else {
						// Serveur DOWN
						consecutiveFailures++

						// Notification critique après 3 échecs consécutifs
						if consecutiveFailures >= 3 {
							m.Notifier.SendCritical(server.Name,
								fmt.Sprintf("DOWN (échecs: %d)", consecutiveFailures))
						} else {
							m.Notifier.Send(server.Name, "DOWN")
						}
					}
				} else if !newStatus.IsUp {
					// Serveur toujours DOWN, incrémenter le compteur
					consecutiveFailures++

					// Notification critique périodique pour les pannes persistantes
					if consecutiveFailures%5 == 0 { // Tous les 5 échecs
						m.Notifier.SendCritical(server.Name,
							fmt.Sprintf("TOUJOURS DOWN (échecs: %d)", consecutiveFailures))
					}
				}

			case <-stopChan:
				fmt.Printf("⏹️ Arrêt monitoring pour %s\n", server.Name)

				return
			}
		}
	}()
}

func (m *Monitor) updateServerStatus(serverID string, status ServerStatus) {
	m.mutex.Lock()
	if server, exists := m.servers[serverID]; exists {
		server.Status = status
	}
	m.mutex.Unlock()
}

func (m *Monitor) CheckServer(server *Server, timeout time.Duration) ServerStatus {
	start := time.Now()

	switch server.Type {
	case "http":
		return m.checkHTTP(server, start, timeout)
	case "tcp":
		return m.checkTCP(server, start, timeout)
	case "ping":
		return m.checkPing(server, start, timeout)
	}

	return ServerStatus{
		IsUp:      false,
		LastCheck: time.Now(),
		LastError: "Type de serveur non supporté",
	}
}

func (m *Monitor) checkHTTP(server *Server, start time.Time, timeout time.Duration) ServerStatus {
	client := &http.Client{Timeout: timeout}
	resp, err := client.Get(server.URL)
	duration := time.Since(start).Milliseconds()

	if err != nil {
		return ServerStatus{
			IsUp:         false,
			ResponseTime: duration,
			LastCheck:    time.Now(),
			LastError:    err.Error(),
		}
	}
	defer resp.Body.Close()

	return ServerStatus{
		IsUp:         resp.StatusCode < 400,
		ResponseTime: duration,
		LastCheck:    time.Now(),
		LastError: func() string {
			if resp.StatusCode >= 400 {
				return fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
			return ""
		}(),
	}
}

func (m *Monitor) checkTCP(server *Server, start time.Time, timeout time.Duration) ServerStatus {
	conn, err := net.DialTimeout("tcp", server.URL, timeout)
	duration := time.Since(start).Milliseconds()

	if err != nil {
		return ServerStatus{
			IsUp:         false,
			ResponseTime: duration,
			LastCheck:    time.Now(),
			LastError:    err.Error(),
		}
	}
	defer conn.Close()

	return ServerStatus{
		IsUp:         true,
		ResponseTime: duration,
		LastCheck:    time.Now(),
	}
}

func (m *Monitor) checkPing(server *Server, start time.Time, timeout time.Duration) ServerStatus {
	// Extraire l'IP/hostname de l'URL si nécessaire
	host := server.URL
	if strings.Contains(host, "://") {
		parts := strings.Split(host, "://")
		if len(parts) > 1 {
			host = strings.Split(parts[1], "/")[0]
			host = strings.Split(host, ":")[0] // Enlever le port si présent
		}
	}

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "1", "-w", fmt.Sprintf("%d", int(timeout.Milliseconds())), host)
	} else {
		cmd = exec.Command("ping", "-c", "1", "-W", fmt.Sprintf("%d", int(timeout.Seconds())), host)
	}

	err := cmd.Run()
	duration := time.Since(start).Milliseconds()

	if err != nil {
		return ServerStatus{
			IsUp:         false,
			ResponseTime: duration,
			LastCheck:    time.Now(),
			LastError:    "Ping failed",
		}
	}

	return ServerStatus{
		IsUp:         true,
		ResponseTime: duration,
		LastCheck:    time.Now(),
	}
}

// Persistance des données
func (m *Monitor) SaveServersToFile() error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	servers := make([]Server, 0, len(m.servers))
	for _, server := range m.servers {
		servers = append(servers, *server)
	}

	data, err := json.MarshalIndent(servers, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile("servers.json", data, 0644)
}

func (m *Monitor) LoadServersFromFile() error {
	data, err := os.ReadFile("servers.json")
	if err != nil {
		if os.IsNotExist(err) {
			return nil // Fichier n'existe pas encore, c'est normal
		}
		return err
	}

	var servers []Server
	if err := json.Unmarshal(data, &servers); err != nil {
		return err
	}

	m.mutex.Lock()
	defer m.mutex.Unlock()

	for _, server := range servers {
		m.servers[server.ID] = &server
	}

	return nil
}

// Utilitaires
func parseDuration(s string) (time.Duration, error) {
	// Convertir les formats comme "30s", "1m", "5m" en time.Duration
	if s == "" {
		return 0, fmt.Errorf("durée vide")
	}

	// Si c'est juste un nombre, on assume que c'est en secondes
	if val, err := strconv.Atoi(strings.TrimSuffix(s, "s")); err == nil {
		return time.Duration(val) * time.Second, nil
	}
	duration, err := time.ParseDuration(s)
	fmt.Println("Time duration ", duration)
	return duration, err
}

/* func (a *App) SendTestNotification(title, message string) {
	a.monitor.Notifier.Send(title, message)
} */

// Nouvelle méthode pour votre struct App
func (a *App) SetNotificationsEnabled(enabled bool) {
	a.monitor.Notifier.SetEnabled(enabled)
}

func (a *App) GetNotificationsEnabled() bool {
	return a.monitor.Notifier.IsEnabled()
}

func (a *App) SetNotificationCooldown(minutes int) {
	a.monitor.Notifier.SetCooldown(minutes)
}

func (a *App) GetNotificationCooldown() int {
	return a.monitor.Notifier.GetCooldown()
}

func (a *App) ClearNotificationCooldowns() {
	a.monitor.Notifier.ClearCooldowns()
}

// Méthode pour envoyer un résumé des serveurs en panne
func (a *App) SendDownServersSummary() {
	a.monitor.mutex.RLock()
	defer a.monitor.mutex.RUnlock()

	var downServers []string
	for _, server := range a.monitor.servers {
		if !server.Status.IsUp {
			downServers = append(downServers, server.Name)
		}
	}

	if len(downServers) > 0 {
		a.monitor.Notifier.SendSummary(downServers)
	}
}

func (a *App) ManualCheck(server Server) ServerStatus {
	timeout, err := parseDuration(server.Timeout)
	if err != nil {
		timeout = 10 * time.Second
	}
	status := a.monitor.CheckServer(&server, timeout)

	return status
}

func (a *App) GetSystemTheme() string {
	cmd := exec.Command("defaults", "read", "-g", "AppleInterfaceStyle")
	output, err := cmd.Output()
	if err != nil {
		// If command fails, assume light theme (default)
		return "light"
	}

	theme := strings.TrimSpace(string(output))
	if theme == "Dark" {
		return "dark"
	}
	return "light"
}

// GetSettings renvoie la struct Settings actuellement chargée
func (a *App) GetSettings() (backend.Settings, error) {
	a.settingsMu.RLock()
	defer a.settingsMu.RUnlock()
	return a.settings, nil
}

// SaveSettings reçoit une struct Settings depuis le frontend et la persiste
func (a *App) SaveSettings(s backend.Settings) error {
	a.settingsMu.Lock()
	defer a.settingsMu.Unlock()

	// 1. Mettre à jour le NotificationManager
	switch s.NotificationMode {
	case "inapp":
		a.notifier.SetEnabled(true)
	case "email":
		a.notifier.SetEnabled(false)
		// TODO : plus tard, gérer envoi d’email
	case "none":
		a.notifier.SetEnabled(false)
	default:
		a.notifier.SetEnabled(true)
	}
	a.notifier.SetCooldown(s.NotificationCooldown)

	// 2. Mettre à jour la valeur en mémoire
	a.settings = s

	// 3. Écrire dans le fichier settings.json
	if err := backend.SaveSettings(a.settings); err != nil {
		return err
	}

	return nil
}
