// app.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx        context.Context
	modsPath   string // Ruta de la carpeta 'mods' de 3DMigoto
	configPath string // Ruta para guardar la configuración
	charsPath  string // Ruta del archivo characters.json
}

type Config struct {
	ModsPath string `json:"modsPath"`
}

type Character struct {
	Name      string `json:"name"`
	Mods      []Mod  `json:"mods"`
	HasFolder bool   `json:"hasFolder"` // Indica si existe carpeta en el sistema
}

type Mod struct {
	ID        string `json:"id"`
	Character string `json:"character"`
	Name      string `json:"name"`
	IsActive  bool   `json:"isActive"`
	FullPath  string `json:"fullPath"`
}

func NewApp() *App {
	return &App{}
}

// startup se ejecuta al iniciar la aplicación
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.configPath = filepath.Join(".", "config.json")
	a.charsPath = filepath.Join(".", "characters.json")
	a.loadConfig()
}

// loadConfig carga la configuración guardada
func (a *App) loadConfig() {
	data, err := os.ReadFile(a.configPath)
	if err == nil {
		var config Config
		json.Unmarshal(data, &config)
		a.modsPath = config.ModsPath
	}
}

// SaveConfig guarda la ruta de 3DMigoto
func (a *App) SaveConfig(modsPath string) error {
	a.modsPath = modsPath

	config := Config{ModsPath: modsPath}
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}

	return os.WriteFile(a.configPath, data, 0644)
}

// SelectDirectory abre el selector de carpetas del sistema
func (a *App) SelectDirectory() (string, error) {
	dialogOptions := runtime.OpenDialogOptions{
		Title: "Seleccionar carpeta de mods de 3DMigoto",
	}

	selectedDirectory, err := runtime.OpenDirectoryDialog(a.ctx, dialogOptions)
	if err != nil {
		return "", err
	}

	return selectedDirectory, nil
}

// IsConfigured verifica si la aplicación está configurada
func (a *App) IsConfigured() bool {
	return a.modsPath != "" && isDirectory(a.modsPath)
}

// LoadCharactersList carga la lista de personajes desde el JSON
func (a *App) LoadCharactersList() ([]string, error) {
	data, err := os.ReadFile(a.charsPath)
	if err != nil {
		// Si el archivo no existe, crear uno por defecto
		defaultChars := []string{
			"arlecchino", "clorinde", "furina", "raiden shogun",
			"ganyu", "jean", "lisa", "kujou sara", "ningguang",
			"eula", "yelan", "yae miko", "xilonen", "skirk", "mavulka", "deliya",
		}
		data, _ = json.MarshalIndent(defaultChars, "", "  ")
		os.WriteFile(a.charsPath, data, 0644)
		return defaultChars, nil
	}

	var characters []string
	err = json.Unmarshal(data, &characters)
	if err != nil {
		return nil, err
	}

	return characters, nil
}

// GetCharacters obtiene todos los personajes con su información
func (a *App) GetCharacters() ([]Character, error) {
	if !a.IsConfigured() {
		return []Character{}, nil
	}

	// Cargar lista de personajes desde JSON
	charList, err := a.LoadCharactersList()
	if err != nil {
		return nil, err
	}

	// Obtener carpetas existentes en mods
	existingFolders := make(map[string]bool)
	entries, err := os.ReadDir(a.modsPath)
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
			Mods:      []Mod{},
			HasFolder: existingFolders[strings.ToLower(charName)],
		}

		// Si existe la carpeta, cargar los mods
		if character.HasFolder {
			mods, err := a.getModsForCharacter(charName)
			if err == nil {
				character.Mods = mods
			}
		}

		characters = append(characters, character)
	}

	// Ordenar por nombre
	sort.Slice(characters, func(i, j int) bool {
		return characters[i].Name < characters[j].Name
	})

	return characters, nil
}

// getModsForCharacter obtiene los mods de un personaje específico
func (a *App) getModsForCharacter(characterName string) ([]Mod, error) {
	characterPath := filepath.Join(a.modsPath, characterName)
	var mods []Mod

	entries, err := os.ReadDir(characterPath)
	if err != nil {
		return mods, err
	}

	for _, modEntry := range entries {
		if modEntry.IsDir() {
			modName := modEntry.Name()
			isActive := !strings.HasPrefix(modName, "DISABLED_")

			// Obtener el nombre real del mod (sin DISABLED_)
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

			mods = append(mods, mod)
		}
	}

	// Ordenar mods por nombre
	sort.Slice(mods, func(i, j int) bool {
		return mods[i].Name < mods[j].Name
	})

	return mods, nil
}

