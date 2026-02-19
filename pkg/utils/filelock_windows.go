//go:build windows

package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

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
