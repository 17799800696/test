package event

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"

	"erc20-tracker/backend/internal/config"
	"erc20-tracker/backend/internal/database"
	"erc20-tracker/backend/pkg/logger"
)

// ERC20 ABI for Transfer, Mint, Burn events
const ERC20ABI = `[
	{
		"anonymous": false,
		"inputs": [
			{"indexed": true, "name": "from", "type": "address"},
			{"indexed": true, "name": "to", "type": "address"},
			{"indexed": false, "name": "value", "type": "uint256"}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{"indexed": true, "name": "to", "type": "address"},
			{"indexed": false, "name": "amount", "type": "uint256"},
			{"indexed": false, "name": "timestamp", "type": "uint256"}
		],
		"name": "TokenMinted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{"indexed": true, "name": "from", "type": "address"},
			{"indexed": false, "name": "amount", "type": "uint256"},
			{"indexed": false, "name": "timestamp", "type": "uint256"}
		],
		"name": "TokenBurned",
		"type": "event"
	}
]`

// EventListener 事件监听器
type EventListener struct {
	client          *ethclient.Client
	contractABI     abi.ABI
	contractAddress common.Address
	chainConfig     config.ChainConfig
	repos           *database.Repositories
	ctx             context.Context
	cancel          context.CancelFunc
}

// NewEventListener 创建事件监听器
func NewEventListener(chainConfig config.ChainConfig, repos *database.Repositories) (*EventListener, error) {
	// 连接以太坊客户端
	client, err := ethclient.Dial(chainConfig.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("连接RPC失败: %w", err)
	}

	// 解析合约ABI
	contractABI, err := abi.JSON(strings.NewReader(ERC20ABI))
	if err != nil {
		return nil, fmt.Errorf("解析ABI失败: %w", err)
	}

	// 解析合约地址
	contractAddress := common.HexToAddress(chainConfig.ContractAddress)

	ctx, cancel := context.WithCancel(context.Background())

	return &EventListener{
		client:          client,
		contractABI:     contractABI,
		contractAddress: contractAddress,
		chainConfig:     chainConfig,
		repos:           repos,
		ctx:             ctx,
		cancel:          cancel,
	}, nil
}

// Start 开始监听事件
func (el *EventListener) Start(confirmationBlocks int) error {
	logger.WithFields(logger.WithFields(map[string]interface{}{
		"chain":    el.chainConfig.Name,
		"chain_id": el.chainConfig.ChainID,
		"contract": el.contractAddress.Hex(),
	}).Data).Info("开始事件监听")

	// 获取最后同步的区块号
	lastSyncedBlock, err := el.repos.BlockSyncStatus.GetLastSyncedBlock(el.chainConfig.ChainID)
	if err != nil {
		return fmt.Errorf("获取最后同步区块失败: %w", err)
	}

	// 如果是第一次运行且配置了起始区块，使用配置的起始区块
	if lastSyncedBlock == 0 && el.chainConfig.StartBlock > 0 {
		lastSyncedBlock = el.chainConfig.StartBlock
	}

	logger.WithField("last_synced_block", lastSyncedBlock).Info("从区块开始同步")

	// 启动历史事件同步
	go el.syncHistoricalEvents(lastSyncedBlock, confirmationBlocks)

	// 启动实时事件监听
	go el.listenRealTimeEvents(confirmationBlocks)

	return nil
}

// Stop 停止监听
func (el *EventListener) Stop() {
	logger.WithField("chain", el.chainConfig.Name).Info("停止事件监听")
	el.cancel()
	el.client.Close()
}

// syncHistoricalEvents 同步历史事件
func (el *EventListener) syncHistoricalEvents(fromBlock uint64, confirmationBlocks int) {
	logger.WithFields(map[string]interface{}{
		"chain":      el.chainConfig.Name,
		"from_block": fromBlock,
	}).Info("开始同步历史事件")

	for {
		select {
		case <-el.ctx.Done():
			return
		default:
		}

		// 获取当前最新区块号
		latestBlock, err := el.client.BlockNumber(el.ctx)
		if err != nil {
			logger.WithField("error", err).Error("获取最新区块号失败")
			time.Sleep(10 * time.Second)
			continue
		}

		// 计算确认后的区块号
		confirmedBlock := int64(latestBlock) - int64(confirmationBlocks)
		if confirmedBlock <= int64(fromBlock) {
			// 没有新的确认区块，等待
			time.Sleep(10 * time.Second)
			continue
		}

		// 批量处理区块，避免一次查询太多
		batchSize := uint64(1000)
		toBlock := fromBlock + batchSize
		if toBlock > uint64(confirmedBlock) {
			toBlock = uint64(confirmedBlock)
		}

		// 处理这批区块的事件
		if err := el.processBlockRange(fromBlock, toBlock); err != nil {
			logger.WithFields(map[string]interface{}{
				"error":      err,
				"from_block": fromBlock,
				"to_block":   toBlock,
			}).Error("处理区块范围事件失败")
			time.Sleep(5 * time.Second)
			continue
		}

		// 更新同步状态
		if err := el.repos.BlockSyncStatus.UpdateLastSyncedBlock(el.chainConfig.ChainID, toBlock); err != nil {
			logger.WithField("error", err).Error("更新同步状态失败")
		}

		fromBlock = toBlock + 1

		// 如果已经同步到最新确认区块，等待新区块
		if fromBlock > uint64(confirmedBlock) {
			time.Sleep(10 * time.Second)
		}
	}
}

