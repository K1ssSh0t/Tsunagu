package mod

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"tsunagu/pkg/config"
	"tsunagu/pkg/gamebanana"
	"tsunagu/pkg/utils"
)

type Mod struct {
	ID            string `json:"id"`
	Character     string `json:"character"`
	Name          string `json:"name"`
	IsActive      bool   `json:"isActive"`
	FullPath      string `json:"fullPath"`
	GameBananaUrl string `json:"gameBananaUrl"`
	ImagePath     string `json:"imagePath"`
}

type ModConfig struct {
	Id          string `json:"Id"`
	CustomName  string `json:"CustomName"`
	Author      string `json:"Author"`
	ModUrl      string `json:"ModUrl"`
	ImagePath   string `json:"ImagePath"`
	Description string `json:"Description"`
	DateAdded   string `json:"DateAdded"`
	LastChecked string `json:"LastChecked"`
}

type JASMConfig struct {
	Id            string `json:"Id"`
	CustomName    string `json:"CustomName"`
	Author        string `json:"Author"`
	ModUrl        string `json:"ModUrl"`
	ImagePath     string `json:"ImagePath"`
	MergedIniPath string `json:"MergedIniPath"`
	Description   string `json:"Description"`
	DateAdded     string `json:"DateAdded"`
}

// ModUpdate struct to hold update information
type ModUpdate struct {
	CharacterName string `json:"characterName"`
	ModName       string `json:"modName"`
	ModUrl        string `json:"modUrl"`
	LocalDate     string `json:"localDate"`
	RemoteDate    string `json:"remoteDate"`
}

type Service struct {
	configService *config.Service
	mu            sync.Mutex
	watcher       *ModWatcherManager
}

func NewService(cfg *config.Service) *Service {
	return &Service{
		configService: cfg,
		watcher:       NewModWatcherManager(),
	}
}

func (s *Service) SetWatcher(watcher *ModWatcherManager) {
	s.watcher = watcher
}

func (s *Service) GetWatcher() *ModWatcherManager {
	return s.watcher
}

func (s *Service) StartWatchingModsPath() error {
	modsPath := s.configService.CurrentModsPath()
	if modsPath == "" {
		return nil
	}

	return s.watcher.AddWatcher(modsPath, func(event fsnotify.Event) {
		_ = event
	})
}

func (s *Service) StopWatching() error {
	return s.watcher.Close()
}

// GetModsForCharacter gets the mods for a specific character
func (s *Service) GetModsForCharacter(characterName string) ([]Mod, error) {
	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	mods := []Mod{}

	entries, err := os.ReadDir(characterPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []Mod{}, nil
		}
		return nil, err
	}

	for _, modEntry := range entries {
		if modEntry.IsDir() {
			modName := modEntry.Name()
			isActive := !strings.HasPrefix(modName, "DISABLED_")

			// Get actual mod name (without DISABLED_)
			actualModName := modName
			if !isActive {
				actualModName = strings.TrimPrefix(modName, "DISABLED_")
			}

			mod := Mod{
				ID:        actualModName,
				Character: characterName,
				Name:      actualModName,
				IsActive:  isActive,
				FullPath:  filepath.Join(characterPath, modName),
			}

			// Check for JASM migration
			s.checkAndMigrateJASMConfig(filepath.Join(characterPath, modName))

			// Try to read GameBanana URL and ImagePath from .modconfig.json
			modConfigPath := filepath.Join(characterPath, modName, ".modconfig.json")
			if data, err := os.ReadFile(modConfigPath); err == nil {
				var config ModConfig
				if err := json.Unmarshal(data, &config); err == nil {
					mod.GameBananaUrl = config.ModUrl
					// Build full image path if ImagePath is set
					if config.ImagePath != "" {
						mod.ImagePath = filepath.Join(mod.FullPath, config.ImagePath)
					}
				}
			}

			mods = append(mods, mod)
		}
	}

	// Sort mods by name
	sort.Slice(mods, func(i, j int) bool {
		return mods[i].Name < mods[j].Name
	})

	return mods, nil
}

