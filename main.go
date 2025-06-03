package main

import (
	"embed"
	"fmt"
	backend "monitoring_serv/backend"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	loadedSettings, err := backend.LoadSettings()
	if err != nil {
		fmt.Println("⚠️ Impossible de charger les settings au démarrage :", err)
		loadedSettings = backend.DefaultSettings()
	}

	notifier := backend.NewNotificationManager(loadedSettings.NotificationCooldown)

	switch loadedSettings.NotificationMode {
	case "inapp":
		notifier.SetEnabled(true)
	case "email":
		notifier.SetEnabled(false)
	case "none":
		notifier.SetEnabled(false)
	default:
		notifier.SetEnabled(true)
	}

	app := NewApp(notifier)
	// Create application with options
	err = wails.Run(&options.App{
		Title:  "monitoring_serv",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},

		OnStartup: app.startup,
		Bind: []interface{}{
			app,
			notifier,
		},
		OnDomReady: app.onDomReady,
		OnShutdown: app.onShutdown,

		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: true,
				HideTitle:                  true,
			},
			Appearance:           mac.NSAppearanceNameAqua,
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