// listenRealTimeEvents 监听实时事件（使用轮询方式）
func (el *EventListener) listenRealTimeEvents(confirmationBlocks int) {
	logger.WithField("chain", el.chainConfig.Name).Info("开始实时事件监听")

	// 尝试WebSocket订阅，如果失败则使用轮询
	query := ethereum.FilterQuery{
		Addresses: []common.Address{el.contractAddress},
		Topics: [][]common.Hash{
			{
				el.contractABI.Events["Transfer"].ID,
				el.contractABI.Events["TokenMinted"].ID,
				el.contractABI.Events["TokenBurned"].ID,
			},
		},
	}

	// 尝试创建日志订阅
	logs := make(chan types.Log)
	sub, err := el.client.SubscribeFilterLogs(el.ctx, query, logs)
	if err != nil {
		logger.WithField("error", err).Error("创建日志订阅失败")
		logger.WithField("chain", el.chainConfig.Name).Info("切换到轮询模式监听事件")
		// 使用轮询模式
		el.pollForEvents(confirmationBlocks)
		return
	}
	defer sub.Unsubscribe()

	// WebSocket订阅模式
	for {
		select {
		case <-el.ctx.Done():
			return
		case err := <-sub.Err():
			logger.WithField("error", err).Error("日志订阅错误")
			return
		case vLog := <-logs:
			// 等待确认
			go el.waitAndProcessLog(vLog, confirmationBlocks)
		}
	}
}

// pollForEvents 轮询监听事件
func (el *EventListener) pollForEvents(confirmationBlocks int) {
	ticker := time.NewTicker(10 * time.Second) // 每10秒轮询一次
	defer ticker.Stop()

	// 获取当前最后同步的区块号
	lastSyncedBlock, err := el.repos.BlockSyncStatus.GetLastSyncedBlock(el.chainConfig.ChainID)
	if err != nil {
		logger.WithField("error", err).Error("获取最后同步区块失败")
		return
	}

	for {
		select {
		case <-el.ctx.Done():
			return
		case <-ticker.C:
			// 获取当前最新区块号
			latestBlock, err := el.client.BlockNumber(el.ctx)
			if err != nil {
				logger.WithField("error", err).Error("获取最新区块号失败")
				continue
			}

			// 计算确认后的区块号
			confirmedBlock := int64(latestBlock) - int64(confirmationBlocks)
			if confirmedBlock <= int64(lastSyncedBlock) {
				continue
			}

			// 处理新区块的事件
			toBlock := uint64(confirmedBlock)
			if err := el.processBlockRange(lastSyncedBlock+1, toBlock); err != nil {
				logger.WithFields(map[string]interface{}{
					"error":      err,
					"from_block": lastSyncedBlock + 1,
					"to_block":   toBlock,
				}).Error("轮询处理区块事件失败")
				continue
			}

			// 更新同步状态
			if err := el.repos.BlockSyncStatus.UpdateLastSyncedBlock(el.chainConfig.ChainID, toBlock); err != nil {
				logger.WithField("error", err).Error("更新同步状态失败")
			}

			lastSyncedBlock = toBlock
			logger.WithFields(map[string]interface{}{
				"chain":      el.chainConfig.Name,
				"last_block": lastSyncedBlock,
			}).Debug("轮询事件监听更新")
		}
	}
}

// waitAndProcessLog 等待确认后处理日志
func (el *EventListener) waitAndProcessLog(vLog types.Log, confirmationBlocks int) {
	// 等待确认
	for {
		select {
		case <-el.ctx.Done():
			return
		default:
		}

		currentBlock, err := el.client.BlockNumber(el.ctx)
		if err != nil {
			logger.WithField("error", err).Error("获取当前区块号失败")
			time.Sleep(5 * time.Second)
			continue
		}

		if currentBlock >= vLog.BlockNumber+uint64(confirmationBlocks) {
			// 已确认，处理事件
			if err := el.processLog(vLog); err != nil {
				logger.WithFields(map[string]interface{}{
					"error":   err,
					"tx_hash": vLog.TxHash.Hex(),
				}).Error("处理事件失败")
			}
			return
		}

		// 等待更多确认
		time.Sleep(10 * time.Second)
	}
}