// ToggleMod toggles a mod active/inactive
func (s *Service) ToggleMod(characterName string, modName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	reenableWatcher := s.watcher.DisableAll()
	defer reenableWatcher()

	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	activePath := filepath.Join(characterPath, modName)
	disabledPath := filepath.Join(characterPath, "DISABLED_"+modName)

	// Check if mod is active (no DISABLED_)
	if _, err := os.Stat(activePath); err == nil {
		// It's active -> deactivate (rename to DISABLED_)
		return utils.RenameWithRetry(activePath, disabledPath, 5)
	}

	// Check if mod is inactive (with DISABLED_)
	if _, err := os.Stat(disabledPath); err == nil {
		// It's inactive -> activate (remove DISABLED_)
		return utils.RenameWithRetry(disabledPath, activePath, 5)
	}

	return os.ErrNotExist
}

// ActivateSingleMod activates one mod and deactivates others for the same character
func (s *Service) ActivateSingleMod(characterName string, modName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	reenableWatcher := s.watcher.DisableAll()
	defer reenableWatcher()

	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)

	// First deactivate all mods for the character
	entries, err := os.ReadDir(characterPath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			currentModName := entry.Name()

			// If it's an active mod (no DISABLED_), deactivate it
			if !strings.HasPrefix(currentModName, "DISABLED_") {
				disabledPath := filepath.Join(characterPath, "DISABLED_"+currentModName)
				if err := utils.RenameWithRetry(filepath.Join(characterPath, currentModName), disabledPath, 5); err != nil {
					return err
				}
			}
		}
	}

	// Now activate the requested mod
	targetDisabledPath := filepath.Join(characterPath, "DISABLED_"+modName)
	targetActivePath := filepath.Join(characterPath, modName)

	// If the mod is deactivated, activate it
	if _, err := os.Stat(targetDisabledPath); err == nil {
		return utils.RenameWithRetry(targetDisabledPath, targetActivePath, 5)
	}

	return nil
}

// AddMod adds a new mod (creates character folder if not exists)
func (s *Service) AddMod(characterName string, modName string, sourcePath string, gameBananaUrl string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	reenableWatcher := s.watcher.DisableAll()
	defer reenableWatcher()

	modName = strings.TrimSpace(modName)
	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	targetPath := filepath.Join(characterPath, modName)

	// Lock source directory during installation (like JASM)
	dirLocker := utils.NewDirectoryLocker(sourcePath)
	if err := dirLocker.LockAllFiles(); err != nil {
		return fmt.Errorf("failed to lock source directory: %w", err)
	}
	defer dirLocker.ReleaseAllFiles()

	// Create character directory if not exists
	if err := os.MkdirAll(characterPath, 0755); err != nil {
		return err
	}

	// Create mod directory
	if err := os.MkdirAll(targetPath, 0755); err != nil {
		return err
	}

	// Copy mod files
	if err := s.copyModFiles(sourcePath, targetPath); err != nil {
		return err
	}

	// Create mod config file
	return s.createModConfig(targetPath, modName, gameBananaUrl)
}

// AddModFromZipWithRoot adds a mod from ZIP using a specific root
func (s *Service) AddModFromZipWithRoot(characterName string, modName string, tempZipDir string, selectedRoot string, gameBananaUrl string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	reenableWatcher := s.watcher.DisableAll()
	defer reenableWatcher()

	modName = strings.TrimSpace(modName)
	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	targetPath := filepath.Join(characterPath, modName)

	// Create character directory if not exists
	if err := os.MkdirAll(characterPath, 0755); err != nil {
		return err
	}

	// Build full path to selected root directory in temp
	selectedRootPath := filepath.Join(tempZipDir, selectedRoot)

	// Verify selected directory exists
	if _, err := os.Stat(selectedRootPath); os.IsNotExist(err) {
		return fmt.Errorf("selected root directory does not exist: %s", selectedRoot)
	}

	// Lock source directory during installation
	dirLocker := utils.NewDirectoryLocker(selectedRootPath)
	if err := dirLocker.LockAllFiles(); err != nil {
		return fmt.Errorf("failed to lock source directory: %w", err)
	}
	defer dirLocker.ReleaseAllFiles()

	// Copy files from temp directory already extracted
	if err := s.copyModFiles(selectedRootPath, targetPath); err != nil {
		return err
	}

	// Create mod config file
	return s.createModConfig(targetPath, modName, gameBananaUrl)
}

