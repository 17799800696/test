package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/robfig/cron/v3"

	"erc20-tracker/backend/internal/config"
	"erc20-tracker/backend/internal/database"
	"erc20-tracker/backend/internal/event"
	"erc20-tracker/backend/internal/points"
	"erc20-tracker/backend/internal/retry"
	"erc20-tracker/backend/pkg/logger"
)

// Application 应用程序结构
type Application struct {
	config     *config.Config
	db         *database.DB
	repos      *database.Repositories
	listeners  []*event.EventListener
	calculator *points.PointsCalculator
	retryMgr   *retry.RetryManager
	cronJob    *cron.Cron
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
}

// NewApplication 创建应用程序实例
func NewApplication() (*Application, error) {
	// 加载配置
	cfg, err := config.LoadConfig()
	if err != nil {
		return nil, fmt.Errorf("加载配置失败: %w", err)
	}

	// 初始化日志
	if err := logger.InitLogger(&cfg.Logging); err != nil {
		return nil, fmt.Errorf("初始化日志失败: %w", err)
	}

	logger.Info("ERC20代币追踪系统启动中...")

	// 连接数据库
	db, err := database.NewDB(cfg)
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %w", err)
	}

	logger.Info("数据库连接成功")

	// 创建仓库
	repos := database.NewRepositories(db)

	// 创建重试管理器
	retryConfig := retry.RetryConfig{
		MaxAttempts: cfg.System.RetryMaxAttempts,
		Delay:       cfg.System.RetryDelay,
		Backoff:     retry.ExponentialBackoff,
	}
	retryMgr := retry.NewRetryManager(retryConfig)

	// 创建积分计算器
	calculator := points.NewPointsCalculator(repos, cfg)

	// 创建上下文
	ctx, cancel := context.WithCancel(context.Background())

	return &Application{
		config:     cfg,
		db:         db,
		repos:      repos,
		listeners:  make([]*event.EventListener, 0),
		calculator: calculator,
		retryMgr:   retryMgr,
		ctx:        ctx,
		cancel:     cancel,
	}, nil
}

// Start 启动应用程序
func (app *Application) Start() error {
	logger.Info("启动ERC20代币追踪系统")

	// 启动事件监听器
	if err := app.startEventListeners(); err != nil {
		return fmt.Errorf("启动事件监听器失败: %w", err)
	}

	// 启动定时任务
	//if err := app.startCronJobs(); err != nil {
	//	return fmt.Errorf("启动定时任务失败: %w", err)
	//}

	// 检查是否需要回溯计算积分
	if err := app.checkAndBackfillPoints(); err != nil {
		logger.WithField("error", err).Warn("积分回溯检查失败")
	}

	logger.Info("ERC20代币追踪系统启动完成")

	// 立即执行积分计算测试
	if err := app.testPointsCalculation(); err != nil {
		logger.WithField("error", err).Error("积分计算测试失败，但系统继续运行")
	}

	return nil
}

// startEventListeners 启动事件监听器
func (app *Application) startEventListeners() error {
	enabledChains := app.config.GetEnabledChains()
	if len(enabledChains) == 0 {
		return fmt.Errorf("没有启用的区块链")
	}

	logger.WithField("chains_count", len(enabledChains)).Info("启动事件监听器")

	for _, chainConfig := range enabledChains {
		listener, err := event.NewEventListener(chainConfig, app.repos)
		if err != nil {
			return fmt.Errorf("创建事件监听器失败 (链: %s): %w", chainConfig.Name, err)
		}

		// 使用重试机制启动监听器
		err = app.retryMgr.ExecuteWithContext(app.ctx, func(ctx context.Context) error {
			return listener.Start(app.config.System.ConfirmationBlocks)
		})
		if err != nil {
			return fmt.Errorf("启动事件监听器失败 (链: %s): %w", chainConfig.Name, err)
		}

		app.listeners = append(app.listeners, listener)
		logger.WithFields(map[string]interface{}{
			"chain":    chainConfig.Name,
			"chain_id": chainConfig.ChainID,
			"contract": chainConfig.ContractAddress,
		}).Info("事件监听器启动成功")
	}

	return nil
}

