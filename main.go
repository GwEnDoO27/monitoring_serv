package main

import (
	"embed"
	notifications "monitoring_serv/backend"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	notifier := notifications.NewNotificationManager(1)
	app := NewApp(notifier)
	// Create application with options
	err := wails.Run(&options.App{
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