// UpdateMod updates an existing mod from a folder
func (s *Service) UpdateMod(characterName string, modName string, sourcePath string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	reenableWatcher := s.watcher.DisableAll()
	defer reenableWatcher()

	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	targetPath := filepath.Join(characterPath, modName)
	configPath := filepath.Join(targetPath, ".modconfig.json")

	// Lock source directory during update (like JASM)
	dirLocker := utils.NewDirectoryLocker(sourcePath)
	if err := dirLocker.LockAllFiles(); err != nil {
		return fmt.Errorf("failed to lock source directory: %w", err)
	}
	defer dirLocker.ReleaseAllFiles()

	// 1. Read existing config to preserve ID and URL
	var oldConfig ModConfig
	if data, err := os.ReadFile(configPath); err == nil {
		json.Unmarshal(data, &oldConfig)
	}

	// 2. Clear mod contents but preserve .modconfig.json
	if err := s.clearModContents(targetPath, true); err != nil {
		return fmt.Errorf("error clearing mod contents (file may be in use by another program): %v", err)
	}

	// 3. Copy new files
	if err := s.copyModFiles(sourcePath, targetPath); err != nil {
		return err
	}

	// 4. Update config - ONLY update LastChecked, preserve original DateAdded
	if oldConfig.Id == "" {
		oldConfig.Id = utils.GenerateUUID()
	}

	// IMPORTANT: Preserve original DateAdded, only update LastChecked
	oldConfig.LastChecked = time.Now().Format("02/01/2006 03:04:05 p. m.")
	oldConfig.CustomName = modName

	// Write config
	data, err := json.MarshalIndent(oldConfig, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// UpdateModFromZipWithRoot updates a mod from a ZIP
func (s *Service) UpdateModFromZipWithRoot(characterName string, modName string, tempZipDir string, selectedRoot string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	reenableWatcher := s.watcher.DisableAll()
	defer reenableWatcher()

	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	targetPath := filepath.Join(characterPath, modName)
	configPath := filepath.Join(targetPath, ".modconfig.json")

	// 1. Read existing config
	var oldConfig ModConfig
	if data, err := os.ReadFile(configPath); err == nil {
		json.Unmarshal(data, &oldConfig)
	}

	// 2. Clear mod contents but preserve .modconfig.json
	if err := s.clearModContents(targetPath, true); err != nil {
		return fmt.Errorf("error clearing mod contents (file may be in use by another program): %v", err)
	}

	// 3. Copy files from temp zip
	selectedRootPath := filepath.Join(tempZipDir, selectedRoot)
	if _, err := os.Stat(selectedRootPath); os.IsNotExist(err) {
		return fmt.Errorf("selected root directory does not exist: %s", selectedRoot)
	}

	// Lock source directory during update
	dirLocker := utils.NewDirectoryLocker(selectedRootPath)
	if err := dirLocker.LockAllFiles(); err != nil {
		return fmt.Errorf("failed to lock source directory: %w", err)
	}
	defer dirLocker.ReleaseAllFiles()

	if err := s.copyModFiles(selectedRootPath, targetPath); err != nil {
		return err
	}

	// 4. Update config - ONLY update LastChecked, preserve original DateAdded
	if oldConfig.Id == "" {
		oldConfig.Id = utils.GenerateUUID()
	}
	// IMPORTANT: Preserve original DateAdded, only update LastChecked
	oldConfig.LastChecked = time.Now().Format("02/01/2006 03:04:05 p. m.")
	oldConfig.CustomName = modName

	data, err := json.MarshalIndent(oldConfig, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// createModConfig creates .modconfig.json file in mod directory
func (s *Service) createModConfig(modPath string, modName string, gameBananaUrl string) error {
	fmt.Printf("[createModConfig] Starting for mod: %s\n", modName)
	fmt.Printf("[createModConfig] Mod path: %s\n", modPath)
	fmt.Printf("[createModConfig] GameBanana URL: %s\n", gameBananaUrl)

	configPath := filepath.Join(modPath, ".modconfig.json")
	jasmPath := filepath.Join(modPath, ".JASM_ModConfig.json")

	// Check if .JASM_ModConfig.json exists
	if data, err := os.ReadFile(jasmPath); err == nil {
		fmt.Printf("[createModConfig] Found JASM config, migrating...\n")
		var jasmConfig JASMConfig
		if err := json.Unmarshal(data, &jasmConfig); err == nil {
			// Found valid JASM config, use it
			config := ModConfig{
				Id:          jasmConfig.Id,
				CustomName:  jasmConfig.CustomName,
				Author:      jasmConfig.Author,
				ModUrl:      jasmConfig.ModUrl,
				ImagePath:   jasmConfig.ImagePath,
				Description: jasmConfig.Description,
				DateAdded:   jasmConfig.DateAdded,
				LastChecked: jasmConfig.DateAdded,
			}

			// If ModUrl was passed explicitly and JASM is empty, use passed one
			if config.ModUrl == "" && gameBananaUrl != "" {
				config.ModUrl = gameBananaUrl
			}

			// Try to download cover image if we have a GameBanana URL
			urlToUse := config.ModUrl
			if urlToUse == "" {
				urlToUse = gameBananaUrl
			}
			fmt.Printf("[createModConfig] (JASM) URL to use for image: %s\n", urlToUse)
			if urlToUse != "" && strings.Contains(urlToUse, "gamebanana.com") {
				fmt.Printf("[createModConfig] (JASM) Attempting to fetch image...\n")
				if imageUrl, err := s.fetchGameBananaImage(urlToUse); err == nil {
					fmt.Printf("[createModConfig] (JASM) Got image URL, downloading...\n")
					if coverPath, err := s.downloadModCover(imageUrl, modPath); err == nil {
						config.ImagePath = coverPath
						fmt.Printf("[createModConfig] (JASM) Image saved as: %s\n", coverPath)
					} else {
						fmt.Printf("[createModConfig] (JASM) ERROR downloading image: %v\n", err)
					}
				} else {
					fmt.Printf("[createModConfig] (JASM) ERROR fetching image URL: %v\n", err)
				}
			}

			data, err := json.MarshalIndent(config, "", "  ")
			if err != nil {
				return err
			}
			return os.WriteFile(configPath, data, 0644)
		}
	}

	fmt.Printf("[createModConfig] No JASM config, creating new config...\n")

	// Generate UUID
	id := utils.GenerateUUID()
	now := time.Now().Format("02/01/2006 03:04:05 p. m.")

	// Default image path
	imagePath := ".JASM_Cover.jpg"

	// Try to download cover image from GameBanana if URL provided
	fmt.Printf("[createModConfig] Checking if should download image. URL: '%s'\n", gameBananaUrl)
	if gameBananaUrl != "" && strings.Contains(gameBananaUrl, "gamebanana.com") {
		fmt.Printf("[createModConfig] Attempting to fetch image from GameBanana...\n")
		if imageUrl, err := s.fetchGameBananaImage(gameBananaUrl); err == nil {
			fmt.Printf("[createModConfig] Got image URL: %s\n", imageUrl)
			fmt.Printf("[createModConfig] Downloading image...\n")
			if coverPath, err := s.downloadModCover(imageUrl, modPath); err == nil {
				imagePath = coverPath
				fmt.Printf("[createModConfig] SUCCESS: Image saved as: %s\n", coverPath)
			} else {
				fmt.Printf("[createModConfig] ERROR downloading image: %v\n", err)
			}
		} else {
			fmt.Printf("[createModConfig] ERROR fetching image URL: %v\n", err)
		}
	} else {
		fmt.Printf("[createModConfig] Skipping image download - no valid GameBanana URL\n")
	}

	config := ModConfig{
		Id:          id,
		CustomName:  modName,
		Author:      "",
		ModUrl:      gameBananaUrl,
		ImagePath:   imagePath,
		Description: "",
		DateAdded:   now,
		LastChecked: now,
	}

	fmt.Printf("[createModConfig] Final ImagePath: %s\n", config.ImagePath)

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// RemoveMod removes a mod
func (s *Service) RemoveMod(characterName string, modName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	reenableWatcher := s.watcher.DisableAll()
	defer reenableWatcher()

	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)

	// Try to remove both versions (active and inactive) with retry for Windows
	activePath := filepath.Join(characterPath, modName)
	disabledPath := filepath.Join(characterPath, "DISABLED_"+modName)

	// Attempt to remove both paths, but don't fail immediately
	var activeErr, disabledErr error

	if _, err := os.Stat(activePath); err == nil {
		activeErr = utils.RemoveAllWithRetry(activePath, 3)
	}

	if _, err := os.Stat(disabledPath); err == nil {
		disabledErr = utils.RemoveAllWithRetry(disabledPath, 3)
	}

	// Return error if either removal failed
	if activeErr != nil && disabledErr != nil {
		return fmt.Errorf("failed to remove mod (files may be in use): %v, %v", activeErr, disabledErr)
	} else if activeErr != nil {
		return fmt.Errorf("failed to remove active mod: %v", activeErr)
	} else if disabledErr != nil {
		return fmt.Errorf("failed to remove disabled mod: %v", disabledErr)
	}

	return nil
}

// MoveMod moves a mod from one character to another (including skins)
func (s *Service) MoveMod(sourceCharacter string, modName string, targetCharacter string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	reenableWatcher := s.watcher.DisableAll()
	defer reenableWatcher()

	modsPath := s.configService.CurrentModsPath()
	sourceCharacterPath := filepath.Join(modsPath, "character", sourceCharacter)
	targetCharacterPath := filepath.Join(modsPath, "character", targetCharacter)

	// Check if source and target are the same
	if strings.EqualFold(sourceCharacter, targetCharacter) {
		return fmt.Errorf("source and target character cannot be the same")
	}

	// Determine if mod is active or disabled in source
	sourceActivePath := filepath.Join(sourceCharacterPath, modName)
	sourceDisabledPath := filepath.Join(sourceCharacterPath, "DISABLED_"+modName)

	var sourcePath string
	isActive := true

	// Check which version exists
	if _, err := os.Stat(sourceActivePath); err == nil {
		sourcePath = sourceActivePath
		isActive = true
	} else if _, err := os.Stat(sourceDisabledPath); err == nil {
		sourcePath = sourceDisabledPath
		isActive = false
	} else {
		return fmt.Errorf("mod not found: %s", modName)
	}

	// Create target character directory if it doesn't exist
	if err := os.MkdirAll(targetCharacterPath, 0755); err != nil {
		return fmt.Errorf("failed to create target character directory: %v", err)
	}

	// Determine target path (preserve active/disabled state)
	var targetPath string
	if isActive {
		targetPath = filepath.Join(targetCharacterPath, modName)
	} else {
		targetPath = filepath.Join(targetCharacterPath, "DISABLED_"+modName)
	}

	// Check if mod already exists in target
	if _, err := os.Stat(targetPath); err == nil {
		return fmt.Errorf("a mod with the name '%s' already exists in %s", modName, targetCharacter)
	}

	// Also check the opposite state (if we're moving active, check if disabled exists, and vice versa)
	var oppositeTargetPath string
	if isActive {
		oppositeTargetPath = filepath.Join(targetCharacterPath, "DISABLED_"+modName)
	} else {
		oppositeTargetPath = filepath.Join(targetCharacterPath, modName)
	}
	if _, err := os.Stat(oppositeTargetPath); err == nil {
		return fmt.Errorf("a mod with the name '%s' already exists in %s", modName, targetCharacter)
	}

	// Copy mod to target
	if err := s.copyModFiles(sourcePath, targetPath); err != nil {
		return fmt.Errorf("failed to copy mod to target: %v", err)
	}

	// Remove mod from source with retry for Windows file locking
	if err := utils.RemoveAllWithRetry(sourcePath, 5); err != nil {
		// If removal fails, try to clean up the copied files
		utils.RemoveAllWithRetry(targetPath, 3)
		return fmt.Errorf("failed to remove mod from source (file may be in use): %v", err)
	}

	return nil
}

// clearModContents removes all files and directories except .modconfig.json
// This is used during mod updates to preserve the config while replacing mod files
func (s *Service) clearModContents(modPath string, preserveConfig bool) error {
	entries, err := os.ReadDir(modPath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		// Skip .modconfig.json if preserveConfig is true
		if preserveConfig && entry.Name() == ".modconfig.json" {
			continue
		}

		fullPath := filepath.Join(modPath, entry.Name())
		if err := utils.RemoveAllWithRetry(fullPath, 5); err != nil {
			return fmt.Errorf("error removing %s: %v", entry.Name(), err)
		}
	}

	return nil
}

// copyModFiles copies mod files
func (s *Service) copyModFiles(sourcePath, targetPath string) error {
	return filepath.Walk(sourcePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// If error accessing a file, log but continue
			return fmt.Errorf("error accessing %s: %v", path, err)
		}

		relPath, err := filepath.Rel(sourcePath, path)
		if err != nil {
			return err
		}

		targetFilePath := filepath.Join(targetPath, relPath)

		if info.IsDir() {
			// If it's an empty folder, create it but don't fail if error
			if err := os.MkdirAll(targetFilePath, 0755); err != nil {
				return fmt.Errorf("error creating directory %s: %v", targetFilePath, err)
			}
			return nil
		} else {
			// Try to copy file, but if fails continue with next
			input, err := os.ReadFile(path)
			if err != nil {
				return fmt.Errorf("error reading file %s: %v", path, err)
			}

			if err := os.WriteFile(targetFilePath, input, 0644); err != nil {
				return fmt.Errorf("error writing file %s: %v", targetFilePath, err)
			}
		}

		return nil
	})
}

// CheckForUpdates checks for updates for all mods with a GameBanana URL
func (s *Service) CheckForUpdates(characters []string) ([]ModUpdate, error) {
	var updates []ModUpdate

	for _, charName := range characters {
		mods, err := s.GetModsForCharacter(charName)
		if err != nil {
			continue
		}

		for _, mod := range mods {
			configPath := filepath.Join(mod.FullPath, ".modconfig.json")
			if _, err := os.Stat(configPath); err == nil {
				// Read config
				data, err := os.ReadFile(configPath)
				if err != nil {
					continue
				}

				var config ModConfig
				if err := json.Unmarshal(data, &config); err != nil {
					continue
				}

				if config.ModUrl != "" && strings.Contains(config.ModUrl, "gamebanana.com") {
					// Fetch GameBanana page
					remoteDate, err := s.fetchGameBananaDate(config.ModUrl)
					if err != nil {
						fmt.Printf("Error fetching date for %s: %v\n", config.ModUrl, err)
						continue
					}

					// Parse dates
					// Use LastChecked for comparison (when the mod was last verified/updated locally)
					// We need to normalize "p. m." to "PM" and "a. m." to "AM" for Go's parser
					localDateToCompare := config.LastChecked
					if localDateToCompare == "" {
						// Fallback to DateAdded if LastChecked is empty (backward compatibility)
						localDateToCompare = config.DateAdded
					}

					normalizedDate := strings.ReplaceAll(localDateToCompare, "p. m.", "PM")
					normalizedDate = strings.ReplaceAll(normalizedDate, "a. m.", "AM")

					localTime, err := time.Parse("02/01/2006 03:04:05 PM", normalizedDate)
					if err != nil {
						// Try fallback to standard format just in case
						localTime, err = time.Parse("2006-01-02 15:04:05", localDateToCompare)
						if err != nil {
							fmt.Printf("Error parsing local date %s: %v\n", localDateToCompare, err)
							continue
						}
					}

					// Remote date format (ISO 8601 from JSON-LD): "2024-09-10T19:33:05+00:00"
					remoteTime, err := time.Parse(time.RFC3339, remoteDate)
					if err != nil {
						fmt.Printf("Error parsing remote date %s: %v\n", remoteDate, err)
						continue
					}

					// Compare dates: remote (GameBanana) vs local (LastChecked)
					updateAvailable := remoteTime.After(localTime)

					if updateAvailable {
						updates = append(updates, ModUpdate{
							CharacterName: charName,
							ModName:       mod.Name,
							ModUrl:        config.ModUrl,
							LocalDate:     localDateToCompare,
							RemoteDate:    remoteTime.Format("2006-01-02 15:04:05"),
						})
						fmt.Printf("[CheckForUpdates] Update available for %s: remote=%s > local=%s\n",
							mod.Name, remoteTime.Format("2006-01-02"), localTime.Format("2006-01-02"))
					}

					// ALWAYS update LastChecked after checking (whether update is available or not)
					config.LastChecked = time.Now().Format("02/01/2006 03:04:05 p. m.")

					// Save updated config back to file
					updatedData, err := json.MarshalIndent(config, "", "  ")
					if err != nil {
						fmt.Printf("Error marshaling updated config for %s: %v\n", mod.Name, err)
					} else {
						if err := os.WriteFile(configPath, updatedData, 0644); err != nil {
							fmt.Printf("Error saving updated LastChecked for %s: %v\n", mod.Name, err)
						} else {
							fmt.Printf("[CheckForUpdates] Updated LastChecked for %s to %s\n", mod.Name, config.LastChecked)
						}
					}
				}
			}
		}
	}

	return updates, nil
}

// fetchGameBananaDate fetches the modification date from a GameBanana URL using API
func (s *Service) fetchGameBananaDate(url string) (string, error) {
	// Extract mod ID
	modID, err := gamebanana.ExtractModID(url)
	if err != nil {
		return "", err
	}

	// Create temporary GameBanana client
	client := gamebanana.NewClient("")

	// Get mod info from API
	modInfo, err := client.GetModInfo(modID)
	if err != nil {
		return "", err
	}

	// Return date in RFC3339 format (compatible with existing parsing logic)
	return modInfo.DateModified.Format(time.RFC3339), nil
}

// fetchGameBananaImage fetches the main image URL from a GameBanana mod page using the API
func (s *Service) fetchGameBananaImage(url string) (string, error) {
	fmt.Printf("[fetchGameBananaImage] Starting for URL: %s\n", url)

	// Extract mod ID from URL (e.g., https://gamebanana.com/mods/648208 -> 648208)
	re := regexp.MustCompile(`gamebanana\.com/mods/(\d+)`)
	matches := re.FindStringSubmatch(url)
	if len(matches) < 2 {
		fmt.Printf("[fetchGameBananaImage] ERROR: Could not extract mod ID from URL\n")
		return "", fmt.Errorf("could not extract mod ID from URL: %s", url)
	}
	modID := matches[1]
	fmt.Printf("[fetchGameBananaImage] Extracted mod ID: %s\n", modID)

	// Use GameBanana API to get preview media
	apiURL := fmt.Sprintf("https://gamebanana.com/apiv11/Mod/%s?_csvProperties=_aPreviewMedia", modID)
	fmt.Printf("[fetchGameBananaImage] API URL: %s\n", apiURL)

	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		fmt.Printf("[fetchGameBananaImage] ERROR creating request: %v\n", err)
		return "", err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

	fmt.Printf("[fetchGameBananaImage] Sending API request...\n")
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("[fetchGameBananaImage] ERROR sending request: %v\n", err)
		return "", err
	}
	defer resp.Body.Close()

	fmt.Printf("[fetchGameBananaImage] Response status: %d\n", resp.StatusCode)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("API returned status code %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("[fetchGameBananaImage] ERROR reading response: %v\n", err)
		return "", err
	}

	fmt.Printf("[fetchGameBananaImage] Response body (first 500 chars): %.500s\n", string(body))

	// Parse JSON response - the structure is: { "_aPreviewMedia": { "_aImages": [...] } }
	var apiResponse struct {
		PreviewMedia struct {
			Images []struct {
				Type    string `json:"_sType"`
				BaseURL string `json:"_sBaseUrl"`
				File    string `json:"_sFile"`
				File100 string `json:"_sFile100"`
				File220 string `json:"_sFile220"`
				File530 string `json:"_sFile530"`
				File800 string `json:"_sFile800"`
			} `json:"_aImages"`
		} `json:"_aPreviewMedia"`
	}

	if err := json.Unmarshal(body, &apiResponse); err != nil {
		fmt.Printf("[fetchGameBananaImage] ERROR parsing JSON: %v\n", err)
		return "", fmt.Errorf("failed to parse API response: %v", err)
	}

	fmt.Printf("[fetchGameBananaImage] Found %d images in preview media\n", len(apiResponse.PreviewMedia.Images))

	// Find first image in preview media
	for i, media := range apiResponse.PreviewMedia.Images {
		fmt.Printf("[fetchGameBananaImage] Image[%d]: Type=%s, BaseURL=%s, File=%s\n", i, media.Type, media.BaseURL, media.File)
		if media.BaseURL != "" && media.File != "" {
			// Prefer higher resolution images
			imageFile := media.File
			if media.File530 != "" {
				imageFile = media.File530
			} else if media.File220 != "" {
				imageFile = media.File220
			}

			finalURL := media.BaseURL + "/" + imageFile
			fmt.Printf("[fetchGameBananaImage] SUCCESS: Found image URL: %s\n", finalURL)
			return finalURL, nil
		}
	}

	fmt.Printf("[fetchGameBananaImage] ERROR: No image found in preview media\n")
	return "", fmt.Errorf("no image found in mod preview media")
}

// downloadModCover downloads an image from a URL and saves it as .modCover in the mod folder
func (s *Service) downloadModCover(imageUrl string, modPath string) (string, error) {
	fmt.Printf("[downloadModCover] Starting download from: %s\n", imageUrl)
	fmt.Printf("[downloadModCover] Target mod path: %s\n", modPath)

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	req, err := http.NewRequest("GET", imageUrl, nil)
	if err != nil {
		fmt.Printf("[downloadModCover] ERROR creating request: %v\n", err)
		return "", err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

	fmt.Printf("[downloadModCover] Sending request...\n")
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("[downloadModCover] ERROR sending request: %v\n", err)
		return "", err
	}
	defer resp.Body.Close()

	fmt.Printf("[downloadModCover] Response status: %d\n", resp.StatusCode)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("failed to download image: status %d", resp.StatusCode)
	}

	// Determine file extension from content type or URL
	contentType := resp.Header.Get("Content-Type")
	fmt.Printf("[downloadModCover] Content-Type: %s\n", contentType)

	ext := ".jpg"
	if strings.Contains(contentType, "png") {
		ext = ".png"
	} else if strings.Contains(contentType, "gif") {
		ext = ".gif"
	} else if strings.Contains(contentType, "webp") {
		ext = ".webp"
	}

	coverPath := filepath.Join(modPath, ".modCover"+ext)
	fmt.Printf("[downloadModCover] Will save to: %s\n", coverPath)

	// Read image data
	imageData, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("[downloadModCover] ERROR reading image data: %v\n", err)
		return "", err
	}

	fmt.Printf("[downloadModCover] Downloaded %d bytes\n", len(imageData))

	// Save to file
	if err := os.WriteFile(coverPath, imageData, 0644); err != nil {
		fmt.Printf("[downloadModCover] ERROR writing file: %v\n", err)
		return "", err
	}

	fmt.Printf("[downloadModCover] SUCCESS: Saved image to %s\n", coverPath)
	return ".modCover" + ext, nil
}

// checkAndMigrateJASMConfig checks for .JASM_ModConfig.json and migrates it to .modconfig.json if needed
func (s *Service) checkAndMigrateJASMConfig(modPath string) error {
	jasmPath := filepath.Join(modPath, ".JASM_ModConfig.json")
	configPath := filepath.Join(modPath, ".modconfig.json")

	// If .modconfig.json already exists, skip
	if _, err := os.Stat(configPath); err == nil {
		return nil
	}

	// Check if JASM config exists
	data, err := os.ReadFile(jasmPath)
	if err != nil {
		return nil // Not found or error, just skip
	}

	var jasmConfig JASMConfig
	if err := json.Unmarshal(data, &jasmConfig); err != nil {
		return err
	}

	// Map to ModConfig
	config := ModConfig{
		Id:          jasmConfig.Id,
		CustomName:  jasmConfig.CustomName,
		Author:      jasmConfig.Author,
		ModUrl:      jasmConfig.ModUrl,
		ImagePath:   jasmConfig.ImagePath,
		Description: jasmConfig.Description,
		DateAdded:   jasmConfig.DateAdded,
		LastChecked: jasmConfig.DateAdded,
	}

	// Write .modconfig.json
	outData, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, outData, 0644)
}
