package updater

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

// UpdateCharacterDatabase fetches character data from all games and merges with existing data
// Progress updates are sent via the callback function
func UpdateCharacterDatabase(progressCallback func(string)) (*UpdateResult, error) {
	result := &UpdateResult{}

	// 1. Load existing data
	progressCallback("Loading existing database...")
	existing, err := loadExistingCharacters()
	if err != nil {
		// If file doesn't exist, start with empty database
		existing = &CharactersDatabase{
			Genshin: []Character{},
			HSR:     []Character{},
			WuWa:    []Character{},
			ZZZ:     []Character{},
		}
	}

	// 2. Fetch from all APIs in parallel
	var wg sync.WaitGroup
	var mu sync.Mutex
	var genshinNew, hsrNew, wuwaNew, zzzNew []Character
	errors := []string{}

	wg.Add(4)

	// Fetch Genshin
	go func() {
		defer wg.Done()
		progressCallback("Fetching Genshin Impact characters...")
		chars, err := FetchGenshinCharacters()
		if err != nil {
			mu.Lock()
			errors = append(errors, fmt.Sprintf("Genshin: %v", err))
			mu.Unlock()
		} else {
			genshinNew = chars
		}
	}()

	// Fetch HSR
	go func() {
		defer wg.Done()
		progressCallback("Fetching Honkai: Star Rail characters...")
		chars, err := FetchHSRCharacters()
		if err != nil {
			mu.Lock()
			errors = append(errors, fmt.Sprintf("HSR: %v", err))
			mu.Unlock()
		} else {
			hsrNew = chars
		}
	}()

	// Fetch WuWa
	go func() {
		defer wg.Done()
		progressCallback("Fetching Wuthering Waves characters...")
		chars, err := FetchWuWaCharacters()
		if err != nil {
			mu.Lock()
			errors = append(errors, fmt.Sprintf("WuWa: %v", err))
			mu.Unlock()
		} else {
			wuwaNew = chars
		}
	}()

	// Fetch ZZZ
	go func() {
		defer wg.Done()
		progressCallback("Fetching Zenless Zone Zero characters and skins...")
		chars, err := FetchZZZCharacters()
		if err != nil {
			mu.Lock()
			errors = append(errors, fmt.Sprintf("ZZZ: %v", err))
			mu.Unlock()
		} else {
			zzzNew = chars
		}
	}()

	wg.Wait()

	// 3. Merge data (NEVER DELETE existing characters)
	progressCallback("Merging data...")

	var stats1, stats2, stats3, stats4 MergeStats
	merged := &CharactersDatabase{
		Genshin: mergeCharacters(existing.Genshin, genshinNew, &stats1),
		HSR:     mergeCharacters(existing.HSR, hsrNew, &stats2),
		WuWa:    mergeCharacters(existing.WuWa, wuwaNew, &stats3),
		ZZZ:     mergeCharactersWithSkins(existing.ZZZ, zzzNew, &stats4),
	}

	result.NewCharacters = stats1.New + stats2.New + stats3.New + stats4.New
	result.UpdatedCharacters = stats1.Updated + stats2.Updated + stats3.Updated + stats4.Updated
	result.TotalCharacters = len(merged.Genshin) + len(merged.HSR) + len(merged.WuWa) + len(merged.ZZZ)
	result.Errors = errors

	// 4. Save to characters.json
	progressCallback("Saving updated database...")
	if err := saveCharactersJSON(merged); err != nil {
		return nil, fmt.Errorf("failed to save characters.json: %w", err)
	}

	progressCallback("Update complete!")
	return result, nil
}

// mergeCharacters merges scraped characters with existing ones WITHOUT deleting
// Used for Genshin/HSR/WuWa which don't have skin data in API
func mergeCharacters(existing, scraped []Character, stats *MergeStats) []Character {
	merged := make(map[string]Character)

	// Add all existing characters (preserves manually-added skins)
	for _, char := range existing {
		merged[char.Name] = char
	}

	// Add new characters from API
	for _, char := range scraped {
		if _, exists := merged[char.Name]; !exists {
			merged[char.Name] = char
			stats.New++
		}
		// If character already exists, keep the existing one (with skins)
	}

	// Convert map to slice
	result := []Character{}
	for _, char := range merged {
		result = append(result, char)
	}

	return result
}

// mergeCharactersWithSkins merges ZZZ characters WITH skin data from API
func mergeCharactersWithSkins(existing, scraped []Character, stats *MergeStats) []Character {
	merged := make(map[string]Character)

	// Add existing characters
	for _, char := range existing {
		merged[char.Name] = char
	}

	// Merge scraped characters (update skins if character exists)
	for _, char := range scraped {
		if existingChar, exists := merged[char.Name]; exists {
			// Character exists - merge skins
			mergedSkins := mergeSkins(existingChar.Skins, char.Skins)
			merged[char.Name] = Character{
				Name:  char.Name,
				Skins: mergedSkins,
			}
			if len(mergedSkins) > len(existingChar.Skins) {
				stats.Updated++
			}
		} else {
			// New character
			merged[char.Name] = char
			stats.New++
		}
	}

	// Convert map to slice
	result := []Character{}
	for _, char := range merged {
		result = append(result, char)
	}

	return result
}

// mergeSkins combines existing and new skins, avoiding duplicates
func mergeSkins(existing, new []Skin) []Skin {
	skinMap := make(map[string]Skin)

	// Add existing skins
	for _, skin := range existing {
		skinMap[skin.Name] = skin
	}

	// Add new skins (may override if same name)
	for _, skin := range new {
		skinMap[skin.Name] = skin
	}

	// Convert map to slice
	result := []Skin{}
	for _, skin := range skinMap {
		result = append(result, skin)
	}

	return result
}

// loadExistingCharacters reads characters.json from disk
func loadExistingCharacters() (*CharactersDatabase, error) {
	data, err := os.ReadFile("characters.json")
	if err != nil {
		return nil, err
	}

	var db CharactersDatabase
	if err := json.Unmarshal(data, &db); err != nil {
		return nil, err
	}

	return &db, nil
}

// saveCharactersJSON writes the character database to characters.json
func saveCharactersJSON(db *CharactersDatabase) error {
	data, err := json.MarshalIndent(db, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile("characters.json", data, 0644)
}
