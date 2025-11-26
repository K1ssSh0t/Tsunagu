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
	"time"

	"tsunagu/pkg/config"
	"tsunagu/pkg/utils"
)

type Mod struct {
	ID            string `json:"id"`
	Character     string `json:"character"`
	Name          string `json:"name"`
	IsActive      bool   `json:"isActive"`
	FullPath      string `json:"fullPath"`
	GameBananaUrl string `json:"gameBananaUrl"`
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
}

func NewService(cfg *config.Service) *Service {
	return &Service{
		configService: cfg,
	}
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

			// Try to read GameBanana URL from .modconfig.json
			modConfigPath := filepath.Join(characterPath, modName, ".modconfig.json")
			if data, err := os.ReadFile(modConfigPath); err == nil {
				var config ModConfig
				if err := json.Unmarshal(data, &config); err == nil {
					mod.GameBananaUrl = config.ModUrl
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
	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	activePath := filepath.Join(characterPath, modName)
	disabledPath := filepath.Join(characterPath, "DISABLED_"+modName)

	// Check if mod is active (no DISABLED_)
	if _, err := os.Stat(activePath); err == nil {
		// It's active -> deactivate (rename to DISABLED_)
		return os.Rename(activePath, disabledPath)
	}

	// Check if mod is inactive (with DISABLED_)
	if _, err := os.Stat(disabledPath); err == nil {
		// It's inactive -> activate (remove DISABLED_)
		return os.Rename(disabledPath, activePath)
	}

	return os.ErrNotExist
}

// ActivateSingleMod activates one mod and deactivates others for the same character
func (s *Service) ActivateSingleMod(characterName string, modName string) error {
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
				if err := os.Rename(filepath.Join(characterPath, currentModName), disabledPath); err != nil {
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
		return os.Rename(targetDisabledPath, targetActivePath)
	}

	return nil
}

// AddMod adds a new mod (creates character folder if not exists)
func (s *Service) AddMod(characterName string, modName string, sourcePath string, gameBananaUrl string) error {
	modName = strings.TrimSpace(modName)
	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	targetPath := filepath.Join(characterPath, modName)

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

	// Copy files from temp directory already extracted
	if err := s.copyModFiles(selectedRootPath, targetPath); err != nil {
		return err
	}

	// Create mod config file
	return s.createModConfig(targetPath, modName, gameBananaUrl)
}

// UpdateMod updates an existing mod from a folder
func (s *Service) UpdateMod(characterName string, modName string, sourcePath string) error {
	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	targetPath := filepath.Join(characterPath, modName)
	configPath := filepath.Join(targetPath, ".modconfig.json")

	// 1. Read existing config to preserve ID and URL
	var oldConfig ModConfig
	if data, err := os.ReadFile(configPath); err == nil {
		json.Unmarshal(data, &oldConfig)
	}

	// 2. Remove old files
	if err := os.RemoveAll(targetPath); err != nil {
		return fmt.Errorf("error removing old mod: %v", err)
	}

	// 3. Re-create directory
	if err := os.MkdirAll(targetPath, 0755); err != nil {
		return fmt.Errorf("error creating mod directory: %v", err)
	}

	// 4. Copy new files
	if err := s.copyModFiles(sourcePath, targetPath); err != nil {
		return err
	}

	// 5. Restore/Update config
	if oldConfig.Id == "" {
		oldConfig.Id = utils.GenerateUUID()
	}

	// Update date
	oldConfig.DateAdded = time.Now().Format("02/01/2006 03:04:05 p. m.")
	oldConfig.LastChecked = oldConfig.DateAdded
	oldConfig.CustomName = modName

	// Write config
	data, err := json.MarshalIndent(oldConfig, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(targetPath, ".modconfig.json"), data, 0644)
}

// UpdateModFromZipWithRoot updates a mod from a ZIP
func (s *Service) UpdateModFromZipWithRoot(characterName string, modName string, tempZipDir string, selectedRoot string) error {
	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)
	targetPath := filepath.Join(characterPath, modName)
	configPath := filepath.Join(targetPath, ".modconfig.json")

	// 1. Read existing config
	var oldConfig ModConfig
	if data, err := os.ReadFile(configPath); err == nil {
		json.Unmarshal(data, &oldConfig)
	}

	// 2. Remove old mod
	if err := os.RemoveAll(targetPath); err != nil {
		return fmt.Errorf("error removing old mod: %v", err)
	}

	// 3. Re-create directory
	if err := os.MkdirAll(targetPath, 0755); err != nil {
		return fmt.Errorf("error creating mod directory: %v", err)
	}

	// 4. Copy files from temp zip
	selectedRootPath := filepath.Join(tempZipDir, selectedRoot)
	if _, err := os.Stat(selectedRootPath); os.IsNotExist(err) {
		return fmt.Errorf("selected root directory does not exist: %s", selectedRoot)
	}

	if err := s.copyModFiles(selectedRootPath, targetPath); err != nil {
		return err
	}

	// 5. Restore config
	if oldConfig.Id == "" {
		oldConfig.Id = utils.GenerateUUID()
	}
	oldConfig.DateAdded = time.Now().Format("02/01/2006 03:04:05 p. m.")
	oldConfig.LastChecked = oldConfig.DateAdded
	oldConfig.CustomName = modName

	data, err := json.MarshalIndent(oldConfig, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(targetPath, ".modconfig.json"), data, 0644)
}

// createModConfig creates .modconfig.json file in mod directory
func (s *Service) createModConfig(modPath string, modName string, gameBananaUrl string) error {
	configPath := filepath.Join(modPath, ".modconfig.json")
	jasmPath := filepath.Join(modPath, ".JASM_ModConfig.json")

	// Check if .JASM_ModConfig.json exists
	if data, err := os.ReadFile(jasmPath); err == nil {
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

			data, err := json.MarshalIndent(config, "", "  ")
			if err != nil {
				return err
			}
			return os.WriteFile(configPath, data, 0644)
		}
	}

	// Generate UUID
	id := utils.GenerateUUID()
	now := time.Now().Format("02/01/2006 03:04:05 p. m.")

	config := ModConfig{
		Id:          id,
		CustomName:  modName,
		Author:      "",
		ModUrl:      gameBananaUrl,
		ImagePath:   ".JASM_Cover.jpg", // Default value
		Description: "",
		DateAdded:   now,
		LastChecked: now,
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// RemoveMod removes a mod
func (s *Service) RemoveMod(characterName string, modName string) error {
	modsPath := s.configService.CurrentModsPath()
	characterPath := filepath.Join(modsPath, "character", characterName)

	// Try to remove both versions (active and inactive)
	activePath := filepath.Join(characterPath, modName)
	disabledPath := filepath.Join(characterPath, "DISABLED_"+modName)

	os.RemoveAll(activePath)
	os.RemoveAll(disabledPath)

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
					// Local date format: "02/01/2006 03:04:05 p. m." (from createModConfig)
					// We need to normalize "p. m." to "PM" and "a. m." to "AM" for Go's parser
					normalizedDate := strings.ReplaceAll(config.DateAdded, "p. m.", "PM")
					normalizedDate = strings.ReplaceAll(normalizedDate, "a. m.", "AM")

					localTime, err := time.Parse("02/01/2006 03:04:05 PM", normalizedDate)
					if err != nil {
						// Try fallback to standard format just in case
						localTime, err = time.Parse("2006-01-02 15:04:05", config.DateAdded)
						if err != nil {
							fmt.Printf("Error parsing local date %s: %v\n", config.DateAdded, err)
							continue
						}
					}

					// Remote date format (ISO 8601 from JSON-LD): "2024-09-10T19:33:05+00:00"
					remoteTime, err := time.Parse(time.RFC3339, remoteDate)
					if err != nil {
						fmt.Printf("Error parsing remote date %s: %v\n", remoteDate, err)
						continue
					}

					// Compare dates
					if remoteTime.After(localTime) {
						updates = append(updates, ModUpdate{
							CharacterName: charName,
							ModName:       mod.Name,
							ModUrl:        config.ModUrl,
							LocalDate:     config.DateAdded,
							RemoteDate:    remoteTime.Format("2006-01-02 15:04:05"),
						})
					}
				}
			}
		}
	}

	return updates, nil
}

// fetchGameBananaDate fetches the modification date from a GameBanana URL
func (s *Service) fetchGameBananaDate(url string) (string, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	// Set User-Agent to avoid being blocked
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("received status code %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// Extract JSON-LD
	// Look for <script type="application/ld+json"> containing "dateModified"
	// Simple regex to find the dateModified field in the JSON-LD block
	// This is a bit hacky but avoids a full HTML parser dependency for now
	re := regexp.MustCompile(`"dateModified"\s*:\s*"([^"]+)"`)
	matches := re.FindStringSubmatch(string(body))

	if len(matches) > 1 {
		return matches[1], nil
	}

	return "", fmt.Errorf("dateModified not found in page")
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
