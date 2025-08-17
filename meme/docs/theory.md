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

## 8. 代币税机制分析
- 作用与目标：
  - 平滑价格波动：在买卖时征税，抑制短线频繁博弈，提升持有成本，降低瞬时冲击。
  - 建设公共池：将税费用于销毁、营销、流动性建设，形成“使用即供给”的反馈回路。
  - 激励长期持有：通过较低的转账税与较高的卖出税，倾向持仓与做市。
- 征收方式：
  - 交易税（本项目采用）：在买/卖/转账路径按不同税率计提，最直观、实现简单。
  - 持有税（反射/负利率）：按时间或区块对持仓扣减或反射奖励，实现复杂、合规与体验风险更高。
- 调参示例：
  - 上线初期：略高的卖出税与适中的营销分配，增强抗抛压与外宣预算。
  - 稳定期：降低总税率，提升用户体验，更多分配给流动性以降低滑点。
  - 活动期：临时上调买入税的“销毁”份额，用于通缩活动（需公告与时间窗约束）。
- 取舍与风险：税率过高将伤害成交深度与做市意愿；过低则无法形成公共资金池与激励，应结合流动性、用户规模与传播节奏动态调整。

## 9. 流动性池原理探究
- AMM 基本原理：
  - 以常乘不变（如 x*y=k）做市，价格由池子两侧资产相对数量决定，撮合由合约自动完成。
  - 与订单簿的区别：无挂单簿与做市商报价，价格连续可交易，滑点取决于池子深度。
- 流动性提供者（LP）：
  - 向池中按比例存入两种资产，获得 LP 份额凭证，按交易量获得手续费分成。
  - 风险：无常损失（价格偏离初始比值时相对持有单边更亏），极端行情/攻击可能导致池子单边化。
- 对本项目的启示：
  - 若要在合约内集成真实加池/换币，应引入 Router 接口（如 UniswapV2Router02），在 _swapAndLiquify 中将税费的一部分换成另一侧资产后 addLiquidity，并在移除流动性时处理 LP 代币。
  - 需关注滑点、最小接收量、交易截止时间等参数，并在合约侧限制可调用者与数量，避免被套利或滥用。

## 10. 交易限制策略探讨
- 目标：抑制操纵与女巫攻击、保护散户体验、避免巨鲸一笔砸盘引发瀑布。
- 常见策略：
  - 单笔交易额度限制（本项目已实现）。
  - 钱包持仓上限（本项目已实现，仅在买入路径校验）。
  - 交易频率限制：
    - 冷却时间（cooldown）：两次交易需间隔 N 秒。
    - 每日交易次数上限：按地址在 24h 窗口内的可交易次数计数。
  - 上线保护期：在初期仅白名单可交易或更严格的额度限制。
  - 黑名单与自动移除：对明显恶意的地址施加限制，并在申诉/观察后自动解除。
- 优缺点：
  - 越严格的限制越能抑制短线操纵，但也会影响真实用户流畅交易与做市效率。
  - 频率限制需持久化计数，会增加链上存储与 gas；建议提供临时开关与调参能力。
- 参数建议：
  - 主网上线初期：maxTx≈0.5%～1%，maxWallet≈1%～2%，cooldown≈15～60s，每日次数≈20～100 依项目体量而定。
  - 运营成熟后可逐步放宽或全部取消限制，维持最小化干预。

## 11. 生产化部署细节
- 部署前准备：
  - 确保 .env 配置完整：RPC URL、私钥、路由器地址等
  - 验证目标网络的 Uniswap V2 Router 地址正确性
  - 准备足够的 ETH 用于部署 gas 费用
  - 设置合适的流动性钱包和营销钱包地址
- 部署后配置：
  - 设置正确的 AMM 交易对地址（通过 setAMMPair）
  - 开启交易（setTradingEnabled(true)）
  - 根据项目需求调整税率和分配比例
  - 配置交易限制参数（频率限制、额度限制等）
- 安全检查：
  - 验证合约 owner 权限正确
  - 确认紧急提取功能可用
  - 测试税费计算和分配逻辑
  - 验证黑名单和免税名单功能

## 12. 测试策略与覆盖
- 单元测试覆盖：
  - 基础 ERC20 功能：转账、授权、余额查询
  - 税费机制：买入/卖出/转账不同税率路径
  - 交易限制：单笔限额、钱包限额、黑名单、免限名单
  - 频率限制：冷却时间、每日交易次数限制
  - 自动分配：阈值触发、税费分配比例、手动分配
  - 管理功能：权限控制、参数更新、紧急提取
- 集成测试：
  - LP 包装器：用户添加/移除流动性功能
  - 自动加池：Router 交互、滑点处理
  - 边界条件：极值参数、异常输入处理
- 压力测试：
  - 大量用户并发交易
  - 频繁触发自动分配机制
  - 极端市场条件下的合约行为
- 安全测试：
  - 重入攻击防护
  - 权限提升漏洞
  - 整数溢出/下溢
  - 前端运行攻击（MEV）防护