package mod

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"

	"tsunagu/pkg/utils"
)

// KeySwapInfo represents a single key binding section parsed from a .ini file.
// Covers [Key], [KeySwap], [KeyFace], [KeySwapDress], and any [Key*] variant.
type KeySwapInfo struct {
	SectionName  string `json:"sectionName"`  // e.g. "KeySwapDress", "Key"
	ForwardKey   string `json:"forwardKey"`   // value of "key"
	BackwardKey  string `json:"backwardKey"`  // value of "back"
	Type         string `json:"type"`         // value of "type" (e.g. "cycle")
	Variants     int    `json:"variants"`     // count of items in the $ variable
	Condition    string `json:"condition"`    // value of "condition" (e.g. "$active == 1")
	VariableName string `json:"variableName"` // name of the $ variable (e.g. "$face", "$swapvar")
}

// ParseKeySwapsFromModFolder scans all .ini files in the root of modPath
// and extracts KeySwap sections. Returns an empty slice if none are found.
// This function is read-only and never modifies any files.
func ParseKeySwapsFromModFolder(modPath string) []KeySwapInfo {
	entries, err := os.ReadDir(modPath)
	if err != nil {
		return nil
	}

	var allKeySwaps []KeySwapInfo

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := strings.ToLower(entry.Name())
		if !strings.HasSuffix(name, ".ini") {
			continue
		}

		iniPath := filepath.Join(modPath, entry.Name())
		keySwaps := parseIniFileForKeySwaps(iniPath)
		if len(keySwaps) > 0 {
			allKeySwaps = append(allKeySwaps, keySwaps...)
		}
	}

	if allKeySwaps == nil {
		return []KeySwapInfo{}
	}
	return allKeySwaps
}

// parseIniFileForKeySwaps reads a single .ini file and extracts all KeySwap sections.
func parseIniFileForKeySwaps(filePath string) []KeySwapInfo {
	file, err := os.Open(filePath)
	if err != nil {
		utils.LogWarn("Failed to open ini file for keyswap parsing: %s: %v", filePath, err)
		return nil
	}
	defer file.Close()

	var keySwaps []KeySwapInfo
	var currentSection string
	var currentSwap *KeySwapInfo
	inKeySwapSection := false

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, ";") {
			continue
		}

		// Check if this is a section header like [KeySwap] or [KeySwapDress]
		if isIniSection(line) {
			// If we were in a keyswap section, save it
			if inKeySwapSection && currentSwap != nil && currentSwap.hasValues() {
				keySwaps = append(keySwaps, *currentSwap)
			}

			currentSection = line
			if isKeySection(line) {
				inKeySwapSection = true
				currentSwap = &KeySwapInfo{
					SectionName: extractSectionName(line),
				}
			} else {
				inKeySwapSection = false
				currentSwap = nil
			}
			continue
		}

		// Parse key-value pairs inside a KeySwap section
		if inKeySwapSection && currentSwap != nil {
			_ = currentSection // used for context, section already captured
			parseKeySwapLine(line, currentSwap)
		}
	}

	// Don't forget the last section if the file ends without a new section
	if inKeySwapSection && currentSwap != nil && currentSwap.hasValues() {
		keySwaps = append(keySwaps, *currentSwap)
	}

	return keySwaps
}

// isIniSection checks if a line is an INI section header like [SectionName]
func isIniSection(line string) bool {
	return strings.HasPrefix(line, "[") && strings.Contains(line, "]")
}

// isKeySection checks if a section header is a key binding section.
// Matches [Key], [KeySwap], [KeyFace], [KeySwapDress], [KeyHair], etc.
// The section name (inside brackets) must start with "key" (case-insensitive).
func isKeySection(line string) bool {
	name := strings.ToLower(extractSectionName(line))
	return strings.HasPrefix(name, "key")
}

// extractSectionName extracts the section name from a header like "[KeySwapDress]"
func extractSectionName(line string) string {
	start := strings.Index(line, "[")
	end := strings.Index(line, "]")
	if start >= 0 && end > start {
		return line[start+1 : end]
	}
	return line
}

// parseKeySwapLine parses a single key=value line inside a Key/KeySwap section.
// Handles standard keys (key, back, type, condition) and any $variable line.
func parseKeySwapLine(line string, swap *KeySwapInfo) {
	// Split on first '=' only
	eqIdx := strings.Index(line, "=")
	if eqIdx < 0 {
		return
	}

	key := strings.TrimSpace(line[:eqIdx])
	value := strings.TrimSpace(line[eqIdx+1:])

	// Remove inline comments (anything after ;)
	if commentIdx := strings.Index(value, ";"); commentIdx >= 0 {
		value = strings.TrimSpace(value[:commentIdx])
	}

	switch strings.ToLower(key) {
	case "key":
		swap.ForwardKey = value
	case "back":
		swap.BackwardKey = value
	case "type":
		swap.Type = value
	case "condition":
		swap.Condition = value
	default:
		// Detect any $variable (e.g. $swapvar, $face, $dress, $hair)
		// These contain comma-separated variant values like "0,1,2"
		if strings.HasPrefix(key, "$") && value != "" && strings.Contains(value, ",") {
			swap.VariableName = key
			parts := strings.Split(value, ",")
			swap.Variants = len(parts)
		}
	}
}

// hasValues returns true if the KeySwapInfo has at least one key defined
func (k *KeySwapInfo) hasValues() bool {
	return k.ForwardKey != "" || k.BackwardKey != ""
}
