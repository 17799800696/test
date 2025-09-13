package database

import (
	"math/big"
	"time"

	"gorm.io/gorm"
)

// UserBalance 用户余额表
type UserBalance struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserAddress string    `gorm:"type:varchar(42);not null;index:idx_user_chain,unique" json:"user_address"`
	ChainID     int64     `gorm:"not null;index:idx_user_chain,unique" json:"chain_id"`
	Balance     string    `gorm:"type:decimal(65,0);not null;default:0" json:"balance"` // 使用字符串存储大数
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName 指定表名
func (UserBalance) TableName() string {
	return "user_balances"
}

// GetBalanceBigInt 获取余额的big.Int表示
func (ub *UserBalance) GetBalanceBigInt() *big.Int {
	balance := new(big.Int)
	balance.SetString(ub.Balance, 10)
	return balance
}

// SetBalanceFromBigInt 从big.Int设置余额
func (ub *UserBalance) SetBalanceFromBigInt(balance *big.Int) {
	ub.Balance = balance.String()
}

// UserPoints 用户积分表
type UserPoints struct {
	ID               uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserAddress      string    `gorm:"type:varchar(42);not null;index:idx_user_chain_points,unique" json:"user_address"`
	ChainID          int64     `gorm:"not null;index:idx_user_chain_points,unique" json:"chain_id"`
	TotalPoints      float64   `gorm:"type:decimal(20,8);not null;default:0" json:"total_points"`
	LastCalculatedAt time.Time `gorm:"not null" json:"last_calculated_at"`
	CreatedAt        time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName 指定表名
func (UserPoints) TableName() string {
	return "user_points"
}

// BalanceChange 余额变动记录表
type BalanceChange struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserAddress   string    `gorm:"type:varchar(42);not null;index:idx_user_time" json:"user_address"`
	ChainID       int64     `gorm:"not null;index:idx_chain" json:"chain_id"`
	TxHash        string    `gorm:"type:varchar(66);not null;index:idx_tx_hash,unique" json:"tx_hash"`
	BlockNumber   uint64    `gorm:"not null;index:idx_block" json:"block_number"`
	BalanceBefore string    `gorm:"type:decimal(65,0);not null" json:"balance_before"`
	BalanceAfter  string    `gorm:"type:decimal(65,0);not null" json:"balance_after"`
	ChangeAmount  string    `gorm:"type:decimal(65,0);not null" json:"change_amount"`
	ChangeType    string    `gorm:"type:varchar(20);not null" json:"change_type"` // mint, burn, transfer_in, transfer_out
	Timestamp     time.Time `gorm:"not null;index:idx_user_time" json:"timestamp"`
	Processed     bool      `gorm:"not null;default:false;index:idx_processed" json:"processed"` // 是否已处理积分计算
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// TableName 指定表名
func (BalanceChange) TableName() string {
	return "balance_changes"
}

// GetBalanceBeforeBigInt 获取变动前余额的big.Int表示
func (bc *BalanceChange) GetBalanceBeforeBigInt() *big.Int {
	balance := new(big.Int)
	balance.SetString(bc.BalanceBefore, 10)
	return balance
}

// GetBalanceAfterBigInt 获取变动后余额的big.Int表示
func (bc *BalanceChange) GetBalanceAfterBigInt() *big.Int {
	balance := new(big.Int)
	balance.SetString(bc.BalanceAfter, 10)
	return balance
}

// GetChangeAmountBigInt 获取变动金额的big.Int表示
func (bc *BalanceChange) GetChangeAmountBigInt() *big.Int {
	amount := new(big.Int)
	amount.SetString(bc.ChangeAmount, 10)
	return amount
}

// SetBalancesFromBigInt 从big.Int设置余额
func (bc *BalanceChange) SetBalancesFromBigInt(before, after, change *big.Int) {
	bc.BalanceBefore = before.String()
	bc.BalanceAfter = after.String()
	bc.ChangeAmount = change.String()
}

// BlockSyncStatus 区块同步状态表
type BlockSyncStatus struct {
	ID              uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	ChainID         int64     `gorm:"not null;uniqueIndex" json:"chain_id"`
	LastSyncedBlock uint64    `gorm:"not null;default:0" json:"last_synced_block"`
	LastSyncedAt    time.Time `gorm:"not null" json:"last_synced_at"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName 指定表名
func (BlockSyncStatus) TableName() string {
	return "block_sync_status"
}

// PointsCalculationLog 积分计算日志表
type PointsCalculationLog struct {
	ID              uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserAddress     string    `gorm:"type:varchar(42);not null;index:idx_user_calc" json:"user_address"`
	ChainID         int64     `gorm:"not null;index:idx_user_calc" json:"chain_id"`
	CalculationTime time.Time `gorm:"not null;index:idx_user_calc" json:"calculation_time"`
	StartTime       time.Time `gorm:"not null" json:"start_time"`
	EndTime         time.Time `gorm:"not null" json:"end_time"`
	PointsEarned    float64   `gorm:"type:decimal(20,8);not null" json:"points_earned"`
	AverageBalance  string    `gorm:"type:decimal(65,0);not null" json:"average_balance"`
	HoldingHours    float64   `gorm:"type:decimal(10,4);not null" json:"holding_hours"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// TableName 指定表名
func (PointsCalculationLog) TableName() string {
	return "points_calculation_logs"
}

// GetAverageBalanceBigInt 获取平均余额的big.Int表示
func (pcl *PointsCalculationLog) GetAverageBalanceBigInt() *big.Int {
	balance := new(big.Int)
	balance.SetString(pcl.AverageBalance, 10)
	return balance
}

// SetAverageBalanceFromBigInt 从big.Int设置平均余额
func (pcl *PointsCalculationLog) SetAverageBalanceFromBigInt(balance *big.Int) {
	pcl.AverageBalance = balance.String()
}

// SystemConfig 系统配置表
type SystemConfig struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	ConfigKey   string    `gorm:"type:varchar(100);not null;uniqueIndex" json:"config_key"`
	ConfigValue string    `gorm:"type:text;not null" json:"config_value"`
	Description string    `gorm:"type:varchar(255)" json:"description"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName 指定表名
func (SystemConfig) TableName() string {
	return "system_configs"
}

// 常量定义
const (
	// 变动类型
	ChangeTypeMint        = "mint"
	ChangeTypeBurn        = "burn"
	ChangeTypeTransferIn  = "transfer_in"
	ChangeTypeTransferOut = "transfer_out"

	// 系统配置键
	ConfigKeyPointsRate   = "points_rate"        // 积分计算比率
	ConfigKeyLastBackfill = "last_backfill_time" // 最后回溯时间
)

// AutoMigrate 自动迁移数据库表
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&UserBalance{},
		&UserPoints{},
		&BalanceChange{},
		&BlockSyncStatus{},
		&PointsCalculationLog{},
		&SystemConfig{},
	)
}
