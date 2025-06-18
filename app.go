package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
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

	"github.com/emersion/go-smtp"
	//smtpbackend "github.com/emersion/go-smtp/backend"
	"github.com/wneessen/go-mail"
)

type App struct {
	ctx        context.Context
	monitor    *Monitor
	notifier   *backend.NotificationManager
	settings   backend.Settings
	settingsMu sync.RWMutex
	smtpServer *smtp.Server
	smtpPort   int
}

type EmbeddedSMTP struct {
	// Stockage temporaire des emails
	emails     []EmailMessage
	smtpConfig backend.SMTPConfig
}

type EmailMessage struct {
	From    string
	To      []string
	Subject string
	Body    string
	Time    time.Time
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
	a.StartEmbeddedSMTP()
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
		a.notifier.SetEnabled(true)
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

// Implémentation du backend SMTP
func (b *EmbeddedSMTP) NewSession(c *smtp.Conn) (smtp.Session, error) {
	return &SMTPSession{backend: b}, nil
}

type SMTPSession struct {
	backend *EmbeddedSMTP
	from    string
	to      []string
}

func (s *SMTPSession) AuthPlain(username, password string) error {
	// Pas d'auth nécessaire pour notre usage interne
	return nil
}

func (s *SMTPSession) Mail(from string, opts *smtp.MailOptions) error {
	s.from = from
	return nil
}

func (s *SMTPSession) Rcpt(to string, opts *smtp.RcptOptions) error {
	s.to = append(s.to, to)
	return nil
}

func (s *SMTPSession) Data(r io.Reader) error {
	// Lire le contenu de l'email
	data, err := io.ReadAll(r)
	if err != nil {
		return err
	}

	// Parser le contenu basique
	content := string(data)
	lines := strings.Split(content, "\n")

	var subject, body string
	var inHeaders = true

	for _, line := range lines {
		if inHeaders {
			if strings.HasPrefix(line, "Subject: ") {
				subject = strings.TrimPrefix(line, "Subject: ")
			}
			if line == "" {
				inHeaders = false
			}
		} else {
			body += line + "\n"
		}
	}

	// Stocker l'email (ici on pourrait l'envoyer vraiment)
	email := EmailMessage{
		From:    s.from,
		To:      s.to,
		Subject: subject,
		Body:    strings.TrimSpace(body),
		Time:    time.Now(),
	}

	s.backend.emails = append(s.backend.emails, email)

	// ICI: Envoyer l'email vers la vraie destination
	if s.backend.smtpConfig.Host != "" {
		go s.forwardToRealEmail(email, s.backend.smtpConfig)
	} else {
		log.Printf("⚠️ Pas de configuration SMTP, email stocké localement uniquement")
	}

	return nil
}

func (s *SMTPSession) Reset()        {}
func (s *SMTPSession) Logout() error { return nil }

// Forwarding vers le vrai destinataire
// Dans votre main.go, remplacez la fonction forwardToRealEmail par :
func (s *SMTPSession) forwardToRealEmail(email EmailMessage, smtpConfig backend.SMTPConfig) {
	if smtpConfig.Host == "" || smtpConfig.Username == "" {
		log.Printf("❌ Configuration SMTP incomplète, email non envoyé")
		return
	}

	log.Printf("📧 Envoi email via %s:%d vers %v", smtpConfig.Host, smtpConfig.Port, email.To)

	// Nettoyer le mot de passe pour Gmail
	cleanPassword := cleanAppPassword(smtpConfig.Password)

	// Créer le client avec timeout plus long
	c, err := mail.NewClient(smtpConfig.Host,
		mail.WithPort(smtpConfig.Port),
		mail.WithTimeout(30*time.Second),
	)
	if err != nil {
		log.Printf("❌ Erreur création client SMTP: %s", err)
		return
	}

	// Configuration de l'authentification
	c.SetSMTPAuth(mail.SMTPAuthPlain)
	c.SetUsername(smtpConfig.Username)
	c.SetPassword(cleanPassword)

	// Configuration TLS
	if smtpConfig.TLS {
		c.SetTLSPolicy(mail.TLSMandatory)
	} else {
		c.SetTLSPolicy(mail.NoTLS)
	}

	// Créer le message
	m := mail.NewMsg()

	// Utiliser l'adresse From configurée ou celle du username
	fromAddr := smtpConfig.From
	if fromAddr == "" {
		fromAddr = smtpConfig.Username
	}

	if err := m.From(fromAddr); err != nil {
		log.Printf("❌ Erreur adresse From: %s", err)
		return
	}

	// Envoyer à tous les destinataires
	for _, to := range email.To {
		if err := m.To(to); err != nil {
			log.Printf("❌ Erreur adresse To: %s", err)
			continue
		}
	}

	m.Subject(email.Subject)
	m.SetBodyString(mail.TypeTextPlain, email.Body)

	// Envoyer l'email
	if err := c.DialAndSend(m); err != nil {
		log.Printf("❌ Erreur envoi email: %s", err)
		return
	}

	log.Printf("✅ Email envoyé avec succès vers %v", email.To)
}

func (a *App) StartEmbeddedSMTP() error {
	// IMPORTANT: Récupérer la config SMTP actuelle
	a.settingsMu.RLock()
	currentSMTPConfig := a.settings.SMTPConfig
	a.settingsMu.RUnlock()

	backend := &EmbeddedSMTP{
		smtpConfig: currentSMTPConfig, // Utiliser la vraie config
	}

	s := smtp.NewServer(backend)
	s.Addr = ":0" // Port automatique
	s.Domain = "localhost"
	s.AllowInsecureAuth = true

	// Trouver un port libre
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		return fmt.Errorf("impossible de créer le serveur SMTP: %s", err)
	}

	a.smtpPort = listener.Addr().(*net.TCPAddr).Port
	log.Printf("🚀 Serveur SMTP embarqué démarré sur le port %d", a.smtpPort)
	log.Printf("📧 Configuration SMTP: %s:%d (TLS: %t)", currentSMTPConfig.Host, currentSMTPConfig.Port, currentSMTPConfig.TLS)

	// Démarrer le serveur en arrière-plan
	go func() {
		if err := s.Serve(listener); err != nil {
			log.Printf("❌ Erreur serveur SMTP: %s", err)
		}
	}()

	a.smtpServer = s
	return nil
}

