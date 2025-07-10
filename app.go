// Package main - Application de monitoring de serveurs
// Cette application permet de surveiller plusieurs serveurs et d'envoyer des notifications par email
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

	"github.com/emersion/go-smtp"    // Serveur SMTP embarqué
	//smtpbackend "github.com/emersion/go-smtp/backend"
	"github.com/wneessen/go-mail"    // Client SMTP pour l'envoi d'emails
)

// App - Structure principale de l'application
type App struct {
	ctx        context.Context                  // Contexte d'exécution de l'application
	monitor    *Monitor                         // Gestionnaire de monitoring des serveurs
	notifier   *backend.NotificationManager     // Gestionnaire de notifications avec cooldown
	settings   backend.Settings                 // Configuration utilisateur
	settingsMu sync.RWMutex                     // Mutex pour accès concurrent aux paramètres
	smtpServer *smtp.Server                     // Serveur SMTP embarqué
	smtpPort   int                              // Port du serveur SMTP embarqué
}

// EmbeddedSMTP - Gestionnaire du serveur SMTP embarqué
type EmbeddedSMTP struct {
	// Stockage temporaire des emails reçus par le serveur embarqué
	emails     []EmailMessage        // Liste des emails en attente de traitement
	smtpConfig backend.SMTPConfig    // Configuration SMTP pour le transfert externe
}

// EmailMessage - Structure représentant un email
type EmailMessage struct {
	From    string      // Adresse de l'expéditeur
	To      []string    // Liste des destinataires
	Subject string      // Sujet de l'email
	Body    string      // Corps du message
	Time    time.Time   // Horodatage de création
}

// NewApp - Constructeur de l'application
// Crée une nouvelle instance de App en se basant sur les settings chargés
// Initialise le monitoring et la configuration SMTP
func NewApp(notifier *backend.NotificationManager) *App {
	// Charger les settings (ou valeurs par défaut)
	s, err := backend.LoadSettings()
	if err != nil {
		fmt.Println("⚠️ Impossible de charger les settings :", err)
		s = backend.DefaultSettings()
	}

	// Configurer le NotificationManager selon le mode de notification choisi
	switch s.NotificationMode {
	case "inapp":
		// Notifications dans l'application seulement
		notifier.SetEnabled(true)
	case "email":
		// Notifications par email, désactiver les notifications in-app
		notifier.SetEnabled(false)
	case "none":
		// Aucune notification
		notifier.SetEnabled(false)
	default:
		// Par défaut, activer les notifications in-app
		notifier.SetEnabled(true)
	}
	// Appliquer le délai de cooldown entre notifications
	notifier.SetCooldown(s.NotificationCooldown)

	// Créer l'instance de l'application avec ses composants
	app := &App{
		monitor: &Monitor{
			servers:    make(map[string]*Server),    // Map des serveurs surveillés
			stopChans:  make(map[string]chan bool), // Canaux d'arrêt par serveur
			statusChan: make(chan ServerStatusUpdate, 100), // Canal des mises à jour de statut
			mutex:      sync.RWMutex{},             // Mutex pour accès concurrent
			Notifier:   notifier,                   // Gestionnaire de notifications
		},
		notifier: notifier,  // Référence au gestionnaire de notifications
		settings: s,         // Configuration utilisateur
	}
	return app
}

// startup - Fonction appelée au démarrage de l'application
// Le contexte est sauvegardé pour pouvoir appeler les méthodes runtime
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Charger les serveurs existants depuis le fichier de configuration
	a.monitor.LoadServersFromFile()
	// Démarrer le serveur SMTP embarqué pour les notifications email
	a.StartEmbeddedSMTP()
}

// onDomReady - Fonction appelée après le chargement des ressources front-end
// Démarre le monitoring de tous les serveurs
func (a *App) onDomReady(ctx context.Context) {
	// Démarrer le monitoring pour tous les serveurs chargés
	for _, server := range a.monitor.servers {
		a.monitor.StartMonitoring(server)
	}
}

