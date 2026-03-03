package gamebanana

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ModFile representa un archivo disponible para descargar
type ModFile struct {
	DownloadURL string    `json:"downloadUrl"`
	FileName    string    `json:"fileName"`
	FileSize    int64     `json:"fileSize"`
	MD5Checksum string    `json:"md5Checksum"`
	Description string    `json:"description"`
	FileID      int64     `json:"fileId"`
	DateAdded   time.Time `json:"dateAdded"`
}

// ModInfo contiene información básica del mod
type ModInfo struct {
	Name         string    `json:"name"`
	DateModified time.Time `json:"dateModified"`
	DateAdded    time.Time `json:"dateAdded"`
	Downloads    int64     `json:"downloads"`
	Views        int64     `json:"views"`
}

// DownloadProgress representa el progreso de una descarga
type DownloadProgress struct {
	BytesDownloaded int64   `json:"bytesDownloaded"`
	TotalBytes      int64   `json:"totalBytes"`
	Percentage      float64 `json:"percentage"`
	Speed           string  `json:"speed"`
}

// Client es el cliente HTTP para interactuar con GameBanana API
type Client struct {
	httpClient *http.Client
	cacheDir   string
}

// NewClient crea una nueva instancia del cliente GameBanana
func NewClient(cacheDir string) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:       10,
				IdleConnTimeout:    30 * time.Second,
				DisableCompression: false,
			},
		},
		cacheDir: cacheDir,
	}
}

// ExtractModID extrae el ID del mod desde una URL de GameBanana
func ExtractModID(modURL string) (string, error) {
	re := regexp.MustCompile(`gamebanana\.com/mods/(\d+)`)
	matches := re.FindStringSubmatch(modURL)
	if len(matches) < 2 {
		return "", fmt.Errorf("invalid GameBanana URL: %s", modURL)
	}
	return matches[1], nil
}

// GetModInfo obtiene información del mod incluyendo fecha de modificación
func (c *Client) GetModInfo(modID string) (*ModInfo, error) {
	// Usar solo campos válidos según la API de GameBanana
	// date = fecha de modificación (timestamp Unix)
	// udate = fecha de última actualización (timestamp Unix)
	url := fmt.Sprintf(
		"https://api.gamebanana.com/Core/Item/Data?itemtype=Mod&itemid=%s&fields=name,date,udate,downloads,views&return_keys=1",
		modID,
	)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch mod info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status code %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	modInfo := &ModInfo{}

	if name, ok := result["name"].(string); ok {
		modInfo.Name = name
	}

	// Parsear fecha de modificación/creación (timestamp Unix)
	// Según GameBanana API: "date" es la fecha de creación del mod
	if dateValue, ok := result["date"].(float64); ok {
		modInfo.DateAdded = time.Unix(int64(dateValue), 0)
	}

	// Parsear fecha de última actualización (timestamp Unix)
	// "udate" = update date - esta es la fecha que queremos para detectar updates
	if udateValue, ok := result["udate"].(float64); ok {
		modInfo.DateModified = time.Unix(int64(udateValue), 0)
	} else if dateValue, ok := result["date"].(float64); ok {
		// Fallback a "date" si no hay "udate"
		modInfo.DateModified = time.Unix(int64(dateValue), 0)
	}

	if downloads, ok := result["downloads"].(float64); ok {
		modInfo.Downloads = int64(downloads)
	}

	if views, ok := result["views"].(float64); ok {
		modInfo.Views = int64(views)
	}

	return modInfo, nil
}

// GetModFiles obtiene la lista de archivos disponibles para descargar
func (c *Client) GetModFiles(modID string) ([]ModFile, error) {
	url := fmt.Sprintf(
		"https://api.gamebanana.com/Core/Item/Data?itemtype=Mod&itemid=%s&fields=Files().aFiles()&return_keys=1",
		modID,
	)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch mod files: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status code %d: %s", resp.StatusCode, string(body))
	}

	// La respuesta viene en formato: {"Files().aFiles()": {"1609027": {...}, "1609028": {...}}}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Extraer el objeto de archivos (es un mapa, no un array)
	filesData, ok := result["Files().aFiles()"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected response format")
	}

	if len(filesData) == 0 {
		return nil, fmt.Errorf("no files available for this mod")
	}

	modFiles := make([]ModFile, 0, len(filesData))

	// Iterar sobre el mapa de archivos
	for fileID, fileData := range filesData {
		fileMap, ok := fileData.(map[string]interface{})
		if !ok {
			continue
		}

		modFile := ModFile{}

		// Usar el ID del archivo desde la clave del mapa
		if id, err := strconv.ParseInt(fileID, 10, 64); err == nil {
			modFile.FileID = id
		} else if idRow, ok := fileMap["_idRow"].(string); ok {
			if id, err := strconv.ParseInt(idRow, 10, 64); err == nil {
				modFile.FileID = id
			}
		} else if idRow, ok := fileMap["_idRow"].(float64); ok {
			modFile.FileID = int64(idRow)
		}

		if downloadURL, ok := fileMap["_sDownloadUrl"].(string); ok {
			modFile.DownloadURL = downloadURL
		}

		if fileName, ok := fileMap["_sFile"].(string); ok {
			modFile.FileName = fileName
		}

		if fileSize, ok := fileMap["_nFilesize"].(float64); ok {
			modFile.FileSize = int64(fileSize)
		}

		if md5, ok := fileMap["_sMd5Checksum"].(string); ok {
			modFile.MD5Checksum = md5
		}

		if description, ok := fileMap["_sDescription"].(string); ok {
			modFile.Description = description
		}

		// Parsear fecha de subida del archivo (timestamp Unix)
		if tsDateAdded, ok := fileMap["_tsDateAdded"].(float64); ok {
			modFile.DateAdded = time.Unix(int64(tsDateAdded), 0)
		}

		// Agregar versión si existe
		if version, ok := fileMap["_sVersion"].(string); ok {
			if modFile.Description != "" {
				modFile.Description = fmt.Sprintf("%s - %s", version, modFile.Description)
			} else {
				modFile.Description = version
			}
		}

		// Solo agregar archivos con URL de descarga válida
		if modFile.DownloadURL != "" && modFile.FileName != "" {
			modFiles = append(modFiles, modFile)
		}
	}

	if len(modFiles) == 0 {
		return nil, fmt.Errorf("no valid files found")
	}

	return modFiles, nil
}

