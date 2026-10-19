package updater

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// buildTestZip mimics the layout of the release assets: the executable and
// characters.json inside build/bin/.
func buildTestZip(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, name := range []string{"build/bin/" + binaryName(), "build/bin/characters.json"} {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("creating zip entry: %v", err)
		}
		if _, err := w.Write([]byte("payload-" + name)); err != nil {
			t.Fatalf("writing zip entry: %v", err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("closing zip: %v", err)
	}
	return buf.Bytes()
}

func digestOf(payload []byte) string {
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

// releaseServer serves a releases list and the asset payload. The asset URL
// always points back to the same server.
func releaseServer(t *testing.T, payload []byte, tag string, createdAt time.Time, digest string) *httptest.Server {
	t.Helper()
	var server *httptest.Server
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/test/tsunagu/releases":
			items := []map[string]any{{
				"tag_name":   tag,
				"name":       "Tsunagu " + tag,
				"body":       "notas de la release",
				"html_url":   server.URL + "/release",
				"created_at": createdAt.Format(time.RFC3339),
				"draft":      false,
				"assets": []map[string]any{{
					"name":                 AssetName(),
					"browser_download_url": server.URL + "/asset",
					"size":                 len(payload),
					"digest":               "sha256:" + digest,
				}},
			}}
			if err := json.NewEncoder(w).Encode(items); err != nil {
				t.Errorf("encoding releases: %v", err)
			}
		case "/asset":
			if _, err := w.Write(payload); err != nil {
				t.Errorf("writing payload: %v", err)
			}
		default:
			http.NotFound(w, r)
		}
	})
	server = httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return server
}

func newTestService(t *testing.T, srv *httptest.Server) *Service {
	t.Helper()
	t.Setenv(RepoEnv, "test/tsunagu")
	svc := NewService(t.TempDir())
	svc.apiBase = srv.URL
	svc.client = srv.Client()
	return svc
}

func pinVersion(t *testing.T, version, buildTime, buildTag string) {
	t.Helper()
	oldVersion, oldBuildTime, oldBuildTag := Version, BuildTime, BuildTag
	Version, BuildTime, BuildTag = version, buildTime, buildTag
	t.Cleanup(func() {
		Version, BuildTime, BuildTag = oldVersion, oldBuildTime, oldBuildTag
	})
}

func TestCheckFindsNewerRelease(t *testing.T) {
	payload := buildTestZip(t)
	srv := releaseServer(t, payload, "build-2099", time.Now().Add(time.Hour), digestOf(payload))
	svc := newTestService(t, srv)
	pinVersion(t, "build-old", time.Now().Add(-24*time.Hour).Format(time.RFC3339), "build-old")

	info, err := svc.Check(context.Background())
	if err != nil {
		t.Fatalf("Check: %v", err)
	}
	if !info.Available {
		t.Fatalf("expected update available, got %+v", info)
	}
	if info.LatestVersion != "build-2099" {
		t.Errorf("LatestVersion = %q", info.LatestVersion)
	}
	if info.AssetName != AssetName() || info.AssetURL == "" || info.AssetSize != int64(len(payload)) {
		t.Errorf("asset not selected: %+v", info)
	}
	if info.CurrentVersion != "build-old" || info.ReleaseURL == "" || info.Notes == "" {
		t.Errorf("metadata missing: %+v", info)
	}
}

func TestCheckSameTagIsNotAvailable(t *testing.T) {
	payload := buildTestZip(t)
	srv := releaseServer(t, payload, "build-current", time.Now().Add(time.Hour), digestOf(payload))
	svc := newTestService(t, srv)
	pinVersion(t, "build-current", time.Now().Add(-time.Hour).Format(time.RFC3339), "build-current")

	info, err := svc.Check(context.Background())
	if err != nil {
		t.Fatalf("Check: %v", err)
	}
	if info.Available {
		t.Fatalf("same tag must not count as update: %+v", info)
	}
}

func TestCheckOlderReleaseIsNotAvailable(t *testing.T) {
	payload := buildTestZip(t)
	srv := releaseServer(t, payload, "build-2099", time.Now().Add(-48*time.Hour), digestOf(payload))
	svc := newTestService(t, srv)
	pinVersion(t, "build-newer", time.Now().Add(-time.Hour).Format(time.RFC3339), "build-newer")

	info, err := svc.Check(context.Background())
	if err != nil {
		t.Fatalf("Check: %v", err)
	}
	if info.Available {
		t.Fatalf("older release must not count as update: %+v", info)
	}
}

