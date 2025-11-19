// app.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"crypto/rand"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golift.io/xtractr"
)

type App struct {
	ctx        context.Context
	configPath string
	modsPath   string
	charsPath  string
	tempZipDir string // Nuevo campo para almacenar el directorio temporal del ZIP
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

type ZipFile struct {
	Name     string     `json:"name"`
	IsDir    bool       `json:"isDir"`
	Path     string     `json:"path"`
	Children []*ZipFile `json:"children,omitempty"`
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
	dialogOptions := wailsruntime.OpenDialogOptions{
		Title: "Seleccionar carpeta de mods de 3DMigoto",
	}

	selectedDirectory, err := wailsruntime.OpenDirectoryDialog(a.ctx, dialogOptions)
	if err != nil {
		return "", err
	}

	return selectedDirectory, nil
}

// SelectFile abre el selector de archivos del sistema
func (a *App) SelectFile() (string, error) {
	dialogOptions := wailsruntime.OpenDialogOptions{
		Title:           "Seleccionar archivo de mod comprimido",
		DefaultFilename: "",
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "Archivos Comprimidos (*.zip, *.rar, *.7z)",
				Pattern:     "*.zip;*.rar;*.7z",
			},
		},
	}

	selectedFile, err := wailsruntime.OpenFileDialog(a.ctx, dialogOptions)
	if err != nil {
		return "", err
	}

	return selectedFile, nil
}

// OpenModFolder abre la carpeta del mod en el explorador de archivos del sistema
func (a *App) OpenModFolder(modPath string) error {

	// Verificar que la carpeta existe
	if _, err := os.Stat(modPath); os.IsNotExist(err) {
		return fmt.Errorf("la carpeta del mod no existe: %s", modPath)
	}

	// Abrir en el explorador de archivos del sistema usando comandos del SO
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", modPath)
	case "darwin":
		cmd = exec.Command("open", modPath)
	case "linux":
		cmd = exec.Command("xdg-open", modPath)
	default:
		return fmt.Errorf("sistema operativo no soportado: %s", runtime.GOOS)
	}

	return cmd.Start()
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
func (a *App) AddMod(characterName string, modName string, sourcePath string, gameBananaUrl string) error {
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
	if err := a.copyModFiles(sourcePath, targetPath); err != nil {
		return err
	}

	// Crear archivo de configuración del mod
	return a.createModConfig(targetPath, modName, gameBananaUrl)
}

// AddModFromZipWithRoot agrega un mod desde ZIP usando una raíz específica
func (a *App) AddModFromZipWithRoot(characterName string, modName string, zipFilePath string, selectedRoot string, gameBananaUrl string) error {
	// Verificar que tenemos un directorio temporal disponible
	if a.tempZipDir == "" {
		return fmt.Errorf("no temporary directory available. Please call GetZipStructure first")
	}

	characterPath := filepath.Join(a.modsPath, characterName)
	targetPath := filepath.Join(characterPath, modName)

	// Crear directorio del personaje si no existe
	if err := os.MkdirAll(characterPath, 0755); err != nil {
		return err
	}

	// Construir la ruta completa al directorio raíz seleccionado en el temp
	selectedRootPath := filepath.Join(a.tempZipDir, selectedRoot)

	// Verificar que el directorio seleccionado existe
	if _, err := os.Stat(selectedRootPath); os.IsNotExist(err) {
		return fmt.Errorf("selected root directory does not exist: %s", selectedRoot)
	}

	// Copiar archivos desde el directorio temporal ya extraído
	if err := a.copyModFiles(selectedRootPath, targetPath); err != nil {
		return err
	}

	// Limpiar el directorio temporal después de usarlo
	defer os.RemoveAll(a.tempZipDir)
	a.tempZipDir = ""

	// Crear archivo de configuración del mod
	return a.createModConfig(targetPath, modName, gameBananaUrl)
}

