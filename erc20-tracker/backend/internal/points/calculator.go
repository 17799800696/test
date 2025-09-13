package points

import (
	"fmt"
	"math"
	"math/big"
	"time"

	"erc20-tracker/backend/internal/config"
	"erc20-tracker/backend/internal/database"
	"erc20-tracker/backend/pkg/logger"
)

// PointsCalculator 积分计算器
type PointsCalculator struct {
	repos  *database.Repositories
	config *config.Config
}

// NewPointsCalculator 创建积分计算器
func NewPointsCalculator(repos *database.Repositories, cfg *config.Config) *PointsCalculator {
	return &PointsCalculator{
		repos:  repos,
		config: cfg,
	}
}

// CalculatePointsForUser 为指定用户计算积分
func (pc *PointsCalculator) CalculatePointsForUser(userAddress string, chainID int64, startTime, endTime time.Time) error {
	logger.WithFields(map[string]any{
		"user":       userAddress,
		"chain_id":   chainID,
		"start_time": startTime,
		"end_time":   endTime,
	}).Debug("开始计算用户积分")

	// 获取时间范围内的余额变动记录
	changes, err := pc.repos.BalanceChange.GetChangesByTimeRange(userAddress, chainID, startTime, endTime)
	if err != nil {
		return fmt.Errorf("获取余额变动记录失败: %w", err)
	}

	// 如果没有变动记录，检查是否有余额
	if len(changes) == 0 {
		currentBalance, err := pc.repos.UserBalance.GetBalance(userAddress, chainID)
		if err != nil {
			return fmt.Errorf("获取用户余额失败: %w", err)
		}

		// 如果有余额但没有变动记录，说明余额在此时间段前就存在
		if currentBalance.Sign() > 0 {
			// 计算整个时间段的积分
			holdingHours := endTime.Sub(startTime).Hours()
			points := pc.calculatePoints(currentBalance, holdingHours)

			if err := pc.addPointsAndLog(userAddress, chainID, points, startTime, endTime, currentBalance, holdingHours); err != nil {
				return err
			}
		}
		return nil
	}

	// 计算基于时间权重的积分
	totalPoints, err := pc.calculateTimeWeightedPoints(userAddress, chainID, changes, startTime, endTime)
	if err != nil {
		return fmt.Errorf("计算时间权重积分失败: %w", err)
	}

	// 如果有积分产生，记录到数据库
	if totalPoints > 0 {
		// 计算平均余额和持有时间
		averageBalance, holdingHours := pc.calculateAverageBalance(changes, startTime, endTime)

		if err := pc.addPointsAndLog(userAddress, chainID, totalPoints, startTime, endTime, averageBalance, holdingHours); err != nil {
			return err
		}
	}

	return nil
}

// calculateTimeWeightedPoints 计算基于时间权重的积分
func (pc *PointsCalculator) calculateTimeWeightedPoints(userAddress string, chainID int64, changes []database.BalanceChange, startTime, endTime time.Time) (float64, error) {
	var totalPoints float64

	// 获取起始余额
	startBalance := big.NewInt(0)
	if len(changes) > 0 {
		startBalance = changes[0].GetBalanceBeforeBigInt()
	} else {
		// 如果没有变动记录，获取当前余额
		currentBalance, err := pc.repos.UserBalance.GetBalance(userAddress, chainID)
		if err != nil {
			return 0, fmt.Errorf("获取用户余额失败: %w", err)
		}
		startBalance = currentBalance
	}

	// 当前时间和余额
	currentTime := startTime
	currentBalance := new(big.Int).Set(startBalance)

	// 遍历每个余额变动
	for _, change := range changes {
		// 计算从当前时间到变动时间的积分
		if change.Timestamp.After(currentTime) {
			holdingDuration := change.Timestamp.Sub(currentTime)
			holdingHours := holdingDuration.Hours()

			if holdingHours > 0 && currentBalance.Sign() > 0 {
				points := pc.calculatePoints(currentBalance, holdingHours)
				totalPoints += points

				logger.WithFields(map[string]any{
					"user":          userAddress,
					"balance":       currentBalance.String(),
					"holding_hours": holdingHours,
					"points":        points,
					"period_start":  currentTime,
					"period_end":    change.Timestamp,
				}).Info("计算时间段积分")
			}
		}

		// 更新当前时间和余额
		currentTime = change.Timestamp
		currentBalance = change.GetBalanceAfterBigInt()
	}

	// 计算从最后一次变动到结束时间的积分
	if endTime.After(currentTime) && currentBalance.Sign() > 0 {
		holdingDuration := endTime.Sub(currentTime)
		holdingHours := holdingDuration.Hours()

		if holdingHours > 0 {
			points := pc.calculatePoints(currentBalance, holdingHours)
			totalPoints += points

			logger.WithFields(map[string]any{
				"user":          userAddress,
				"balance":       currentBalance.String(),
				"holding_hours": holdingHours,
				"points":        points,
				"period_start":  currentTime,
				"period_end":    endTime,
			}).Info("计算最后时间段积分")
		}
	}

	return totalPoints, nil
}

