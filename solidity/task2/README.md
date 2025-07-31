# Simple ERC20 Token Contract

这是一个基于 Solidity 的简单 ERC20 代币合约实现，参考了 OpenZeppelin 的标准。

## 功能特性

### 标准 ERC20 功能
- ✅ `balanceOf` - 查询账户余额
- ✅ `transfer` - 转账功能
- ✅ `approve` - 授权功能
- ✅ `transferFrom` - 代扣转账
- ✅ `allowance` - 查询授权额度

### 扩展功能
- ✅ `mint` - 增发代币（仅所有者）
- ✅ `increaseAllowance` - 增加授权额度
- ✅ `decreaseAllowance` - 减少授权额度
- ✅ `transferOwnership` - 转移所有权
- ✅ `renounceOwnership` - 放弃所有权

### 事件
- `Transfer` - 转账事件
- `Approval` - 授权事件
- `Mint` - 增发事件
- `OwnershipTransferred` - 所有权转移事件

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译合约

```bash
npm run compile
```

### 3. 运行测试

```bash
npm test
```

### 4. 本地部署

启动本地节点：
```bash
npm run node
```

在新终端中部署：
```bash
npm run deploy:local
```

### 5. 部署到 Sepolia 测试网

1. 复制 `.env.example` 为 `.env`
2. 填入您的配置信息
3. 运行部署命令：

```bash
npm run deploy:sepolia
```

## 环境配置

创建 `.env` 文件并填入以下信息：

```env
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
PRIVATE_KEY=your_wallet_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

### 获取测试 ETH

- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)

## 合约验证

部署后可以使用以下命令验证合约：

```bash
npx hardhat verify --network sepolia CONTRACT_ADDRESS "TokenName" "SYMBOL" 18 1000000
```

## 导入到钱包

1. 打开 MetaMask
2. 切换到 Sepolia 测试网
3. 点击 "导入代币"
4. 输入合约地址
5. 代币信息会自动填充

## 项目结构