// onShutdown - Fonction appelée à la fermeture de l'application
// Sauvegarde les serveurs dans le fichier de configuration
func (a *App) onShutdown(ctx context.Context) {
	fmt.Println(">>> onShutdown called, saving servers to file")
	err := a.monitor.SaveServersToFile()
	if err != nil {
		fmt.Println(">>> Error saving servers:", err)
	}
}

// Server - Structure représentant un serveur à surveiller
type Server struct {
	ID       string       `json:"id"`       // Identifiant unique du serveur
	Name     string       `json:"name"`     // Nom convivial du serveur
	URL      string       `json:"url"`      // URL ou adresse à surveiller
	Type     string       `json:"type"`     // Type de monitoring: http, tcp, ping
	Interval string       `json:"interval"` // Intervalle de vérification (format string)
	Timeout  string       `json:"timeout"`  // Timeout pour les vérifications (format string)
	Status   ServerStatus `json:"status"`   // Statut actuel du serveur
}

// ServerStatus - Structure représentant l'état d'un serveur
type ServerStatus struct {
	IsUp         bool      `json:"is_up"`             // Serveur disponible ou non
	ResponseTime int64     `json:"response_time_ms"`  // Temps de réponse en millisecondes
	LastCheck    time.Time `json:"last_check"`        // Horodatage de la dernière vérification
	LastError    string    `json:"last_error,omitempty"` // Dernière erreur rencontrée
}

// Monitor - Gestionnaire du monitoring des serveurs
type Monitor struct {
	servers    map[string]*Server              // Map des serveurs surveillés par ID
	stopChans  map[string]chan bool           // Canaux d'arrêt pour chaque serveur
	statusChan chan ServerStatusUpdate       // Canal pour les mises à jour de statut
	mutex      sync.RWMutex                  // Mutex pour accès concurrent sécurisé
	Notifier   *backend.NotificationManager // Gestionnaire de notifications
}

// ServerStatusUpdate - Structure pour les mises à jour de statut
type ServerStatusUpdate struct {
	ServerID string  // Identifiant du serveur concerné
	Status   ServerStatus  // Nouveau statut du serveur
}

// NewMonitor - Constructeur du gestionnaire de monitoring
// Initialise toutes les structures de données nécessaires
func NewMonitor() *Monitor {
	return &Monitor{
		servers:    make(map[string]*Server),            // Map vide des serveurs
		stopChans:  make(map[string]chan bool),         // Map vide des canaux d'arrêt
		statusChan: make(chan ServerStatusUpdate, 100), // Canal avec buffer de 100
		mutex:      sync.RWMutex{},                     // Mutex initialisé
	}
}

// ===== Méthodes exposées au frontend =====

// GetServers - Récupère la liste de tous les serveurs
// Retourne une copie sécurisée de la liste des serveurs
func (a *App) GetServers() []Server {
	a.monitor.mutex.RLock()    // Verrouillage en lecture
	defer a.monitor.mutex.RUnlock()

	// Créer une slice avec la capacité appropriée
	servers := make([]Server, 0, len(a.monitor.servers))
	for _, server := range a.monitor.servers {
		servers = append(servers, *server) // Copie des données
	}
	return servers
}