func TestCheckPrivateRepoReturnsErrNoAccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)
	svc := newTestService(t, srv)

	_, err := svc.Check(context.Background())
	if !errors.Is(err, ErrNoAccess) {
		t.Fatalf("expected ErrNoAccess, got %v", err)
	}
}

func TestDownloadAndPrepareFlow(t *testing.T) {
	payload := buildTestZip(t)
	srv := releaseServer(t, payload, "build-2099", time.Now().Add(time.Hour), digestOf(payload))
	svc := newTestService(t, srv)
	pinVersion(t, "build-old", time.Now().Add(-24*time.Hour).Format(time.RFC3339), "build-old")

	if _, err := svc.Check(context.Background()); err != nil {
		t.Fatalf("Check: %v", err)
	}

	var lastProgress Progress
	if err := svc.Download(context.Background(), func(p Progress) {
		lastProgress = p
	}); err != nil {
		t.Fatalf("Download: %v", err)
	}
	if lastProgress.Phase != "downloading" || lastProgress.BytesDownloaded != int64(len(payload)) {
		t.Errorf("unexpected progress: %+v", lastProgress)
	}
	if !fileExists(svc.zipPath) {
		t.Fatalf("downloaded file missing: %s", svc.zipPath)
	}

	if err := svc.Prepare(); err != nil {
		t.Fatalf("Prepare: %v", err)
	}
	if !fileExists(filepath.Join(svc.stageDir, binaryName())) {
		t.Fatalf("staged binary missing in %s", svc.stageDir)
	}
	if !fileExists(filepath.Join(svc.stageDir, "characters.json")) {
		t.Fatalf("staged characters.json missing in %s", svc.stageDir)
	}
}

func TestDownloadDetectsCorruptedPayload(t *testing.T) {
	payload := buildTestZip(t)
	srv := releaseServer(t, payload, "build-2099", time.Now().Add(time.Hour), digestOf([]byte("otro contenido")))
	svc := newTestService(t, srv)
	pinVersion(t, "build-old", time.Now().Add(-24*time.Hour).Format(time.RFC3339), "build-old")

	if _, err := svc.Check(context.Background()); err != nil {
		t.Fatalf("Check: %v", err)
	}
	if err := svc.Download(context.Background(), nil); err == nil {
		t.Fatal("expected digest mismatch error")
	}
	dest := filepath.Join(svc.cacheDir, "update", sanitizeTag("build-2099"), sanitizeTag(AssetName()))
	if _, statErr := os.Stat(dest); !os.IsNotExist(statErr) {
		t.Errorf("corrupted download should be removed, stat err = %v", statErr)
	}
	if svc.zipPath != "" {
		t.Errorf("zipPath should stay empty after a failed download, got %q", svc.zipPath)
	}
}

func TestDownloadWithoutCheckFails(t *testing.T) {
	t.Setenv(RepoEnv, "test/tsunagu")
	svc := NewService(t.TempDir())
	if err := svc.Download(context.Background(), nil); err == nil {
		t.Fatal("expected error when no update was checked")
	}
}

func TestSanitizeTag(t *testing.T) {
	cases := map[string]string{
		"build-20261019-12-abc123": "build-20261019-12-abc123",
		"v1.9.0+meta":              "v1.9.0-meta",
		"../escape":                "escape",
		"":                         "latest",
	}
	for input, want := range cases {
		if got := sanitizeTag(input); got != want {
			t.Errorf("sanitizeTag(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestLocateBinaryDir(t *testing.T) {
	root := t.TempDir()
	nested := filepath.Join(root, "build", "bin")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(nested, binaryName()), []byte("bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	dir, err := locateBinaryDir(root, binaryName())
	if err != nil {
		t.Fatalf("locateBinaryDir: %v", err)
	}
	if dir != nested {
		t.Errorf("locateBinaryDir = %q, want %q", dir, nested)
	}
	if _, err := locateBinaryDir(root, "no-existe-"+sanitizeTag(t.Name())); err == nil {
		t.Error("expected error for missing binary")
	}
}

func TestVersionInfoDefaults(t *testing.T) {
	t.Setenv(RepoEnv, "test/tsunagu")
	svc := NewService(t.TempDir())
	pinVersion(t, "dev", "", "dev")
	info := svc.VersionInfo()
	if info.Version != "dev" || info.BuildTime != "unknown" || info.Platform == "" {
		t.Errorf("unexpected VersionInfo: %+v", info)
	}
}
