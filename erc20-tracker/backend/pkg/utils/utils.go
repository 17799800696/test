package utils

import (
	"fmt"
	"math"
	"math/big"
	"strings"
	"time"
)

// FormatTokenAmount 格式化代币数量显示
func FormatTokenAmount(amount *big.Int, decimals int) string {
	if amount == nil {
		return "0"
	}

	// 创建除数 (10^decimals)
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)

	// 计算整数部分
	integerPart := new(big.Int).Div(amount, divisor)

	// 计算小数部分
	remainder := new(big.Int).Mod(amount, divisor)

	if remainder.Sign() == 0 {
		return integerPart.String()
	}

	// 格式化小数部分
	fractionalPart := remainder.String()
	// 补齐前导零
	for len(fractionalPart) < decimals {
		fractionalPart = "0" + fractionalPart
	}

	// 移除尾随零
	fractionalPart = strings.TrimRight(fractionalPart, "0")

	if fractionalPart == "" {
		return integerPart.String()
	}

	return integerPart.String() + "." + fractionalPart
}

// ParseTokenAmount 解析代币数量
func ParseTokenAmount(amount string, decimals int) (*big.Int, error) {
	if amount == "" {
		return big.NewInt(0), nil
	}

	// 分割整数和小数部分
	parts := strings.Split(amount, ".")
	if len(parts) > 2 {
		return nil, fmt.Errorf("无效的数字格式: %s", amount)
	}

	integerPart := parts[0]
	fractionalPart := ""
	if len(parts) == 2 {
		fractionalPart = parts[1]
	}

	// 限制小数位数
	if len(fractionalPart) > decimals {
		fractionalPart = fractionalPart[:decimals]
	}

	// 补齐小数位数
	for len(fractionalPart) < decimals {
		fractionalPart += "0"
	}

	// 组合完整数字
	fullAmount := integerPart + fractionalPart

	// 转换为big.Int
	result := new(big.Int)
	result, ok := result.SetString(fullAmount, 10)
	if !ok {
		return nil, fmt.Errorf("无法解析数字: %s", amount)
	}

	return result, nil
}

// TruncateToHour 将时间截断到小时
func TruncateToHour(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, t.Location())
}

// GetHourRange 获取指定时间所在小时的开始和结束时间
func GetHourRange(t time.Time) (start, end time.Time) {
	start = TruncateToHour(t)
	end = start.Add(time.Hour)
	return
}

// IsValidAddress 验证以太坊地址格式
func IsValidAddress(address string) bool {
	if len(address) != 42 {
		return false
	}

	if !strings.HasPrefix(address, "0x") {
		return false
	}

	// 检查是否为有效的十六进制字符
	for _, char := range address[2:] {
		if !((char >= '0' && char <= '9') ||
			(char >= 'a' && char <= 'f') ||
			(char >= 'A' && char <= 'F')) {
			return false
		}
	}

	return true
}

// IsValidTxHash 验证交易哈希格式
func IsValidTxHash(hash string) bool {
	if len(hash) != 66 {
		return false
	}

	if !strings.HasPrefix(hash, "0x") {
		return false
	}

	// 检查是否为有效的十六进制字符
	for _, char := range hash[2:] {
		if !((char >= '0' && char <= '9') ||
			(char >= 'a' && char <= 'f') ||
			(char >= 'A' && char <= 'F')) {
			return false
		}
	}

	return true
}

// SafeDivide 安全除法，避免除零错误
func SafeDivide(a, b *big.Int) *big.Float {
	if b.Sign() == 0 {
		return big.NewFloat(0)
	}

	result := new(big.Float).SetInt(a)
	divisor := new(big.Float).SetInt(b)
	return result.Quo(result, divisor)
}

// MinBigInt 返回两个big.Int中的较小值
func MinBigInt(a, b *big.Int) *big.Int {
	if a.Cmp(b) < 0 {
		return new(big.Int).Set(a)
	}
	return new(big.Int).Set(b)
}

// MaxBigInt 返回两个big.Int中的较大值
func MaxBigInt(a, b *big.Int) *big.Int {
	if a.Cmp(b) > 0 {
		return new(big.Int).Set(a)
	}
	return new(big.Int).Set(b)
}

// AbsBigInt 返回big.Int的绝对值
func AbsBigInt(a *big.Int) *big.Int {
	result := new(big.Int).Set(a)
	if result.Sign() < 0 {
		result.Neg(result)
	}
	return result
}

// FormatDuration 格式化时间间隔
func FormatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%.1f秒", d.Seconds())
	}
	if d < time.Hour {
		return fmt.Sprintf("%.1f分钟", d.Minutes())
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%.1f小时", d.Hours())
	}
	return fmt.Sprintf("%.1f天", d.Hours()/24)
}

// RoundToDecimals 将浮点数四舍五入到指定小数位
func RoundToDecimals(value float64, decimals int) float64 {
	multiplier := math.Pow(10, float64(decimals))
	return math.Round(value*multiplier) / multiplier
}

// ContainsString 检查字符串切片是否包含指定字符串
func ContainsString(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// RemoveString 从字符串切片中移除指定字符串
func RemoveString(slice []string, item string) []string {
	result := make([]string, 0, len(slice))
	for _, s := range slice {
		if s != item {
			result = append(result, s)
		}
	}
	return result
}

// UniqueStrings 去除字符串切片中的重复项
func UniqueStrings(slice []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(slice))

	for _, s := range slice {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}

	return result
}

// ChunkSlice 将切片分割成指定大小的块
func ChunkSlice[T any](slice []T, chunkSize int) [][]T {
	if chunkSize <= 0 {
		return nil
	}

	var chunks [][]T
	for i := 0; i < len(slice); i += chunkSize {
		end := i + chunkSize
		if end > len(slice) {
			end = len(slice)
		}
		chunks = append(chunks, slice[i:end])
	}

	return chunks
}

// Retry 简单的重试函数
func Retry(attempts int, delay time.Duration, fn func() error) error {
	var err error
	for i := 0; i < attempts; i++ {
		err = fn()
		if err == nil {
			return nil
		}

		if i < attempts-1 {
			time.Sleep(delay)
		}
	}
	return err
}
