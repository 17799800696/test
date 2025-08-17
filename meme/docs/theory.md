# 理论知识梳理

本文旨在帮助读者理解本项目 MemeToken 的机制设计与实现取舍，并对照测试用例掌握关键逻辑。

## 1. 总体设计
- 最大供应量 MAX_SUPPLY：1,000,000,000,000 * 1e18
- 税率分母 TAX_DENOMINATOR：10000（支持到 0.01% 精度）
- 初始税率：
  - 买入 buyTaxRate = 5% (500)
  - 卖出 sellTaxRate = 8% (800)
  - 转账 transferTaxRate = 2% (200)
- 税费分配比例（总和=10000）：
  - 流动性 liquidityTaxShare = 4000
  - 营销 marketingTaxShare = 3000
  - 销毁 burnTaxShare = 3000

## 2. 核心转账路径
转账走 _update：
- 若铸造/销毁（from==0 或 to==0），直接 super._update
- 若非铸造/销毁：
  1) 检查交易开关 tradingEnabled（或双方处于免限名单）
  2) 检查限额：
     - 单笔最大额度 maxTransactionAmount
     - 买入路径（from 为 AMM pair）检查钱包上限 maxWalletAmount
  3) 自动分配：若合约内余额 ≥ swapTokensAtAmount 且 swapEnabled 且非递归且非 AMM 卖出，则进行 _swapAndLiquify
  4) 税费计算：
     - 买入：from 是 AMM pair => buyTaxRate
     - 卖出：to 是 AMM pair => sellTaxRate
     - 普通转账：其它 => transferTaxRate
  5) 税费转入合约地址，剩余到收款方

## 3. 分配实现（教学简化版）
函数 _swapAndLiquify(contractTokenBalance)：
- 计算三部分：liquidityTokens / marketingTokens / burnTokens
- 销毁 burnTokens：_burn(this, burnTokens)
- 转营销：transfer(this -> marketingWallet, marketingTokens)
- 转流动性：transfer(this -> liquidityWallet, liquidityTokens)
- 事件：SwapAndLiquify

说明：
- 本实现不依赖 Router 做真实 swap/addLiquidity，便于测试与教学；生产环境若需要兑换 ETH 并加入 LP，应扩展 Router 交互、滑点处理与回退保护。
- 开关/阈值：
  - swapEnabled：是否启用自动分配
  - swapTokensAtAmount：触发自动分配的阈值（绝对代币数量）

## 4. 管理与限制
- 交易开关：setTradingEnabled
- AMM 对：setAMMPair（用于判断买/卖路径）
- 税率：updateTaxRates（内置上限校验）
- 税费分配：updateTaxDistribution（总和=10000）
- 限额：updateLimits（以总量百分比设置 maxTransactionAmount / maxWalletAmount）
- 免税/免限：setExcludedFromTax / setExcludedFromLimits
- 黑名单：setBlacklisted
- 钱包更新：updateWallets（流动性/营销）
- 自动分配开关与阈值：setSwapEnabled / setSwapTokensAtAmount
- 手动分配：manualSwapAndLiquify
- 紧急提取：emergencyWithdrawETH / emergencyWithdrawTokens（不可提取本币）

## 5. 安全边界与注意事项
- Ownable 权限：非 owner 调用管理函数将被 OwnableUnauthorizedAccount 拒绝。
- 重入保护：lockTheSwap 防止自动分配过程递归进入。
- 黑名单：被列入黑名单地址无法转账。
- 限额：需兼顾流动性与公平性。若做空投/迁移，可临时将相关地址加入免限。
- 参数上下限：
  - 税率上限：buy≤10%，sell≤15%，transfer≤5%
  - 分配比例总和须为 10000
  - swapTokensAtAmount 需大于 0 且不超过 MAX_SUPPLY/100

## 6. 测试覆盖点映射
- 基础功能：铸造至 owner、普通转账税
- 买卖路径：isAMMPair 标记，买入/卖出税生效
- 限额：单笔限额、钱包限额、免限名单绕过
- 黑名单：黑名单地址禁止交易
- 自动分配：累计税费到阈值触发，校验营销/流动性/销毁变化；手动分配
- 分配与税率边界：updateTaxDistribution 总和约束；税率上限约束
- 紧急提取：ETH 提取；禁止提取本代币

## 7. 与生产化的差异与扩展建议
- 真实 LP/Swap：在 _swapAndLiquify 中集成 Router 以兑换与加池；
- 交易对发现：通过工厂或路由自动识别常见 pair；
- 反 MEV/防抢跑：加入转账延迟/冷却、最大 gas/价格保护等策略；
- 税率动态化：根据区块高度、持仓周期或治理动态调整；
- 事件丰富化：记录更多诊断信息，便于 off-chain 分析与图表化展示。