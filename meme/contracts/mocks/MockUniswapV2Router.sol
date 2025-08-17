// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockUniswapV2Router - 用于测试的 Uniswap V2 Router 模拟合约
 * @dev 模拟 addLiquidityETH 和 removeLiquidityETH 的行为，支持成功和失败场景
 */
contract MockUniswapV2Router {
    address public immutable WETH;
    address public factory;
    
    // 控制模拟行为的状态变量
    bool public shouldFail = false;
    string public failureReason = "Mock failure";
    bool public shouldRevert = false;
    
    // 模拟返回值
    uint256 public mockAmountToken = 1000 * 10**18;
    uint256 public mockAmountETH = 1 ether;
    uint256 public mockLiquidity = 100 * 10**18;
    
    event MockAddLiquidity(
        address indexed token,
        uint256 amountToken,
        uint256 amountETH,
        uint256 liquidity,
        address indexed to
    );
    
    event MockRemoveLiquidity(
        address indexed token,
        uint256 liquidity,
        uint256 amountToken,
        uint256 amountETH,
        address indexed to
    );
    
    constructor(address _weth) {
        WETH = _weth;
        factory = address(this); // 简化处理
    }
    
    // 设置模拟行为
    function setMockBehavior(
        bool _shouldFail,
        string memory _failureReason,
        bool _shouldRevert
    ) external {
        shouldFail = _shouldFail;
        failureReason = _failureReason;
        shouldRevert = _shouldRevert;
    }
    
    // 设置模拟返回值
    function setMockReturnValues(
        uint256 _amountToken,
        uint256 _amountETH,
        uint256 _liquidity
    ) external {
        mockAmountToken = _amountToken;
        mockAmountETH = _amountETH;
        mockLiquidity = _liquidity;
    }
    
    // 模拟 addLiquidityETH
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity) {
        require(block.timestamp <= deadline, "Router: EXPIRED");
        
        if (shouldRevert) {
            revert("Mock revert");
        }
        
        if (shouldFail) {
            revert(failureReason);
        }
        
        // 模拟成功场景：转移代币和 ETH
        IERC20(token).transferFrom(msg.sender, address(this), amountTokenDesired);
        
        // 返回模拟值
        amountToken = mockAmountToken;
        amountETH = mockAmountETH;
        liquidity = mockLiquidity;
        
        emit MockAddLiquidity(token, amountToken, amountETH, liquidity, to);
        
        return (amountToken, amountETH, liquidity);
    }
    
    // 模拟 removeLiquidityETH
    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external returns (uint amountToken, uint amountETH) {
        require(block.timestamp <= deadline, "Router: EXPIRED");
        
        if (shouldRevert) {
            revert("Mock revert");
        }
        
        if (shouldFail) {
            revert(failureReason);
        }
        
        // 返回模拟值
        amountToken = mockAmountToken;
        amountETH = mockAmountETH;
        
        // 模拟转移资产给接收者
        if (amountToken > 0) {
            IERC20(token).transfer(to, amountToken);
        }
        if (amountETH > 0) {
            payable(to).transfer(amountETH);
        }
        
        emit MockRemoveLiquidity(token, liquidity, amountToken, amountETH, to);
        
        return (amountToken, amountETH);
    }
    
    // 模拟其他必要的 Router 函数
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external {
        require(block.timestamp <= deadline, "Router: EXPIRED");
        
        if (shouldRevert) {
            revert("Mock swap revert");
        }
        
        if (shouldFail) {
            revert(failureReason);
        }
        
        // 简单模拟：转移输入代币，给接收者一些 ETH
        if (path.length >= 2) {
            IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
            if (address(this).balance >= mockAmountETH) {
                payable(to).transfer(mockAmountETH);
            }
        }
    }
    
    // 允许合约接收 ETH
    receive() external payable {}
    
    // 提取 ETH（测试辅助）
    function withdrawETH() external {
        payable(msg.sender).transfer(address(this).balance);
    }
}