// createModConfig crea el archivo .modconfig.json en el directorio del mod
func (a *App) createModConfig(modPath string, modName string, gameBananaUrl string) error {
	configPath := filepath.Join(modPath, ".modconfig.json")

	// Generar UUID
	id := generateUUID()
	now := time.Now().Format("02/01/2006 03:04:05 p. m.")

	config := ModConfig{
		Id:          id,
		CustomName:  modName,
		Author:      "", // Por ahora vacío, podría ser un campo futuro
		ModUrl:      gameBananaUrl,
		ImagePath:   ".JASM_Cover.jpg", // Valor por defecto
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

// generateUUID genera un UUID v4 simple
func generateUUID() string {
	u := make([]byte, 16)
	_, err := rand.Read(u)
	if err != nil {
		return ""
	}

	u[6] = (u[6] & 0x0f) | 0x40 // Version 4
	u[8] = (u[8] & 0x3f) | 0x80 // Variant 10

	return fmt.Sprintf("%x-%x-%x-%x-%x", u[0:4], u[4:6], u[6:8], u[8:10], u[10:])
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
			return fmt.Errorf("error accediendo a %s: %v", path, err)
		}

		relPath, err := filepath.Rel(sourcePath, path)
		if err != nil {
			return err
		}

		targetFilePath := filepath.Join(targetPath, relPath)

		if info.IsDir() {
			// Si es una carpeta vacía, la creamos pero no fallamos si hay error
			if err := os.MkdirAll(targetFilePath, 0755); err != nil {
				return fmt.Errorf("error creando directorio %s: %v", targetFilePath, err)
			}
			return nil
		} else {
			// Intentar copiar el archivo, pero si falla continuamos con el siguiente
			input, err := os.ReadFile(path)
			if err != nil {
				return fmt.Errorf("error leyendo archivo %s: %v", path, err)
			}

			if err := os.WriteFile(targetFilePath, input, 0644); err != nil {
				return fmt.Errorf("error escribiendo archivo %s: %v", targetFilePath, err)
			}
		}

		return nil
	})
}

// extractArchive descomprime un archivo (zip, rar, 7z) en el directorio especificado
func (a *App) extractArchive(source, destination string) error {
	// Asegurarse de que el destino sea una ruta absoluta
	dest, err := filepath.Abs(destination)
	if err != nil {
		return fmt.Errorf("error getting absolute path for destination: %v", err)
	}

	// Configurar la extracción
	xfile := &xtractr.XFile{
		FilePath:  source,
		OutputDir: dest,
		FileMode:  0644, // Permisos para archivos extraídos
		DirMode:   0755, // Permisos para directorios extraídos
	}

	// Extraer el archivo
	_, files, arch, err := xtractr.ExtractFile(xfile)
	if err != nil || files == nil || arch == nil {
		return fmt.Errorf("error extracting archive: %v", err)
	}

	return nil
}