// processBlockRange 处理区块范围内的事件
func (el *EventListener) processBlockRange(fromBlock, toBlock uint64) error {
	// 创建事件查询
	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(fromBlock)),
		ToBlock:   big.NewInt(int64(toBlock)),
		Addresses: []common.Address{el.contractAddress},
		Topics: [][]common.Hash{
			{
				el.contractABI.Events["Transfer"].ID,
				el.contractABI.Events["TokenMinted"].ID,
				el.contractABI.Events["TokenBurned"].ID,
			},
		},
	}

	// 查询日志
	logs, err := el.client.FilterLogs(el.ctx, query)
	if err != nil {
		return fmt.Errorf("查询日志失败: %w", err)
	}

	logger.WithFields(map[string]interface{}{
		"from_block": fromBlock,
		"to_block":   toBlock,
		"logs_count": len(logs),
	}).Debug("处理区块范围事件")

	// 处理每个日志
	for _, vLog := range logs {
		if err := el.processLog(vLog); err != nil {
			logger.WithFields(map[string]interface{}{
				"error":   err,
				"tx_hash": vLog.TxHash.Hex(),
			}).Error("处理事件失败")
			// 继续处理其他事件，不因单个事件失败而停止
		}
	}

	return nil
}

// processLog 处理单个日志事件
func (el *EventListener) processLog(vLog types.Log) error {
	// 检查是否已处理过此交易
	exists, err := el.repos.BalanceChange.ExistsByTxHash(vLog.TxHash.Hex())
	if err != nil {
		return fmt.Errorf("检查交易是否存在失败: %w", err)
	}
	if exists {
		// 已处理过，跳过
		return nil
	}

	// 获取区块信息以获取时间戳
	block, err := el.client.BlockByNumber(el.ctx, big.NewInt(int64(vLog.BlockNumber)))
	if err != nil {
		return fmt.Errorf("获取区块信息失败: %w", err)
	}

	timestamp := time.Unix(int64(block.Time()), 0).Local()

	// 根据事件类型处理
	switch vLog.Topics[0] {
	case el.contractABI.Events["Transfer"].ID:
		return el.processTransferEvent(vLog, timestamp)
	case el.contractABI.Events["TokenMinted"].ID:
		return el.processMintEvent(vLog, timestamp)
	case el.contractABI.Events["TokenBurned"].ID:
		return el.processBurnEvent(vLog, timestamp)
	default:
		logger.WithField("topic", vLog.Topics[0].Hex()).Warn("未知事件类型")
	}

	return nil
}

// processTransferEvent 处理转账事件
func (el *EventListener) processTransferEvent(vLog types.Log, timestamp time.Time) error {
	// 检查交易是否已经处理过
	txHash := vLog.TxHash.Hex()
	exists, err := el.repos.BalanceChange.ExistsByTxHash(txHash)
	if err != nil {
		return fmt.Errorf("检查交易重复性失败: %w", err)
	}
	if exists {
		logger.WithFields(map[string]interface{}{
			"tx_hash": txHash,
			"event":   "Transfer",
		}).Debug("Transfer事件已处理，跳过重复处理")
		return nil
	}

	// 解析事件数据
	event := struct {
		From  common.Address
		To    common.Address
		Value *big.Int
	}{}

	if err := el.contractABI.UnpackIntoInterface(&event, "Transfer", vLog.Data); err != nil {
		return fmt.Errorf("解析Transfer事件失败: %w", err)
	}

	// 从topics中获取indexed参数
	event.From = common.HexToAddress(vLog.Topics[1].Hex())
	event.To = common.HexToAddress(vLog.Topics[2].Hex())

	logger.WithFields(map[string]interface{}{
		"from":    event.From.Hex(),
		"to":      event.To.Hex(),
		"value":   event.Value.String(),
		"tx_hash": txHash,
		"block":   vLog.BlockNumber,
	}).Debug("处理Transfer事件")

	// 处理发送方余额变动（如果不是mint）
	if event.From != (common.Address{}) {
		if err := el.updateUserBalanceWithoutDuplicateCheck(event.From.Hex(), event.Value, database.ChangeTypeTransferOut, vLog, timestamp, false); err != nil {
			return fmt.Errorf("更新发送方余额失败: %w", err)
		}
	}

	// 处理接收方余额变动（如果不是burn）
	if event.To != (common.Address{}) {
		if err := el.updateUserBalanceWithoutDuplicateCheck(event.To.Hex(), event.Value, database.ChangeTypeTransferIn, vLog, timestamp, true); err != nil {
			return fmt.Errorf("更新接收方余额失败: %w", err)
		}
	}

	return nil
}

