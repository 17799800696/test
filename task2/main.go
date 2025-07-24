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

	// 导入生成的绑定包（根据你的实际包名调整）
	"github.com/test/client/task2/counter"
)

func main() {
	// 连接到Sepolia测试网络
	client, err := ethclient.Dial("https://sepolia.infura.io/v3/79a9402a07c440ca94ca94d75d77171b")
	if err != nil {
		log.Fatalf("连接到Sepolia网络失败: %v", err)
	}

	// 合约地址
	contractAddress := common.HexToAddress("0x94C6335dC38af266f8e8E8d9631adE2F59935065")

	// 创建合约实例
	contract, err := counter.NewCounter(contractAddress, client)
	if err != nil {
		log.Fatalf("创建合约实例失败: %v", err)
	}

	// 1. 查询当前计数器值
	count, err := contract.Count(nil)
	if err != nil {
		log.Fatalf("获取计数器值失败: %v", err)
	}
	fmt.Printf("当前计数器值: %d\n", count.Int64())

	// 2. 准备交易发送者（需要私钥）
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
		log.Fatalf("get chainId err %v", err)
	}
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		log.Fatalf("创建Transactor失败: %v", err)
	}
	auth.Nonce = big.NewInt(int64(nonce))
	auth.Value = big.NewInt(0)     // 不转账ETH，仅调用函数
	auth.GasLimit = uint64(300000) // 设置足够的gas上限
	auth.GasPrice = gasPrice

	// 3. 调用increment方法增加计数器
	fmt.Println("正在发送交易以增加计数器...")
	tx, err := contract.Increment(auth)
	if err != nil {
		log.Fatalf("调用increment失败: %v", err)
	}

	fmt.Printf("交易已发送: %s\n", tx.Hash().Hex())
	fmt.Printf("查看交易状态: https://sepolia.etherscan.io/tx/%s\n", tx.Hash().Hex())

	// 4. 等待交易确认
	fmt.Println("等待交易确认...")
	receipt, err := bind.WaitMined(context.Background(), client, tx)
	if err != nil {
		log.Fatalf("等待交易确认失败: %v", err)
	}

	if receipt.Status == 0 {
		log.Fatal("交易执行失败")
	}

	fmt.Println("交易已确认!")

	// 5. 查询更新后的计数器值
	newCount, err := contract.Count(nil)
	if err != nil {
		log.Fatalf("获取新计数器值失败: %v", err)
	}
	fmt.Printf("更新后的计数器值: %d\n", newCount.Int64())
}
