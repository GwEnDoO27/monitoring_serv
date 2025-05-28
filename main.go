package main

import (
	"embed"
	notifications "monitoring_serv/backend"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	notifier := notifications.NewNotificationManager(15)
	app := NewApp(notifier)
	// Create application with options
	err := wails.Run(&options.App{
		Title:  "monitoring_serv",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
			notifier,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
