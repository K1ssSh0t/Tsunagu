package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"tsunagu/pkg/character"
	"tsunagu/pkg/config"
	"tsunagu/pkg/gamebanana"
	"tsunagu/pkg/mod"
	"tsunagu/pkg/utils"
)

type App struct {
	ctx              context.Context
	configService    *config.Service
	modService       *mod.Service
	characterService *character.Service
	tempZipDir       string
	gameBananaClient *gamebanana.Client
}

func NewApp() *App {
	configSvc := config.NewService()
	modSvc := mod.NewService(configSvc)
	charSvc := character.NewService(configSvc, modSvc)

	return &App{
		configService:    configSvc,
		modService:       modSvc,
		characterService: charSvc,
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.configService.LoadConfig()

	// Initialize logger
	logDir := filepath.Join(".", ".logs")
	if err := utils.InitLogger(logDir); err != nil {
		fmt.Printf("Warning: failed to initialize logger: %v\n", err)
	} else {
		utils.LogInfo("=== Tsunagu started ===")
	}

	// Create cache directory for mod downloads
	cacheDir := filepath.Join(".", ".cache", "mod-downloads")
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		utils.LogError("Failed to create cache directory: %v", err)
	}

	// Initialize GameBanana client
	a.gameBananaClient = gamebanana.NewClient(cacheDir)

	// Start watching mods path for changes (with ability to disable during operations)
	if err := a.modService.StartWatchingModsPath(); err != nil {
		utils.LogWarn("Failed to start mod watcher: %v", err)
	}

	utils.LogInfo("Startup completed successfully")
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	utils.LogInfo("Shutting down...")

	// Stop watching mods
	if err := a.modService.StopWatching(); err != nil {
		utils.LogWarn("Failed to stop mod watcher: %v", err)
	}

	utils.LogInfo("=== Tsunagu shutdown complete ===")
	utils.CloseLogger()
}

// SaveConfig saves the configuration
func (a *App) SaveConfig() error {
	return a.configService.SaveConfig()
}

// SetGame changes the selected game
func (a *App) SetGame(game string) string {
	return a.configService.SetGame(game)
}

// GetCurrentGame gets the current game
func (a *App) GetCurrentGame() string {
	return a.configService.GetCurrentGame()
}

// GetGamesConfig gets the configuration for all games
func (a *App) GetGamesConfig() config.Config {
	return a.configService.GetGamesConfig()
}

// UpdateGamePath updates the mods path for a specific game
func (a *App) UpdateGamePath(game string, path string) error {
	return a.configService.UpdateGamePath(game, path)
}

// UpdateGameExecutable updates the executable path for a specific game
func (a *App) UpdateGameExecutable(game string, path string) error {
	return a.configService.UpdateGameExecutable(game, path)
}

// LaunchXXMI launches the XXMI executable for the current game
func (a *App) LaunchXXMI() error {
	game := a.configService.GetCurrentGame()
	conf := a.configService.GetGamesConfig()
	if gameConf, ok := conf.Games[game]; ok && gameConf.ExecutablePath != "" {
		return utils.OpenUrl(gameConf.ExecutablePath)
	}
	return fmt.Errorf("no se ha configurado el ejecutable para %s", game)
}

// SelectExecutable opens the system file selector for .exe and .lnk files
func (a *App) SelectExecutable() (string, error) {
	dialogOptions := wailsruntime.OpenDialogOptions{
		Title: "Seleccionar Lanzador de Mods (XXMI)",
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "Lanzadores (*.exe, *.lnk)",
				Pattern:     "*.exe;*.lnk",
			},
		},
	}

	selectedFile, err := wailsruntime.OpenFileDialog(a.ctx, dialogOptions)
	if err != nil {
		return "", err
	}

	return selectedFile, nil
}

// SelectDirectory opens the system folder selector
func (a *App) SelectDirectory() (string, error) {
	dialogOptions := wailsruntime.OpenDialogOptions{
		Title: "Seleccionar carpeta",
	}

	selectedDirectory, err := wailsruntime.OpenDirectoryDialog(a.ctx, dialogOptions)
	if err != nil {
		return "", err
	}

	return selectedDirectory, nil
}

// SelectFile opens the system file selector
func (a *App) SelectFile() (string, error) {
	dialogOptions := wailsruntime.OpenDialogOptions{
		Title:           "Seleccionar archivo de mod comprimido",
		DefaultFilename: "",
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "Archivos Comprimidos (*.zip, *.rar, *.7z)",
				Pattern:     "*.zip;*.rar;*.7z",
			},
		},
	}

	selectedFile, err := wailsruntime.OpenFileDialog(a.ctx, dialogOptions)
	if err != nil {
		return "", err
	}

	return selectedFile, nil
}