// calculatePoints 计算积分：积分 = 余额 × 0.05 × 持有时间(小时)
func (pc *PointsCalculator) calculatePoints(balance *big.Int, holdingHours float64) float64 {
	// 使用更高精度的big.Float进行计算
	balanceFloat := new(big.Float).SetInt(balance)
	balanceInEther := new(big.Float).Quo(balanceFloat, big.NewFloat(math.Pow(10, 18)))

	// 计算积分
	pointsFloat := new(big.Float).Mul(balanceInEther, big.NewFloat(0.05))
	points := new(big.Float).Mul(pointsFloat, big.NewFloat(holdingHours))

	// 如果积分小于0.0001，则返回0
	if points.Cmp(big.NewFloat(0.0001)) < 0 {
		return 0
	}

	// 四舍五入到4位小数
	result, _ := points.Float64()
	return math.Round(result*10000) / 10000
}

// calculateAverageBalance 计算平均余额和总持有时间
func (pc *PointsCalculator) calculateAverageBalance(changes []database.BalanceChange, startTime, endTime time.Time) (*big.Int, float64) {
	if len(changes) == 0 {
		return big.NewInt(0), 0
	}

	totalDuration := endTime.Sub(startTime)
	totalSeconds := totalDuration.Seconds()

	// 计算加权平均余额
	weightedSum := big.NewFloat(0)
	currentTime := startTime
	currentBalance := changes[0].GetBalanceBeforeBigInt()

	for _, change := range changes {
		if change.Timestamp.After(currentTime) {
			duration := change.Timestamp.Sub(currentTime)
			weight := duration.Seconds() / totalSeconds

			// 使用更精确的浮点计算
			balanceFloat := new(big.Float).SetInt(currentBalance)
			weightedBalance := new(big.Float).Mul(balanceFloat, big.NewFloat(weight))
			weightedSum.Add(weightedSum, weightedBalance)
		}

		currentTime = change.Timestamp
		currentBalance = change.GetBalanceAfterBigInt()
	}

	// 处理最后一段时间
	if endTime.After(currentTime) {
		duration := endTime.Sub(currentTime)
		weight := duration.Seconds() / totalSeconds

		balanceFloat := new(big.Float).SetInt(currentBalance)
		weightedBalance := new(big.Float).Mul(balanceFloat, big.NewFloat(weight))
		weightedSum.Add(weightedSum, weightedBalance)
	}

	// 转换回big.Int
	averageBalance, _ := weightedSum.Int(nil)
	return averageBalance, totalSeconds / 3600 // 返回小时数
}

// addPointsAndLog 添加积分并记录日志
func (pc *PointsCalculator) addPointsAndLog(userAddress string, chainID int64, points float64, startTime, endTime time.Time, averageBalance *big.Int, holdingHours float64) error {
	// 添加积分
	if err := pc.repos.UserPoints.AddPoints(userAddress, chainID, points, endTime); err != nil {
		return fmt.Errorf("添加用户积分失败: %w", err)
	}

	// 记录计算日志
	calcLog := &database.PointsCalculationLog{
		UserAddress:     userAddress,
		ChainID:         chainID,
		CalculationTime: time.Now().Local(),
		StartTime:       startTime,
		EndTime:         endTime,
		PointsEarned:    points,
		HoldingHours:    holdingHours,
	}
	calcLog.SetAverageBalanceFromBigInt(averageBalance)

	if err := pc.repos.PointsCalculationLog.Create(calcLog); err != nil {
		return fmt.Errorf("创建积分计算日志失败: %w", err)
	}

	logger.WithFields(map[string]any{
		"user":            userAddress,
		"chain_id":        chainID,
		"points_earned":   points,
		"average_balance": averageBalance.String(),
		"holding_hours":   holdingHours,
		"start_time":      startTime,
		"end_time":        endTime,
	}).Info("用户积分计算完成")

	return nil
}

