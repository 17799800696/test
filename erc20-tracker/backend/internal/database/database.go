package database

import (
	"fmt"
	"math/big"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"erc20-tracker/backend/internal/config"
)

// DB 数据库实例
type DB struct {
	*gorm.DB
}

// NewDB 创建数据库连接
func NewDB(cfg *config.Config) (*DB, error) {
	dsn := cfg.GetDSN()

	// 配置GORM日志级别
	logLevel := logger.Info
	switch cfg.Logging.Level {
	case "debug":
		logLevel = logger.Info
	case "warn":
		logLevel = logger.Warn
	case "error":
		logLevel = logger.Error
	default:
		logLevel = logger.Silent
	}

	// 连接数据库
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %w", err)
	}

	// 获取底层sql.DB以配置连接池
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("获取SQL DB失败: %w", err)
	}

	// 配置连接池
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// 自动迁移数据库表
	if err := AutoMigrate(db); err != nil {
		return nil, fmt.Errorf("数据库迁移失败: %w", err)
	}

	return &DB{DB: db}, nil
}

// UserBalanceRepository 用户余额仓库
type UserBalanceRepository struct {
	db *DB
}

// NewUserBalanceRepository 创建用户余额仓库
func NewUserBalanceRepository(db *DB) *UserBalanceRepository {
	return &UserBalanceRepository{db: db}
}

// GetOrCreate 获取或创建用户余额记录
func (r *UserBalanceRepository) GetOrCreate(userAddress string, chainID int64) (*UserBalance, error) {
	var balance UserBalance
	err := r.db.Where("user_address = ? AND chain_id = ?", userAddress, chainID).First(&balance).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// 创建新记录
			balance = UserBalance{
				UserAddress: userAddress,
				ChainID:     chainID,
				Balance:     "0",
			}
			if err := r.db.Create(&balance).Error; err != nil {
				return nil, fmt.Errorf("创建用户余额记录失败: %w", err)
			}
		} else {
			return nil, fmt.Errorf("查询用户余额失败: %w", err)
		}
	}
	return &balance, nil
}

// UpdateBalance 更新用户余额
func (r *UserBalanceRepository) UpdateBalance(userAddress string, chainID int64, newBalance *big.Int) error {
	balance, err := r.GetOrCreate(userAddress, chainID)
	if err != nil {
		return err
	}

	balance.SetBalanceFromBigInt(newBalance)
	return r.db.Save(balance).Error
}

// GetBalance 获取用户余额
func (r *UserBalanceRepository) GetBalance(userAddress string, chainID int64) (*big.Int, error) {
	balance, err := r.GetOrCreate(userAddress, chainID)
	if err != nil {
		return nil, err
	}
	return balance.GetBalanceBigInt(), nil
}

// BalanceChangeRepository 余额变动仓库
type BalanceChangeRepository struct {
	db *DB
}

// NewBalanceChangeRepository 创建余额变动仓库
func NewBalanceChangeRepository(db *DB) *BalanceChangeRepository {
	return &BalanceChangeRepository{db: db}
}

// Create 创建余额变动记录
func (r *BalanceChangeRepository) Create(change *BalanceChange) error {
	return r.db.Create(change).Error
}

// GetUnprocessedChanges 获取未处理的余额变动记录
func (r *BalanceChangeRepository) GetUnprocessedChanges(userAddress string, chainID int64, startTime, endTime time.Time) ([]BalanceChange, error) {
	var changes []BalanceChange
	err := r.db.Where("user_address = ? AND chain_id = ? AND timestamp >= ? AND timestamp < ? AND processed = ?",
		userAddress, chainID, startTime, endTime, false).Order("timestamp ASC").Find(&changes).Error
	return changes, err
}

// MarkAsProcessed 标记为已处理
func (r *BalanceChangeRepository) MarkAsProcessed(ids []uint64) error {
	return r.db.Model(&BalanceChange{}).Where("id IN ?", ids).Update("processed", true).Error
}

// GetChangesByTimeRange 获取时间范围内的变动记录
func (r *BalanceChangeRepository) GetChangesByTimeRange(userAddress string, chainID int64, startTime, endTime time.Time) ([]BalanceChange, error) {
	var changes []BalanceChange
	query := r.db.Where("chain_id = ? AND timestamp >= ? AND timestamp < ?", chainID, startTime, endTime)

	// 如果指定了用户地址，则添加用户地址条件
	if userAddress != "" {
		query = query.Where("user_address = ?", userAddress)
	}

	err := query.Order("timestamp ASC").Find(&changes).Error
	return changes, err
}

// ExistsByTxHash 检查交易哈希是否已存在
func (r *BalanceChangeRepository) ExistsByTxHash(txHash string) (bool, error) {
	var count int64
	err := r.db.Model(&BalanceChange{}).Where("tx_hash = ?", txHash).Count(&count).Error
	return count > 0, err
}

// UserPointsRepository 用户积分仓库
type UserPointsRepository struct {
	db *DB
}

// NewUserPointsRepository 创建用户积分仓库
func NewUserPointsRepository(db *DB) *UserPointsRepository {
	return &UserPointsRepository{db: db}
}

