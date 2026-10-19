// Package updater implements the self-update flow for Tsunagu.
//
// The release pipeline (GitHub Actions) uploads one zip per platform with
// the executable and characters.json. The binary embeds its version and
// build time through -ldflags at build time, so it can tell whether a newer
// release exists in the GitHub repository.
package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"tsunagu/pkg/utils"
)

const (
	// DefaultRepo is the GitHub repository (owner/name) that hosts releases.
	DefaultRepo = "K1ssSh0t/Tsunagu"
	// RepoEnv overrides the repository (useful to test the flow against a
	// public test repository).
	RepoEnv = "TSUN_UPDATE_REPO"

	userAgent = "Tsunagu-Updater"
)

// Version, BuildTag and BuildTime are injected at build time:
//
//	-ldflags "-X tsunagu/pkg/updater.Version=1.9.0 -X tsunagu/pkg/updater.BuildTag=build-20261019-1-abc123 -X tsunagu/pkg/updater.BuildTime=2026-10-19T12:00:00Z"
//
// BuildTag must match the GitHub release tag of this build, so the app can
// tell that the newest release is the one it already runs.
var (
	Version   = "dev"
	BuildTag  = "dev"
	BuildTime = ""
)

// ErrNoAccess means the releases endpoint could not be reached with the
// current credentials (typically: the repository is private).
var ErrNoAccess = errors.New("no se pudo acceder a los releases del repositorio (¿es privado?)")

type asset struct {
	Name   string `json:"name"`
	URL    string `json:"browser_download_url"`
	Size   int64  `json:"size"`
	Digest string `json:"digest"`
}

type release struct {
	TagName    string    `json:"tag_name"`
	Name       string    `json:"name"`
	Body       string    `json:"body"`
	HTMLURL    string    `json:"html_url"`
	CreatedAt  time.Time `json:"created_at"`
	Draft      bool      `json:"draft"`
	Prerelease bool      `json:"prerelease"`
	Assets     []asset   `json:"assets"`
}

// VersionInfo describes the running build. It is exposed to the frontend.
type VersionInfo struct {
	Version   string `json:"version"`
	BuildTime string `json:"buildTime"`
	Platform  string `json:"platform"`
	Repo      string `json:"repo"`
}

// UpdateInfo describes the result of a release check. It is exposed to the
// frontend.
type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseName    string `json:"releaseName"`
	Notes          string `json:"notes"`
	ReleaseURL     string `json:"releaseUrl"`
	AssetName      string `json:"assetName"`
	AssetURL       string `json:"assetUrl"`
	AssetSize      int64  `json:"assetSize"`
	PublishedAt    string `json:"publishedAt"`
}

// Progress reports the status of a download/apply operation. It is exposed
// to the frontend through the "update:progress" event.
type Progress struct {
	Phase           string  `json:"phase"` // downloading | extracting | applying
	BytesDownloaded int64   `json:"bytesDownloaded"`
	TotalBytes      int64   `json:"totalBytes"`
	Percentage      float64 `json:"percentage"`
	Speed           string  `json:"speed"`
}

// Service checks, downloads and applies app updates.
type Service struct {
	repo     string
	apiBase  string
	client   *http.Client
	cacheDir string

	latest   *release
	info     *UpdateInfo
	zipPath  string
	stageDir string
}

// NewService creates the updater service. cacheDir is the base cache
// directory of the app (".cache"); updates are staged inside it.
func NewService(cacheDir string) *Service {
	repo := DefaultRepo
	if override := strings.TrimSpace(os.Getenv(RepoEnv)); override != "" {
		repo = override
	}
	return &Service{
		repo:     repo,
		apiBase:  "https://api.github.com",
		client:   &http.Client{Timeout: 15 * time.Minute},
		cacheDir: cacheDir,
	}
}

// AssetName returns the release asset that matches the running platform,
// or an empty string when the platform is not published. Releases only
// contain amd64 builds, so other architectures must not install them.
func AssetName() string {
	if runtime.GOARCH != "amd64" {
		return ""
	}
	switch runtime.GOOS {
	case "windows":
		return "Tsunagu-windows-amd64.zip"
	case "linux":
		return "Tsunagu-linux-amd64.zip"
	default:
		return ""
	}
}

func binaryName() string {
	if runtime.GOOS == "windows" {
		return "Tsunagu.exe"
	}
	return "Tsunagu"
}

// VersionInfo returns the version data of this build.
func (s *Service) VersionInfo() VersionInfo {
	buildTime := BuildTime
	if buildTime == "" {
		buildTime = "unknown"
	}
	return VersionInfo{
		Version:   displayVersion(),
		BuildTime: buildTime,
		Platform:  runtime.GOOS + "/" + runtime.GOARCH,
		Repo:      s.repo,
	}
}

