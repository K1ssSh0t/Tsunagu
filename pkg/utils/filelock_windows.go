//go:build windows

package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	LOCKFILE_EXCLUSIVE_LOCK = 0x00000002
)

type FileLock struct {
	path   string
	file   *os.File
	handle windows.Handle
	locked bool
}

func NewFileLock(dir string) *FileLock {
	return &FileLock{
		path:   filepath.Join(dir, ".tsunagu.lock"),
		locked: false,
	}
}

func (fl *FileLock) Lock() error {
	dir := filepath.Dir(fl.path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create lock directory: %w", err)
	}

	pathPtr, err := windows.UTF16PtrFromString(fl.path)
	if err != nil {
		return fmt.Errorf("failed to convert path: %w", err)
	}

	handle, err := windows.CreateFile(
		pathPtr,
		windows.GENERIC_READ|windows.GENERIC_WRITE,
		0,
		nil,
		windows.OPEN_ALWAYS,
		windows.FILE_ATTRIBUTE_NORMAL,
		0,
	)
	if err != nil {
		return fmt.Errorf("failed to get file handle: %w", err)
	}

	var overlapped windows.Overlapped
	err = windows.LockFileEx(
		handle,
		LOCKFILE_EXCLUSIVE_LOCK,
		0,
		1,
		0,
		&overlapped,
	)
	if err != nil {
		windows.CloseHandle(handle)
		return fmt.Errorf("directory is locked by another operation: %w", err)
	}

	fl.handle = handle
	fl.locked = true
	return nil
}

func (fl *FileLock) Unlock() error {
	if !fl.locked {
		return nil
	}

	if fl.handle != 0 {
		var overlapped windows.Overlapped
		windows.UnlockFileEx(fl.handle, 0, 1, 0, &overlapped)
		windows.CloseHandle(fl.handle)
	}

	if fl.file != nil {
		fl.file.Close()
	}

	os.Remove(fl.path)
	fl.locked = false
	return nil
}

func (fl *FileLock) IsLocked() bool {
	return fl.locked
}

type FileLocker struct {
	locks []*FileLock
}

func NewFileLocker() *FileLocker {
	return &FileLocker{
		locks: make([]*FileLock, 0),
	}
}

func (flr *FileLocker) LockDirectory(dir string) error {
	lock := NewFileLock(dir)
	if err := lock.Lock(); err != nil {
		return err
	}
	flr.locks = append(flr.locks, lock)
	return nil
}

func (flr *FileLocker) UnlockAll() {
	for _, lock := range flr.locks {
		lock.Unlock()
	}
	flr.locks = make([]*FileLock, 0)
}

type LockedFile struct {
	file   *os.File
	handle windows.Handle
	path   string
}

func OpenFileLocked(path string) (*LockedFile, error) {
	path = filepath.Clean(path)

	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return nil, fmt.Errorf("failed to convert path: %w", err)
	}

	handle, err := windows.CreateFile(
		pathPtr,
		windows.GENERIC_READ|windows.GENERIC_WRITE,
		windows.FILE_SHARE_READ,
		nil,
		windows.OPEN_EXISTING,
		windows.FILE_ATTRIBUTE_NORMAL,
		0,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to open file with lock: %w", err)
	}

	var overlapped windows.Overlapped
	err = windows.LockFileEx(
		handle,
		LOCKFILE_EXCLUSIVE_LOCK,
		0,
		1,
		0,
		&overlapped,
	)
	if err != nil {
		windows.CloseHandle(handle)
		return nil, fmt.Errorf("failed to lock file: %w", err)
	}

	file := os.NewFile(uintptr(handle), path)

	return &LockedFile{
		file:   file,
		handle: handle,
		path:   path,
	}, nil
}

func (lf *LockedFile) Close() error {
	if lf.file != nil {
		lf.file.Close()
	}
	if lf.handle != 0 {
		var overlapped windows.Overlapped
		windows.UnlockFileEx(lf.handle, 0, 1, 0, &overlapped)
		windows.CloseHandle(lf.handle)
	}
	return nil
}

type DirectoryLocker struct {
	dir       string
	lockFiles []*LockedFile
}

func NewDirectoryLocker(dir string) *DirectoryLocker {
	return &DirectoryLocker{
		dir:       dir,
		lockFiles: make([]*LockedFile, 0),
	}
}

func (dl *DirectoryLocker) LockAllFiles() error {
	err := filepath.Walk(dl.dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}

		lockedFile, err := OpenFileLocked(path)
		if err != nil {
			return fmt.Errorf("failed to lock file %s: %w", path, err)
		}
		dl.lockFiles = append(dl.lockFiles, lockedFile)
		return nil
	})

	if err != nil {
		dl.ReleaseAllFiles()
		return err
	}

	return nil
}

