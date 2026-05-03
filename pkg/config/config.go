package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type GameConfig struct {
	ModsPath       string `json:"modsPath"`
	ExecutablePath string `json:"executablePath"`
}

type Config struct {
	Games        map[string]GameConfig `json:"games"`
	SelectedGame string                `json:"selectedGame"`
}

type Service struct {
	configPath   string
	config       Config
	selectedGame string
}

func NewService() *Service {
	return &Service{
		configPath: filepath.Join(".", "config.json"),
		config: Config{
			Games: make(map[string]GameConfig),
		},
		selectedGame: "genshin", // Default
	}
}

// LoadConfig loads the saved configuration
func (s *Service) LoadConfig() {
	data, err := os.ReadFile(s.configPath)
	if err == nil {
		// Try to decode with new structure
		var newConfig Config
		if err := json.Unmarshal(data, &newConfig); err == nil && newConfig.Games != nil {
			s.config = newConfig
			if s.config.SelectedGame != "" {
				s.selectedGame = s.config.SelectedGame
			}
			return
		}

		// If fails, try to migrate old config
		var oldConfig struct {
			ModsPath string `json:"modsPath"`
		}
		if err := json.Unmarshal(data, &oldConfig); err == nil {
			// Migrate
			s.config.Games = make(map[string]GameConfig)
			if oldConfig.ModsPath != "" {
				s.config.Games["genshin"] = GameConfig{ModsPath: oldConfig.ModsPath}
			}
			s.config.SelectedGame = "genshin"
			s.selectedGame = "genshin"
			s.SaveConfig() // Save new format
		}
	} else {
		// Initialize if not exists
		s.config.Games = make(map[string]GameConfig)
		s.config.SelectedGame = "genshin"
	}
}

// SaveConfig saves the full configuration
func (s *Service) SaveConfig() error {
	data, err := json.MarshalIndent(s.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.configPath, data, 0644)
}

// SetGame changes the selected game
func (s *Service) SetGame(game string) string {
	s.selectedGame = game
	s.config.SelectedGame = game
	s.SaveConfig()
	return s.selectedGame
}

// GetCurrentGame gets the current game
func (s *Service) GetCurrentGame() string {
	return s.selectedGame
}

// GetGamesConfig gets the configuration for all games
func (s *Service) GetGamesConfig() Config {
	return s.config
}

// UpdateGamePath updates the mods path for a specific game
func (s *Service) UpdateGamePath(game string, path string) error {
	if s.config.Games == nil {
		s.config.Games = make(map[string]GameConfig)
	}
	gameConf := s.config.Games[game]
	gameConf.ModsPath = path
	s.config.Games[game] = gameConf
	return s.SaveConfig()
}

// UpdateGameExecutable updates the executable path for a specific game
func (s *Service) UpdateGameExecutable(game string, path string) error {
	if s.config.Games == nil {
		s.config.Games = make(map[string]GameConfig)
	}
	gameConf := s.config.Games[game]
	gameConf.ExecutablePath = path
	s.config.Games[game] = gameConf
	return s.SaveConfig()
}

// CurrentModsPath helper to get the current mods path
func (s *Service) CurrentModsPath() string {
	if config, ok := s.config.Games[s.selectedGame]; ok {
		return config.ModsPath
	}
	return ""
}
