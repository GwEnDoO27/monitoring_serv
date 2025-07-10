package main

import (
	"embed"
	"fmt"
	backend "monitoring_serv/backend"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
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
		Title:  "Monitoring serv",
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
			About: &mac.AboutInfo{
				Title:   "Monitoring App",
				Message: "© 2025 Me"},
		},
		Windows: &windows.Options{
			WebviewIsTransparent:              false,
			WindowIsTranslucent:               false,
			BackdropType:                      windows.Mica,
			DisablePinchZoom:                  false,
			DisableWindowIcon:                 false,
			DisableFramelessWindowDecorations: false,
			WebviewUserDataPath:               "",
			WebviewBrowserPath:                "",
			Theme:                             windows.SystemDefault,
			CustomTheme: &windows.ThemeSettings{
				DarkModeTitleBar:   windows.RGB(20, 20, 20),
				DarkModeTitleText:  windows.RGB(200, 200, 200),
				DarkModeBorder:     windows.RGB(20, 0, 20),
				LightModeTitleBar:  windows.RGB(200, 200, 200),
				LightModeTitleText: windows.RGB(20, 20, 20),
				LightModeBorder:    windows.RGB(200, 200, 200),
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
