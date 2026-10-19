//go:build !windows

package updater

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

// applyPlatform swaps the binary in place (safe on Unix: the running process
// keeps its inode) and relaunches the app detached. If the new build exits
// right away (e.g. a system library is missing), the previous binary is
// restored and the running app stays open.
func (s *Service) applyPlatform() error {
	exe, err := currentExecutable()
	if err != nil {
		return err
	}
	installDir := filepath.Dir(exe)

	newBin := filepath.Join(s.stageDir, binaryName())
	if !fileExists(newBin) {
		return fmt.Errorf("la actualización descargada no contiene %s", binaryName())
	}

	// Keep a rollback copy outside the install dir and outside the update
	// cache (the new build cleans the cache on startup).
	backup := filepath.Join(os.TempDir(), fmt.Sprintf("tsunagu-backup-%d", os.Getpid()))
	_ = os.Remove(backup)
	if err := copyFile(exe, backup, 0o755); err != nil {
		return fmt.Errorf("no se pudo preparar una copia de seguridad: %w", err)
	}
	defer os.Remove(backup)

	// Copy next to the target so the swap is an atomic rename on the same
	// filesystem.
	tmp := filepath.Join(installDir, ".tsunagu-update-new")
	if err := copyFile(newBin, tmp, 0o755); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("no se pudo preparar el binario nuevo: %w", err)
	}
	if err := os.Rename(tmp, exe); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("no se pudo reemplazar el ejecutable: %w", err)
	}

	if chars := filepath.Join(s.stageDir, "characters.json"); fileExists(chars) {
		if err := copyFile(chars, filepath.Join(installDir, "characters.json"), 0o644); err != nil {
			// Not fatal: the app keeps working with the previous data file.
			fmt.Fprintf(os.Stderr, "no se pudo actualizar characters.json: %v\n", err)
		}
	}

	// Relaunch detached from the same working directory the app was using:
	// config.json, characters.json and the cache are relative to it.
	cwd, err := os.Getwd()
	if err != nil {
		cwd = installDir
	}
	cmd := exec.Command(exe)
	cmd.Dir = cwd
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		_ = copyFile(backup, exe, 0o755)
		return fmt.Errorf("la actualización se aplicó pero no se pudo iniciar; se restauró la versión anterior: %w", err)
	}

	// Give the new build a moment to fail fast (missing webkit, broken
	// download); otherwise consider it healthy.
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case <-time.After(3 * time.Second):
		return nil
	case err := <-done:
		if restoreErr := copyFile(backup, exe, 0o755); restoreErr != nil {
			return fmt.Errorf("la nueva versión no arrancó (%v) y no se pudo restaurar la anterior: %w", err, restoreErr)
		}
		if err != nil {
			return fmt.Errorf("la nueva versión no arrancó (%v); se restauró la versión anterior", err)
		}
		return errors.New("la nueva versión se cerró al iniciar; se restauró la versión anterior")
	}
}
