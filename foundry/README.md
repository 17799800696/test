# Foundry智能合约Gas优化项目

本项目使用Foundry框架完成智能合约开发、测试和Gas优化分析的完整流程。

## 项目结构

```
foundry/
├── src/
│   ├── Counter.sol              # 原始算术运算合约 (ArithmeticContract)
│   ├── ArithmeticOptimized1.sol # Gas优化版本1
│   └── ArithmeticOptimized2.sol # Gas优化版本2
├── test/
│   ├── Counter.t.sol            # 原始合约测试
│   └── GasComparison.t.sol      # Gas对比测试
├── script/
│   └── Counter.s.sol            # 部署脚本
├── lib/
│   └── forge-std/               # Foundry标准库
├── GAS_OPTIMIZATION_REPORT.md   # 详细的Gas优化分析报告
├── foundry.toml                 # Foundry配置文件
└── README.md                    # 项目说明文档
```

## 快速开始

### 1. 运行测试

```bash
# 运行所有测试
forge test

# 运行测试并显示详细输出
forge test -vv

# 运行测试并生成Gas报告
forge test --gas-report

# 运行特定测试合约
forge test --match-contract ArithmeticContractTest
forge test --match-contract GasComparisonTest
```

### 2. 编译合约

```bash
# 编译所有合约
forge build

# 编译并显示详细信息
forge build -v
```

### 3. 部署合约

```bash
# 使用脚本部署
forge script script/Counter.s.sol
```

## 合约功能说明

### ArithmeticContract (原始版本)
- 基本算术运算：加、减、乘、除
- 结果存储和历史记录
- 事件发射和查询功能
- 完整的状态管理

### ArithmeticOptimized1 (优化版本1)
- 移除操作历史存储
- 简化事件发射
- 新增批量计算功能
- 约73%的Gas节省

### ArithmeticOptimized2 (优化版本2)
- 极简设计，移除所有非必要功能
- 使用assembly优化
- 纯函数设计
- 最高97%的Gas节省

## Gas优化成果

| 操作类型 | 原始合约 | 优化版本1 | 优化版本2 | 节省率1 | 节省率2 |
|---------|---------|----------|----------|---------|----------|
| 单次运算 | ~187k gas | ~51k gas | ~50k gas | 72.8% | 73.5% |
| 批量运算 | ~635k gas | ~66k gas | ~14k gas | 89.6% | 97.8% |

## 测试覆盖

- ✅ 功能测试：验证算术运算正确性
- ✅ 边界测试：处理溢出、除零等情况
- ✅ Gas分析：详细的Gas消耗记录
- ✅ 模糊测试：随机输入验证
- ✅ 性能对比：系统性的优化效果分析

## 主要文件说明

- **GAS_OPTIMIZATION_REPORT.md**: 详细的Gas优化分析报告
- **test/GasComparison.t.sol**: 三个版本合约的性能对比测试
- **src/**: 包含三个不同优化程度的智能合约

## 技术栈

- **Foundry**: 智能合约开发框架
- **Solidity**: 智能合约编程语言 (^0.8.13)
- **Forge**: 测试和构建工具
- **Cast**: 以太坊交互工具

## 学习价值

本项目展示了：
1. Foundry框架的完整使用流程
2. 系统性的Gas优化策略
3. 完整的测试驱动开发流程
4. 性能分析和对比方法
5. 智能合约最佳实践

## 贡献

欢迎提交Issue和Pull Request来改进项目。

## 许可证

MIT License
