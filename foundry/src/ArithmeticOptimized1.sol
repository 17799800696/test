// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title ArithmeticOptimized1
 * @dev Gas优化版本1：减少存储操作和事件发射
 * @notice 优化策略：
 * 1. 移除操作历史记录存储（减少SSTORE操作）
 * 2. 简化事件发射（只保留必要事件）
 * 3. 使用局部变量减少状态变量访问
 */
contract ArithmeticOptimized1 {
    // 只保留最后结果，移除操作历史
    uint256 public lastResult;
    
    // 简化事件定义，只保留结果更新事件
    event ResultUpdated(uint256 newResult);
    
    /**
     * @dev 优化的加法运算
     * @param a 第一个操作数
     * @param b 第二个操作数
     * @return result 运算结果
     */
    function add(uint256 a, uint256 b) public returns (uint256 result) {
        result = a + b;
        lastResult = result;
        emit ResultUpdated(result);
        return result;
    }
    
    /**
     * @dev 优化的减法运算
     * @param a 被减数
     * @param b 减数
     * @return result 运算结果
     */
    function subtract(uint256 a, uint256 b) public returns (uint256 result) {
        require(a >= b, "Subtraction would result in negative number");
        result = a - b;
        lastResult = result;
        emit ResultUpdated(result);
        return result;
    }
    
    /**
     * @dev 优化的乘法运算
     * @param a 第一个操作数
     * @param b 第二个操作数
     * @return result 运算结果
     */
    function multiply(uint256 a, uint256 b) public returns (uint256 result) {
        result = a * b;
        lastResult = result;
        emit ResultUpdated(result);
        return result;
    }
    
    /**
     * @dev 优化的除法运算
     * @param a 被除数
     * @param b 除数
     * @return result 运算结果
     */
    function divide(uint256 a, uint256 b) public returns (uint256 result) {
        require(b != 0, "Division by zero");
        result = a / b;
        lastResult = result;
        emit ResultUpdated(result);
        return result;
    }
    
    /**
     * @dev 重置最后结果
     */
    function resetLastResult() public {
        lastResult = 0;
        emit ResultUpdated(0);
    }
    
    /**
     * @dev 批量运算函数 - 进一步优化Gas
     * @param operations 操作类型数组 (0=add, 1=subtract, 2=multiply, 3=divide)
     * @param operands1 第一个操作数数组
     * @param operands2 第二个操作数数组
     * @return results 结果数组
     */
    function batchCalculate(
        uint8[] calldata operations,
        uint256[] calldata operands1,
        uint256[] calldata operands2
    ) external returns (uint256[] memory results) {
        require(
            operations.length == operands1.length && 
            operands1.length == operands2.length,
            "Array lengths must match"
        );
        
        results = new uint256[](operations.length);
        uint256 tempResult;
        
        for (uint256 i = 0; i < operations.length;) {
            uint256 a = operands1[i];
            uint256 b = operands2[i];
            
            if (operations[i] == 0) {
                tempResult = a + b;
            } else if (operations[i] == 1) {
                require(a >= b, "Subtraction would result in negative number");
                tempResult = a - b;
            } else if (operations[i] == 2) {
                tempResult = a * b;
            } else if (operations[i] == 3) {
                require(b != 0, "Division by zero");
                tempResult = a / b;
            } else {
                revert("Invalid operation");
            }
            
            results[i] = tempResult;
            
            unchecked {
                ++i;
            }
        }
        
        // 只更新最后一个结果
        if (results.length > 0) {
            lastResult = results[results.length - 1];
            emit ResultUpdated(lastResult);
        }
        
        return results;
    }
}