// OpenModFolder opens the mod folder in the system file explorer
func (a *App) OpenModFolder(modPath string) error {
	// Verify folder exists
	if _, err := os.Stat(modPath); os.IsNotExist(err) {
		return fmt.Errorf("la carpeta del mod no existe: %s", modPath)
	}

	// Open in system file explorer using OS commands

	// Use utils.OpenFolder logic
	return utils.OpenFolder(modPath)
}

// IsConfigured checks if the app is configured for the current game
func (a *App) IsConfigured() bool {
	path := a.configService.CurrentModsPath()
	return path != "" && utils.IsDirectory(path)
}

// GetCharacters gets all characters with their info
func (a *App) GetCharacters() ([]character.Character, error) {
	return a.characterService.GetCharacters()
}

// GetModsForCharacter gets mods for a specific character
func (a *App) GetModsForCharacter(characterName string) ([]mod.Mod, error) {
	if !a.IsConfigured() {
		return []mod.Mod{}, nil
	}
	return a.modService.GetModsForCharacter(characterName)
}

// ToggleMod toggles a mod
func (a *App) ToggleMod(characterName string, modName string) error {
	return a.modService.ToggleMod(characterName, modName)
}

// ActivateSingleMod activates a single mod
func (a *App) ActivateSingleMod(characterName string, modName string) error {
	return a.modService.ActivateSingleMod(characterName, modName)
}

// AddMod adds a new mod
func (a *App) AddMod(characterName string, modName string, sourcePath string, gameBananaUrl string) error {
	return a.modService.AddMod(characterName, modName, sourcePath, gameBananaUrl)
}

// AddModFromZipWithRoot adds a mod from ZIP using a specific root
func (a *App) AddModFromZipWithRoot(characterName string, modName string, zipFilePath string, selectedRoot string, gameBananaUrl string) error {
	// Verify we have a temp directory available
	if a.tempZipDir == "" {
		return fmt.Errorf("no temporary directory available. Please call GetZipStructure first")
	}

	// Delegate to service, passing the temp dir
	err := a.modService.AddModFromZipWithRoot(characterName, modName, a.tempZipDir, selectedRoot, gameBananaUrl)

	// Clean up temp dir
	os.RemoveAll(a.tempZipDir)
	a.tempZipDir = ""

	return err
}

// UpdateMod updates an existing mod
func (a *App) UpdateMod(characterName string, modName string, sourcePath string) error {
	return a.modService.UpdateMod(characterName, modName, sourcePath)
}

// UpdateModFromZipWithRoot updates a mod from ZIP
func (a *App) UpdateModFromZipWithRoot(characterName string, modName string, zipFilePath string, selectedRoot string) error {
	if a.tempZipDir == "" {
		return fmt.Errorf("no temporary directory available. Please call GetZipStructure first")
	}

	err := a.modService.UpdateModFromZipWithRoot(characterName, modName, a.tempZipDir, selectedRoot)

	os.RemoveAll(a.tempZipDir)
	a.tempZipDir = ""

	return err
}

// RemoveMod removes a mod
func (a *App) RemoveMod(characterName string, modName string) error {
	return a.modService.RemoveMod(characterName, modName)
}

// MoveMod moves a mod from one character to another
func (a *App) MoveMod(sourceCharacter string, modName string, targetCharacter string) error {
	return a.modService.MoveMod(sourceCharacter, modName, targetCharacter)
}

// GetZipStructure gets the structure of a ZIP file
func (a *App) GetZipStructure(zipFilePath string) ([]utils.ZipFile, error) {
	// Clean previous temp dir
	if a.tempZipDir != "" {
		os.RemoveAll(a.tempZipDir)
	}

	// Create temp directory
	tempDir, err := os.MkdirTemp(".", "zip-structure-*")
	if err != nil {
		return nil, fmt.Errorf("error creating temp directory: %v", err)
	}

	// Save temp path
	a.tempZipDir = tempDir

	// Extract ZIP to temp
	err = utils.ExtractArchive(zipFilePath, tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		a.tempZipDir = ""
		return nil, fmt.Errorf("error extracting zip to temp directory: %v", err)
	}

	// Build structure
	structure, err := utils.BuildStructureFromPath(tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		a.tempZipDir = ""
		return nil, fmt.Errorf("error building structure from temp directory: %v", err)
	}

	// Wrap in Root node
	rootNode := utils.ZipFile{
		Name:     "Root (Select this if files are not in a folder)",
		IsDir:    true,
		Path:     ".",
		Children: make([]*utils.ZipFile, len(structure)),
	}

	for i := range structure {
		rootNode.Children[i] = &structure[i]
	}

	return []utils.ZipFile{rootNode}, nil
}

// CleanupTempDirectory cleans the temp directory
func (a *App) CleanupTempDirectory() error {
	if a.tempZipDir != "" {
		err := os.RemoveAll(a.tempZipDir)
		a.tempZipDir = ""
		return err
	}
	return nil
}