func displayVersion() string {
	if strings.TrimSpace(Version) == "" {
		return "dev"
	}
	return Version
}

// Check looks for the newest release and decides whether it is newer than
// the running build. It returns ErrNoAccess when the repository cannot be
// read without credentials.
func (s *Service) Check(ctx context.Context) (*UpdateInfo, error) {
	rel, err := s.fetchLatestRelease(ctx)
	if err != nil {
		return nil, err
	}

	info := &UpdateInfo{
		CurrentVersion: displayVersion(),
		LatestVersion:  rel.TagName,
		ReleaseName:    rel.Name,
		Notes:          strings.TrimSpace(rel.Body),
		ReleaseURL:     rel.HTMLURL,
		PublishedAt:    rel.CreatedAt.Format(time.RFC3339),
	}

	if name := AssetName(); name != "" {
		for _, a := range rel.Assets {
			if a.Name == name {
				info.AssetName = a.Name
				info.AssetURL = a.URL
				info.AssetSize = a.Size
				break
			}
		}
	}

	info.Available = s.isNewer(rel) && info.AssetURL != ""
	s.latest = rel
	s.info = info
	return info, nil
}

// isNewer decides whether the release is newer than the running build. A
// different tag plus a release created after this binary was built counts
// as newer; dev builds always treat published releases as newer.
func (s *Service) isNewer(rel *release) bool {
	if rel == nil || rel.TagName == "" {
		return false
	}
	if rel.TagName == BuildTag {
		return false
	}
	if buildTime, err := time.Parse(time.RFC3339, BuildTime); err == nil {
		return rel.CreatedAt.After(buildTime)
	}
	return true
}

func (s *Service) fetchLatestRelease(ctx context.Context) (*release, error) {
	url := fmt.Sprintf("%s/repos/%s/releases?per_page=5", s.apiBase, s.repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("error preparando la consulta de actualizaciones: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", userAgent)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("no se pudo consultar GitHub: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return nil, ErrNoAccess
	case http.StatusForbidden:
		return nil, errors.New("GitHub rechazó la consulta (límite de peticiones alcanzado); inténtalo más tarde")
	default:
		return nil, fmt.Errorf("GitHub respondió %d al buscar actualizaciones", resp.StatusCode)
	}

	var releases []release
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("no se pudo leer la respuesta de GitHub: %w", err)
	}
	for i := range releases {
		if !releases[i].Draft {
			return &releases[i], nil
		}
	}
	return nil, errors.New("el repositorio todavía no tiene releases publicados")
}

// Download fetches and verifies the asset of the last checked update. It
// stores the zip inside the cache directory for a later Prepare/Apply.
func (s *Service) Download(ctx context.Context, onProgress func(Progress)) error {
	if s.info == nil || !s.info.Available || s.info.AssetURL == "" {
		return errors.New("no hay una actualización pendiente para descargar")
	}

	tagDir := filepath.Join(s.cacheDir, "update", sanitizeTag(s.info.LatestVersion))
	if err := os.MkdirAll(tagDir, 0o755); err != nil {
		return fmt.Errorf("no se pudo preparar la carpeta de descarga: %w", err)
	}
	dest := filepath.Join(tagDir, sanitizeTag(s.info.AssetName))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.info.AssetURL, nil)
	if err != nil {
		return fmt.Errorf("error preparando la descarga: %w", err)
	}
	req.Header.Set("User-Agent", userAgent)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("error descargando la actualización: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return ErrNoAccess
	default:
		return fmt.Errorf("la descarga respondió %d", resp.StatusCode)
	}

	total := s.info.AssetSize
	if resp.ContentLength > 0 {
		total = resp.ContentLength
	}

	file, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("no se pudo crear el archivo de descarga: %w", err)
	}

	hasher := sha256.New()
	buf := make([]byte, 32*1024)
	var downloaded int64
	started := time.Now()
	lastEmit := time.Time{}

	emit := func() {
		if onProgress == nil {
			return
		}
		onProgress(Progress{
			Phase:           "downloading",
			BytesDownloaded: downloaded,
			TotalBytes:      total,
			Percentage:      percentage(downloaded, total),
			Speed:           transferSpeed(downloaded, time.Since(started)),
		})
	}

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := file.Write(buf[:n]); writeErr != nil {
				file.Close()
				os.Remove(dest)
				return fmt.Errorf("no se pudo guardar la descarga: %w", writeErr)
			}
			hasher.Write(buf[:n])
			downloaded += int64(n)
			if time.Since(lastEmit) > 150*time.Millisecond {
				lastEmit = time.Now()
				emit()
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			file.Close()
			os.Remove(dest)
			return fmt.Errorf("error descargando la actualización: %w", readErr)
		}
	}

	if err := file.Close(); err != nil {
		os.Remove(dest)
		return fmt.Errorf("no se pudo cerrar el archivo de descarga: %w", err)
	}
	emit()

	if digest := s.expectedDigest(s.info.AssetName); digest != "" {
		sum := hex.EncodeToString(hasher.Sum(nil))
		if !strings.EqualFold(sum, digest) {
			os.Remove(dest)
			return errors.New("la verificación SHA-256 falló; la descarga está corrupta, vuelve a intentarlo")
		}
	} else {
		utils.LogWarn("[updater] el release no expone SHA-256; no se pudo verificar %s", s.info.AssetName)
	}

	s.zipPath = dest
	return nil
}