// CalculateHourlyPoints 计算每小时积分（定时任务调用）
func (pc *PointsCalculator) CalculateHourlyPoints(endTimeOptional ...time.Time) error {
	// 如果没有指定endTime，则默认使用当前时间
	var endTime time.Time
	if len(endTimeOptional) > 0 {
		endTime = endTimeOptional[0]
	} else {
		endTime = time.Now().Local()
	}

	logger.WithFields(map[string]any{
		"end_time": endTime,
	}).Info("开始每小时积分计算")

	// 为每个启用的链计算积分
	for _, chain := range pc.config.GetEnabledChains() {
		if err := pc.calculatePointsForChain(chain.ChainID, endTime); err != nil {
			logger.WithFields(map[string]any{
				"error":    err,
				"chain_id": chain.ChainID,
				"chain":    chain.Name,
			}).Error("链积分计算失败")
			// 继续处理其他链
			continue
		}
	}
	return nil
}

// TestCalculatePoints 手动测试积分计算功能
func (pc *PointsCalculator) TestCalculatePoints(endTimeOptional ...time.Time) error {
	// 如果没有指定endTime，则默认使用当前时间
	var endTime time.Time
	if len(endTimeOptional) > 0 {
		endTime = endTimeOptional[0]
	} else {
		endTime = time.Now().Local()
	}

	logger.WithFields(map[string]any{
		"end_time": endTime,
	}).Info("开始测试积分计算")

	// 为每个启用的链计算积分
	for _, chain := range pc.config.GetEnabledChains() {
		if err := pc.calculatePointsForChain(chain.ChainID, endTime); err != nil {
			logger.WithFields(map[string]any{
				"error":    err,
				"chain_id": chain.ChainID,
				"chain":    chain.Name,
			}).Error("测试积分计算失败")
			return err
		}
	}

	logger.Info("测试积分计算完成")
	return nil
}

// calculatePointsForChain 为指定链计算积分
func (pc *PointsCalculator) calculatePointsForChain(chainID int64, endTime time.Time) error {
	// 获取需要计算积分的用户（最后计算时间早于endTime的用户）以及每个人的last_calculated_at
	usersMap, err := pc.getUsersLastCalculatedAt(chainID, endTime)
	if err != nil {
		return fmt.Errorf("获取需要计算积分的用户失败: %w", err)
	}

	// 如果没有需要计算积分的用户，则返回
	if len(usersMap) == 0 {
		return nil
	}

	logger.WithFields(map[string]any{
		"chain_id":    chainID,
		"users_count": len(usersMap),
		"end_time":    endTime,
	}).Info("开始为链计算用户积分")

	// 为每个用户计算积分
	for userAddress, startTime := range usersMap {
		if err := pc.CalculatePointsForUser(userAddress, chainID, startTime, endTime); err != nil {
			logger.WithFields(map[string]any{
				"error":    err,
				"user":     userAddress,
				"chain_id": chainID,
			}).Error("用户积分计算失败")
			// 继续处理其他用户
			continue
		}

		// 计算完成之后要将endTime（也就是最新的last_calculated_at）更新到user_points表中的相应字段中
		if err := pc.repos.UserPoints.AddPoints(userAddress, chainID, 0, endTime); err != nil {
			logger.WithFields(map[string]any{
				"error":    err,
				"user":     userAddress,
				"chain_id": chainID,
				"end_time": endTime,
			}).Error("更新用户最后计算时间失败")
			// 继续处理其他用户
			continue
		}
	}

	return nil
}

func (pc *PointsCalculator) getUsersLastCalculatedAt(chainID int64, endTime time.Time) (map[string]time.Time, error) {
	// 先查询有哪些users符合当前的条件（chainID, last_calculated_at < endTime）
	users, err := pc.repos.UserPoints.GetUsersNeedingCalculation(chainID, endTime)
	if err != nil {
		return nil, fmt.Errorf("获取用户失败: %w", err)
	}
	usersMap := make(map[string]time.Time)
	for _, user := range users {
		usersMap[user.UserAddress] = user.LastCalculatedAt
	}

	return usersMap, nil
}

// BackfillPoints 回溯计算积分
func (pc *PointsCalculator) BackfillPoints(fromTime, toTime time.Time) error {
	logger.WithFields(map[string]any{
		"from_time": fromTime,
		"to_time":   toTime,
	}).Info("开始积分回溯计算")

	// 按小时分割时间段
	currentTime := fromTime
	for currentTime.Before(toTime) {
		nextHour := currentTime.Add(time.Hour)
		if nextHour.After(toTime) {
			nextHour = toTime
		}

		// 为每个启用的链计算这一小时的积分
		for _, chain := range pc.config.GetEnabledChains() {
			if err := pc.calculatePointsForChain(chain.ChainID, nextHour); err != nil {
				logger.WithFields(map[string]any{
					"error":    err,
					"chain_id": chain.ChainID,
					"end_time": nextHour,
				}).Error("回溯积分计算失败")
				// 继续处理其他链
				continue
			}
		}

		currentTime = nextHour
	}

	logger.Info("积分回溯计算完成")
	return nil
}
