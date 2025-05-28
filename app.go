package main

import (
	"context"
	"encoding/json"
	"fmt"
	notifications "monitoring_serv/backend"
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

// App struct
type App struct {
	ctx     context.Context
	monitor *Monitor
}

// NewApp creates a new App application struct
func NewApp(notifier *notifications.NotificationManager) *App {
	return &App{
		monitor: &Monitor{
			servers:    make(map[string]*Server),
			stopChans:  make(map[string]chan bool),
			statusChan: make(chan ServerStatusUpdate, 100),
			mutex:      sync.RWMutex{},
			Notifier:   notifier,
		},
	}
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
	Notifier   *notifications.NotificationManager
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

// Méthodes de monitoring
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
		prevStatus := server.Status
		newStatus := m.checkServer(server, timeout)
		m.updateServerStatus(server.ID, newStatus)

		if prevStatus.IsUp != newStatus.IsUp {
			statusLabel := "DOWN"
			if newStatus.IsUp {
				statusLabel = "UP"
			}
			m.Notifier.Send(server.Name, statusLabel)
		}

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				// Ici on relit l'état actuel du serveur
				m.mutex.RLock()
				serverCopy := *m.servers[server.ID] // copy to avoid race
				m.mutex.RUnlock()

				prevStatus := serverCopy.Status
				newStatus := m.checkServer(&serverCopy, timeout)

				m.updateServerStatus(server.ID, newStatus)

				if prevStatus.IsUp != newStatus.IsUp {
					statusLabel := "DOWN"
					if newStatus.IsUp {
						statusLabel = "UP"
					}
					m.Notifier.Send(server.Name, statusLabel)
				}

			case <-stopChan:
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

func (m *Monitor) checkServer(server *Server, timeout time.Duration) ServerStatus {
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

	return time.ParseDuration(s)
}

func (a *App) SendTestNotification(title, message string) {
	a.monitor.Notifier.Send(title, message)
}
