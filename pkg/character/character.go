package character

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"modManager/pkg/config"
	"modManager/pkg/mod"
)

type Character struct {
	Name      string    `json:"name"`
	Mods      []mod.Mod `json:"mods"`
	HasFolder bool      `json:"hasFolder"`
}

type Service struct {
	charsPath     string
	configService *config.Service
	modService    *mod.Service
}

func NewService(cfg *config.Service, modSvc *mod.Service) *Service {
	return &Service{
		charsPath:     filepath.Join(".", "characters.json"),
		configService: cfg,
		modService:    modSvc,
	}
}

// LoadCharactersList loads the list of characters from JSON
func (s *Service) LoadCharactersList() ([]string, error) {
	data, err := os.ReadFile(s.charsPath)

	// Default structure for new files
	defaultChars := map[string][]string{
		"genshin": {
			"arlecchino", "clorinde", "furina", "raiden shogun",
			"ganyu", "jean", "lisa", "kujou sara", "ningguang",
			"eula", "yelan", "yae miko", "xilonen", "skirk", "mavulka", "deliya",
		},
		"wuwa": {
			"jinhsi", "yinlin", "changli", "jiyan",
		},
		"hsr": {
			"kafka", "black swan", "acheron", "firefly",
		},
		"zzz": {
			"ellen", "zhu yuan", "jane doe",
		},
	}

	selectedGame := s.configService.GetCurrentGame()

	if err != nil {
		// If file doesn't exist, create a default one
		data, _ = json.MarshalIndent(defaultChars, "", "  ")
		os.WriteFile(s.charsPath, data, 0644)
		return defaultChars[selectedGame], nil
	}

	// Try to decode with new structure (map)
	var charactersMap map[string][]string
	if err := json.Unmarshal(data, &charactersMap); err == nil {
		// If current game is in map, return list
		if list, ok := charactersMap[selectedGame]; ok {
			return list, nil
		}
		// If key doesn't exist, return defaults if we have them, or empty
		if def, ok := defaultChars[selectedGame]; ok {
			return def, nil
		}
		return []string{}, nil
	}

	// If fails, try as old list (only Genshin)
	var oldList []string
	if err := json.Unmarshal(data, &oldList); err == nil {
		// It's the old format, assume it's Genshin
		// Migrate file to new format in memory and save

		// Preserve old list as 'genshin'
		defaultChars["genshin"] = oldList

		data, _ = json.MarshalIndent(defaultChars, "", "  ")
		os.WriteFile(s.charsPath, data, 0644)

		// Return list corresponding to selected game
		if list, ok := defaultChars[selectedGame]; ok {
			return list, nil
		}
		return []string{}, nil
	}

	return nil, fmt.Errorf("formato de characters.json desconocido")
}

// GetCharacters gets all characters with their info
func (s *Service) GetCharacters() ([]Character, error) {
	modsPath := s.configService.CurrentModsPath()
	if modsPath == "" || !isDir(modsPath) {
		return []Character{}, nil
	}

	// Load character list from JSON
	charList, err := s.LoadCharactersList()
	if err != nil {
		return nil, err
	}

	// Get existing folders in mods
	existingFolders := make(map[string]bool)
	entries, err := os.ReadDir(modsPath)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				existingFolders[strings.ToLower(entry.Name())] = true
			}
		}
	}

	var characters []Character

	for _, charName := range charList {
		character := Character{
			Name:      charName,
			Mods:      []mod.Mod{},
			HasFolder: existingFolders[strings.ToLower(charName)],
		}

		// If folder exists, load mods
		if character.HasFolder {
			mods, err := s.modService.GetModsForCharacter(charName)
			if err == nil {
				character.Mods = mods
			}
		}

		characters = append(characters, character)
	}

	// Sort by name
	sort.Slice(characters, func(i, j int) bool {
		return characters[i].Name < characters[j].Name
	})

	return characters, nil
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}
