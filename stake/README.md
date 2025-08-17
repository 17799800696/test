# Stake 质押系统

基于区块链的多代币质押系统，支持ETH和ERC20代币质押，并分配MetaNode代币作为奖励。

## 功能特性

- **多代币质押**: 支持ETH和ERC20代币质押
- **奖励分配**: 基于质押数量和时间分配MetaNode代币奖励
- **可升级合约**: 使用OpenZeppelin UUPS代理模式
- **锁定期管理**: 支持自定义解质押锁定期
- **安全保障**: 集成访问控制、重入保护、暂停机制
- **多池管理**: 支持多个独立配置的质押池

## 合约架构

### 核心合约

1. **MetaNodeToken.sol** - ERC20奖励代币
   - 标准ERC20功能
   - 铸造者权限管理
   - 暂停/恢复功能
   - 代币销毁功能

2. **StakeContract.sol** - 主质押合约
   - 多池质押管理
   - 奖励计算和分配
   - 解质押锁定机制
   - 可升级代理模式

3. **MockERC20.sol** - 测试用ERC20代币

## 系统架构图

### 整体架构流程图

```mermaid
graph TB
    subgraph "用户层"
        U1[用户A]
        U2[用户B]
        U3[用户C]
    end
    
    subgraph "前端交互层"
        UI[Web3 DApp界面]
        W[钱包连接]
    end
    
    subgraph "区块链网络层"
        ETH[以太坊网络]
        SEP[Sepolia测试网]
    end
    
    subgraph "智能合约层"
        SC[StakeContract 主合约]
        MT[MetaNodeToken 奖励代币]
        ME[MockERC20 测试代币]
        PROXY[UUPS代理合约]
    end
    
    subgraph "数据存储层"
        PS[Pool Storage 池数据]
        US[User Storage 用户数据]
        RS[Reward Storage 奖励数据]
    end
    
    U1 --> UI
    U2 --> UI
    U3 --> UI
    UI --> W
    W --> ETH
    W --> SEP
    ETH --> PROXY
    SEP --> PROXY
    PROXY --> SC
    SC --> MT
    SC --> ME
    SC --> PS
    SC --> US
    SC --> RS
```

### 质押流程图

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as 前端界面
    participant Wallet as 钱包
    participant StakeContract as 质押合约
    participant MetaNodeToken as 奖励代币
    participant ERC20 as ERC20代币
    
    Note over User, ERC20: ETH质押流程
    User->>UI: 选择ETH质押
    UI->>Wallet: 连接钱包
    User->>UI: 输入质押金额
    UI->>Wallet: 发起交易
    Wallet->>StakeContract: stake(poolId, {value: amount})
    StakeContract->>StakeContract: 更新用户质押数据
    StakeContract->>StakeContract: 更新池总量
    StakeContract->>StakeContract: 计算奖励
    StakeContract-->>User: 返回交易结果
    
    Note over User, ERC20: ERC20代币质押流程
    User->>UI: 选择ERC20质押
    UI->>Wallet: 连接钱包
    User->>UI: 输入质押金额
    UI->>Wallet: 授权代币
    Wallet->>ERC20: approve(stakeContract, amount)
    ERC20-->>Wallet: 授权成功
    UI->>Wallet: 发起质押交易
    Wallet->>StakeContract: stake(poolId, amount)
    StakeContract->>ERC20: transferFrom(user, contract, amount)
    StakeContract->>StakeContract: 更新用户质押数据
    StakeContract->>StakeContract: 更新池总量
    StakeContract->>StakeContract: 计算奖励
    StakeContract-->>User: 返回交易结果
```

### 奖励分发流程图

```mermaid
flowchart TD
    A[用户发起领取奖励] --> B[调用claimReward函数]
    B --> C[计算待领取奖励]
    C --> D{奖励是否大于0?}
    D -->|是| E[更新用户奖励数据]
    D -->|否| F[交易回滚]
    E --> G[调用MetaNodeToken铸造]
    G --> H[转账奖励代币给用户]
    H --> I[触发RewardClaimed事件]
    I --> J[交易完成]
    F --> K[返回错误信息]
```

### 解质押流程图

```mermaid
stateDiagram-v2
    [*] --> 质押中
    质押中 --> 请求解质押: requestUnstake()
    请求解质押 --> 锁定期: 创建解质押请求
    锁定期 --> 锁定期: 等待锁定期结束
    锁定期 --> 可执行解质押: 锁定期结束
    可执行解质押 --> 解质押完成: executeUnstake()
    解质押完成 --> [*]: 资金返还用户
    
    note right of 锁定期
        锁定期由池配置决定
        防止频繁进出
    end note
    
    note right of 可执行解质押
        用户可以执行解质押
        获得本金和奖励
    end note
```

### 数据流向图

```mermaid
graph LR
    subgraph "输入数据"
        ETH_IN[ETH质押]
        ERC20_IN[ERC20质押]
        CONFIG[池配置]
    end
    
    subgraph "处理层"
        CALC[奖励计算引擎]
        POOL[池管理器]
        USER[用户管理器]
    end
    
    subgraph "存储层"
        POOL_DATA[(池数据)]
        USER_DATA[(用户数据)]
        REWARD_DATA[(奖励数据)]
    end
    
    subgraph "输出数据"
        REWARDS[MetaNode奖励]
        UNSTAKE[解质押资金]
        EVENTS[事件日志]
    end
    
    ETH_IN --> POOL
    ERC20_IN --> POOL
    CONFIG --> POOL
    
    POOL --> POOL_DATA
    POOL --> USER
    USER --> USER_DATA
    USER --> CALC
    CALC --> REWARD_DATA
    
    CALC --> REWARDS
    USER --> UNSTAKE
    POOL --> EVENTS
    USER --> EVENTS
    CALC --> EVENTS
