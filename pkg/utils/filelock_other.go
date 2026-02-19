//go:build !windows

package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type FileLock struct {
	path   string
	file   *os.File
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

	file, err := os.OpenFile(fl.path, os.O_CREATE|os.O_EXCL|os.O_RDWR, 0666)
	if err != nil {
		if os.IsExist(err) {
			return fmt.Errorf("directory is locked by another operation")
		}
		return fmt.Errorf("failed to create lock file: %w", err)
	}

	fl.file = file
	fl.locked = true
	return nil
}

func (fl *FileLock) Unlock() error {
	if !fl.locked {
		return nil
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
	file *os.File
	path string
}

func OpenFileLocked(path string) (*LockedFile, error) {
	path = filepath.Clean(path)

	file, err := os.OpenFile(path, os.O_RDWR, 0666)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}

	return &LockedFile{
		file: file,
		path: path,
	}, nil
}

func (lf *LockedFile) Close() error {
	if lf.file != nil {
		lf.file.Close()
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

// MoveFileEx is a stub for non-Windows systems that just uses os.Rename
func MoveFileEx(oldpath, newpath string) error {
	LogInfo("[MoveFileEx] Non-Windows: falling back to os.Rename")
	return os.Rename(oldpath, newpath)
}

// MoveFileExWithReboot is a stub for non-Windows systems
func MoveFileExWithReboot(oldpath, newpath string) error {
	LogWarn("[MoveFileExWithReboot] Non-Windows: reboot move not supported, removing instead")
	return os.RemoveAll(oldpath)
}
