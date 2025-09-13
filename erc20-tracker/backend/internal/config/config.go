package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config 应用配置结构
type Config struct {
	// 数据库配置
	Database DatabaseConfig `json:"database"`

	// 区块链配置
	Chains []ChainConfig `json:"chains"`

	// 系统配置
	System SystemConfig `json:"system"`

	// 日志配置
	Logging LoggingConfig `json:"logging"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	DBName   string `json:"db_name"`
	Charset  string `json:"charset"`
	TimeZone string `json:"timezone"`
}

// ChainConfig 区块链配置
type ChainConfig struct {
	Name            string `json:"name"`
	ChainID         int64  `json:"chain_id"`
	RPCURL          string `json:"rpc_url"`
	ContractAddress string `json:"contract_address"`
	StartBlock      uint64 `json:"start_block"`
	Enabled         bool   `json:"enabled"`
}

// SystemConfig 系统配置
type SystemConfig struct {
	ConfirmationBlocks        int           `json:"confirmation_blocks"`
	PointsCalculationInterval time.Duration `json:"points_calculation_interval"`
	RetryMaxAttempts          int           `json:"retry_max_attempts"`
	RetryDelay                time.Duration `json:"retry_delay"`
	EventBatchSize            int           `json:"event_batch_size"`
	BlockScanInterval         time.Duration `json:"block_scan_interval"`
}

// LoggingConfig 日志配置
type LoggingConfig struct {
	Level    string `json:"level"`
	FilePath string `json:"file_path"`
	MaxSize  int    `json:"max_size"`
	MaxAge   int    `json:"max_age"`
	Compress bool   `json:"compress"`
}

// LoadConfig 加载配置
func LoadConfig() (*Config, error) {
	// 加载.env文件
	if err := godotenv.Load(); err != nil {
		// .env文件不存在时不报错，使用系统环境变量
		fmt.Println("Warning: .env file not found, using system environment variables")
	}

	config := &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvAsInt("DB_PORT", 3306),
			User:     getEnv("DB_USER", "root"),
			Password: getEnv("DB_PASSWORD", ""),
			DBName:   getEnv("DB_NAME", "erc20_tracker"),
			Charset:  getEnv("DB_CHARSET", "utf8mb4"),
			TimeZone: getEnv("DB_TIMEZONE", "Asia/Shanghai"),
		},
		Chains: []ChainConfig{
			{
				Name:            "Sepolia",
				ChainID:         11155111,
				RPCURL:          getEnv("SEPOLIA_RPC_URL", ""),
				ContractAddress: getEnv("SEPOLIA_CONTRACT_ADDRESS", ""),
				StartBlock:      getEnvAsUint64("SEPOLIA_START_BLOCK", 0),
				Enabled:         getEnv("SEPOLIA_CONTRACT_ADDRESS", "") != "",
			},
			{
				Name:            "Base Sepolia",
				ChainID:         84532,
				RPCURL:          getEnv("BASE_SEPOLIA_RPC_URL", ""),
				ContractAddress: getEnv("BASE_SEPOLIA_CONTRACT_ADDRESS", ""),
				StartBlock:      getEnvAsUint64("BASE_SEPOLIA_START_BLOCK", 0),
				Enabled:         getEnv("BASE_SEPOLIA_CONTRACT_ADDRESS", "") != "",
			},
		},
		System: SystemConfig{
			ConfirmationBlocks:        getEnvAsInt("CONFIRMATION_BLOCKS", 6),
			PointsCalculationInterval: getEnvAsDuration("POINTS_CALCULATION_INTERVAL", "1h"),
			RetryMaxAttempts:          getEnvAsInt("RETRY_MAX_ATTEMPTS", 3),
			RetryDelay:                getEnvAsDuration("RETRY_DELAY", "5s"),
			EventBatchSize:            getEnvAsInt("EVENT_BATCH_SIZE", 100),
			BlockScanInterval:         getEnvAsDuration("BLOCK_SCAN_INTERVAL", "10s"),
		},
		Logging: LoggingConfig{
			Level:    getEnv("LOG_LEVEL", "info"),
			FilePath: getEnv("LOG_FILE", "logs/app.log"),
			MaxSize:  getEnvAsInt("LOG_MAX_SIZE", 100),
			MaxAge:   getEnvAsInt("LOG_MAX_AGE", 30),
			Compress: getEnvAsBool("LOG_COMPRESS", true),
		},
	}

	// 验证配置
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("配置验证失败: %w", err)
	}

	return config, nil
}

// Validate 验证配置
func (c *Config) Validate() error {
	// 验证数据库配置
	if c.Database.Host == "" {
		return fmt.Errorf("数据库主机地址不能为空")
	}
	if c.Database.User == "" {
		return fmt.Errorf("数据库用户名不能为空")
	}
	if c.Database.DBName == "" {
		return fmt.Errorf("数据库名称不能为空")
	}

	// 验证至少有一个启用的链
	enabledChains := 0
	for _, chain := range c.Chains {
		if chain.Enabled {
			if chain.RPCURL == "" {
				return fmt.Errorf("链 %s 的RPC URL不能为空", chain.Name)
			}
			if chain.ContractAddress == "" {
				return fmt.Errorf("链 %s 的合约地址不能为空", chain.Name)
			}
			enabledChains++
		}
	}
	if enabledChains == 0 {
		return fmt.Errorf("至少需要启用一个区块链")
	}

	// 验证系统配置
	if c.System.ConfirmationBlocks < 1 {
		return fmt.Errorf("确认区块数必须大于0")
	}
	if c.System.RetryMaxAttempts < 1 {
		return fmt.Errorf("最大重试次数必须大于0")
	}

	return nil
}

// GetDSN 获取数据库连接字符串
func (c *Config) GetDSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local",
		c.Database.User,
		c.Database.Password,
		c.Database.Host,
		c.Database.Port,
		c.Database.DBName,
		c.Database.Charset,
	)
}

// GetEnabledChains 获取启用的链配置
func (c *Config) GetEnabledChains() []ChainConfig {
	var enabled []ChainConfig
	for _, chain := range c.Chains {
		if chain.Enabled {
			enabled = append(enabled, chain)
		}
	}
	return enabled
}

// 辅助函数
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsUint64(key string, defaultValue uint64) uint64 {
	if value := os.Getenv(key); value != "" {
		if uint64Value, err := strconv.ParseUint(value, 10, 64); err == nil {
			return uint64Value
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvAsDuration(key, defaultValue string) time.Duration {
	value := getEnv(key, defaultValue)
	if duration, err := time.ParseDuration(value); err == nil {
		return duration
	}
	// 如果解析失败，使用默认值
	if duration, err := time.ParseDuration(defaultValue); err == nil {
		return duration
	}
	// 最后的备用值
	return time.Hour
}
