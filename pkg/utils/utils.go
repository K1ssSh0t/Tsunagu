package utils

import (
	"crypto/rand"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"golift.io/xtractr"
)

// GenerateUUID generates a simple v4 UUID
func GenerateUUID() string {
	u := make([]byte, 16)
	_, err := rand.Read(u)
	if err != nil {
		return ""
	}

	u[6] = (u[6] & 0x0f) | 0x40 // Version 4
	u[8] = (u[8] & 0x3f) | 0x80 // Variant 10

	return fmt.Sprintf("%x-%x-%x-%x-%x", u[0:4], u[4:6], u[6:8], u[8:10], u[10:])
}

// IsDirectory checks if a path is a directory
func IsDirectory(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// OpenUrl opens a URL in the default browser
func OpenUrl(url string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start", url}
	case "darwin":
		cmd = "open"
		args = []string{url}
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
		args = []string{url}
	}

	return exec.Command(cmd, args...).Start()
}

// OpenFolder opens a folder in the system file explorer
func OpenFolder(path string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "explorer"
		args = []string{path}
	case "darwin":
		cmd = "open"
		args = []string{path}
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
		args = []string{path}
	}

	return exec.Command(cmd, args...).Start()
}

// ExtractArchive extracts an archive (zip, rar, 7z) to the specified directory
func ExtractArchive(source, destination string) error {
	// Ensure destination is an absolute path
	dest, err := filepath.Abs(destination)
	if err != nil {
		return fmt.Errorf("error getting absolute path for destination: %v", err)
	}

	// Configure extraction
	xfile := &xtractr.XFile{
		FilePath:  source,
		OutputDir: dest,
		FileMode:  0644, // Permissions for extracted files
		DirMode:   0755, // Permissions for extracted directories
	}

	// Extract the file
	_, files, arch, err := xtractr.ExtractFile(xfile)
	if err != nil || files == nil || arch == nil {
		return fmt.Errorf("error extracting archive: %v", err)
	}

	return nil
}