func (dl *DirectoryLocker) ReleaseAllFiles() {
	for _, lf := range dl.lockFiles {
		lf.Close()
	}
	dl.lockFiles = make([]*LockedFile, 0)
}

func (dl *DirectoryLocker) GetLockedCount() int {
	return len(dl.lockFiles)
}

func WithDirectoryLock(dir string, timeout time.Duration, fn func() error) error {
	lock := NewFileLock(dir)

	deadline := time.Now().Add(timeout)
	var lastErr error

	for time.Now().Before(deadline) {
		lastErr = lock.Lock()
		if lastErr == nil {
			defer lock.Unlock()
			return fn()
		}
		time.Sleep(50 * time.Millisecond)
	}

	return fmt.Errorf("could not acquire lock after %v: %w", timeout, lastErr)
}

const (
	MOVEFILE_REPLACE_EXISTING      = 0x00000001
	MOVEFILE_COPY_ALLOWED          = 0x00000002
	MOVEFILE_DELAY_UNTIL_REBOOT    = 0x00000004
	MOVEFILE_WRITE_THROUGH         = 0x00000008
	MOVEFILE_CREATE_HARDLINK       = 0x00000010
	MOVEFILE_FAIL_IF_NOT_TRACKABLE = 0x00000020
)

var (
	kernel32       = windows.NewLazySystemDLL("kernel32.dll")
	moveFileExProc = kernel32.NewProc("MoveFileExW")
)

// MoveFileEx moves a file or directory using Windows MoveFileEx API
// This can handle cases where files are partially locked by using MOVEFILE_COPY_ALLOWED
func MoveFileEx(oldpath, newpath string) error {
	LogInfo("[MoveFileEx] Attempting Windows API move: %s -> %s", oldpath, newpath)

	oldpathPtr, err := windows.UTF16PtrFromString(oldpath)
	if err != nil {
		LogError("[MoveFileEx] Failed to convert old path: %v", err)
		return fmt.Errorf("failed to convert old path: %w", err)
	}

	newpathPtr, err := windows.UTF16PtrFromString(newpath)
	if err != nil {
		LogError("[MoveFileEx] Failed to convert new path: %v", err)
		return fmt.Errorf("failed to convert new path: %w", err)
	}

	flags := uint32(MOVEFILE_COPY_ALLOWED | MOVEFILE_REPLACE_EXISTING)
	LogDebug("[MoveFileEx] Using flags: COPY_ALLOWED | REPLACE_EXISTING")

	ret, _, callErr := moveFileExProc.Call(
		uintptr(unsafe.Pointer(oldpathPtr)),
		uintptr(unsafe.Pointer(newpathPtr)),
		uintptr(flags),
	)

	if ret == 0 {
		errCode := windows.GetLastError()
		LogError("[MoveFileEx] MoveFileEx failed with error code: %d", errCode)
		LogError("[MoveFileEx] Call error: %v", callErr)
		return fmt.Errorf("MoveFileEx failed with error %d: %w", errCode, callErr)
	}

	LogInfo("[MoveFileEx] Successfully moved via Windows API")
	return nil
}

// MoveFileExWithReboot schedules a file/directory to be moved/deleted on next reboot
func MoveFileExWithReboot(oldpath, newpath string) error {
	LogInfo("[MoveFileExWithReboot] Scheduling for reboot: %s -> %s", oldpath, newpath)

	oldpathPtr, err := windows.UTF16PtrFromString(oldpath)
	if err != nil {
		return fmt.Errorf("failed to convert old path: %w", err)
	}

	var newpathPtr *uint16
	if newpath != "" {
		newpathPtr, err = windows.UTF16PtrFromString(newpath)
		if err != nil {
			return fmt.Errorf("failed to convert new path: %w", err)
		}
	}

	ret, _, callErr := moveFileExProc.Call(
		uintptr(unsafe.Pointer(oldpathPtr)),
		uintptr(unsafe.Pointer(newpathPtr)),
		uintptr(MOVEFILE_DELAY_UNTIL_REBOOT),
	)

	if ret == 0 {
		errCode := windows.GetLastError()
		LogError("[MoveFileExWithReboot] Failed with error code: %d", errCode)
		return fmt.Errorf("MoveFileEx reboot failed with error %d: %w", errCode, callErr)
	}

	LogInfo("[MoveFileExWithReboot] Successfully scheduled for next reboot")
	return nil
}
