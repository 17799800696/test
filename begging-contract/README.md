# 讨饭合约 (BeggingContract)

这是一个基于以太坊的讨饭合约，允许用户向合约发送以太币，并记录捐赠信息。

## 功能特性

- ✅ 用户可以向合约发送以太币进行捐赠
- ✅ 记录每个捐赠者的地址和捐赠金额
- ✅ 合约所有者可以提取所有捐赠的资金
- ✅ 查询某个地址的捐赠金额
- ✅ 捐赠和提款事件记录
- ✅ 权限控制（只有所有者可以提款）

## 合约功能

### 主要函数

1. **donate()** - 捐赠函数
   - 允许用户向合约发送以太币
   - 自动记录捐赠者的地址和金额
   - 触发 Donation 事件

2. **withdraw()** - 提款函数
   - 只有合约所有者可以调用
   - 提取合约中的所有资金
   - 触发 Withdrawal 事件

3. **getDonation(address donor)** - 查询函数
   - 查询指定地址的捐赠金额

4. **getContractBalance()** - 获取合约余额
   - 返回合约当前的以太币余额

5. **getOwner()** - 获取合约所有者
   - 返回合约所有者的地址

## 环境配置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
# 以太坊网络配置
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-project-id
PRIVATE_KEY=your-private-key-here

# Etherscan API密钥（用于验证合约）
ETHERSCAN_API_KEY=your-etherscan-api-key
```

### 3. 获取必要的配置

1. **Infura API Key**: 访问 [Infura](https://infura.io/) 注册并获取项目ID
2. **私钥**: 从你的钱包导出私钥（注意安全）
3. **Etherscan API Key**: 访问 [Etherscan](https://etherscan.io/) 注册并获取API密钥

## 使用方法

### 编译合约

```bash
npx hardhat compile
```

### 本地测试

```bash
npx hardhat test
```

### 运行测试脚本

```bash
npx hardhat run scripts/test.js
```

### 部署到 Sepolia 测试网

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### 验证合约

```bash
npx hardhat verify --network sepolia <合约地址>
```

## 合约地址

部署后，合约地址将显示在控制台中。

## 测试步骤

1. **部署合约** - 使用部署脚本部署到 Sepolia 测试网
2. **捐赠测试** - 使用 MetaMask 向合约地址发送以太币
3. **查询测试** - 调用 `getDonation` 函数查询捐赠金额
4. **提款测试** - 使用合约所有者账户调用 `withdraw` 函数
