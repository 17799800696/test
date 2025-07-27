package main

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/test/client/voting/vote-contract"
)

func main() {
	// 连接到Sepolia测试网络
	client, err := ethclient.Dial("https://sepolia.infura.io/v3/79a9402a07c440ca94ca94d75d77171b")
	if err != nil {
		log.Fatalf("连接到Sepolia网络失败: %v", err)
	}

	// 您部署的Voting合约地址
	contractAddress := common.HexToAddress("0xd4066694b589729eCEe134142EB76AF84ea34812")

	// 创建合约实例
	contract, err := voting.NewVoting(contractAddress, client)
	if err != nil {
		log.Fatalf("创建合约实例失败: %v", err)
	}

	fmt.Println("🗳️  Voting合约交互演示")
	fmt.Println("===================")

	// 1. 查询当前候选人列表
	fmt.Println("1. 查询当前候选人列表:")
	candidates, err := contract.GetAllCandidates(nil)
	if err != nil {
		log.Fatalf("获取候选人列表失败: %v", err)
	}

	if len(candidates) == 0 {
		fmt.Println("暂无候选人")
	} else {
		for i, candidate := range candidates {
			votes, err := contract.GetVotes(nil, candidate)
			if err != nil {
				log.Printf("获取候选人 %s 得票数失败: %v", candidate, err)
				continue
			}
			fmt.Printf("%d. %s: %d票\n", i+1, candidate, votes.Int64())
		}
	}

	// 2. 查询候选人总数
	count, err := contract.GetCandidateCount(nil)
	if err != nil {
		log.Fatalf("获取候选人总数失败: %v", err)
	}
	fmt.Printf("\n候选人总数: %d\n\n", count.Int64())

	// 3. 准备交易发送者（使用与task2相同的配置）
	privateKey, err := crypto.HexToECDSA("3a5beda8d7840a5b8a68a09c358e1f75e0fc78adf4fc54d814546e05046316de")
	if err != nil {
		log.Fatalf("解析私钥失败: %v", err)
	}

	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		log.Fatal("转换公钥失败")
	}

	fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)
	nonce, err := client.PendingNonceAt(context.Background(), fromAddress)
	if err != nil {
		log.Fatalf("获取nonce失败: %v", err)
	}

	gasPrice, err := client.SuggestGasPrice(context.Background())
	if err != nil {
		log.Fatalf("获取gas价格失败: %v", err)
	}

	chainID, err := client.NetworkID(context.Background())
	if err != nil {
		log.Fatalf("获取chainId失败: %v", err)
	}

	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		log.Fatalf("创建Transactor失败: %v", err)
	}
	auth.Nonce = big.NewInt(int64(nonce))
	auth.Value = big.NewInt(0)
	auth.GasLimit = uint64(300000)
	auth.GasPrice = gasPrice

	// 4. 演示投票功能
	fmt.Println("2. 开始投票演示:")
	candidatesToVote := []string{"张三", "李四", "王五"}

	for _, candidate := range candidatesToVote {
		fmt.Printf("正在为 '%s' 投票...\n", candidate)
		tx, err := contract.Vote(auth, candidate)
		if err != nil {
			log.Printf("为 %s 投票失败: %v\n", candidate, err)
			continue
		}

		fmt.Printf("投票交易已发送: %s\n", tx.Hash().Hex())
		fmt.Printf("查看交易: https://sepolia.etherscan.io/tx/%s\n", tx.Hash().Hex())

		// 等待交易确认
		fmt.Println("等待交易确认...")
		receipt, err := bind.WaitMined(context.Background(), client, tx)
		if err != nil {
			log.Printf("等待交易确认失败: %v\n", err)
			continue
		}

		if receipt.Status == 0 {
			log.Printf("为 %s 投票的交易执行失败\n", candidate)
			continue
		}

		fmt.Printf("✓ 为 '%s' 投票成功!\n\n", candidate)

		// 更新nonce
		auth.Nonce = big.NewInt(auth.Nonce.Int64() + 1)
	}

	// 5. 查询投票后的结果
	fmt.Println("3. 投票后的结果:")
	updatedCandidates, err := contract.GetAllCandidates(nil)
	if err != nil {
		log.Fatalf("获取更新后的候选人列表失败: %v", err)
	}

	for i, candidate := range updatedCandidates {
		votes, err := contract.GetVotes(nil, candidate)
		if err != nil {
			log.Printf("获取候选人 %s 得票数失败: %v", candidate, err)
			continue
		}
		fmt.Printf("%d. %s: %d票\n", i+1, candidate, votes.Int64())
	}

	// 6. 演示查询特定候选人得票数
	fmt.Println("\n4. 查询特定候选人得票数:")
	for _, candidate := range candidatesToVote {
		votes, err := contract.GetVotes(nil, candidate)
		if err != nil {
			log.Printf("查询 %s 得票数失败: %v\n", candidate, err)
			continue
		}
		fmt.Printf("%s 的得票数: %d\n", candidate, votes.Int64())
	}

	// 7. 演示重置投票功能（可选）
	fmt.Println("正在重置所有投票...")
	resetTx, err := contract.ResetVotes(auth)
	if err != nil {
		log.Printf("重置投票失败: %v\n", err)
	} else {
		fmt.Printf("重置交易已发送: %s\n", resetTx.Hash().Hex())
		fmt.Printf("查看交易: https://sepolia.etherscan.io/tx/%s\n", resetTx.Hash().Hex())

		// 等待交易确认
		fmt.Println("等待重置交易确认...")
		resetReceipt, err := bind.WaitMined(context.Background(), client, resetTx)
		if err != nil {
			log.Printf("等待重置交易确认失败: %v\n", err)
		} else if resetReceipt.Status == 0 {
			log.Println("重置交易执行失败")
		} else {
			fmt.Println("✓ 投票重置成功!")

			// 查询重置后的结果
			fmt.Println("\n重置后的结果:")
			for _, candidate := range updatedCandidates {
				votes, err := contract.GetVotes(nil, candidate)
				if err != nil {
					log.Printf("获取候选人 %s 得票数失败: %v", candidate, err)
					continue
				}
				fmt.Printf("%s: %d票\n", candidate, votes.Int64())
			}
		}
	}
}