package utils

import (
	"crypto/rand"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

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

// OpenUrl opens a URL or file in the default system handler
func OpenUrl(url string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		// Check if it's a local file and a .lnk or .exe
		if _, err := os.Stat(url); err == nil {
			ext := strings.ToLower(filepath.Ext(url))
			if ext == ".exe" || ext == ".lnk" {
				// Use "cmd /c start" with /d to set working directory.
				// The "" after start is for the title (required if the path has spaces)
				dir, _ := filepath.Abs(filepath.Dir(url))
				base := filepath.Base(url)
				cmd = "cmd"
				args = []string{"/c", "start", "/d", dir, "", base}
				return exec.Command(cmd, args...).Start()
			}
		}
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

// getBackoffDelay calculates exponential backoff delay with cap
func getBackoffDelay(attempt int, baseDelay time.Duration, maxDelay time.Duration) time.Duration {
	delay := baseDelay * time.Duration(1<<uint(attempt))
	if delay > maxDelay {
		delay = maxDelay
	}
	return delay
}

// RemoveAllWithRetry removes a directory with retries on Windows
// This handles the common "file in use" error when antivirus or other processes lock files
func RemoveAllWithRetry(path string, maxRetries int) error {
	return RemoveAllWithRetryAdvanced(path, maxRetries, 100*time.Millisecond, 3*time.Second)
}

// RemoveAllWithRetryAdvanced removes a directory with configurable backoff
func RemoveAllWithRetryAdvanced(path string, maxRetries int, baseDelay time.Duration, maxDelay time.Duration) error {
	var lastErr error

	LogInfo("[RemoveAllWithRetry] Starting removal of: %s", path)
	LogDebug("[RemoveAllWithRetry] Config: maxRetries=%d, baseDelay=%v, maxDelay=%v", maxRetries, baseDelay, maxDelay)

	for i := 0; i < maxRetries; i++ {
		lastErr = os.RemoveAll(path)
		if lastErr == nil {
			LogInfo("[RemoveAllWithRetry] Successfully removed %s on attempt %d", path, i+1)
			return nil
		}

		LogDebug("[RemoveAllWithRetry] Attempt %d/%d failed: %v", i+1, maxRetries, lastErr)

		if runtime.GOOS == "windows" {
			delay := getBackoffDelay(i, baseDelay, maxDelay)
			LogDebug("[RemoveAllWithRetry] Waiting %v before next attempt...", delay)

			runtime.GC()
			time.Sleep(delay)
		}
	}

	LogError("[RemoveAllWithRetry] FAILED to remove %s after %d attempts. Last error: %v", path, maxRetries, lastErr)
	LogError("[RemoveAllWithRetry] TIP: The directory may be open in another program (editor, explorer, antivirus)")
	return fmt.Errorf("failed to remove %s after %d attempts: %v", path, maxRetries, lastErr)
}

// RenameWithRetry renames a file/directory with retries on Windows
// This handles the common "file in use" or "access denied" errors when processes lock files
func RenameWithRetry(oldpath, newpath string, maxRetries int) error {
	return RenameWithRetryAdvanced(oldpath, newpath, maxRetries, 100*time.Millisecond, 3*time.Second)
}

// RenameWithRetryAdvanced renames with configurable backoff
func RenameWithRetryAdvanced(oldpath, newpath string, maxRetries int, baseDelay time.Duration, maxDelay time.Duration) error {
	var lastErr error

	LogInfo("[RenameWithRetry] Starting rename: %s -> %s", oldpath, newpath)
	LogDebug("[RenameWithRetry] Config: maxRetries=%d, baseDelay=%v, maxDelay=%v", maxRetries, baseDelay, maxDelay)

	for i := 0; i < maxRetries; i++ {
		lastErr = os.Rename(oldpath, newpath)
		if lastErr == nil {
			LogInfo("[RenameWithRetry] Successfully renamed on attempt %d", i+1)
			return nil
		}

		LogDebug("[RenameWithRetry] Attempt %d/%d failed: %v", i+1, maxRetries, lastErr)

		if runtime.GOOS == "windows" {
			delay := getBackoffDelay(i, baseDelay, maxDelay)
			LogDebug("[RenameWithRetry] Waiting %v before next attempt...", delay)

			runtime.GC()
			time.Sleep(delay)
		}
	}

	LogError("[RenameWithRetry] FAILED to rename after %d attempts", maxRetries)
	LogError("[RenameWithRetry] Source: %s", oldpath)
	LogError("[RenameWithRetry] Target: %s", newpath)
	LogError("[RenameWithRetry] Last error: %v", lastErr)
	LogError("[RenameWithRetry] TIP: A file may be open in another program (editor, explorer, antivirus)")
	return fmt.Errorf("failed to rename %s to %s after %d attempts: %v", oldpath, newpath, maxRetries, lastErr)
}

// ForceRename attempts rename with retries, then falls back to copy+delete if needed
func ForceRename(oldpath, newpath string) error {
	const maxRetries = 20

	LogInfo("[ForceRename] Starting forced rename: %s -> %s", oldpath, newpath)

	err := RenameWithRetryAdvanced(oldpath, newpath, maxRetries, 100*time.Millisecond, 2*time.Second)
	if err == nil {
		return nil
	}

	LogWarn("[ForceRename] Standard rename failed after %d attempts, trying MoveFileEx...", maxRetries)

	err = MoveFileEx(oldpath, newpath)
	if err == nil {
		LogInfo("[ForceRename] MoveFileEx succeeded")
		return nil
	}

	LogWarn("[ForceRename] MoveFileEx also failed: %v", err)
	LogWarn("[ForceRename] Falling back to copy+delete strategy...")

	err = CopyDirectory(oldpath, newpath)
	if err != nil {
		LogError("[ForceRename] Copy failed: %v", err)
		return fmt.Errorf("force rename failed (copy fallback): %w", err)
	}

	LogInfo("[ForceRename] Copy succeeded, marking original for deletion...")
	MarkDirectoryForDeletion(oldpath)

	LogInfo("[ForceRename] Force rename completed (original will be deleted on next app restart or manual cleanup)")
	return nil
}

// CopyDirectory copies a directory recursively
func CopyDirectory(src, dst string) error {
	LogInfo("[CopyDirectory] Copying: %s -> %s", src, dst)

	err := filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		dstPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			LogDebug("[CopyDirectory] Creating directory: %s", dstPath)
			return os.MkdirAll(dstPath, info.Mode())
		}

		LogDebug("[CopyDirectory] Copying file: %s", dstPath)
		return copyFile(path, dstPath)
	})

	if err != nil {
		LogError("[CopyDirectory] Copy failed: %v", err)
	} else {
		LogInfo("[CopyDirectory] Copy completed successfully")
	}

	return err
}

// copyFile copies a single file
func copyFile(src, dst string) error {
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}

	return os.WriteFile(dst, input, 0644)
}

// MarkDirectoryForDeletion marks a directory for deletion on next restart
func MarkDirectoryForDeletion(path string) {
	deleteMarker := filepath.Join(path, ".DELETE_ON_RESTART")
	err := os.WriteFile(deleteMarker, []byte("This directory should be deleted"), 0644)
	if err != nil {
		LogWarn("[MarkDirectoryForDeletion] Failed to create marker: %v", err)
	} else {
		LogInfo("[MarkDirectoryForDeletion] Created deletion marker at: %s", deleteMarker)
	}
}