// startCronJobs 启动定时任务
func (app *Application) startCronJobs() error {
	logger.Info("启动定时任务")

	// 创建cron调度器
	app.cronJob = cron.New(cron.WithSeconds())

	// 添加每小时积分计算任务
	_, err := app.cronJob.AddFunc("0 0 * * * *", func() {
		logger.Info("开始执行每小时积分计算任务")

		err := app.retryMgr.ExecuteWithContext(app.ctx, func(ctx context.Context) error {
			return app.calculator.CalculateHourlyPoints()
		})
		if err != nil {
			logger.WithField("error", err).Error("每小时积分计算失败")
		} else {
			logger.Info("每小时积分计算完成")
		}
	})
	if err != nil {
		return fmt.Errorf("添加积分计算任务失败: %w", err)
	}

	// 添加每日健康检查任务
	_, err = app.cronJob.AddFunc("0 0 0 * * *", func() {
		logger.Info("执行每日健康检查")
		app.performHealthCheck()
	})
	if err != nil {
		return fmt.Errorf("添加健康检查任务失败: %w", err)
	}

	// 启动cron调度器
	app.cronJob.Start()
	logger.Info("定时任务启动成功")

	return nil
}

// checkAndBackfillPoints 检查并回溯计算积分
func (app *Application) checkAndBackfillPoints() error {
	logger.Info("检查是否需要回溯计算积分")

	// 这里可以实现检查逻辑，比如检查系统配置中的最后回溯时间
	// 如果发现有缺失的时间段，则进行回溯计算

	return nil
}

// testPointsCalculation 测试积分计算功能
func (app *Application) testPointsCalculation() error {
	logger.Info("开始测试积分计算功能")

	// 执行测试积分计算
	if err := app.calculator.TestCalculatePoints(); err != nil {
		logger.WithField("error", err).Error("积分计算测试失败")
		return err
	}

	logger.Info("积分计算测试完成")
	return nil
}

// performHealthCheck 执行健康检查
func (app *Application) performHealthCheck() {
	logger.Info("开始健康检查")

	// 检查数据库连接
	sqlDB, err := app.db.DB.DB()
	if err != nil {
		logger.WithField("error", err).Error("获取数据库连接失败")
		return
	}

	if err := sqlDB.Ping(); err != nil {
		logger.WithField("error", err).Error("数据库连接检查失败")
	} else {
		logger.Info("数据库连接正常")
	}

	// 检查每个链的最后同步状态
	for _, chain := range app.config.GetEnabledChains() {
		lastBlock, err := app.repos.BlockSyncStatus.GetLastSyncedBlock(chain.ChainID)
		if err != nil {
			logger.WithFields(map[string]interface{}{
				"error":    err,
				"chain_id": chain.ChainID,
			}).Error("获取链同步状态失败")
			continue
		}

		logger.WithFields(map[string]interface{}{
			"chain":      chain.Name,
			"chain_id":   chain.ChainID,
			"last_block": lastBlock,
		}).Info("链同步状态")
	}

	logger.Info("健康检查完成")
}

// Stop 停止应用程序
func (app *Application) Stop() {
	logger.Info("正在停止ERC20代币追踪系统...")

	// 取消上下文
	app.cancel()

	// 停止定时任务
	if app.cronJob != nil {
		app.cronJob.Stop()
		logger.Info("定时任务已停止")
	}

	// 停止事件监听器
	for _, listener := range app.listeners {
		listener.Stop()
	}
	logger.Info("事件监听器已停止")

	// 等待所有goroutine完成
	app.wg.Wait()

	// 关闭数据库连接
	if app.db != nil {
		sqlDB, err := app.db.DB.DB()
		if err == nil {
			sqlDB.Close()
		}
		logger.Info("数据库连接已关闭")
	}

	logger.Info("ERC20代币追踪系统已停止")
}

// Run 运行应用程序
func (app *Application) Run() error {
	// 启动应用程序
	if err := app.Start(); err != nil {
		return err
	}

	// 设置信号处理
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 等待停止信号
	select {
	case sig := <-sigChan:
		logger.WithField("signal", sig).Info("收到停止信号")
	case <-app.ctx.Done():
		logger.Info("应用程序上下文已取消")
	}

	// 停止应用程序
	app.Stop()
	return nil
}

func main() {
	// 创建应用程序实例
	app, err := NewApplication()
	if err != nil {
		fmt.Printf("创建应用程序失败: %v\n", err)
		os.Exit(1)
	}

	// 运行应用程序
	if err := app.Run(); err != nil {
		logger.WithField("error", err).Fatal("应用程序运行失败")
		os.Exit(1)
	}
}
