package retry

import (
	"context"
	"fmt"
	"time"

	"erc20-tracker/backend/pkg/logger"
)

// RetryConfig 重试配置
type RetryConfig struct {
	MaxAttempts int           // 最大重试次数
	Delay       time.Duration // 重试延迟
	Backoff     BackoffType   // 退避策略
}

// BackoffType 退避策略类型
type BackoffType int

const (
	FixedBackoff       BackoffType = iota // 固定延迟
	ExponentialBackoff                    // 指数退避
	LinearBackoff                         // 线性退避
)

// RetryableFunc 可重试的函数类型
type RetryableFunc func() error

// RetryableFuncWithContext 带上下文的可重试函数类型
type RetryableFuncWithContext func(ctx context.Context) error

// IsRetryable 判断错误是否可重试的函数类型
type IsRetryable func(error) bool

// DefaultRetryConfig 默认重试配置
var DefaultRetryConfig = RetryConfig{
	MaxAttempts: 3,
	Delay:       5 * time.Second,
	Backoff:     ExponentialBackoff,
}

// Retry 执行重试逻辑
func Retry(fn RetryableFunc, config RetryConfig) error {
	return RetryWithContext(context.Background(), func(ctx context.Context) error {
		return fn()
	}, config, nil)
}

// RetryWithContext 带上下文的重试逻辑
func RetryWithContext(ctx context.Context, fn RetryableFuncWithContext, config RetryConfig, isRetryable IsRetryable) error {
	var lastErr error

	for attempt := 1; attempt <= config.MaxAttempts; attempt++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		err := fn(ctx)
		if err == nil {
			// 成功执行，返回
			if attempt > 1 {
				logger.WithFields(map[string]interface{}{
					"attempt":        attempt,
					"total_attempts": config.MaxAttempts,
				}).Info("重试成功")
			}
			return nil
		}

		lastErr = err

		// 检查是否可重试
		if isRetryable != nil && !isRetryable(err) {
			logger.WithFields(map[string]interface{}{
				"error":   err,
				"attempt": attempt,
			}).Info("错误不可重试，停止重试")
			return err
		}

		// 如果是最后一次尝试，直接返回错误
		if attempt == config.MaxAttempts {
			logger.WithFields(map[string]interface{}{
				"error":          err,
				"total_attempts": config.MaxAttempts,
			}).Error("重试次数已用完")
			return fmt.Errorf("重试失败，已尝试%d次: %w", config.MaxAttempts, err)
		}

		// 计算延迟时间
		delay := calculateDelay(config.Delay, attempt, config.Backoff)

		logger.WithFields(map[string]interface{}{
			"error":        err,
			"attempt":      attempt,
			"max_attempts": config.MaxAttempts,
			"delay":        delay,
		}).Warn("操作失败，准备重试")

		// 等待延迟时间
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
			// 继续下一次重试
		}
	}

	return lastErr
}

// calculateDelay 计算延迟时间
func calculateDelay(baseDelay time.Duration, attempt int, backoff BackoffType) time.Duration {
	switch backoff {
	case FixedBackoff:
		return baseDelay
	case ExponentialBackoff:
		// 指数退避：delay * 2^(attempt-1)
		multiplier := 1 << (attempt - 1) // 2^(attempt-1)
		return baseDelay * time.Duration(multiplier)
	case LinearBackoff:
		// 线性退避：delay * attempt
		return baseDelay * time.Duration(attempt)
	default:
		return baseDelay
	}
}

// RetryableError 可重试的错误类型
type RetryableError struct {
	Err error
}

func (e RetryableError) Error() string {
	return e.Err.Error()
}

func (e RetryableError) Unwrap() error {
	return e.Err
}

// NewRetryableError 创建可重试错误
func NewRetryableError(err error) RetryableError {
	return RetryableError{Err: err}
}

// IsRetryableError 检查是否为可重试错误
func IsRetryableError(err error) bool {
	_, ok := err.(RetryableError)
	return ok
}

// NonRetryableError 不可重试的错误类型
type NonRetryableError struct {
	Err error
}

func (e NonRetryableError) Error() string {
	return e.Err.Error()
}

func (e NonRetryableError) Unwrap() error {
	return e.Err
}

// NewNonRetryableError 创建不可重试错误
func NewNonRetryableError(err error) NonRetryableError {
	return NonRetryableError{Err: err}
}

// IsNonRetryableError 检查是否为不可重试错误
func IsNonRetryableError(err error) bool {
	_, ok := err.(NonRetryableError)
	return ok
}

// DefaultIsRetryable 默认的重试判断函数
func DefaultIsRetryable(err error) bool {
	// 如果明确标记为不可重试，则不重试
	if IsNonRetryableError(err) {
		return false
	}

	// 如果明确标记为可重试，则重试
	if IsRetryableError(err) {
		return true
	}

	// 默认情况下，网络相关错误可重试
	errorStr := err.Error()
	retryableErrors := []string{
		"connection refused",
		"connection reset",
		"timeout",
		"temporary failure",
		"network is unreachable",
		"no such host",
		"EOF",
		"broken pipe",
		"context deadline exceeded",
	}

	for _, retryableErr := range retryableErrors {
		if contains(errorStr, retryableErr) {
			return true
		}
	}

	return false
}

// contains 检查字符串是否包含子字符串（忽略大小写）
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			len(s) > len(substr) &&
				(s[:len(substr)] == substr ||
					s[len(s)-len(substr):] == substr ||
					indexOfSubstring(s, substr) >= 0))
}

// indexOfSubstring 查找子字符串位置
func indexOfSubstring(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// RetryManager 重试管理器
type RetryManager struct {
	config RetryConfig
}

// NewRetryManager 创建重试管理器
func NewRetryManager(config RetryConfig) *RetryManager {
	return &RetryManager{
		config: config,
	}
}

// Execute 执行带重试的操作
func (rm *RetryManager) Execute(fn RetryableFunc) error {
	return Retry(fn, rm.config)
}

// ExecuteWithContext 执行带上下文和重试的操作
func (rm *RetryManager) ExecuteWithContext(ctx context.Context, fn RetryableFuncWithContext) error {
	return RetryWithContext(ctx, fn, rm.config, DefaultIsRetryable)
}

// ExecuteWithCustomRetryable 执行带自定义重试判断的操作
func (rm *RetryManager) ExecuteWithCustomRetryable(ctx context.Context, fn RetryableFuncWithContext, isRetryable IsRetryable) error {
	return RetryWithContext(ctx, fn, rm.config, isRetryable)
}

// UpdateConfig 更新重试配置
func (rm *RetryManager) UpdateConfig(config RetryConfig) {
	rm.config = config
}

// GetConfig 获取当前重试配置
func (rm *RetryManager) GetConfig() RetryConfig {
	return rm.config
}
