# 讨饭合约部署指南

## 部署步骤

### 1. 环境准备

确保你已经配置了环境变量（参考 `ENV_SETUP.md`）：

```bash
# 检查环境变量
echo $SEPOLIA_RPC_URL
echo $PRIVATE_KEY
```

### 2. 编译合约

```bash
npm run compile
```

### 3. 部署到 Sepolia 测试网

```bash
npm run deploy:sepolia
```

部署成功后，你会看到类似输出：
```
开始部署 BeggingContract...
BeggingContract 部署成功!
合约地址: 0x1234567890abcdef...
合约所有者: 0xabcdef1234567890...
```

### 4. 验证合约（可选）

```bash
npx hardhat verify --network sepolia 0x1234567890abcdef...
```

## 合约交互

### 使用 Remix IDE

1. 打开 [Remix IDE](https://remix.ethereum.org/)
2. 在 "Deploy & Run Transactions" 标签页中
3. 选择 "Injected Provider - MetaMask"
4. 连接到 Sepolia 测试网
5. 在 "At Address" 中输入你的合约地址
6. 点击 "At Address" 按钮加载合约

### 使用 MetaMask

1. 确保 MetaMask 连接到 Sepolia 测试网
2. 添加合约地址到 MetaMask 的 "导入代币" 功能
3. 可以直接向合约地址发送以太币进行捐赠

### 使用脚本

更新 `scripts/interact.js` 中的合约地址，然后运行：

```bash
npx hardhat run scripts/interact.js --network sepolia
```

## 测试功能

### 1. 捐赠测试

**使用 Remix IDE:**
1. 选择 `donate` 函数
2. 在 "Value" 字段中输入要捐赠的以太币数量（单位：Wei）
3. 点击 "Transact"

**使用 MetaMask:**
1. 直接向合约地址发送以太币
2. 交易会被自动记录为捐赠

### 2. 查询捐赠金额

**使用 Remix IDE:**
1. 选择 `getDonation` 函数
2. 在参数中输入要查询的地址
3. 点击 "Call"

### 3. 提款测试（仅所有者）

**使用 Remix IDE:**
1. 确保使用合约所有者的账户
2. 选择 `withdraw` 函数
3. 点击 "Transact"

### 4. 查看合约余额

**使用 Remix IDE:**
1. 选择 `getContractBalance` 函数
2. 点击 "Call"

## 合约地址记录

请记录以下信息：

```
合约名称: BeggingContract
合约地址: [你的合约地址]
部署网络: Sepolia
部署时间: [部署时间]
合约所有者: [所有者地址]
```

## 故障排除

### 常见问题

1. **部署失败**
   - 检查网络连接
   - 确认账户有足够的测试币
   - 检查私钥是否正确

2. **交易失败**
   - 检查 Gas 费用设置
   - 确认账户余额充足
   - 检查网络连接

3. **合约验证失败**
   - 确认合约地址正确
   - 检查 Etherscan API 密钥
   - 等待区块确认后再验证

### 获取测试币

如果需要在 Sepolia 测试网上获取测试币：

1. **Sepolia Faucet**: https://sepoliafaucet.com/
2. **Alchemy Faucet**: https://sepoliafaucet.com/
3. **Infura Faucet**: 通过 Infura 控制台申请

## 安全提醒

- ⚠️ 永远不要在主网上测试
- ⚠️ 妥善保管私钥
- ⚠️ 定期备份重要信息
- ⚠️ 使用测试账户进行开发 