```

### 合约交互关系图

```mermaid
graph TB
    subgraph "代理层"
        PROXY[UUPS代理合约]
    end
    
    subgraph "实现层"
        STAKE[StakeContract实现]
    end
    
    subgraph "代币层"
        META[MetaNodeToken]
        MOCK[MockERC20]
        OTHER[其他ERC20]
    end
    
    subgraph "权限层"
        ADMIN[管理员角色]
        MINTER[铸造者角色]
        PAUSER[暂停者角色]
    end
    
    PROXY --> STAKE
    STAKE --> META
    STAKE --> MOCK
    STAKE --> OTHER
    
    ADMIN --> STAKE
    MINTER --> META
    PAUSER --> STAKE
    PAUSER --> META
    
    STAKE -.->|铸造奖励| META
    STAKE -.->|转入质押| MOCK
    STAKE -.->|转入质押| OTHER
```

## 数据结构

### Pool (质押池)
```solidity
struct Pool {
    address stTokenAddress;      // 质押代币地址 (0x0 = ETH)
    uint256 poolWeight;          // 池权重
    uint256 lastRewardBlock;     // 最后奖励区块
    uint256 accMetaNodePerST;    // 累积每代币奖励
    uint256 stTokenAmount;       // 总质押量
    uint256 minDepositAmount;    // 最小质押量
    uint256 unstakeLockedBlocks; // 解质押锁定区块数
}
```

### User (用户信息)
```solidity
struct User {
    uint256 stAmount;           // 质押数量
    uint256 finishedMetaNode;   // 已分配奖励
    uint256 pendingMetaNode;    // 待领取奖励
    UnstakeRequest[] requests;  // 解质押请求列表
}
```

## 快速开始

### 1. 安装依赖

```bash
cd stake
npm install
```

### 2. 配置环境

复制环境变量模板：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的参数：
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
SEPOLIA_PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

### 3. 编译合约

```bash
npx hardhat compile
```

### 4. 运行测试

```bash
# 运行所有测试
npx hardhat test

# 运行特定测试文件
npx hardhat test test/StakeContract.test.js
npx hardhat test test/MetaNodeToken.test.js

# 生成测试覆盖率报告
npx hardhat coverage
```

### 5. 部署合约

#### 本地网络部署
```bash
# 启动本地节点
npx hardhat node

# 在新终端中部署
npx hardhat run scripts/deploy.js --network localhost
```

#### Sepolia测试网部署
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### 6. 验证合约

```bash
npx hardhat run scripts/verify.js --network sepolia
```

### 7. 合约升级

```bash
npx hardhat run scripts/upgrade.js --network sepolia
```

## 使用指南

### 质押操作

1. **ETH质押**:
   ```javascript
   // 质押0.1 ETH到池ID 0
   await stakeContract.stake(0, { value: ethers.parseEther("0.1") });
   ```

2. **ERC20代币质押**:
   ```javascript
   // 先授权代币
   await token.approve(stakeContractAddress, amount);
   // 然后质押
   await stakeContract.stake(poolId, amount);
   ```

### 解质押操作

```javascript
// 请求解质押
await stakeContract.requestUnstake(poolId, amount);

// 等待锁定期结束后执行解质押
await stakeContract.executeUnstake(poolId, requestIndex);
```

### 领取奖励

```javascript
// 领取指定池的奖励
await stakeContract.claimReward(poolId);
```

### 管理功能

```javascript
// 添加新的质押池
await stakeContract.addPool(
    tokenAddress,    // 代币地址 (0x0 = ETH)
    poolWeight,      // 池权重
    minDeposit,      // 最小质押量
    lockBlocks       // 锁定区块数
);

// 更新池配置
await stakeContract.updatePool(poolId, newWeight, newMinDeposit, newLockBlocks);

// 暂停/恢复合约
await stakeContract.pause();
await stakeContract.unpause();
```

## 项目结构

```
stake/
├── contracts/              # 智能合约
│   ├── StakeContract.sol   # 主质押合约
│   ├── MetaNodeToken.sol   # 奖励代币合约
│   └── MockERC20.sol       # 测试代币合约
├── test/                   # 测试文件
│   ├── StakeContract.test.js
│   └── MetaNodeToken.test.js
├── scripts/                # 部署和管理脚本
│   ├── deploy.js          # 部署脚本
│   ├── upgrade.js         # 升级脚本
│   └── verify.js          # 验证脚本
├── ignition/              # Hardhat Ignition模块
│   └── modules/
│       └── StakeSystem.js
├── deployments/           # 部署信息（自动生成）
├── hardhat.config.js      # Hardhat配置
├── package.json           # 项目依赖
└── README.md             # 项目文档
```

## 安全考虑

- ✅ 使用OpenZeppelin经过审计的合约库
- ✅ 实现重入攻击保护
- ✅ 访问控制和权限管理
- ✅ 暂停机制用于紧急情况
- ✅ 输入验证和边界检查
- ✅ 事件日志记录所有重要操作

## 测试覆盖

项目包含全面的测试套件，覆盖：
- 合约部署和初始化
- 质押和解质押功能
- 奖励计算和分配
- 权限管理
- 错误处理
- 边界条件