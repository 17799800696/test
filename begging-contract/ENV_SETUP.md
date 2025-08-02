# 环境变量配置说明

## 共享环境变量配置

为了避免在每个项目中重复配置环境变量，建议在项目根目录创建共享的 `.env` 文件。

### 1. 在项目根目录创建 `.env` 文件

```bash
# 在项目根目录 (/home/dylan/project/client/) 创建 .env 文件
touch .env
```

### 2. 配置环境变量

在根目录的 `.env` 文件中添加以下配置：

```bash
# 以太坊网络配置
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-project-id
GOERLI_RPC_URL=https://goerli.infura.io/v3/your-project-id
MAINNET_RPC_URL=https://mainnet.infura.io/v3/your-project-id

# 私钥配置（注意安全）
PRIVATE_KEY=your-private-key-here

# Etherscan API密钥（用于验证合约）
ETHERSCAN_API_KEY=your-etherscan-api-key

# 其他配置
GAS_LIMIT=3000000
GAS_PRICE=20000000000
```

### 3. 获取必要的配置

#### Infura API Key
1. 访问 [Infura](https://infura.io/)
2. 注册账户并创建新项目
3. 复制项目的端点URL
4. 将URL中的 `your-project-id` 替换为你的项目ID

#### 私钥
1. 从你的钱包（如MetaMask）导出私钥
2. **⚠️ 安全警告**: 私钥非常重要，请妥善保管，不要泄露给他人
3. 建议使用测试账户的私钥

#### Etherscan API Key
1. 访问 [Etherscan](https://etherscan.io/)
2. 注册账户并获取API密钥
3. 用于验证部署的合约

### 4. 项目特定的环境变量

如果某个项目需要特殊的配置，可以在项目目录中创建 `.env` 文件，它会覆盖根目录的配置。

### 5. 使用示例

```bash
# 编译合约
npm run compile

# 本地测试
npm run test:local

# 部署到Sepolia测试网
npm run deploy:sepolia

# 启动本地节点
npm run node
```

### 6. 安全注意事项

- ⚠️ 永远不要将 `.env` 文件提交到Git仓库
- ⚠️ 在 `.gitignore` 中添加 `.env` 文件
- ⚠️ 定期更换私钥和API密钥
- ⚠️ 使用测试网进行开发和测试

### 7. 故障排除

如果遇到环境变量问题：

1. 检查 `.env` 文件是否存在
2. 确认环境变量名称正确
3. 重启终端或IDE
4. 检查网络连接和API密钥有效性 