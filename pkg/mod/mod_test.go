package mod

import (
	"os"
	"path/filepath"
	"testing"
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