// AddServer - Ajoute un nouveau serveur à surveiller
// Génère un ID unique, valide les données et démarre le monitoring
func (a *App) AddServer(server Server) (Server, error) {
	// Générer un ID unique si pas fourni
	if server.ID == "" {
		server.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	// Valider les données du serveur
	if err := a.validateServer(&server); err != nil {
		return server, err
	}

	// Ajouter le serveur de manière thread-safe
	a.monitor.mutex.Lock()
	a.monitor.servers[server.ID] = &server
	a.monitor.mutex.Unlock()

	// Sauvegarder dans le fichier de configuration
	a.monitor.SaveServersToFile()

	// Démarrer le monitoring du nouveau serveur
	a.monitor.StartMonitoring(&server)

	return server, nil
}

// UpdateServer - Met à jour un serveur existant
// Arrête l'ancien monitoring, met à jour les données et redémarre le monitoring
func (a *App) UpdateServer(server Server) (Server, error) {
	fmt.Printf("UpdateServer reçu, interval = %q\n", server.Interval)
	if server.ID == "" {
		return server, fmt.Errorf("ID du serveur requis pour la mise à jour")
	}

	// Valider les nouvelles données
	if err := a.validateServer(&server); err != nil {
		return server, err
	}

	a.monitor.mutex.Lock()
	// Arrêter l'ancien monitoring s'il existe
	if stopChan, exists := a.monitor.stopChans[server.ID]; exists {
		close(stopChan)
		delete(a.monitor.stopChans, server.ID)
	}

	// Mettre à jour le serveur dans la map
	a.monitor.servers[server.ID] = &server
	a.monitor.mutex.Unlock()

	// Sauvegarder les modifications
	a.monitor.SaveServersToFile()

	// Redémarrer le monitoring avec les nouveaux paramètres
	a.monitor.StartMonitoring(&server)

	return server, nil
}

// DeleteServer - Supprime un serveur de la surveillance
// Arrête le monitoring et supprime toutes les données associées
func (a *App) DeleteServer(id string) error {
	a.monitor.mutex.Lock()
	defer a.monitor.mutex.Unlock()

	// Arrêter le monitoring du serveur
	if stopChan, exists := a.monitor.stopChans[id]; exists {
		close(stopChan)
		delete(a.monitor.stopChans, id)
	}

	// Supprimer le serveur de la map
	delete(a.monitor.servers, id)

	// Sauvegarder les modifications
	a.monitor.SaveServersToFile()

	return nil
}

// validateServer - Valide les données d'un serveur
// Vérifie que tous les champs requis sont présents et valides
func (a *App) validateServer(server *Server) error {
	if server.Name == "" {
		return fmt.Errorf("nom du serveur requis")
	}
	if server.URL == "" {
		return fmt.Errorf("URL du serveur requise")
	}
	// Vérifier que le type de monitoring est supporté
	if server.Type != "http" && server.Type != "tcp" && server.Type != "ping" {
		return fmt.Errorf("type de serveur invalide")
	}
	return nil
}

// ===== Fonctions de monitoring =====

// StartMonitoring - Démarre le monitoring d'un serveur
// Version améliorée avec gestion intelligente des notifications
func (m *Monitor) StartMonitoring(server *Server) {
	// Parser l'intervalle de vérification ou utiliser la valeur par défaut
	interval, err := parseDuration(server.Interval)
	if err != nil {
		interval = 30 * time.Second
	}

	// Parser le timeout ou utiliser la valeur par défaut
	timeout, err := parseDuration(server.Timeout)
	if err != nil {
		timeout = 10 * time.Second
	}

	// Créer le canal d'arrêt pour ce serveur
	stopChan := make(chan bool)
	m.mutex.Lock()
	m.stopChans[server.ID] = stopChan
	m.mutex.Unlock()

	// Lancer la goroutine de monitoring
	go func() {
		// État initial du serveur
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

// ===== Configuration des emails =====

// SetUserEmail - Configure l'email de l'utilisateur
// Email utilisé pour recevoir les notifications d'alerte
func (a *App) SetUserEmail(email string) {
	a.settings.UserEmail = email
	log.Printf("📧 Email configuré: %s", email)
}

// SendServerAlert - Envoie une alerte email pour un serveur down
// Version 100% autonome utilisant le serveur SMTP embarqué
func (a *App) SendServerAlert(serverName string) error {
	// Vérifier que l'email est configuré
	if a.settings.UserEmail == "" {
		return fmt.Errorf("email non configuré")
	}

	// Démarrer le serveur SMTP embarqué si nécessaire
	if a.smtpServer == nil {
		fmt.Println("🚀 Démarrage du serveur SMTP embarqué... : ", a.smtpServer)
		if err := a.StartEmbeddedSMTP(); err != nil {
			return err
		}
	}

	// Utiliser notre propre serveur SMTP embarqué
	return a.sendViaEmbeddedSMTP(serverName)
}

// NotifyServerDown - Fonction principale pour les notifications de serveur down
// Gère les notifications in-app et email selon la configuration
func (a *App) NotifyServerDown(serverName string) {
	// Notification in-app
	log.Printf("📱 Notification: %s DOWN", serverName)

	// Email automatique via SMTP embarqué (asynchrone)
	if a.settings.UserEmail != "" {
		go func() {
			err := a.SendServerAlert(serverName)
			if err != nil {
				log.Printf("❌ Erreur alerte email: %s", err)
			}
		}()
	}
}

// TestEmailAlert - Envoie un email de test
// Utilise un serveur fictif pour tester la configuration email
func (a *App) TestEmailAlert() error {
	fmt.Println("Envoi d'une alerte de test... a ", a.settings.UserEmail)
	if a.settings.UserEmail == "" {
		return fmt.Errorf("configurez votre email d'abord")
	}
	fmt.Println("Envoi d'une alerte de test ")
	return a.SendServerAlert("TEST-SERVER")
}

// GetSMTPPort - Obtient le port du serveur SMTP embarqué
// Utilisé pour le debug et la configuration
func (a *App) GetSMTPPort() int {
	fmt.Println("Port stmp :", a.smtpPort)
	return a.smtpPort
}

// StopSMTP - Arrête proprement le serveur SMTP embarqué
// Libère les ressources et ferme le serveur
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

/*
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
} */

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

// Version corrigée avec encodage proper
/* func (a *App) sendTestEmailWithConfig(config backend.SMTPConfig, to, subject string) error {
	cleanPassword := cleanAppPassword(config.Password)

	log.Printf("📧 Création du client SMTP...")
	c, err := mail.NewClient(config.Host,
		mail.WithPort(config.Port),
		mail.WithTimeout(30*time.Second),
	)
	if err != nil {
		return fmt.Errorf("impossible de créer le client SMTP: %s", err)
	}

	log.Printf("🔐 Configuration de l'authentification...")
	c.SetSMTPAuth(mail.SMTPAuthPlain)
	c.SetUsername(config.Username)
	c.SetPassword(cleanPassword)

	if config.TLS {
		c.SetTLSPolicy(mail.TLSMandatory)
	} else {
		c.SetTLSPolicy(mail.NoTLS)
	}

	log.Printf("✉️ Création du message...")
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

	// Sujet simple sans emojis
	m.Subject("Test de configuration SMTP - Monitoring App")

	// Corps d'email SANS emojis et caractères spéciaux
	var bodyBuilder strings.Builder
	bodyBuilder.WriteString("TEST DE CONFIGURATION SMTP REUSSI !\n\n")
	bodyBuilder.WriteString("Configuration utilisee:\n")
	bodyBuilder.WriteString(fmt.Sprintf("- Serveur: %s:%d\n", config.Host, config.Port))
	bodyBuilder.WriteString(fmt.Sprintf("- Utilisateur: %s\n", config.Username))
	bodyBuilder.WriteString(fmt.Sprintf("- TLS: %t\n", config.TLS))
	bodyBuilder.WriteString(fmt.Sprintf("- Mot de passe: %d caracteres\n\n", len(cleanPassword)))
	bodyBuilder.WriteString("Votre configuration email est correcte et prete a etre utilisee pour les alertes de monitoring.\n\n")
	bodyBuilder.WriteString("---\n")
	bodyBuilder.WriteString(fmt.Sprintf("Envoye le %s par Monitoring App\n", time.Now().Format("15:04:05 - 02/01/2006")))

	body := bodyBuilder.String()

	// Configuration de l'encodage
	m.SetEncoding(mail.EncodingQP) // Quoted-Printable
	m.SetCharset(mail.CharsetUTF8) // UTF-8

	// Définir explicitement le Content-Type
	m.SetBodyString(mail.TypeTextPlain, body)

	// Debug
	log.Printf("📝 Corps de l'email (%d caracteres):", len(body))
	log.Printf("Apercu: %.50s...", body)

	// Envoyer l'email
	log.Printf("🚀 Tentative d'envoi...")
	if err := c.DialAndSend(m); err != nil {
		log.Printf("❌ Erreur détaillée: %s", err)

		errorMsg := err.Error()
		if strings.Contains(errorMsg, "535") && strings.Contains(errorMsg, "BadCredentials") {
			return fmt.Errorf("identifiants Gmail incorrects - utilisez un mot de passe d'application de 16 caracteres")
		}

		if strings.Contains(errorMsg, "534") {
			return fmt.Errorf("authentification requise - activez l'authentification a 2 facteurs sur Gmail")
		}

		if strings.Contains(errorMsg, "connection refused") {
			return fmt.Errorf("impossible de se connecter a %s:%d", config.Host, config.Port)
		}

		return fmt.Errorf("échec du test SMTP: %s", err)
	}

	log.Printf("✅ Email envoyé avec succès à %s!", to)
	return nil
} */

// ===== Génération du contenu des emails =====

// createAlertEmailBody - Génère le corps d'un email d'alerte
// Crée un message simple et clair sans caractères spéciaux
func (a *App) createAlertEmailBody(serverName string) string {
	var bodyBuilder strings.Builder

	// En-tête de l'alerte
	bodyBuilder.WriteString("ALERTE SERVEUR\n\n")
	// Informations du serveur
	bodyBuilder.WriteString(fmt.Sprintf("Serveur: %s\n", serverName))
	bodyBuilder.WriteString("Statut: HORS LIGNE\n")
	bodyBuilder.WriteString(fmt.Sprintf("Heure: %s\n\n", time.Now().Format("15:04:05 - 02/01/2006")))
	// Message d'alerte
	bodyBuilder.WriteString(fmt.Sprintf("Votre serveur %s ne repond plus.\n\n", serverName))
	// Pied de page
	bodyBuilder.WriteString("---\n")
	bodyBuilder.WriteString("Envoye par votre app de monitoring\n")

	return bodyBuilder.String()
}

// sendViaEmbeddedSMTP - Envoie un email via le serveur SMTP embarqué
// Utilise le serveur SMTP local pour envoyer les alertes
func (a *App) sendViaEmbeddedSMTP(serverName string) error {
	// Créer le client SMTP vers le serveur embarqué
	c, err := mail.NewClient("localhost", mail.WithPort(a.smtpPort))
	if err != nil {
		return fmt.Errorf("connexion SMTP embarqué échouée: %s", err)
	}

	// Pas de TLS pour le serveur embarqué local
	c.SetTLSPolicy(mail.NoTLS)

	// Créer le message
	m := mail.NewMsg()
	m.From("alert@monitoring-app.local")  // Adresse expéditeur locale
	m.To(a.settings.UserEmail)              // Adresse destinataire configurée

	// Sujet simple sans emojis
	subject := fmt.Sprintf("ALERTE: %s est DOWN", serverName)
	m.Subject(subject)

	// Générer le corps de l'email
	body := a.createAlertEmailBody(serverName)

	// Configuration de l'encodage pour les caractères spéciaux
	m.SetEncoding(mail.EncodingQP)    // Quoted-Printable
	m.SetCharset(mail.CharsetUTF8)    // UTF-8
	m.SetBodyString(mail.TypeTextPlain, body)

	// Envoyer l'email
	if err := c.DialAndSend(m); err != nil {
		return fmt.Errorf("envoi via SMTP embarqué échoué: %s", err)
	}

	log.Printf("✅ Alerte envoyée via SMTP embarqué à : %s", a.settings.UserEmail)
	return nil
}
