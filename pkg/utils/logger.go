package utils

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

type LogLevel int

const (
	LOG_DEBUG LogLevel = iota
	LOG_INFO
	LOG_WARN
	LOG_ERROR
)

type Logger struct {
	file   *os.File
	logger *log.Logger
	level  LogLevel
}

var defaultLogger *Logger

func InitLogger(logDir string) error {
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}

	logFile := filepath.Join(logDir, fmt.Sprintf("tsunagu_%s.log", time.Now().Format("2006-01-02")))
	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}

	defaultLogger = &Logger{
		file:   file,
		logger: log.New(file, "", log.LstdFlags),
		level:  LOG_DEBUG,
	}

	return nil
}

func (l *Logger) log(level LogLevel, format string, args ...interface{}) {
	if level < l.level {
		return
	}

	var prefix string
	switch level {
	case LOG_DEBUG:
		prefix = "[DEBUG] "
	case LOG_INFO:
		prefix = "[INFO] "
	case LOG_WARN:
		prefix = "[WARN] "
	case LOG_ERROR:
		prefix = "[ERROR] "
	}

	msg := fmt.Sprintf(prefix+format, args...)
	l.logger.Println(msg)

	if level >= LOG_WARN {
		fmt.Println(msg)
	}
}

func LogDebug(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.log(LOG_DEBUG, format, args...)
	}
}

func LogInfo(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.log(LOG_INFO, format, args...)
	}
}

func LogWarn(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.log(LOG_WARN, format, args...)
	}
}

func LogError(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.log(LOG_ERROR, format, args...)
	}
}

func CloseLogger() {
	if defaultLogger != nil && defaultLogger.file != nil {
		defaultLogger.file.Close()
	}
}