func isDirectory(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// GetZipStructure obtiene la estructura de archivos de un ZIP extrayéndolo a una carpeta temporal
func (a *App) GetZipStructure(zipFilePath string) ([]ZipFile, error) {
	// Limpiar directorio temporal anterior si existe
	if a.tempZipDir != "" {
		os.RemoveAll(a.tempZipDir)
	}

	// Crear directorio temporal para extraer el ZIP en el mismo directorio de ejecución
	tempDir, err := os.MkdirTemp(".", "zip-structure-*")
	if err != nil {
		return nil, fmt.Errorf("error creating temp directory: %v", err)
	}

	// Guardar la ruta temporal para uso posterior
	a.tempZipDir = tempDir

	// Extraer todo el ZIP al directorio temporal
	err = a.extractArchive(zipFilePath, tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		a.tempZipDir = ""
		return nil, fmt.Errorf("error extracting zip to temp directory: %v", err)
	}

	// Leer la estructura desde el sistema de archivos
	structure, err := a.buildStructureFromPath(tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		a.tempZipDir = ""
		return nil, fmt.Errorf("error building structure from temp directory: %v", err)
	}

	// NO limpiamos el directorio temporal aquí porque lo necesitaremos para AddModFromZipWithRoot

	return structure, nil
}

// buildStructureFromPath construye la estructura ZipFile desde una ruta del sistema de archivos
func (a *App) buildStructureFromPath(rootPath string) ([]ZipFile, error) {
	var result []ZipFile

	err := filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Obtener la ruta relativa desde el directorio raíz
		relPath, err := filepath.Rel(rootPath, path)
		if err != nil {
			return err
		}

		// Normalizar separadores a /
		normalizedPath := filepath.ToSlash(relPath)

		// Construir la entrada ZipFile
		zipFile := ZipFile{
			Name:     info.Name(),
			IsDir:    info.IsDir(),
			Path:     normalizedPath,
			Children: []*ZipFile{}, // Se llenará después
		}

		// Si es el directorio raíz, agregarlo al resultado
		if relPath == "." {
			return nil // Saltar el directorio raíz
		}

		result = append(result, zipFile)
		return nil
	})

	if err != nil {
		return nil, err
	}

	// Construir la estructura jerárquica
	return a.buildHierarchicalStructure(result), nil
}
func (a *App) buildHierarchicalStructure(files []ZipFile) []ZipFile {
	// Crear un mapa para acceso rápido
	fileMap := make(map[string]*ZipFile)

	// Primero, crear todas las entradas y guardar referencias
	for i := range files {
		fileMap[files[i].Path] = &files[i]
		fmt.Printf("DEBUG: Added to map: %s (isDir: %v)\n", files[i].Path, files[i].IsDir)
	}

	// Luego, construir la jerarquía
	var root []*ZipFile // Usar punteros para mantener las referencias
	for i := range files {
		file := &files[i]
		if !strings.Contains(file.Path, "/") {
			// Es un archivo/directorio raíz - agregar la referencia del mapa
			root = append(root, file)
			fmt.Printf("DEBUG: Root item: %s\n", file.Path)
		} else {
			// Tiene un padre
			parentPath := file.Path[:strings.LastIndex(file.Path, "/")]
			if parent, exists := fileMap[parentPath]; exists {
				// Agregar la referencia del mapa en lugar de la copia
				parent.Children = append(parent.Children, file)
				fmt.Printf("DEBUG: Added %s as child of %s\n", file.Path, parentPath)
			} else {
				fmt.Printf("DEBUG: Parent not found for %s (parent: %s)\n", file.Path, parentPath)
			}
		}
	}

	// Imprimir estructura final para depuración
	fmt.Printf("DEBUG: Final structure:\n")
	for _, item := range root {
		a.printZipFileStructure(*item, 0)
	}

	// Convertir a []ZipFile para el retorno
	result := make([]ZipFile, len(root))
	for i, item := range root {
		result[i] = *item
	}

	// Ordenar
	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDir != result[j].IsDir {
			return result[i].IsDir // Directorios primero
		}
		return result[i].Name < result[j].Name
	})

	// Ordenar recursivamente
	for i := range result {
		sortZipFileChildren(&result[i])
	}

	return result
}

// printZipFileStructure imprime la estructura para depuración
func (a *App) printZipFileStructure(file ZipFile, level int) {
	indent := strings.Repeat("  ", level)
	fmt.Printf("%s- %s (isDir: %v, children: %d)\n", indent, file.Path, file.IsDir, len(file.Children))
	for _, child := range file.Children {
		a.printZipFileStructure(*child, level+1)
	}
}

// sortZipFileChildren ordena recursivamente los hijos de un archivo ZIP
func sortZipFileChildren(file *ZipFile) {
	if len(file.Children) > 0 {
		sort.Slice(file.Children, func(i, j int) bool {
			if file.Children[i].IsDir != file.Children[j].IsDir {
				return file.Children[i].IsDir // Directorios primero
			}
			return file.Children[i].Name < file.Children[j].Name
		})

		// Ordenar recursivamente los hijos de cada hijo
		for i := range file.Children {
			sortZipFileChildren(file.Children[i])
		}
	}
}

func (a *App) Greet(name string) (string, error) {
	return "Hello " + name, nil
}

// CleanupTempDirectory limpia el directorio temporal del ZIP
func (a *App) CleanupTempDirectory() error {
	if a.tempZipDir != "" {
		err := os.RemoveAll(a.tempZipDir)
		a.tempZipDir = ""
		return err
	}
	return nil
}