// GetModsForCharacter obtiene los mods de un personaje (para el frontend)
func (a *App) GetModsForCharacter(characterName string) ([]Mod, error) {
	if !a.IsConfigured() {
		return []Mod{}, nil
	}

	return a.getModsForCharacter(characterName)
}

// ToggleMod activa/desactiva un mod
func (a *App) ToggleMod(characterName string, modName string) error {
	characterPath := filepath.Join(a.modsPath, characterName)
	activePath := filepath.Join(characterPath, modName)
	disabledPath := filepath.Join(characterPath, "DISABLED_"+modName)

	// Verificar si el mod está activo (sin DISABLED_)
	if _, err := os.Stat(activePath); err == nil {
		// Está activo → desactivar (renombrar a DISABLED_)
		return os.Rename(activePath, disabledPath)
	}

	// Verificar si el mod está inactivo (con DISABLED_)
	if _, err := os.Stat(disabledPath); err == nil {
		// Está inactivo → activar (quitar DISABLED_)
		return os.Rename(disabledPath, activePath)
	}

	return os.ErrNotExist
}

// ActivateSingleMod activa un mod y desactiva los demás del mismo personaje
func (a *App) ActivateSingleMod(characterName string, modName string) error {
	characterPath := filepath.Join(a.modsPath, characterName)

	// Primero desactivar todos los mods del personaje
	entries, err := os.ReadDir(characterPath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			currentModName := entry.Name()

			// Si es un mod activo (no tiene DISABLED_), desactivarlo
			if !strings.HasPrefix(currentModName, "DISABLED_") {
				disabledPath := filepath.Join(characterPath, "DISABLED_"+currentModName)
				if err := os.Rename(filepath.Join(characterPath, currentModName), disabledPath); err != nil {
					return err
				}
			}
		}
	}

	// Ahora activar el mod solicitado
	targetDisabledPath := filepath.Join(characterPath, "DISABLED_"+modName)
	targetActivePath := filepath.Join(characterPath, modName)

	// Si el mod está desactivado, activarlo
	if _, err := os.Stat(targetDisabledPath); err == nil {
		return os.Rename(targetDisabledPath, targetActivePath)
	}

	return nil
}

// AddMod agrega un nuevo mod (crea la carpeta del personaje si no existe)
func (a *App) AddMod(characterName string, modName string, sourcePath string) error {
	characterPath := filepath.Join(a.modsPath, characterName)
	targetPath := filepath.Join(characterPath, modName)

	// Crear directorio del personaje si no existe
	if err := os.MkdirAll(characterPath, 0755); err != nil {
		return err
	}

	// Crear directorio del mod
	if err := os.MkdirAll(targetPath, 0755); err != nil {
		return err
	}

	// Copiar archivos del mod
	return a.copyModFiles(sourcePath, targetPath)
}

// RemoveMod elimina un mod
func (a *App) RemoveMod(characterName string, modName string) error {
	characterPath := filepath.Join(a.modsPath, characterName)

	// Intentar eliminar ambas versiones (activa e inactiva)
	activePath := filepath.Join(characterPath, modName)
	disabledPath := filepath.Join(characterPath, "DISABLED_"+modName)

	os.RemoveAll(activePath)
	os.RemoveAll(disabledPath)

	return nil
}

// copyModFiles copia archivos de mod
func (a *App) copyModFiles(sourcePath, targetPath string) error {
	return filepath.Walk(sourcePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// Si hay error al acceder a un archivo, lo registramos pero continuamos
			fmt.Printf("Error accediendo a %s: %v\n", path, err)
			return nil
		}

		relPath, err := filepath.Rel(sourcePath, path)
		if err != nil {
			return err
		}

		targetFilePath := filepath.Join(targetPath, relPath)

		if info.IsDir() {
			// Si es una carpeta vacía, la creamos pero no fallamos si hay error
			if err := os.MkdirAll(targetFilePath, 0755); err != nil {
				fmt.Printf("Error creando directorio %s: %v\n", targetFilePath, err)
				return nil
			}
			return nil
		} else {
			// Intentar copiar el archivo, pero si falla continuamos con el siguiente
			input, err := os.ReadFile(path)
			if err != nil {
				fmt.Printf("Error leyendo archivo %s: %v\n", path, err)
				return nil
			}

			if err := os.WriteFile(targetFilePath, input, 0644); err != nil {
				fmt.Printf("Error escribiendo archivo %s: %v\n", targetFilePath, err)
				return nil
			}
		}

		return nil
	})
}

// Función auxiliar para verificar si es un directorio
func isDirectory(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

func (a *App) Greet(name string) (string, error) {
	return "Hello " + name, nil
}
