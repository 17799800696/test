package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"erc20-tracker/backend/internal/config"
	"github.com/sirupsen/logrus"
)

// Logger 日志实例
var Logger *logrus.Logger

// InitLogger 初始化日志
func InitLogger(cfg *config.LoggingConfig) error {
	Logger = logrus.New()

	// 设置日志级别
	level, err := logrus.ParseLevel(cfg.Level)
	if err != nil {
		level = logrus.InfoLevel
	}
	Logger.SetLevel(level)

	// 设置日志格式
	Logger.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: time.RFC3339,
		FieldMap: logrus.FieldMap{
			logrus.FieldKeyTime:  "timestamp",
			logrus.FieldKeyLevel: "level",
			logrus.FieldKeyMsg:   "message",
		},
	})

	// 设置输出
	if cfg.FilePath != "" {
		// 确保日志目录存在
		logDir := filepath.Dir(cfg.FilePath)
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return fmt.Errorf("创建日志目录失败: %w", err)
		}

		// 打开日志文件
		logFile, err := os.OpenFile(cfg.FilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return fmt.Errorf("打开日志文件失败: %w", err)
		}

		// 同时输出到文件和控制台
		multiWriter := io.MultiWriter(os.Stdout, logFile)
		Logger.SetOutput(multiWriter)
	} else {
		// 只输出到控制台
		Logger.SetOutput(os.Stdout)
	}

	return nil
}

// WithFields 创建带字段的日志条目
func WithFields(fields logrus.Fields) *logrus.Entry {
	if Logger == nil {
		return logrus.WithFields(fields)
	}
	return Logger.WithFields(fields)
}

// WithField 创建带单个字段的日志条目
func WithField(key string, value interface{}) *logrus.Entry {
	if Logger == nil {
		return logrus.WithField(key, value)
	}
	return Logger.WithField(key, value)
}

// Debug 调试日志
func Debug(args ...interface{}) {
	if Logger == nil {
		logrus.Debug(args...)
		return
	}
	Logger.Debug(args...)
}

// Debugf 格式化调试日志
func Debugf(format string, args ...interface{}) {
	if Logger == nil {
		logrus.Debugf(format, args...)
		return
	}
	Logger.Debugf(format, args...)
}

// Info 信息日志
func Info(args ...interface{}) {
	if Logger == nil {
		logrus.Info(args...)
		return
	}
	Logger.Info(args...)
}

// Infof 格式化信息日志
func Infof(format string, args ...interface{}) {
	if Logger == nil {
		logrus.Infof(format, args...)
		return
	}
	Logger.Infof(format, args...)
}

// Warn 警告日志
func Warn(args ...interface{}) {
	if Logger == nil {
		logrus.Warn(args...)
		return
	}
	Logger.Warn(args...)
}

// Warnf 格式化警告日志
func Warnf(format string, args ...interface{}) {
	if Logger == nil {
		logrus.Warnf(format, args...)
		return
	}
	Logger.Warnf(format, args...)
}

// Error 错误日志
func Error(args ...interface{}) {
	if Logger == nil {
		logrus.Error(args...)
		return
	}
	Logger.Error(args...)
}

// Errorf 格式化错误日志
func Errorf(format string, args ...interface{}) {
	if Logger == nil {
		logrus.Errorf(format, args...)
		return
	}
	Logger.Errorf(format, args...)
}

// Fatal 致命错误日志
func Fatal(args ...interface{}) {
	if Logger == nil {
		logrus.Fatal(args...)
		return
	}
	Logger.Fatal(args...)
}

// Fatalf 格式化致命错误日志
func Fatalf(format string, args ...interface{}) {
	if Logger == nil {
		logrus.Fatalf(format, args...)
		return
	}
	Logger.Fatalf(format, args...)
}

// Panic panic日志
func Panic(args ...interface{}) {
	if Logger == nil {
		logrus.Panic(args...)
		return
	}
	Logger.Panic(args...)
}

// Panicf 格式化panic日志
func Panicf(format string, args ...interface{}) {
	if Logger == nil {
		logrus.Panicf(format, args...)
		return
	}
	Logger.Panicf(format, args...)
}
