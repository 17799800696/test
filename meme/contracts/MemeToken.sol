// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
    
    // ========== 交易限制配置 ==========
    uint256 public maxTransactionAmount;     // 单笔交易最大额度
    uint256 public maxWalletAmount;          // 单个钱包最大持有量
    uint256 public swapTokensAtAmount;       // 自动换币阈值
    
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
    
    // ========== 自动换币和加流动性 ==========
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
        
        // 将流动性代币转给流动性钱包
        if (liquidityTokens > 0) {
            super._update(address(this), liquidityWallet, liquidityTokens);
        }
        
        emit SwapAndLiquify(contractTokenBalance, 0, liquidityTokens);
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