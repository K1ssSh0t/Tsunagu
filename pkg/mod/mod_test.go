package mod

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestClearModContentsPreservesJASMCoverOnUpdate(t *testing.T) {
	service := &Service{}
	modPath := t.TempDir()

	configPath := filepath.Join(modPath, ".modconfig.json")
	coverPath := filepath.Join(modPath, ".JASM_Cover.jpg")
	removedPath := filepath.Join(modPath, "old.ini")

	if err := os.WriteFile(configPath, []byte("{}"), 0644); err != nil {
		t.Fatalf("failed to create config: %v", err)
	}
	if err := os.WriteFile(coverPath, []byte("image"), 0644); err != nil {
		t.Fatalf("failed to create cover: %v", err)
	}
	if err := os.WriteFile(removedPath, []byte("old"), 0644); err != nil {
		t.Fatalf("failed to create removable file: %v", err)
	}

	if err := service.clearModContents(modPath, true, ".JASM_Cover.jpg"); err != nil {
		t.Fatalf("clearModContents failed: %v", err)
	}

	if _, err := os.Stat(configPath); err != nil {
		t.Fatalf("expected config to be preserved: %v", err)
	}
	if _, err := os.Stat(coverPath); err != nil {
		t.Fatalf("expected JASM cover to be preserved: %v", err)
	}
	if _, err := os.Stat(removedPath); !os.IsNotExist(err) {
		t.Fatalf("expected old file to be removed, got err=%v", err)
	}
}

func TestClearModContentsPreservesConfiguredImagePath(t *testing.T) {
	service := &Service{}
	modPath := t.TempDir()

	configPath := filepath.Join(modPath, ".modconfig.json")
	customCover := filepath.Join(modPath, "custom-cover.webp")
	removedPath := filepath.Join(modPath, "unused.txt")

	if err := os.WriteFile(configPath, []byte("{}"), 0644); err != nil {
		t.Fatalf("failed to create config: %v", err)
	}
	if err := os.WriteFile(customCover, []byte("image"), 0644); err != nil {
		t.Fatalf("failed to create custom cover: %v", err)
	}
	if err := os.WriteFile(removedPath, []byte("unused"), 0644); err != nil {
		t.Fatalf("failed to create removable file: %v", err)
	}

	if err := service.clearModContents(modPath, true, "custom-cover.webp"); err != nil {
		t.Fatalf("clearModContents failed: %v", err)
	}

	if _, err := os.Stat(configPath); err != nil {
		t.Fatalf("expected config to be preserved: %v", err)
	}
	if _, err := os.Stat(customCover); err != nil {
		t.Fatalf("expected configured image to be preserved: %v", err)
	}
	if _, err := os.Stat(removedPath); !os.IsNotExist(err) {
		t.Fatalf("expected unused file to be removed, got err=%v", err)
	}
}

func TestImageRestoreBackoffDuration(t *testing.T) {
	tests := []struct {
		retry    int
		expected time.Duration
	}{
		{retry: 1, expected: time.Hour},
		{retry: 2, expected: 6 * time.Hour},
		{retry: 3, expected: 24 * time.Hour},
		{retry: 10, expected: 24 * time.Hour},
	}

	for _, tc := range tests {
		got := imageRestoreBackoffDuration(tc.retry)
		if got != tc.expected {
			t.Fatalf("retry %d: expected %v, got %v", tc.retry, tc.expected, got)
		}
	}
}

func TestShouldAttemptImageRestoreRespectsCooldown(t *testing.T) {
	now := time.Now()
	config := ModConfig{
		ImageRestoreNextRetry: now.Add(30 * time.Minute).Format(time.RFC3339),
	}

	if shouldAttemptImageRestore(config, now, false) {
		t.Fatalf("expected restore attempt to be blocked by cooldown")
	}

	if !shouldAttemptImageRestore(config, now, true) {
		t.Fatalf("expected force restore attempt to bypass cooldown")
	}
}

func TestIsBrokenImageConfig(t *testing.T) {
	modPath := t.TempDir()
	imagePath := filepath.Join(modPath, ".JASM_Cover.jpg")

	if err := os.WriteFile(imagePath, []byte("img"), 0644); err != nil {
		t.Fatalf("failed to create image: %v", err)
	}

	config := ModConfig{
		ModUrl:    "https://gamebanana.com/mods/123456",
		ImagePath: ".JASM_Cover.jpg",
	}

	if isBrokenImageConfig(modPath, config) {
		t.Fatalf("expected existing image to not be considered broken")
	}

	if err := os.Remove(imagePath); err != nil {
		t.Fatalf("failed to remove image: %v", err)
	}

	if !isBrokenImageConfig(modPath, config) {
		t.Fatalf("expected missing image to be considered broken")
	}

	nonGameBanana := config
	nonGameBanana.ModUrl = "https://example.com/mod"
	if isBrokenImageConfig(modPath, nonGameBanana) {
		t.Fatalf("expected non-GameBanana URLs to be ignored")
	}
}