// CheckForUpdates checks for updates
func (a *App) CheckForUpdates() ([]mod.ModUpdate, error) {
	// We need the list of characters to check updates for all of them
	// Or we can just iterate over all folders in mods path if we wanted,
	// but the original logic iterated over characters.
	// So we need to get characters first.
	charDefs, err := a.characterService.LoadCharactersList()
	if err != nil {
		return nil, err
	}

	var charNames []string
	for _, def := range charDefs {
		charNames = append(charNames, def.Name)
		// Also add skin folders to check for updates
		for _, skin := range def.Skins {
			if skin.Folder != "" {
				// Construct folder name: {Character}_skin_{SkinFolder}
				fullSkinFolder := strings.ToLower(fmt.Sprintf("%s_skin_%s", def.Name, skin.Folder))
				charNames = append(charNames, fullSkinFolder)
			}
		}
	}

	// Attempt bounded background-like restoration for missing covers
	if restored, err := a.modService.RestoreMissingImagesBatch(charNames, 20, 3); err != nil {
		utils.LogWarn("[CheckForUpdates] Error restoring missing images: %v", err)
	} else if restored > 0 {
		utils.LogInfo("[CheckForUpdates] Restored %d missing mod covers", restored)
	}

	return a.modService.CheckForUpdates(charNames)
}

// OpenUrl opens a URL
func (a *App) OpenUrl(url string) error {
	return utils.OpenUrl(url)
}

// GetModImageBase64 reads the mod cover image and returns it as base64
func (a *App) GetModImageBase64(imagePath string) (string, error) {
	if imagePath == "" {
		return "", fmt.Errorf("empty image path")
	}

	// Check if file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		return "", fmt.Errorf("image file not found: %s", imagePath)
	}

	// Read the image file
	data, err := os.ReadFile(imagePath)
	if err != nil {
		return "", fmt.Errorf("failed to read image: %v", err)
	}

	// Determine MIME type based on extension
	ext := strings.ToLower(filepath.Ext(imagePath))
	var mimeType string
	switch ext {
	case ".png":
		mimeType = "image/png"
	case ".gif":
		mimeType = "image/gif"
	case ".webp":
		mimeType = "image/webp"
	default:
		mimeType = "image/jpeg"
	}

	// Encode to base64 with data URI prefix
	base64Data := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data), nil
}

// RestoreModImage tries to restore a missing cover image for a mod.
func (a *App) RestoreModImage(characterName string, modName string, force bool) (bool, error) {
	return a.modService.RestoreModImage(characterName, modName, force)
}

func (a *App) Greet(name string) (string, error) {
	return "Hello " + name, nil
}

// GetModDownloadFiles obtiene la lista de archivos disponibles para descargar
func (a *App) GetModDownloadFiles(modURL string) ([]gamebanana.ModFile, error) {
	if a.gameBananaClient == nil {
		return nil, fmt.Errorf("GameBanana client not initialized")
	}

	// Extraer mod ID de la URL
	modID, err := gamebanana.ExtractModID(modURL)
	if err != nil {
		return nil, fmt.Errorf("invalid GameBanana URL: %w", err)
	}

	// Obtener archivos disponibles
	files, err := a.gameBananaClient.GetModFiles(modID)
	if err != nil {
		return nil, fmt.Errorf("failed to get mod files: %w", err)
	}

	return files, nil
}

// DownloadModUpdate descarga un archivo de actualización de mod
func (a *App) DownloadModUpdate(downloadURL, fileName string) (string, error) {
	if a.gameBananaClient == nil {
		return "", fmt.Errorf("GameBanana client not initialized")
	}

	// Descargar archivo con callback de progreso
	downloadedPath, err := a.gameBananaClient.DownloadModFile(downloadURL, fileName, func(progress gamebanana.DownloadProgress) {
		// Emitir evento de progreso al frontend
		wailsruntime.EventsEmit(a.ctx, "download:progress", progress)
	})

	if err != nil {
		return "", fmt.Errorf("download failed: %w", err)
	}

	return downloadedPath, nil
}

// CleanupCachedFile elimina un archivo del caché de descargas
func (a *App) CleanupCachedFile(filePath string) error {
	// Validar que el archivo esté en el directorio de caché
	cacheDir := filepath.Join(".", ".cache", "mod-downloads")
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return fmt.Errorf("invalid file path: %w", err)
	}

	absCacheDir, err := filepath.Abs(cacheDir)
	if err != nil {
		return fmt.Errorf("invalid cache directory: %w", err)
	}

	// Verificar que el archivo está dentro del directorio de caché
	if !strings.HasPrefix(absPath, absCacheDir) {
		return fmt.Errorf("file is not in cache directory")
	}

	// Eliminar archivo
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}