// processMintEvent 处理铸造事件
func (el *EventListener) processMintEvent(vLog types.Log, timestamp time.Time) error {
	// 解析事件数据
	event := struct {
		To        common.Address
		Amount    *big.Int
		Timestamp *big.Int
	}{}

	if err := el.contractABI.UnpackIntoInterface(&event, "TokenMinted", vLog.Data); err != nil {
		return fmt.Errorf("解析TokenMinted事件失败: %w", err)
	}

	// 从topics中获取indexed参数
	event.To = common.HexToAddress(vLog.Topics[1].Hex())

	logger.WithFields(map[string]interface{}{
		"to":      event.To.Hex(),
		"amount":  event.Amount.String(),
		"tx_hash": vLog.TxHash.Hex(),
		"block":   vLog.BlockNumber,
	}).Debug("处理TokenMinted事件")

	return el.updateUserBalance(event.To.Hex(), event.Amount, database.ChangeTypeMint, vLog, timestamp, true)
}

// processBurnEvent 处理销毁事件
func (el *EventListener) processBurnEvent(vLog types.Log, timestamp time.Time) error {
	// 解析事件数据
	event := struct {
		From      common.Address
		Amount    *big.Int
		Timestamp *big.Int
	}{}

	if err := el.contractABI.UnpackIntoInterface(&event, "TokenBurned", vLog.Data); err != nil {
		return fmt.Errorf("解析TokenBurned事件失败: %w", err)
	}

	// 从topics中获取indexed参数
	event.From = common.HexToAddress(vLog.Topics[1].Hex())

	logger.WithFields(map[string]interface{}{
		"from":    event.From.Hex(),
		"amount":  event.Amount.String(),
		"tx_hash": vLog.TxHash.Hex(),
		"block":   vLog.BlockNumber,
	}).Debug("处理TokenBurned事件")

	return el.updateUserBalance(event.From.Hex(), event.Amount, database.ChangeTypeBurn, vLog, timestamp, false)
}

// updateUserBalance 更新用户余额
func (el *EventListener) updateUserBalance(userAddress string, amount *big.Int, changeType string, vLog types.Log, timestamp time.Time, isIncrease bool) error {
	// 检查交易是否已经处理过
	txHash := vLog.TxHash.Hex()
	exists, err := el.repos.BalanceChange.ExistsByTxHash(txHash)
	if err != nil {
		return fmt.Errorf("检查交易重复性失败: %w", err)
	}
	if exists {
		logger.WithFields(map[string]interface{}{
			"tx_hash": txHash,
			"user":    userAddress,
		}).Debug("交易已处理，跳过重复处理")
		return nil // 交易已处理，直接返回成功
	}

	return el.updateUserBalanceWithoutDuplicateCheck(userAddress, amount, changeType, vLog, timestamp, isIncrease)
}

// updateUserBalanceWithoutDuplicateCheck 更新用户余额（不进行重复检查）
// 用于Transfer事件中已经在上层检查过重复性的情况
func (el *EventListener) updateUserBalanceWithoutDuplicateCheck(userAddress string, amount *big.Int, changeType string, vLog types.Log, timestamp time.Time, isIncrease bool) error {
	txHash := vLog.TxHash.Hex()

	// 获取当前余额
	currentBalance, err := el.repos.UserBalance.GetBalance(userAddress, el.chainConfig.ChainID)
	if err != nil {
		return fmt.Errorf("获取用户余额失败: %w", err)
	}

	// 计算新余额
	newBalance := new(big.Int).Set(currentBalance)
	if isIncrease {
		newBalance.Add(newBalance, amount)
	} else {
		newBalance.Sub(newBalance, amount)
	}

	// 确保余额不为负数
	if newBalance.Sign() < 0 {
		newBalance.SetInt64(0)
	}

	// 更新数据库中的余额
	if err := el.repos.UserBalance.UpdateBalance(userAddress, el.chainConfig.ChainID, newBalance); err != nil {
		return fmt.Errorf("更新用户余额失败: %w", err)
	}

	// 记录余额变动
	balanceChange := &database.BalanceChange{
		UserAddress: userAddress,
		ChainID:     el.chainConfig.ChainID,
		TxHash:      txHash,
		BlockNumber: vLog.BlockNumber,
		ChangeType:  changeType,
		Timestamp:   timestamp,
		Processed:   false,
	}
	balanceChange.SetBalancesFromBigInt(currentBalance, newBalance, amount)

	if err := el.repos.BalanceChange.Create(balanceChange); err != nil {
		return fmt.Errorf("创建余额变动记录失败: %w", err)
	}

	logger.WithFields(map[string]interface{}{
		"user":        userAddress,
		"change_type": changeType,
		"amount":      amount.String(),
		"old_balance": currentBalance.String(),
		"new_balance": newBalance.String(),
		"tx_hash":     txHash,
	}).Info("用户余额已更新")

	return nil
}
