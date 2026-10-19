//go:build windows

package updater

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// applyPlatform replaces the running executable through a detached
// PowerShell helper: Windows keeps the .exe locked while the app runs, so
// the swap happens once the app exits. The helper keeps a ".old" rollback
// copy and deletes itself (and its payload) when done.
func (s *Service) applyPlatform() error {
	exe, err := currentExecutable()
	if err != nil {
		return err
	}
	installDir := filepath.Dir(exe)

	newExe := filepath.Join(s.stageDir, binaryName())
	if !fileExists(newExe) {
		return fmt.Errorf("la actualización descargada no contiene %s", binaryName())
	}

	// Fail before quitting if the install folder is not writable.
	if err := ensureWritable(installDir); err != nil {
		return fmt.Errorf("no se puede escribir en %s; mueve la app a una carpeta tuya o actualiza manualmente", installDir)
	}

	// Preserve the working directory: config.json, characters.json and the
	// cache are relative to it.
	cwd, err := os.Getwd()
	if err != nil || cwd == "" {
		cwd = installDir
	}

	script := buildWindowsHelper(os.Getpid(), exe, installDir, s.stageDir, cwd)
	scriptPath := filepath.Join(os.TempDir(), fmt.Sprintf("tsunagu-update-%d.ps1", os.Getpid()))
	// UTF-8 BOM: Windows PowerShell 5.1 otherwise reads the script as ANSI
	// and mangles non-ASCII paths.
	scriptBytes := append([]byte{0xEF, 0xBB, 0xBF}, []byte(script)...)
	if err := os.WriteFile(scriptPath, scriptBytes, 0o644); err != nil {
		return fmt.Errorf("no se pudo preparar el reinicio para aplicar la actualización: %w", err)
	}

	cmd := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-NonInteractive",
		"-ExecutionPolicy", "Bypass",
		"-WindowStyle", "Hidden",
		"-File", scriptPath,
	)
	// CREATE_NO_WINDOW: run the helper without flashing a console window.
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	if err := cmd.Start(); err != nil {
		_ = os.Remove(scriptPath)
		return fmt.Errorf("no se pudo iniciar el reinicio para aplicar la actualización: %w", err)
	}
	_ = cmd.Process.Release()
	return nil
}

func ensureWritable(dir string) error {
	probe, err := os.CreateTemp(dir, ".tsunagu-write-test-*")
	if err != nil {
		return err
	}
	name := probe.Name()
	probe.Close()
	_ = os.Remove(name)
	return nil
}

func buildWindowsHelper(appPid int, exePath, installDir, stageDir, workDir string) string {
	return `$ErrorActionPreference = 'SilentlyContinue'
$appPid = ` + strconv.Itoa(appPid) + `
$exe = ` + psQuote(exePath) + `
$installDir = ` + psQuote(installDir) + `
$stageDir = ` + psQuote(stageDir) + `
$workDir = ` + psQuote(workDir) + `
$exeOld = "$exe.old"

# 1. Wait for the running app to exit (max ~60 s)
for ($i = 0; $i -lt 120; $i++) {
    if (-not (Get-Process -Id $appPid -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
}
Start-Sleep -Milliseconds 800

# 2. Move the current executable aside (rollback point). If the move fails
# (e.g. the file is still locked) the update is aborted so the old binary is
# never mistaken for the freshly copied one.
$oldMoved = $false
if (Test-Path $exe) {
    Move-Item -Force $exe $exeOld
    $oldMoved = Test-Path $exeOld
}

# 3. Install the new executable and check the full size so a partial copy is
# not taken as success.
$installed = $false
$srcExe = Join-Path $stageDir 'Tsunagu.exe'
if ($oldMoved) {
    $srcLen = (Get-Item $srcExe).Length
    for ($i = 0; $i -lt 20; $i++) {
        Copy-Item -Force $srcExe $exe
        if ((Test-Path $exe) -and ((Get-Item $exe).Length -eq $srcLen)) { $installed = $true; break }
        Start-Sleep -Milliseconds 500
    }
}

# 4. Roll back if the copy never succeeded (only if we moved the old exe)
if (-not $installed -and $oldMoved -and (Test-Path $exeOld)) {
    Move-Item -Force $exeOld $exe
}

# 5. Update the character data shipped with the release
$chars = Join-Path $stageDir 'characters.json'
if ($installed -and (Test-Path $chars)) {
    Copy-Item -Force $chars (Join-Path $installDir 'characters.json')
}

# 6. Relaunch, then clean up payload and helper
$stillRunning = Get-Process -Id $appPid -ErrorAction SilentlyContinue
if (-not $stillRunning -and (Test-Path $exe)) {
    Start-Process -FilePath $exe -WorkingDirectory $workDir
}
if ($installed) {
    Remove-Item -Recurse -Force $stageDir
}
Remove-Item -Force $PSCommandPath
`
}

func psQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}