// GetOrCreate 获取或创建用户积分记录
func (r *UserPointsRepository) GetOrCreate(userAddress string, chainID int64) (*UserPoints, error) {
	var points UserPoints
	err := r.db.Where("user_address = ? AND chain_id = ?", userAddress, chainID).First(&points).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// 创建新记录
			points = UserPoints{
				UserAddress:      userAddress,
				ChainID:          chainID,
				TotalPoints:      0,
				LastCalculatedAt: time.Now().UTC(),
			}
			if err := r.db.Create(&points).Error; err != nil {
				return nil, fmt.Errorf("创建用户积分记录失败: %w", err)
			}
		} else {
			return nil, fmt.Errorf("查询用户积分失败: %w", err)
		}
	}
	return &points, nil
}

// AddPoints 增加积分
func (r *UserPointsRepository) AddPoints(userAddress string, chainID int64, points float64, calculatedAt time.Time) error {
	userPoints, err := r.GetOrCreate(userAddress, chainID)
	if err != nil {
		return err
	}

	userPoints.TotalPoints += points
	userPoints.LastCalculatedAt = calculatedAt
	return r.db.Save(userPoints).Error
}

// GetPoints 获取用户积分
func (r *UserPointsRepository) GetPoints(userAddress string, chainID int64) (float64, error) {
	points, err := r.GetOrCreate(userAddress, chainID)
	if err != nil {
		return 0, err
	}
	return points.TotalPoints, nil
}

// GetUsersNeedingCalculation 获取需要计算积分的用户
func (r *UserPointsRepository) GetUsersNeedingCalculation(chainID int64, beforeTime time.Time) ([]UserPoints, error) {
	var users []UserPoints
	err := r.db.Where("chain_id = ? AND last_calculated_at < ?", chainID, beforeTime).Find(&users).Error
	return users, err
}

// BlockSyncStatusRepository 区块同步状态仓库
type BlockSyncStatusRepository struct {
	db *DB
}

// NewBlockSyncStatusRepository 创建区块同步状态仓库
func NewBlockSyncStatusRepository(db *DB) *BlockSyncStatusRepository {
	return &BlockSyncStatusRepository{db: db}
}

// GetOrCreate 获取或创建同步状态
func (r *BlockSyncStatusRepository) GetOrCreate(chainID int64) (*BlockSyncStatus, error) {
	var status BlockSyncStatus
	err := r.db.Where("chain_id = ?", chainID).First(&status).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// 创建新记录
			status = BlockSyncStatus{
				ChainID:         chainID,
				LastSyncedBlock: 0,
				LastSyncedAt:    time.Now().UTC(),
			}
			if err := r.db.Create(&status).Error; err != nil {
				return nil, fmt.Errorf("创建同步状态记录失败: %w", err)
			}
		} else {
			return nil, fmt.Errorf("查询同步状态失败: %w", err)
		}
	}
	return &status, nil
}

// UpdateLastSyncedBlock 更新最后同步的区块
func (r *BlockSyncStatusRepository) UpdateLastSyncedBlock(chainID int64, blockNumber uint64) error {
	status, err := r.GetOrCreate(chainID)
	if err != nil {
		return err
	}

	status.LastSyncedBlock = blockNumber
	status.LastSyncedAt = time.Now().UTC()
	return r.db.Save(status).Error
}

// GetLastSyncedBlock 获取最后同步的区块号
func (r *BlockSyncStatusRepository) GetLastSyncedBlock(chainID int64) (uint64, error) {
	status, err := r.GetOrCreate(chainID)
	if err != nil {
		return 0, err
	}
	return status.LastSyncedBlock, nil
}

// PointsCalculationLogRepository 积分计算日志仓库
type PointsCalculationLogRepository struct {
	db *DB
}

// NewPointsCalculationLogRepository 创建积分计算日志仓库
func NewPointsCalculationLogRepository(db *DB) *PointsCalculationLogRepository {
	return &PointsCalculationLogRepository{db: db}
}

// Create 创建积分计算日志
func (r *PointsCalculationLogRepository) Create(log *PointsCalculationLog) error {
	return r.db.Create(log).Error
}

// GetLastCalculationTime 获取用户最后计算时间
func (r *PointsCalculationLogRepository) GetLastCalculationTime(userAddress string, chainID int64) (time.Time, error) {
	var log PointsCalculationLog
	err := r.db.Where("user_address = ? AND chain_id = ?", userAddress, chainID).
		Order("calculation_time DESC").First(&log).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return time.Time{}, nil // 返回零值时间
		}
		return time.Time{}, err
	}
	return log.CalculationTime, nil
}

// Repositories 仓库集合
type Repositories struct {
	UserBalance          *UserBalanceRepository
	BalanceChange        *BalanceChangeRepository
	UserPoints           *UserPointsRepository
	BlockSyncStatus      *BlockSyncStatusRepository
	PointsCalculationLog *PointsCalculationLogRepository
}

// NewRepositories 创建仓库集合
func NewRepositories(db *DB) *Repositories {
	return &Repositories{
		UserBalance:          NewUserBalanceRepository(db),
		BalanceChange:        NewBalanceChangeRepository(db),
		UserPoints:           NewUserPointsRepository(db),
		BlockSyncStatus:      NewBlockSyncStatusRepository(db),
		PointsCalculationLog: NewPointsCalculationLogRepository(db),
	}
}