// Prepare extracts the downloaded zip and locates the folder that contains
// the new binary.
func (s *Service) Prepare() error {
	if s.zipPath == "" {
		return errors.New("primero hay que descargar la actualización")
	}
	if s.stageDir != "" {
		_ = utils.RemoveAllWithRetry(s.stageDir, 5)
		s.stageDir = ""
	}

	stage := s.zipPath + ".extracted"
	// Remove a previous extraction so a retry never mixes old and new files.
	_ = utils.RemoveAllWithRetry(stage, 5)
	if err := os.MkdirAll(stage, 0o755); err != nil {
		return fmt.Errorf("no se pudo preparar la carpeta de la actualización: %w", err)
	}
	if err := utils.ExtractArchive(s.zipPath, stage); err != nil {
		os.RemoveAll(stage)
		return fmt.Errorf("no se pudo extraer la actualización: %w", err)
	}

	dir, err := locateBinaryDir(stage, binaryName())
	if err != nil {
		os.RemoveAll(stage)
		return err
	}
	s.stageDir = dir
	return nil
}

// Apply prepares (if needed) and installs the downloaded update. On Windows
// it spawns a helper that replaces the executable once the app exits; on
// Linux it swaps the binary in place. The caller should quit the app right
// after Apply returns nil.
func (s *Service) Apply(ctx context.Context, onProgress func(Progress)) error {
	if s.stageDir == "" {
		if onProgress != nil {
			onProgress(Progress{Phase: "extracting", Percentage: 0})
		}
		if err := s.Prepare(); err != nil {
			return err
		}
	}
	if onProgress != nil {
		onProgress(Progress{Phase: "applying", Percentage: 100})
	}
	if err := s.applyPlatform(); err != nil {
		return err
	}
	if onProgress != nil {
		onProgress(Progress{Phase: "restarting", Percentage: 100})
	}
	return nil
}

// Cleanup removes leftovers from previous updates: staged payloads, helper
// scripts and the replaced executable kept aside on Windows.
func (s *Service) Cleanup() {
	_ = os.RemoveAll(filepath.Join(s.cacheDir, "update"))
	if matches, err := filepath.Glob(filepath.Join(os.TempDir(), "tsunagu-update-*")); err == nil {
		for _, path := range matches {
			_ = os.Remove(path)
		}
	}
	if exe, err := currentExecutable(); err == nil {
		_ = os.Remove(exe + ".old")
	}
}

func (s *Service) expectedDigest(assetName string) string {
	if s.latest == nil {
		return ""
	}
	for _, a := range s.latest.Assets {
		if a.Name != assetName {
			continue
		}
		digest := strings.TrimSpace(a.Digest)
		digest = strings.TrimPrefix(digest, "sha256:")
		if len(digest) == 64 {
			return digest
		}
	}
	return ""
}

func locateBinaryDir(root, name string) (string, error) {
	var found string
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if strings.EqualFold(info.Name(), name) {
			found = filepath.Dir(path)
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("no se pudo inspeccionar la actualización: %w", err)
	}
	if found == "" {
		return "", fmt.Errorf("la actualización descargada no contiene %s", name)
	}
	return found, nil
}

func currentExecutable() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("no se pudo localizar el ejecutable actual: %w", err)
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return exe, nil
}

func copyFile(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	// O_CREATE only applies mode to new files; enforce it for retries with a
	// leftover file (the new binary must stay executable).
	if err := out.Chmod(mode); err != nil {
		out.Close()
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	if err := out.Sync(); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func sanitizeTag(tag string) string {
	var b strings.Builder
	for _, r := range tag {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '.', r == '_', r == '-':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	result := strings.Trim(b.String(), "-.")
	if result == "" {
		return "latest"
	}
	return result
}

func percentage(done, total int64) float64 {
	if total <= 0 {
		return 0
	}
	value := float64(done) / float64(total) * 100
	if value > 100 {
		return 100
	}
	return value
}

func transferSpeed(done int64, elapsed time.Duration) string {
	seconds := elapsed.Seconds()
	if seconds <= 0 {
		return "0 MB/s"
	}
	mbPerSecond := float64(done) / seconds / (1024 * 1024)
	return fmt.Sprintf("%.1f MB/s", mbPerSecond)
}