// DownloadModFile descarga un archivo con reporte de progreso
func (c *Client) DownloadModFile(
	downloadURL, fileName string,
	progressCallback func(DownloadProgress),
) (string, error) {
	// Validar que la URL sea de GameBanana
	if !strings.Contains(downloadURL, "gamebanana.com") && !strings.Contains(downloadURL, "files.gamebanana.com") {
		return "", fmt.Errorf("invalid download URL: must be from gamebanana.com")
	}

	// Crear directorio de caché si no existe
	if err := os.MkdirAll(c.cacheDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create cache directory: %w", err)
	}

	// Sanitizar nombre de archivo
	safeFileName := sanitizeFileName(fileName)
	destPath := filepath.Join(c.cacheDir, safeFileName)

	// Crear request
	req, err := http.NewRequest("GET", downloadURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// Ejecutar request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to download file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download failed with status code %d", resp.StatusCode)
	}

	// Obtener tamaño total
	totalBytes := resp.ContentLength
	if totalBytes <= 0 {
		// Si no hay Content-Length, intentar parsear del header
		totalBytes = 0
	}

	// Crear archivo de destino
	out, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer out.Close()

	// Descargar con progreso
	var bytesDownloaded int64
	buffer := make([]byte, 32*1024) // 32KB buffer
	startTime := time.Now()
	lastUpdate := time.Now()

	for {
		n, err := resp.Body.Read(buffer)
		if n > 0 {
			bytesDownloaded += int64(n)
			if _, writeErr := out.Write(buffer[:n]); writeErr != nil {
				return "", fmt.Errorf("failed to write to file: %w", writeErr)
			}

			// Actualizar progreso cada 100ms
			if time.Since(lastUpdate) > 100*time.Millisecond && progressCallback != nil {
				elapsed := time.Since(startTime).Seconds()
				speed := float64(bytesDownloaded) / elapsed / 1024 / 1024 // MB/s

				progress := DownloadProgress{
					BytesDownloaded: bytesDownloaded,
					TotalBytes:      totalBytes,
					Percentage:      0,
					Speed:           fmt.Sprintf("%.2f MB/s", speed),
				}

				if totalBytes > 0 {
					progress.Percentage = float64(bytesDownloaded) / float64(totalBytes) * 100
				}

				progressCallback(progress)
				lastUpdate = time.Now()
			}
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("failed to read response: %w", err)
		}
	}

	// Enviar progreso final
	if progressCallback != nil {
		elapsed := time.Since(startTime).Seconds()
		speed := float64(bytesDownloaded) / elapsed / 1024 / 1024

		progressCallback(DownloadProgress{
			BytesDownloaded: bytesDownloaded,
			TotalBytes:      totalBytes,
			Percentage:      100,
			Speed:           fmt.Sprintf("%.2f MB/s", speed),
		})
	}

	return destPath, nil
}

// sanitizeFileName limpia caracteres inválidos del nombre de archivo
func sanitizeFileName(fileName string) string {
	// Reemplazar caracteres inválidos en Windows
	invalid := []string{"<", ">", ":", "\"", "/", "\\", "|", "?", "*"}
	result := fileName

	for _, char := range invalid {
		result = strings.ReplaceAll(result, char, "_")
	}

	// Limitar longitud del nombre
	if len(result) > 200 {
		ext := filepath.Ext(result)
		name := result[:200-len(ext)]
		result = name + ext
	}

	return result
}

// FormatBytes convierte bytes a formato legible (KB, MB, GB)
func FormatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}

	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// ParseGameBananaDate parsea diferentes formatos de fecha de GameBanana
func ParseGameBananaDate(dateStr string) (time.Time, error) {
	// Intentar parsear como timestamp Unix
	if timestamp, err := strconv.ParseInt(dateStr, 10, 64); err == nil {
		return time.Unix(timestamp, 0), nil
	}

	// Intentar parsear como ISO 8601
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, dateStr); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse date: %s", dateStr)
}
