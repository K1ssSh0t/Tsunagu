package updater

// Character represents a game character with optional skins
type Character struct {
	Name  string `json:"name"`
	Skins []Skin `json:"skins,omitempty"`
}

// Skin represents a character outfit/skin
type Skin struct {
	Name   string `json:"name"`
	Folder string `json:"folder"`
}

// CharactersDatabase holds all characters for all supported games
type CharactersDatabase struct {
	Genshin []Character `json:"genshin"`
	HSR     []Character `json:"hsr"`
	WuWa    []Character `json:"wuwa"`
	ZZZ     []Character `json:"zzz"`
}

// UpdateResult contains statistics about the update operation
type UpdateResult struct {
	NewCharacters     int      `json:"newCharacters"`
	UpdatedCharacters int      `json:"updatedCharacters"`
	TotalCharacters   int      `json:"totalCharacters"`
	Errors            []string `json:"errors,omitempty"`
}

// MergeStats tracks changes during merge operations
type MergeStats struct {
	New     int
	Updated int
}
