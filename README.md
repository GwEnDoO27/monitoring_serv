# 🖥️ Monitoring Server

Une application de monitoring moderne et élégante construite avec **Wails**, **Go** et **React** pour surveiller vos serveurs et services en temps réel.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Go Version](https://img.shields.io/badge/go-1.23-blue.svg)
![React Version](https://img.shields.io/badge/react-18.2-blue.svg)
![Wails Version](https://img.shields.io/badge/wails-2.10.1-blue.svg)

## ✨ Fonctionnalités

### 🔍 Monitoring Avancé
- **Surveillance multi-protocoles** : HTTP, TCP, Ping
- **Temps de réponse** en temps réel
- **Statut visuel** avec codes couleur
- **Historique des vérifications**
- **Monitoring continu** avec intervalles configurables

### 📧 Notifications Intelligentes
- **Notifications desktop** natives
- **Alertes email** automatiques
- **Système de cooldown** anti-spam
- **Notifications critiques** pour les pannes importantes
- **Résumés périodiques** des serveurs en panne

### 🎨 Interface Moderne
- **Design macOS** avec effets glassmorphism
- **Thème sombre/clair** automatique
- **Interface responsive** adaptative
- **Animations fluides** et transitions
- **Icônes Lucide React** cohérentes

### ⚙️ Configuration Flexible
- **Configuration SMTP** intégrée (Gmail, Outlook, Yahoo)
- **Serveur SMTP embarqué** pour les tests
- **Paramètres personnalisables** par utilisateur
- **Sauvegarde automatique** des configurations
- **Import/Export** des serveurs

## 🚀 Installation

### Prérequis
- **Go 1.23** ou version supérieure
- **Node.js 18** ou version supérieure
- **Wails v2** installé globalement

### Installation de Wails
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### Cloner le projet
```bash
git clone https://github.com/your-username/monitoring_serv.git
cd monitoring_serv
```

### Installation des dépendances
```bash
# Dépendances Go
go mod download

# Dépendances Node.js
cd frontend
npm install
cd ..
```

## 📦 Releases & Builds Automatiques

### 🤖 GitHub Actions
Des builds automatiques sont disponibles pour toutes les plateformes via GitHub Actions. Les binaires sont automatiquement générés à chaque release.

[![Build Status](https://github.com/your-username/monitoring_serv/workflows/Build/badge.svg)](https://github.com/your-username/monitoring_serv/actions)
[![Release](https://github.com/your-username/monitoring_serv/workflows/Release/badge.svg)](https://github.com/your-username/monitoring_serv/releases)

### 📥 Télécharger les Releases
Accédez à la section **[Releases](https://github.com/your-username/monitoring_serv/releases)** pour télécharger les binaires pré-compilés :

- 🍎 **macOS** : `monitoring_serv-darwin-universal.app` (Intel + Apple Silicon)
- 🪟 **Windows** : `monitoring_serv-windows-amd64.exe`
- 🐧 **Linux** : `monitoring_serv-linux-amd64`

### 🔄 Builds Automatiques
Les GitHub Actions génèrent automatiquement des builds pour :
- **Chaque push** sur la branche main (builds de développement)
- **Chaque tag** version (releases officielles)
- **Pull requests** (builds de validation)

#### Plateformes supportées
- **macOS** : Intel (amd64) + Apple Silicon (arm64) - Build universel
- **Windows** : 64-bit (amd64)
- **Linux** : 64-bit (amd64)

#### Artefacts disponibles
- **Binaires** : Applications prêtes à l'emploi
- **Source maps** : Pour le debugging
- **Checksums** : Vérification d'intégrité (SHA256)

### 🏷️ Versioning
Le projet suit le [Semantic Versioning](https://semver.org/) :
- **Major** : Changements incompatibles
- **Minor** : Nouvelles fonctionnalités compatibles
- **Patch** : Corrections de bugs

## 🛠️ Développement

### Mode développement
```bash
# Lancer en mode développement avec hot reload
wails dev

# Ou avec mode debug
wails dev -debug
```

L'application sera disponible à `http://localhost:34115` pour le mode web.

### Build de production
```bash
# Build pour la plateforme actuelle
wails build

# Build avec optimisations
wails build -clean -ldflags "-s -w"
```

### 🍎 Build spécifique macOS
```bash
# Build pour macOS avec icône
wails build -platform darwin/amd64

# Build universel macOS (Intel + Apple Silicon)
wails build -platform darwin/universal

# Build avec signature et notarisation (nécessite certificat développeur)
wails build -platform darwin/universal -sign -notarize

# Build avec options avancées macOS
wails build -clean -ldflags "-s -w" -platform darwin/universal -webview2 embed
```

#### Configuration macOS spécifique
- **Icône** : L'icône `build/icon.icns` est automatiquement utilisée
- **Bundle ID** : Configuré dans `wails.json`
- **Permissions** : Ajoutez dans `Info.plist` si nécessaire
- **Signature** : Utilisez un certificat développeur Apple pour la distribution

#### Résolution des problèmes macOS
```bash
# Si erreur de permissions
sudo xattr -r -d com.apple.quarantine ./build/bin/monitoring_serv.app

# Vérifier la signature
codesign -dv --verbose=4 ./build/bin/monitoring_serv.app

# Forcer la recompilation
wails build -clean -f
```

## 📁 Structure du Projet

```
monitoring_serv/
├── 📁 backend/                 # Modules Go
│   ├── notifications.go        # Gestion des notifications
│   └── settings.go            # Configuration utilisateur
├── 📁 frontend/               # Application React
│   ├── 📁 src/
│   │   ├── 📁 components/     # Composants React
│   │   │   ├── ServerCard.jsx    # Carte serveur
│   │   │   ├── ServerForm.jsx    # Formulaire serveur
│   │   │   ├── ServerHeader.jsx  # En-tête principal
│   │   │   └── Settings.jsx      # Interface paramètres
│   │   ├── 📁 hooks/          # Hooks React personnalisés
│   │   └── 📁 assets/         # Ressources statiques
│   └── 📁 wailsjs/            # Bindings Wails générés
├── 📁 build/                  # Ressources de build
├── app.go                     # Application principale Go
├── main.go                    # Point d'entrée
├── go.mod                     # Modules Go
├── wails.json                 # Configuration Wails
├── servers.json               # Données des serveurs
└── settings.json              # Configuration utilisateur
```

## 🔧 Configuration

### Paramètres Utilisateur
L'application stocke ses paramètres dans `settings.json` :

```json
{
  "theme": "auto",                    // "auto", "light", "dark"
  "notificationMode": "email",        // "inapp", "email", "none"
  "notificationCooldown": 10,         // Minutes entre notifications
  "refreshInterval": 60,              // Secondes entre vérifications
  "userEmail": "user@example.com",    // Email pour notifications
  "smtp_config": {
    "host": "smtp.gmail.com",
    "port": 587,
    "username": "user@gmail.com",
    "password": "app_password",
    "tls": true
  }
}
```

### Configuration SMTP

#### Gmail
1. Activez l'authentification à 2 facteurs
2. Générez un mot de passe d'application
3. Utilisez `smtp.gmail.com:587` avec TLS

#### Outlook
1. Utilisez `smtp-mail.outlook.com:587`
2. Activez l'authentification moderne si nécessaire

#### Yahoo
1. Utilisez `smtp.mail.yahoo.com:587`
2. Générez un mot de passe d'application

## 📊 Utilisation

### Ajouter un Serveur
1. Cliquez sur le bouton ➕ **Ajouter**
2. Renseignez les informations :
   - **Nom** : Nom convivial du serveur
   - **URL** : Adresse à surveiller
   - **Type** : HTTP, TCP ou Ping
   - **Intervalle** : Fréquence de vérification
   - **Timeout** : Délai d'attente

### Types de Monitoring

#### HTTP/HTTPS
- Surveillance des sites web et APIs
- Codes de statut HTTP
- Temps de réponse complets

#### TCP
- Surveillance des ports et services
- Connexions socket
- Vérification de disponibilité

#### Ping (ICMP)
- Test de connectivité réseau
- Latence réseau
- Accessibilité basique

### Notifications

#### Desktop
- Notifications natives du système
- Icônes et sons personnalisés
- Groupement par serveur

#### Email
- Alertes automatiques par email
- Templates personnalisables
- Serveur SMTP embarqué

## 🔒 Sécurité

- **Mots de passe chiffrés** dans la configuration
- **Connexions TLS** pour SMTP
- **Validation des entrées** côté serveur
- **Isolation des processus** avec Wails

## 🎯 Fonctionnalités Avancées

### Serveur SMTP Embarqué
- Serveur SMTP local automatique
- Transfert vers fournisseurs externes
- Tests de configuration intégrés

### Système de Cooldown
- Prévention du spam de notifications
- Cooldown par serveur et par type
- Notifications critiques prioritaires

### Interface Adaptive
- Thème automatique selon l'OS
- Mode sombre/clair manuel
- Responsive design complet

## 🐛 Dépannage

### Problèmes courants

#### Notifications email ne fonctionnent pas
1. Vérifiez la configuration SMTP
2. Testez avec le bouton "Tester"
3. Vérifiez les mots de passe d'application

#### Serveur non détecté
1. Vérifiez l'URL et le port
2. Testez la connectivité réseau
3. Ajustez les timeouts

#### Interface ne se charge pas
1. Vérifiez les ports disponibles
2. Redémarrez l'application
3. Vérifiez les logs console

### Logs et Debug
```bash
# Mode debug complet
wails dev -debug

# Logs détaillés
wails build -debug
```

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment participer :

1. **Fork** le projet
2. **Créez** une branche feature (`git checkout -b feature/AmazingFeature`)
3. **Committez** vos changements (`git commit -m 'Add some AmazingFeature'`)
4. **Pushez** vers la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrez** une Pull Request

### Standards de Code
- **Go** : Suivez les conventions Go standard
- **React** : Utilisez ESLint et Prettier
- **Commits** : Messages clairs et descriptifs
- **Documentation** : Commentez le code complexe

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📞 Support

Pour obtenir de l'aide ou signaler des bugs :

- 🐛 **Issues** : [GitHub Issues](https://github.com/your-username/monitoring_serv/issues)
- 💬 **Discussions** : [GitHub Discussions](https://github.com/your-username/monitoring_serv/discussions)

---

<div align="center">
  <strong>Fait avec par gwendoo</strong>
</div>
