package mod

import (
	"os"
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"
)

type ModWatcher struct {
	watcher   *fsnotify.Watcher
	mu        sync.RWMutex
	enabled   bool
	callbacks []func(fsnotify.Event)
}

func NewModWatcher() (*ModWatcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	return &ModWatcher{
		watcher:   watcher,
		enabled:   true,
		callbacks: make([]func(fsnotify.Event), 0),
	}, nil
}

func (mw *ModWatcher) AddCallback(callback func(fsnotify.Event)) {
	mw.mu.Lock()
	defer mw.mu.Unlock()
	mw.callbacks = append(mw.callbacks, callback)
}

func (mw *ModWatcher) Watch(path string) error {
	return mw.watcher.Add(path)
}

func (mw *ModWatcher) RemoveWatch(path string) error {
	return mw.watcher.Remove(path)
}

func (mw *ModWatcher) Start() {
	go func() {
		for {
			select {
			case event, ok := <-mw.watcher.Events:
				if !ok {
					return
				}
				mw.mu.RLock()
				enabled := mw.enabled
				callbacks := make([]func(fsnotify.Event), len(mw.callbacks))
				copy(callbacks, mw.callbacks)
				mw.mu.RUnlock()

				if enabled {
					for _, callback := range callbacks {
						callback(event)
					}
				}

			case err, ok := <-mw.watcher.Errors:
				if !ok {
					return
				}
				_ = err
			}
		}
	}()
}

func (mw *ModWatcher) Disable() func() {
	mw.mu.Lock()
	mw.enabled = false
	mw.mu.Unlock()

	return func() {
		mw.mu.Lock()
		mw.enabled = true
		mw.mu.Unlock()
	}
}

func (mw *ModWatcher) Enable() {
	mw.mu.Lock()
	defer mw.mu.Unlock()
	mw.enabled = true
}

func (mw *ModWatcher) IsEnabled() bool {
	mw.mu.RLock()
	defer mw.mu.RUnlock()
	return mw.enabled
}

func (mw *ModWatcher) Close() error {
	return mw.watcher.Close()
}

type DisableWatcher struct {
	watcher *ModWatcher
}

func NewDisableWatcher(watcher *ModWatcher) *DisableWatcher {
	if watcher != nil {
		watcher.Disable()
	}
	return &DisableWatcher{
		watcher: watcher,
	}
}

func (dw *DisableWatcher) Dispose() {
	if dw.watcher != nil {
		dw.watcher.Enable()
	}
}

type ModWatcherManager struct {
	watchers map[string]*ModWatcher
	mu       sync.RWMutex
}

func NewModWatcherManager() *ModWatcherManager {
	return &ModWatcherManager{
		watchers: make(map[string]*ModWatcher),
	}
}

func (mwm *ModWatcherManager) AddWatcher(path string, callback func(fsnotify.Event)) error {
	mwm.mu.Lock()
	defer mwm.mu.Unlock()

	if _, exists := mwm.watchers[path]; exists {
		return nil
	}

	watcher, err := NewModWatcher()
	if err != nil {
		return err
	}

	watcher.AddCallback(callback)

	absPath, err := filepath.Abs(path)
	if err != nil {
		watcher.Close()
		return err
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		watcher.Close()
		return nil
	}

	if err := watcher.Watch(absPath); err != nil {
		watcher.Close()
		return err
	}

	watcher.Start()
	mwm.watchers[path] = watcher
	return nil
}

func (mwm *ModWatcherManager) RemoveWatcher(path string) error {
	mwm.mu.Lock()
	defer mwm.mu.Unlock()

	watcher, exists := mwm.watchers[path]
	if !exists {
		return nil
	}

	err := watcher.Close()
	delete(mwm.watchers, path)
	return err
}

func (mwm *ModWatcherManager) DisableAll() func() {
	mwm.mu.RLock()
	watchers := make([]*ModWatcher, 0, len(mwm.watchers))
	for _, w := range mwm.watchers {
		watchers = append(watchers, w)
	}
	mwm.mu.RUnlock()

	for _, w := range watchers {
		w.Disable()
	}

	return func() {
		for _, w := range watchers {
			w.Enable()
		}
	}
}

func (mwm *ModWatcherManager) Close() error {
	mwm.mu.Lock()
	defer mwm.mu.Unlock()

	var lastErr error
	for path, watcher := range mwm.watchers {
		if err := watcher.Close(); err != nil {
			lastErr = err
		}
		delete(mwm.watchers, path)
	}
	return lastErr
}

func (mwm *ModWatcherManager) DisableWatcher(path string) func() {
	mwm.mu.RLock()
	watcher, exists := mwm.watchers[path]
	mwm.mu.RUnlock()

	if !exists || watcher == nil {
		return func() {}
	}

	return watcher.Disable()
}
