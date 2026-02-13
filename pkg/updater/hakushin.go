package updater

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
)

const (
	GenshinAPI = "https://api.hakush.in/gi/data/character.json"
	HSRAPI     = "https://api.hakush.in/hsr/data/character.json"
	WuWaAPI    = "https://api.hakush.in/ww/data/character.json"
	ZZZAPI     = "https://api.hakush.in/zzz/data/character.json"
)

// API response structures for different games

// GenshinCharacterData represents a character from Genshin API (no skins)
type GenshinCharacterData struct {
	EN string `json:"EN"`
}

// HSRCharacterData represents a character from HSR API (no skins)
type HSRCharacterData struct {
	EN string `json:"en"`
}

// WuWaCharacterData represents a character from WuWa API (no skins)
type WuWaCharacterData struct {
	EN string `json:"en"`
}

// ZZZCharacterData represents a character from ZZZ API (includes skins)
type ZZZCharacterData struct {
	EN   string                 `json:"EN"`
	Skin map[string]ZZZSkinData `json:"skin"`
}

// ZZZSkinData represents skin information from ZZZ API
type ZZZSkinData struct {
	Name string `json:"Name"`
}

// FetchGenshinCharacters fetches all Genshin Impact characters from hakush.in API
func FetchGenshinCharacters() ([]Character, error) {
	resp, err := http.Get(GenshinAPI)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Genshin characters: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Genshin API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read Genshin response: %w", err)
	}

	var data map[string]GenshinCharacterData
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse Genshin JSON: %w", err)
	}

	characters := []Character{}
	for _, char := range data {
		// Skip empty names or traveler variants
		if char.EN != "" && char.EN != "Traveler" {
			characters = append(characters, Character{
				Name: char.EN,
			})
		}
	}

	// Sort alphabetically for consistency
	sort.Slice(characters, func(i, j int) bool {
		return characters[i].Name < characters[j].Name
	})

	return characters, nil
}

// FetchHSRCharacters fetches all Honkai: Star Rail characters from hakush.in API
func FetchHSRCharacters() ([]Character, error) {
	resp, err := http.Get(HSRAPI)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch HSR characters: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HSR API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read HSR response: %w", err)
	}

	var data map[string]HSRCharacterData
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse HSR JSON: %w", err)
	}

	characters := []Character{}
	for _, char := range data {
		if char.EN != "" && char.EN != "Trailblazer" {
			characters = append(characters, Character{
				Name: char.EN,
			})
		}
	}

	sort.Slice(characters, func(i, j int) bool {
		return characters[i].Name < characters[j].Name
	})

	return characters, nil
}

// FetchWuWaCharacters fetches all Wuthering Waves characters from hakush.in API
func FetchWuWaCharacters() ([]Character, error) {
	resp, err := http.Get(WuWaAPI)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch WuWa characters: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("WuWa API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read WuWa response: %w", err)
	}

	var data map[string]WuWaCharacterData
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse WuWa JSON: %w", err)
	}

	characters := []Character{}
	for _, char := range data {
		if char.EN != "" && char.EN != "Rover" {
			characters = append(characters, Character{
				Name: char.EN,
			})
		}
	}

	sort.Slice(characters, func(i, j int) bool {
		return characters[i].Name < characters[j].Name
	})

	return characters, nil
}

// FetchZZZCharacters fetches all Zenless Zone Zero characters WITH skins from hakush.in API
func FetchZZZCharacters() ([]Character, error) {
	resp, err := http.Get(ZZZAPI)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch ZZZ characters: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ZZZ API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read ZZZ response: %w", err)
	}

	var data map[string]ZZZCharacterData
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse ZZZ JSON: %w", err)
	}

	characters := []Character{}
	for _, char := range data {
		if char.EN == "" {
			continue
		}

		// Convert skins from map to slice
		skins := []Skin{}
		for skinID, skinData := range char.Skin {
			if skinData.Name != "" {
				skins = append(skins, Skin{
					Name:   skinData.Name,
					Folder: skinID, // Use skin ID as folder name
				})
			}
		}

		// Sort skins alphabetically
		sort.Slice(skins, func(i, j int) bool {
			return skins[i].Name < skins[j].Name
		})

		characters = append(characters, Character{
			Name:  char.EN,
			Skins: skins,
		})
	}

	sort.Slice(characters, func(i, j int) bool {
		return characters[i].Name < characters[j].Name
	})

	return characters, nil
}
