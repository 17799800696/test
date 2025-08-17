// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Uniswap V2 接口
interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface IUniswapV2Pair {
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);

    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external returns (uint amountToken, uint amountETH);

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;

    function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB);
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut);
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint amountIn);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);
}

/**
 * @title MemeToken - SHIB 风格的 Meme 代币合约
 * @dev 实现代币税、流动性池交互、交易限制等功能
 */
contract MemeToken is ERC20, Ownable, ReentrancyGuard {
    
    // ========== 常量配置 ==========
    uint256 public constant MAX_SUPPLY = 1_000_000_000_000 * 10**18; // 1万亿代币
    uint256 public constant TAX_DENOMINATOR = 10000; // 税率分母，支持精确到 0.01%
    
    // ========== 税费配置 ==========
    uint256 public buyTaxRate = 500;     // 买入税 5%
    uint256 public sellTaxRate = 800;    // 卖出税 8%
    uint256 public transferTaxRate = 200; // 转账税 2%
    
    // 税费分配比例（总计 100%）
    uint256 public liquidityTaxShare = 4000;  // 40% 用于流动性
    uint256 public marketingTaxShare = 3000;  // 30% 用于营销
    uint256 public burnTaxShare = 3000;       // 30% 用于销毁
    
    // ========== 地址配置 ==========
    address public liquidityWallet;      // 流动性钱包
    address public marketingWallet;      // 营销钱包
    address public uniswapV2Pair;        // Uniswap V2 交易对地址
    address public uniswapV2Router;      // Uniswap V2 路由器地址
    IUniswapV2Router02 public immutable router; // Router 接口实例
    
    // ========== 交易限制配置 ==========
    uint256 public maxTransactionAmount;     // 单笔交易最大额度
    uint256 public maxWalletAmount;          // 单个钱包最大持有量
    uint256 public swapTokensAtAmount;       // 自动换币阈值

    // 频率限制（B1 冷却时间 + B2 每日次数限制）
    bool public cooldownEnabled = true;      // 冷却开关（默认开）
    uint256 public cooldownSeconds = 30;     // 冷却秒数（默认 30s）
    bool public dailyLimitEnabled = true;    // 每日次数限制开关（默认开）
    uint256 public maxDailyTxCount = 50;     // 每日最大次数（默认 50 次）

    mapping(address => uint256) private _lastTxTimestamp; // 最近一次交易时间
    mapping(address => uint256) private _lastTxDay;        // 最近一次交易的自然日索引
    mapping(address => uint256) private _dailyTxCount;     // 自然日内已发生的交易次数

    // LP 增强配置
    bool public autoLiquidityEnabled = true;  // A1: 自动加池开关
    bool public userLpEnabled = true;         // A2: 用户级 LP 包装器开关
    uint256 public defaultSlippagePercent = 200; // 默认滑点 2%（200/10000）
    uint256 public defaultDeadlineMinutes = 20;  // 默认截止时间 20 分钟
    
    // ========== 状态变量 ==========
    bool public tradingEnabled = false;      // 交易开关
    bool public swapEnabled = true;          // 自动换币开关
    bool private swapping = false;           // 防止递归调用
    
    // 累计税费
    uint256 public totalTaxCollected;
    uint256 public totalBurned;
    
    // ========== 映射 ==========
    mapping(address => bool) public isExcludedFromTax;     // 免税地址
    mapping(address => bool) public isExcludedFromLimits;  // 免限制地址
    mapping(address => bool) public isBlacklisted;        // 黑名单地址
    mapping(address => bool) public isAMMPair;             // AMM 交易对标识
    
    // ========== 事件 ==========
    event TaxRatesUpdated(uint256 buyTax, uint256 sellTax, uint256 transferTax);
    event TaxDistributionUpdated(uint256 liquidity, uint256 marketing, uint256 burn);
    event TradingEnabled(bool enabled);
    event SwapAndLiquify(uint256 tokensSwapped, uint256 ethReceived, uint256 tokensIntoLiquidity);
    event TaxCollected(address indexed from, address indexed to, uint256 amount, uint256 tax);
    event TokensBurned(uint256 amount);
    event FrequencyParamsUpdated(bool cooldownEnabled, uint256 cooldownSeconds, bool dailyLimitEnabled, uint256 maxDailyTxCount);
    event LpConfigUpdated(bool autoLpEnabled, bool userLpEnabled, uint256 slippagePercent, uint256 deadlineMinutes);
    event UserAddLiquidity(address indexed user, uint256 tokenAmount, uint256 ethAmount, uint256 lpTokens);
    event UserRemoveLiquidity(address indexed user, uint256 lpTokens, uint256 tokenAmount, uint256 ethAmount);
    
    // ========== 修饰符 ==========
    modifier lockTheSwap {
        swapping = true;
        _;
        swapping = false;
    }
    
    // ========== 构造函数 ==========
    constructor(
        string memory name,
        string memory symbol,
        address _liquidityWallet,
        address _marketingWallet,
        address _uniswapV2Router
    ) ERC20(name, symbol) Ownable(msg.sender) {
        require(_liquidityWallet != address(0), "Invalid liquidity wallet");
        require(_marketingWallet != address(0), "Invalid marketing wallet");
        require(_uniswapV2Router != address(0), "Invalid router address");
        
        liquidityWallet = _liquidityWallet;
        marketingWallet = _marketingWallet;
        uniswapV2Router = _uniswapV2Router;
        router = IUniswapV2Router02(_uniswapV2Router);
        
        // 设置交易限制（总供应量的百分比）
        maxTransactionAmount = MAX_SUPPLY * 1 / 100;  // 1%
        maxWalletAmount = MAX_SUPPLY * 2 / 100;       // 2%
        swapTokensAtAmount = MAX_SUPPLY * 5 / 10000;  // 0.05%
        
        // 免税和免限制设置
        isExcludedFromTax[owner()] = true;
        isExcludedFromTax[address(this)] = true;
        isExcludedFromTax[liquidityWallet] = true;
        isExcludedFromTax[marketingWallet] = true;
        
        isExcludedFromLimits[owner()] = true;
        isExcludedFromLimits[address(this)] = true;
        isExcludedFromLimits[liquidityWallet] = true;
        isExcludedFromLimits[marketingWallet] = true;
        
        // 铸造初始供应量给部署者
        _mint(msg.sender, MAX_SUPPLY);
    }
    
    // ========== 接收 ETH ==========
    receive() external payable {}
    
    // 频率限制：是否豁免
    function _isFrequencyExempt(address account) internal view returns (bool) {
        return account == address(0)
            || account == address(this)
            || account == owner()
            || account == marketingWallet
            || account == liquidityWallet
            || account == uniswapV2Pair
            || account == uniswapV2Router
            || isExcludedFromLimits[account];
    }

    // 频率限制：只读检查（不修改状态）
    function _checkFrequency(address account) internal view {
        if (_isFrequencyExempt(account)) return;
        if (cooldownEnabled) {
            uint256 lastTs = _lastTxTimestamp[account];
            require(block.timestamp >= lastTs + cooldownSeconds, "Cooldown: wait");
        }
        if (dailyLimitEnabled) {
            uint256 dayIndex = block.timestamp / 1 days;
            uint256 count = _dailyTxCount[account];
            uint256 lastDay = _lastTxDay[account];
            if (lastDay != dayIndex) {
                // 新的一天，视为 0 次后再+1 的检查由 _recordFrequency 负责
                count = 0;
            }
            require(count + 1 <= maxDailyTxCount, "Daily tx limit exceeded");
        }
    }

    // 频率限制：记录（在转账成功后调用）
    function _recordFrequency(address account) internal {
        if (_isFrequencyExempt(account)) return;
        _lastTxTimestamp[account] = block.timestamp;
        uint256 dayIndex = block.timestamp / 1 days;
        if (_lastTxDay[account] != dayIndex) {
            _lastTxDay[account] = dayIndex;
            _dailyTxCount[account] = 0;
        }
        _dailyTxCount[account] += 1;
    }
    
    // ========== 核心转账逻辑重写 ==========
    function _update(address from, address to, uint256 amount) internal override {
        require(!isBlacklisted[from] && !isBlacklisted[to], "Blacklisted address");
        
        // 如果是铸造或销毁，直接执行
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }
        
        // 检查交易是否已启用
        if (!tradingEnabled) {
            require(isExcludedFromLimits[from] || isExcludedFromLimits[to], "Trading not enabled");
        }
        
        // 交易频率预检查（只读，避免前置转账）
        bool isBuy = isAMMPair[from];
        bool isSell = isAMMPair[to];
        if (isBuy) {
            _checkFrequency(to);
        } else if (isSell) {
            _checkFrequency(from);
        } else {
            _checkFrequency(from);
            _checkFrequency(to);
        }
        
        // 检查交易限制
        if (!isExcludedFromLimits[from] && !isExcludedFromLimits[to]) {
            // 检查单笔交易限额
            require(amount <= maxTransactionAmount, "Transfer amount exceeds limit");
            
            // 检查钱包持有量限制（买入时）
            if (isAMMPair[from] && to != address(uniswapV2Router)) {
                require(balanceOf(to) + amount <= maxWalletAmount, "Wallet amount exceeds limit");
            }
        }
        
        // 自动换币和加流动性
        uint256 contractTokenBalance = balanceOf(address(this));
        bool canSwap = contractTokenBalance >= swapTokensAtAmount;
        
        if (canSwap && 
            swapEnabled && 
            !swapping && 
            !isAMMPair[from] && 
            from != liquidityWallet && 
            to != liquidityWallet) {
            _swapAndLiquify(contractTokenBalance);
        }
        
        // 计算税费
        uint256 taxAmount = 0;
        if (!isExcludedFromTax[from] && !isExcludedFromTax[to]) {
            taxAmount = _calculateTax(from, to, amount);
            
            if (taxAmount > 0) {
                super._update(from, address(this), taxAmount);
                totalTaxCollected += taxAmount;
                emit TaxCollected(from, to, amount, taxAmount);
            }
        }
        
        // 执行转账（扣除税费后的金额）
        uint256 transferAmount = amount - taxAmount;
        super._update(from, to, transferAmount);

        // 成功后记录频率
        if (isBuy) {
            _recordFrequency(to);
        } else if (isSell) {
            _recordFrequency(from);
        } else {
            _recordFrequency(from);
            _recordFrequency(to);
        }
    }
    
    // ========== 税费计算 ==========
    function _calculateTax(address from, address to, uint256 amount) internal view returns (uint256) {
        uint256 taxRate = 0;
        
        if (isAMMPair[from]) {
            // 买入交易
            taxRate = buyTaxRate;
        } else if (isAMMPair[to]) {
            // 卖出交易
            taxRate = sellTaxRate;
        } else {
            // 普通转账
            taxRate = transferTaxRate;
        }
        
        return amount * taxRate / TAX_DENOMINATOR;
    }
    
    // ========== A1: 自动换币和加流动性（生产化版本） ==========
    function _swapAndLiquify(uint256 contractTokenBalance) internal lockTheSwap {
        // 计算各部分分配
        uint256 liquidityTokens = contractTokenBalance * liquidityTaxShare / TAX_DENOMINATOR;
        uint256 marketingTokens = contractTokenBalance * marketingTaxShare / TAX_DENOMINATOR;
        uint256 burnTokens = contractTokenBalance * burnTaxShare / TAX_DENOMINATOR;
        
        // 销毁代币
        if (burnTokens > 0) {
            _burn(address(this), burnTokens);
            totalBurned += burnTokens;
            emit TokensBurned(burnTokens);
        }
        
        // 将营销代币转给营销钱包
        if (marketingTokens > 0) {
            super._update(address(this), marketingWallet, marketingTokens);
        }
        
        // A1: 自动加池生产化（如果启用且有 Pair）
        if (autoLiquidityEnabled && liquidityTokens > 0 && uniswapV2Pair != address(0)) {
            _addLiquidityAuto(liquidityTokens);
        } else if (liquidityTokens > 0) {
            // 回退到简化版：转给流动
            super._update(address(this), liquidityWallet, liquidityTokens);
        }
        
        emit SwapAndLiquify(contractTokenBalance, 0, liquidityTokens);
    }

    // A1: 自动加池的核心逻辑
    function _addLiquidityAuto(uint256 tokenAmount) internal {
        if (tokenAmount == 0) return;
        
        // 将一半代币换成 ETH
        uint256 half = tokenAmount / 2;
        uint256 otherHalf = tokenAmount - half;
        
        // 记录当前 ETH 余额
        uint256 initialBalance = address(this).balance;
        
        // 换币：代币 -> ETH
        _swapTokensForEth(half);
        
        // 计算新增的 ETH
        uint256 newBalance = address(this).balance - initialBalance;
        
        // 加流动性：剩余代币 + 新增 ETH
        if (newBalance > 0 && otherHalf > 0) {
            _addLiquidityETH(otherHalf, newBalance);
        }
    }

    // 代币换 ETH
    function _swapTokensForEth(uint256 tokenAmount) internal {
        if (tokenAmount == 0) return;
        
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();
        
        _approve(address(this), uniswapV2Router, tokenAmount);
        
        try router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // 接受任何数量的 ETH
            path,
            address(this),
            block.timestamp + defaultDeadlineMinutes * 60
        ) {} catch {
            // 兑换失败时静默处理，避免阻塞转账
        }
    }

    // 添加流动性（ETH 配对）
    function _addLiquidityETH(uint256 tokenAmount, uint256 ethAmount) internal {
        if (tokenAmount == 0 || ethAmount == 0) return;
        
        _approve(address(this), uniswapV2Router, tokenAmount);
        
        try router.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0, // 滑点保护由调用方控制（自动加池使用 0）
            0,
            liquidityWallet, // LP 代币给流动
            block.timestamp + defaultDeadlineMinutes * 60
        ) {} catch {
            // 加池失败时静默处理
        }
    }
    
    // ========== A2: 用户级 LP 包装器 ==========
    
    /**
     * @dev A2: 用户添加流动性包装器（ETH 配对）
     */
    function userAddLiquidityETH(
        uint256 tokenAmount,
        uint256 tokenAmountMin,
        uint256 ethAmountMin
    ) external payable nonReentrant {
        require(userLpEnabled, "User LP disabled");
        require(uniswapV2Pair != address(0), "Pair not set");
        require(tokenAmount > 0 && msg.value > 0, "Invalid amounts");
        
        // 从用户转入代币
        _transfer(msg.sender, address(this), tokenAmount);
        
        // 授权给 Router
        _approve(address(this), uniswapV2Router, tokenAmount);
        
        // 调用 Router 加池
        try router.addLiquidityETH{value: msg.value}(
            address(this),
            tokenAmount,
            tokenAmountMin,
            ethAmountMin,
            msg.sender, // LP 代币直接给用户
            block.timestamp + defaultDeadlineMinutes * 60
        ) returns (uint amountToken, uint amountETH, uint liquidity) {
            emit UserAddLiquidity(msg.sender, amountToken, amountETH, liquidity);
        } catch Error(string memory reason) {
            // 失败时退还资产
            _transfer(address(this), msg.sender, tokenAmount);
            payable(msg.sender).transfer(msg.value);
            revert(string.concat("AddLiquidity failed: ", reason));
        } catch {
            // 失败时退还资产
            _transfer(address(this), msg.sender, tokenAmount);
            payable(msg.sender).transfer(msg.value);
            revert("AddLiquidity failed");
        }
    }
    
    /**
     * @dev A2: 用户移除流动性包装器（ETH 配对）
     */
    function userRemoveLiquidityETH(
        uint256 liquidity,
        uint256 tokenAmountMin,
        uint256 ethAmountMin
    ) external nonReentrant {
        require(userLpEnabled, "User LP disabled");
        require(uniswapV2Pair != address(0), "Pair not set");
        require(liquidity > 0, "Invalid liquidity");
        
        // 从用户转入 LP 代币
        IERC20(uniswapV2Pair).transferFrom(msg.sender, address(this), liquidity);
        
        // 授权给 Router
        IERC20(uniswapV2Pair).approve(uniswapV2Router, liquidity);
        
        // 调用 Router 移除流动性
        try router.removeLiquidityETH(
            address(this),
            liquidity,
            tokenAmountMin,
            ethAmountMin,
            msg.sender, // 资产直接给用户
            block.timestamp + defaultDeadlineMinutes * 60
        ) returns (uint amountToken, uint amountETH) {
            emit UserRemoveLiquidity(msg.sender, liquidity, amountToken, amountETH);
        } catch Error(string memory reason) {
            // 失败时退还 LP 代币
            IERC20(uniswapV2Pair).transfer(msg.sender, liquidity);
            revert(string.concat("RemoveLiquidity failed: ", reason));
        } catch {
            // 失败时退还 LP 代币
            IERC20(uniswapV2Pair).transfer(msg.sender, liquidity);
            revert("RemoveLiquidity failed");
        }
    }
    
    // ========== 管理员功能 ==========
    
    /**
     * @dev 设置交易对地址
     */
    function setAMMPair(address pair, bool value) external onlyOwner {
        require(pair != address(0), "Invalid pair address");
        isAMMPair[pair] = value;
        if (value) {
            uniswapV2Pair = pair;
        }
    }
    
    /**
     * @dev 启用/禁用交易
     */
    function setTradingEnabled(bool _enabled) external onlyOwner {
        tradingEnabled = _enabled;
        emit TradingEnabled(_enabled);
    }

    /**
     * @dev 启用/禁用自动换币
     */
    function setSwapEnabled(bool _enabled) external onlyOwner {
        swapEnabled = _enabled;
    }

    /**
     * @dev 更新换币阈值（绝对数量）
     */
    function setSwapTokensAtAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0 && _amount <= MAX_SUPPLY / 100, "Invalid swap threshold");
        swapTokensAtAmount = _amount;
    }
    
    /**
     * @dev 更新税率
     */
    function updateTaxRates(
        uint256 _buyTax,
        uint256 _sellTax,
        uint256 _transferTax
    ) external onlyOwner {
        require(_buyTax <= 1000, "Buy tax too high");    // 最大 10%
        require(_sellTax <= 1500, "Sell tax too high");  // 最大 15%
        require(_transferTax <= 500, "Transfer tax too high"); // 最大 5%
        
        buyTaxRate = _buyTax;
        sellTaxRate = _sellTax;
        transferTaxRate = _transferTax;
        
        emit TaxRatesUpdated(_buyTax, _sellTax, _transferTax);
    }
    
    /**
     * @dev 更新税费分配比例
     */
    function updateTaxDistribution(
        uint256 _liquidityShare,
        uint256 _marketingShare,
        uint256 _burnShare
    ) external onlyOwner {
        require(_liquidityShare + _marketingShare + _burnShare == TAX_DENOMINATOR, 
                "Shares must sum to 100%");
        
        liquidityTaxShare = _liquidityShare;
        marketingTaxShare = _marketingShare;
        burnTaxShare = _burnShare;
        
        emit TaxDistributionUpdated(_liquidityShare, _marketingShare, _burnShare);
    }
    
    /**
     * @dev 更新交易限制
     */
    function updateLimits(
        uint256 _maxTransactionPercent,
        uint256 _maxWalletPercent
    ) external onlyOwner {
        require(_maxTransactionPercent >= 1 && _maxTransactionPercent <= 100, "Invalid transaction limit");
        require(_maxWalletPercent >= 1 && _maxWalletPercent <= 100, "Invalid wallet limit");
        
        maxTransactionAmount = MAX_SUPPLY * _maxTransactionPercent / 100;
        maxWalletAmount = MAX_SUPPLY * _maxWalletPercent / 100;
    }

    /**
     * @dev 更新频率限制参数
     */
    function updateFrequencyLimits(
        bool _cooldownEnabled,
        uint256 _cooldownSeconds,
        bool _dailyLimitEnabled,
        uint256 _maxDailyTxCount
    ) external onlyOwner {
        require(_cooldownSeconds <= 1 hours, "Cooldown too long");
        require(_maxDailyTxCount <= 1000, "Daily count too high");
        cooldownEnabled = _cooldownEnabled;
        cooldownSeconds = _cooldownSeconds;
        dailyLimitEnabled = _dailyLimitEnabled;
        maxDailyTxCount = _maxDailyTxCount;
        emit FrequencyParamsUpdated(cooldownEnabled, cooldownSeconds, dailyLimitEnabled, maxDailyTxCount);
    }

    /**
     * @dev 更新 LP 增强配置
     */
    function updateLpConfig(
        bool _autoLiquidityEnabled,
        bool _userLpEnabled,
        uint256 _slippagePercent,
        uint256 _deadlineMinutes
    ) external onlyOwner {
        require(_slippagePercent <= 1000, "Slippage too high"); // 最大 10%
        require(_deadlineMinutes >= 1 && _deadlineMinutes <= 120, "Invalid deadline");
        autoLiquidityEnabled = _autoLiquidityEnabled;
        userLpEnabled = _userLpEnabled;
        defaultSlippagePercent = _slippagePercent;
        defaultDeadlineMinutes = _deadlineMinutes;
        emit LpConfigUpdated(autoLiquidityEnabled, userLpEnabled, defaultSlippagePercent, defaultDeadlineMinutes);
    }
    
    /**
     * @dev 设置免税地址
     */
    function setExcludedFromTax(address account, bool excluded) external onlyOwner {
        isExcludedFromTax[account] = excluded;
    }
    
    /**
     * @dev 设置免限制地址
     */
    function setExcludedFromLimits(address account, bool excluded) external onlyOwner {
        isExcludedFromLimits[account] = excluded;
    }
    
    /**
     * @dev 设置黑名单
     */
    function setBlacklisted(address account, bool blacklisted) external onlyOwner {
        isBlacklisted[account] = blacklisted;
    }
    
    /**
     * @dev 更新钱包地址
     */
    function updateWallets(address _liquidityWallet, address _marketingWallet) external onlyOwner {
        require(_liquidityWallet != address(0), "Invalid liquidity wallet");
        require(_marketingWallet != address(0), "Invalid marketing wallet");
        
        liquidityWallet = _liquidityWallet;
        marketingWallet = _marketingWallet;
    }
    
    /**
     * @dev 手动触发换币和加流动性
     */
    function manualSwapAndLiquify() external onlyOwner {
        uint256 contractBalance = balanceOf(address(this));
        require(contractBalance > 0, "No tokens to swap");
        _swapAndLiquify(contractBalance);
    }
    
    /**
     * @dev 紧急提取ETH
     */
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner()).transfer(balance);
    }
    
    /**
     * @dev 紧急提取代币
     */
    function emergencyWithdrawTokens(address token) external onlyOwner {
        require(token != address(this), "Cannot withdraw own tokens");
        IERC20(token).transfer(owner(), IERC20(token).balanceOf(address(this)));
    }
    
    // ========== 查询函数 ==========
    
    /**
     * @dev 获取税费信息
     */
    function getTaxInfo() external view returns (
        uint256 buyTax,
        uint256 sellTax,
        uint256 transferTax,
        uint256 liquidityShare,
        uint256 marketingShare,
        uint256 burnShare
    ) {
        return (
            buyTaxRate,
            sellTaxRate,
            transferTaxRate,
            liquidityTaxShare,
            marketingTaxShare,
            burnTaxShare
        );
    }
    
    /**
     * @dev 获取限制信息
     */
    function getLimitsInfo() external view returns (
        uint256 maxTxAmount,
        uint256 maxWallet,
        uint256 swapThreshold
    ) {
        return (
            maxTransactionAmount,
            maxWalletAmount,
            swapTokensAtAmount
        );
    }

    /**
     * @dev 获取频率限制信息
     */
    function getFrequencyInfo() external view returns (
        bool cooldownOn,
        uint256 cooldownSec,
        bool dailyLimitOn,
        uint256 maxDailyCount
    ) {
        return (cooldownEnabled, cooldownSeconds, dailyLimitEnabled, maxDailyTxCount);
    }

    /**
     * @dev 获取 LP 增强信息
     */
    function getLpInfo() external view returns (
        bool autoLpOn,
        bool userLpOn,
        uint256 slippagePercent,
        uint256 deadlineMinutes,
        address pairAddress,
        address routerAddress
    ) {
        return (
            autoLiquidityEnabled,
            userLpEnabled,
            defaultSlippagePercent,
            defaultDeadlineMinutes,
            uniswapV2Pair,
            uniswapV2Router
        );
    }
    
    /**
     * @dev 获取统计信息
     */
    function getStats() external view returns (
        uint256 totalSupply_,
        uint256 totalTaxCollected_,
        uint256 totalBurned_,
        bool tradingEnabled_,
        bool swapEnabled_
    ) {
        return (
            totalSupply(),
            totalTaxCollected,
            totalBurned,
            tradingEnabled,
            swapEnabled
        );
    }
}