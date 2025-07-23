package main

import (
    "context"
    "crypto/ecdsa"
    "fmt"
    "log"
    "math/big"

    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/core/types"
    "github.com/ethereum/go-ethereum/crypto"
    "github.com/ethereum/go-ethereum/ethclient"
)

func main() {
    // 连接到Sepolia测试网络
    client, err := ethclient.Dial("https://sepolia.infura.io/v3/79a9402a07c440ca94ca94d75d77171b")
    if err != nil {
        log.Fatalf("无法连接到以太坊客户端: %v", err)
    }

    // 任务1: 查询区块信息
    blockNumber := big.NewInt(3000000) // 示例区块号
    block, err := client.BlockByNumber(context.Background(), blockNumber)
    if err != nil {
        log.Fatalf("无法获取区块: %v", err)
    }

    fmt.Printf("区块 #%d\n", block.Number().Uint64())
    fmt.Printf("哈希: %s\n", block.Hash().Hex())
    fmt.Printf("时间戳: %d\n", block.Time())
    fmt.Printf("交易数量: %d\n", len(block.Transactions()))
    fmt.Println("-----------------------------------")

    //任务2: 发送交易
    privateKey, err := crypto.HexToECDSA("3a5beda8d7840a5b8a68a09c358e1f75e0fc78adf4fc54d814546e05046316de")
    if err != nil {
        log.Fatalf("无法解析私钥: %v", err)
    }

    publicKey := privateKey.Public()
    publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
    if !ok {
        log.Fatal("无法将公钥转换为ECDSA格式")
    }

    fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)
    
    // 检查余额
    balance, err := client.BalanceAt(context.Background(), fromAddress, nil)
    if err != nil {
        log.Fatalf("获取余额失败: %v", err)
    }
    fmt.Printf("当前余额: %s ETH\n", weiToEth(balance).String())

    nonce, err := client.PendingNonceAt(context.Background(), fromAddress)
    if err != nil {
        log.Fatalf("获取nonce失败: %v", err)
    }

    value := big.NewInt(500000000000000) // 5e14 wei = 0.0005 ETH
    
    // 使用固定gas价格（示例：20 Gwei）
    gasPrice := big.NewInt(20000000000) // 20 Gwei = 20e9 wei
    gasLimit := uint64(21000)           // 标准转账的gas限制

    // 计算预计的总费用（value + gas）
    gasCost := new(big.Int).Mul(gasPrice, big.NewInt(int64(gasLimit)))
    totalCost := new(big.Int).Add(value, gasCost)
    
    fmt.Printf("转账金额: %s ETH\n", weiToEth(value).String())
    fmt.Printf("Gas费用: %s ETH\n", weiToEth(gasCost).String())
    fmt.Printf("总费用: %s ETH\n", weiToEth(totalCost).String())

    // 检查余额是否足够
    if balance.Cmp(totalCost) < 0 {
        log.Fatalf("余额不足: 需要 %s ETH，可用 %s ETH", 
            weiToEth(totalCost).String(), 
            weiToEth(balance).String())
    }

    toAddress := common.HexToAddress("0xE971aDC9d3A539aA8fd9A30Feaf06215CA7b1E68")
    var data []byte

    tx := types.NewTransaction(nonce, toAddress, value, gasLimit, gasPrice, data)

    chainID, err := client.NetworkID(context.Background())
    if err != nil {
        log.Fatalf("获取链ID失败: %v", err)
    }

    signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
    if err != nil {
        log.Fatalf("签名交易失败: %v", err)
    }

    err = client.SendTransaction(context.Background(), signedTx)
    if err != nil {
        log.Fatalf("发送交易失败: %v", err)
    }

    fmt.Printf("交易已发送: %s\n", signedTx.Hash().Hex())
    fmt.Println("查看交易状态: https://sepolia.etherscan.io/tx/" + signedTx.Hash().Hex())
}

// 辅助函数：将wei转换为ETH
func weiToEth(wei *big.Int) *big.Float {
    ethValue := new(big.Float)
    ethValue.SetString(wei.String())
    return ethValue.Quo(ethValue, big.NewFloat(1e18))
}