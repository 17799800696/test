package main

import (
	"context"
	"fmt"
	"log"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/rpc"
)

func main() {
	client, err := ethclient.Dial("https://eth.w3node.com/3929aae67922ce11638cee1a386e301c91b558b7692bf880372b54fcb191870f/api")
	if err != nil {
		log.Fatal(err)
	}

	chainID, err := client.ChainID(context.Background())
	if err != nil {
		log.Fatal(err)
	}

	blockNumber := big.NewInt(5671744)
	block, err := client.BlockByNumber(context.Background(), blockNumber)
	if err != nil {
		log.Fatal(err)
	}

	for _, tx := range block.Transactions() {
		fmt.Println(tx.Hash().Hex())        // 0x20294a03e8766e9aeab58327fc4112756017c6c28f6f99c7722f4a29075601c5
		fmt.Println(tx.Value().String())    // 100000000000000000
		fmt.Println(tx.Gas())               // 21000
		fmt.Println(tx.GasPrice().Uint64()) // 100000000000
		fmt.Println(tx.Nonce())             // 245132
		fmt.Println(tx.Data())              // []
		fmt.Println(tx.To().Hex())          // 0x8F9aFd209339088Ced7Bc0f57Fe08566ADda3587

		if sender, err := types.Sender(types.NewEIP155Signer(chainID), tx); err == nil {
			fmt.Println("sender", sender.Hex()) // 0x2CdA41645F2dBffB852a605E92B185501801FC28
		} else {
			log.Fatal(err)
		}

		receipt, err := client.TransactionReceipt(context.Background(), tx.Hash())
		if err != nil {
			log.Fatal(err)
		}

		fmt.Println(receipt.Status) // 1
		fmt.Println(receipt.Logs)   // []
		break
	}

	blockHash := common.HexToHash("0xae713dea1419ac72b928ebe6ba9915cd4fc1ef125a606f90f5e783c47cb1a4b5")
	// 替换 TransactionCount 调用为自定义函数
	rpcClient, err := rpc.Dial("https://eth.w3node.com/3929aae67922ce11638cee1a386e301c91b558b7692bf880372b54fcb191870f/api")
	if err != nil {
		log.Fatal(err)
	}
	count, err := getBlockTransactionCountByHash(rpcClient, blockHash.Hex())
	if err != nil {
		log.Fatal(err)
	}

	for idx := uint(0); idx < uint(count); idx++ {
		tx, err := client.TransactionInBlock(context.Background(), blockHash, idx)
		if err != nil {
			log.Fatal(err)
		}

		fmt.Println(tx.Hash().Hex()) // 0x20294a03e8766e9aeab58327fc4112756017c6c28f6f99c7722f4a29075601c5
		break
	}

	txHash := common.HexToHash("0x20294a03e8766e9aeab58327fc4112756017c6c28f6f99c7722f4a29075601c5")
	tx, isPending, err := client.TransactionByHash(context.Background(), txHash)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(isPending)
	fmt.Println(tx.Hash().Hex()) // 0x20294a03e8766e9aeab58327fc4112756017c6c28f6f99c7722f4a29075601c5.Println(isPending)       // false
}

func getBlockTransactionCountByHash(rpcClient *rpc.Client, blockHash string) (uint64, error) {
	var result interface{}
	err := rpcClient.CallContext(context.Background(), &result, "eth_getBlockTransactionCountByHash", blockHash)
	if err != nil {
		return 0, err
	}
	if result == nil {
		return 0, fmt.Errorf("block not found or no transactions")
	}
	switch v := result.(type) {
	case string:
		count := new(big.Int)
		count.SetString(v[2:], 16)
		return count.Uint64(), nil
	case float64:
		return uint64(v), nil
	default:
		return 0, fmt.Errorf("unexpected type %T for transaction count", v)
	}
}
