package character

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"tsunagu/pkg/config"
	"tsunagu/pkg/mod"
)

type Skin struct {
	Name   string `json:"name"`
	Folder string `json:"folder"`
}

type Character struct {
	Name      string    `json:"name"`
	Mods      []mod.Mod `json:"mods"`
	HasFolder bool      `json:"hasFolder"`
	Skins     []Skin    `json:"skins"`
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

// CharacterDefinition represents an entry in characters.json
// It can be a simple string (name) or an object with name and skins
type CharacterDefinition struct {
	Name  string `json:"name"`
	Skins []Skin `json:"skins"`
}

// UnmarshalJSON implements custom unmarshaling for CharacterDefinition
// to support both string and object formats
func (cd *CharacterDefinition) UnmarshalJSON(data []byte) error {
	// Try as string first
	var name string
	if err := json.Unmarshal(data, &name); err == nil {
		cd.Name = name
		return nil
	}

	// Try as object
	type Alias CharacterDefinition
	var aux Alias
	if err := json.Unmarshal(data, &aux); err == nil {
		cd.Name = aux.Name
		cd.Skins = aux.Skins
		return nil
	}

	return fmt.Errorf("invalid character definition")
}

// LoadCharactersList loads the list of characters from JSON
func (s *Service) LoadCharactersList() ([]CharacterDefinition, error) {
	data, err := os.ReadFile(s.charsPath)

	// Default structure for new files (using simple strings for backward compatibility in default)
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

		// Convert default strings to CharacterDefinitions
		var result []CharacterDefinition
		if list, ok := defaultChars[selectedGame]; ok {
			for _, name := range list {
				result = append(result, CharacterDefinition{Name: name})
			}
		}
		return result, nil
	}

	// Try to decode with new structure (map of lists of CharacterDefinition)
	var charactersMap map[string][]CharacterDefinition
	if err := json.Unmarshal(data, &charactersMap); err == nil {
		if list, ok := charactersMap[selectedGame]; ok {
			return list, nil
		}
		// If key doesn't exist, return defaults
		if def, ok := defaultChars[selectedGame]; ok {
			var result []CharacterDefinition
			for _, name := range def {
				result = append(result, CharacterDefinition{Name: name})
			}
			return result, nil
		}
		return []CharacterDefinition{}, nil
	}

	// Fallback: Try to decode as map of strings (old format)
	var oldMap map[string][]string
	if err := json.Unmarshal(data, &oldMap); err == nil {
		if list, ok := oldMap[selectedGame]; ok {
			var result []CharacterDefinition
			for _, name := range list {
				result = append(result, CharacterDefinition{Name: name})
			}
			return result, nil
		}
	}

	// Fallback: Try as old list (only Genshin, array of strings)
	var oldList []string
	if err := json.Unmarshal(data, &oldList); err == nil {
		// It's the old format, assume it's Genshin
		// Preserve old list as 'genshin'
		defaultChars["genshin"] = oldList

		data, _ = json.MarshalIndent(defaultChars, "", "  ")
		os.WriteFile(s.charsPath, data, 0644)

		// Return list corresponding to selected game
		if list, ok := defaultChars[selectedGame]; ok {
			var result []CharacterDefinition
			for _, name := range list {
				result = append(result, CharacterDefinition{Name: name})
			}
			return result, nil
		}
		return []CharacterDefinition{}, nil
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
	charDefs, err := s.LoadCharactersList()
	if err != nil {
		return nil, err
	}

	// Get existing folders in mods/character
	characterPath := filepath.Join(modsPath, "character")
	existingFolders := make(map[string]bool)
	entries, err := os.ReadDir(characterPath)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				existingFolders[strings.ToLower(entry.Name())] = true
			}
		}
	}

	var characters []Character

	for _, charDef := range charDefs {
		// Process skins to enforce naming convention
		var processedSkins []Skin
		for _, skin := range charDef.Skins {
			// Construct folder name: {Character}_skin_{SkinFolder}
			// e.g. Arlecchino + boss -> arlecchino_skin_boss (all lowercase)
			// We only apply this if the folder doesn't already look like a full path (simple heuristic)
			// But user requested "automatic construction based on character", so we enforce it.

			// If folder is empty, skip or default? Assuming required.
			if skin.Folder != "" {
				processedSkin := skin
				processedSkin.Folder = strings.ToLower(fmt.Sprintf("%s_skin_%s", charDef.Name, skin.Folder))
				processedSkins = append(processedSkins, processedSkin)
			}
		}

		// Normalize character name for folder operations (all lowercase)
		normalizedName := strings.ToLower(charDef.Name)

		character := Character{
			Name:      charDef.Name, // Keep original name for display in UI
			Mods:      []mod.Mod{},
			HasFolder: existingFolders[normalizedName],
			Skins:     processedSkins,
		}

		// If folder exists, load mods (for the main character folder)
		if character.HasFolder {
			mods, err := s.modService.GetModsForCharacter(normalizedName)
			if err == nil {
				character.Mods = mods
			}
		}

		// Also load mods from all skins and add them to the total count
		for _, skin := range processedSkins {
			skinMods, err := s.modService.GetModsForCharacter(skin.Folder)
			if err == nil && len(skinMods) > 0 {
				// Append skin mods to the character's mod list for counting purposes
				character.Mods = append(character.Mods, skinMods...)
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

// ReloadCharacters forces a reload of the character database
// This is called after updating characters.json from external sources
func (s *Service) ReloadCharacters() {
	// The next call to LoadCharactersList() or GetCharacters() will automatically
	// read the updated characters.json file, so we don't need to cache anything
	// This method exists as a placeholder for future optimization if we add caching
}