// Redémarrer le serveur SMTP quand la config change
func (a *App) RestartEmbeddedSMTP() error {
	// Arrêter l'ancien serveur
	if a.smtpServer != nil {
		a.smtpServer.Close()
		log.Printf("🛑 Ancien serveur SMTP arrêté")
	}

	// Redémarrer avec la nouvelle config
	return a.StartEmbeddedSMTP()
}

func (a *App) SaveSetting(s backend.Settings) error {
	a.settingsMu.Lock()
	defer a.settingsMu.Unlock()

	// Vérifier si la config SMTP a changé
	smtpChanged := false
	if a.settings.SMTPConfig.Host != s.SMTPConfig.Host ||
		a.settings.SMTPConfig.Port != s.SMTPConfig.Port ||
		a.settings.SMTPConfig.Username != s.SMTPConfig.Username ||
		a.settings.SMTPConfig.Password != s.SMTPConfig.Password ||
		a.settings.SMTPConfig.TLS != s.SMTPConfig.TLS {
		smtpChanged = true
	}

	// 1. Mettre à jour le NotificationManager
	switch s.NotificationMode {
	case "inapp":
		a.notifier.SetEnabled(true)
	case "email":
		a.notifier.SetEnabled(true)
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

	// 4. Redémarrer le serveur SMTP si la config a changé
	if smtpChanged && s.NotificationMode == "email" {
		log.Printf("🔄 Configuration SMTP modifiée, redémarrage du serveur...")
		go func() {
			if err := a.RestartEmbeddedSMTP(); err != nil {
				log.Printf("❌ Erreur redémarrage SMTP: %s", err)
			}
		}()
	}

	return nil
}

// Configuration de l'email utilisateur (ultra simple)
func (a *App) SetUserEmail(email string) {
	a.settings.UserEmail = email
	log.Printf("📧 Email configuré: %s", email)
}

// Envoyer une alerte - maintenant 100% autonome
func (a *App) SendServerAlert(serverName string) error {
	if a.settings.UserEmail == "" {
		return fmt.Errorf("email non configuré")
	}

	if a.smtpServer == nil {
		fmt.Println("🚀 Démarrage du serveur SMTP embarqué... : ", a.smtpServer)
		if err := a.StartEmbeddedSMTP(); err != nil {
			return err
		}
	}

	// Utiliser notre propre serveur SMTP embarqué
	return a.sendViaEmbeddedSMTP(serverName)
}

func (a *App) sendViaEmbeddedSMTP(serverName string) error {
	// Se connecter à notre propre serveur SMTP
	c, err := mail.NewClient("localhost", mail.WithPort(a.smtpPort))
	if err != nil {
		return fmt.Errorf("connexion SMTP embarqué échouée: %s", err)
	}

	fmt.Println("Connexion au serveur SMTP embarqué sur le port :", a.smtpPort)
	fmt.Println("Serveur : ", c)
	// Pas d'auth nécessaire
	c.SetTLSPolicy(mail.NoTLS)

	// Créer le message
	m := mail.NewMsg()
	m.From("alert@monitoring-app.local")
	m.To(a.settings.UserEmail)

	subject := fmt.Sprintf("🚨 ALERTE: %s est DOWN", serverName)
	m.Subject(subject)

	body := fmt.Sprintf(`ALERTE SERVEUR

	Serveur: %s
	Statut: HORS LIGNE
	Heure: %s

	Votre serveur %s ne répond plus.

	---
	Envoyé par votre app de monitoring
	(SMTP embarqué - Port %d)`,
		serverName,
		time.Now().Format("15:04:05 - 02/01/2006"),
		serverName,
		a.smtpPort)

	m.SetBodyString(mail.TypeTextPlain, body)

	// Envoyer via notre serveur embarqué
	if err := c.DialAndSend(m); err != nil {
		return fmt.Errorf("envoi via SMTP embarqué échoué: %s", err)
	}

	log.Println("✅ Alerte envoyée via SMTP embarqué a : ", a.settings.UserEmail)
	return nil
}

// Fonction principale pour vos notifications
func (a *App) NotifyServerDown(serverName string) {
	// Notification in-app
	log.Printf("📱 Notification: %s DOWN", serverName)

	// Email automatique via SMTP embarqué
	if a.settings.UserEmail != "" {
		go func() {
			err := a.SendServerAlert(serverName)
			if err != nil {
				log.Printf("❌ Erreur alerte email: %s", err)
			}
		}()
	}
}

// Test de l'email
func (a *App) TestEmailAlert() error {
	fmt.Println("Envoi d'une alerte de test... a ", a.settings.UserEmail)
	if a.settings.UserEmail == "" {
		return fmt.Errorf("configurez votre email d'abord")
	}
	fmt.Println("Envoi d'une alerte de test ")
	return a.SendServerAlert("TEST-SERVER")
}

// Obtenir le port SMTP (pour debug)
func (a *App) GetSMTPPort() int {
	fmt.Println("Port stmp :", a.smtpPort)
	return a.smtpPort
}

// Arrêter proprement le serveur SMTP
func (a *App) StopSMTP() {
	if a.smtpServer != nil {
		a.smtpServer.Close()
		log.Printf("🛑 Serveur SMTP embarqué arrêté")
	}
}

func (a *App) SetSMTPConfig(config backend.SMTPConfig) error {
	a.settingsMu.Lock()
	defer a.settingsMu.Unlock()

	a.settings.SMTPConfig = config

	// Sauvegarder dans le fichier
	return backend.SaveSettings(a.settings)
}

// Obtenir la configuration SMTP
func (a *App) GetSMTPConfig() backend.SMTPConfig {
	a.settingsMu.RLock()
	defer a.settingsMu.RUnlock()
	return a.settings.SMTPConfig
}

// Tester la configuration SMTP - Version simplifiée
// Tester la configuration SMTP - VERSION AMÉLIORÉE
func (a *App) TestSMTPConfig(config backend.SMTPConfig) error {
	log.Printf("🧪 Test de la configuration SMTP: %s:%d", config.Host, config.Port)

	// Validation basique
	if config.Host == "" {
		return fmt.Errorf("serveur SMTP requis")
	}
	if config.Username == "" {
		return fmt.Errorf("nom d'utilisateur requis")
	}
	if config.Password == "" {
		return fmt.Errorf("mot de passe requis")
	}

	// Nettoyer le mot de passe pour Gmail
	cleanPassword := cleanAppPassword(config.Password)

	// Créer le client avec timeout
	c, err := mail.NewClient(config.Host,
		mail.WithPort(config.Port),
		mail.WithTimeout(15*time.Second),
	)
	if err != nil {
		return fmt.Errorf("impossible de créer le client SMTP: %s", err)
	}

	// Configuration de l'authentification
	c.SetSMTPAuth(mail.SMTPAuthPlain)
	c.SetUsername(config.Username)
	c.SetPassword(cleanPassword)

	// Configuration TLS
	if config.TLS {
		c.SetTLSPolicy(mail.TLSMandatory)
	} else {
		c.SetTLSPolicy(mail.NoTLS)
	}

	// Test en envoyant un vrai email de test à l'utilisateur
	return a.sendTestEmailWithConfig(config, config.Username, "🧪 Test de configuration SMTP")
}

// Envoyer un email de test
func (a *App) SendTestEmail(to string) error {
	config := a.GetSMTPConfig()
	if config.Host == "" {
		return fmt.Errorf("configuration SMTP non définie")
	}

	c, err := mail.NewClient(config.Host, mail.WithPort(config.Port))
	if err != nil {
		return err
	}

	c.SetSMTPAuth(mail.SMTPAuthPlain)
	c.SetUsername(config.Username)
	c.SetPassword(config.Password)

	if config.TLS {
		c.SetTLSPolicy(mail.TLSMandatory)
	}

	m := mail.NewMsg()

	fromAddr := config.From
	if fromAddr == "" {
		fromAddr = config.Username
	}

	m.From(fromAddr)
	m.To(to)
	m.Subject("🧪 Test - Monitoring App")

	body := fmt.Sprintf(`Test de configuration email

Ceci est un email de test envoyé depuis votre application de monitoring.

Configuration utilisée:
- Serveur SMTP: %s:%d
- Utilisateur: %s
- TLS: %t

Si vous recevez cet email, votre configuration est correcte !

---
Envoyé le %s`,
		config.Host,
		config.Port,
		config.Username,
		config.TLS,
		time.Now().Format("15:04:05 - 02/01/2006"))

	m.SetBodyString(mail.TypeTextPlain, body)

	if err := c.DialAndSend(m); err != nil {
		return fmt.Errorf("erreur lors de l'envoi: %s", err)
	}

	return nil
}

// Configurations pré-définies courantes (à ajouter comme méthodes utilitaires)
func (a *App) GetGmailSMTPConfig() backend.SMTPConfig {
	return backend.SMTPConfig{
		Host: "smtp.gmail.com",
		Port: 587,
		TLS:  true,
	}
}

func (a *App) GetOutlookSMTPConfig() backend.SMTPConfig {
	return backend.SMTPConfig{
		Host: "smtp-mail.outlook.com",
		Port: 587,
		TLS:  true,
	}
}

func (a *App) GetYahooSMTPConfig() backend.SMTPConfig {
	return backend.SMTPConfig{
		Host: "smtp.mail.yahoo.com",
		Port: 587,
		TLS:  true,
	}
}

// Fonction helper pour nettoyer le mot de passe d'application
func cleanAppPassword(password string) string {
	// Supprimer les espaces du mot de passe d'application Gmail
	return strings.ReplaceAll(password, " ", "")
}

// Fonction helper pour envoyer un email avec une config spécifique
func (a *App) sendTestEmailWithConfig(config backend.SMTPConfig, to, subject string) error {
	c, err := mail.NewClient(config.Host, mail.WithPort(config.Port))
	if err != nil {
		return fmt.Errorf("impossible de créer le client SMTP: %s", err)
	}

	c.SetSMTPAuth(mail.SMTPAuthPlain)
	c.SetUsername(config.Username)
	c.SetPassword(config.Password)

	if config.TLS {
		c.SetTLSPolicy(mail.TLSMandatory)
	} else {
		c.SetTLSPolicy(mail.NoTLS)
	}

	m := mail.NewMsg()

	fromAddr := config.From
	if fromAddr == "" {
		fromAddr = config.Username
	}

	if err := m.From(fromAddr); err != nil {
		return fmt.Errorf("adresse From invalide: %s", err)
	}

	if err := m.To(to); err != nil {
		return fmt.Errorf("adresse To invalide: %s", err)
	}

	m.Subject(subject)

	body := fmt.Sprintf(`✅ Test de configuration SMTP réussi !

Configuration utilisée:
- Serveur: %s:%d
- Utilisateur: %s
- TLS: %t

Votre configuration email est correcte et prête à être utilisée pour les alertes de monitoring.

---
Envoyé le %s`,
		config.Host,
		config.Port,
		config.Username,
		config.TLS,
		time.Now().Format("15:04:05 - 02/01/2006"))

	m.SetBodyString(mail.TypeTextPlain, body)

	// Envoyer l'email (cela teste la connexion ET l'authentification)
	if err := c.DialAndSend(m); err != nil {
		return fmt.Errorf("échec du test SMTP: %s", err)
	}

	return nil
}
