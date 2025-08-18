// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title ArithmeticContract
 * @dev 一个包含基本算术运算的智能合约
 * @notice 这个合约提供加法、减法、乘法和除法运算
 */
contract ArithmeticContract {
    // 存储最后一次运算的结果
    uint256 public lastResult;
    
    // 运算历史记录
    struct Operation {
        uint256 operand1;
        uint256 operand2;
        uint256 result;
        string operation;
        uint256 timestamp;
    }
    
    Operation[] public operations;
    
    // 事件定义
    event OperationPerformed(uint256 operand1, uint256 operand2, uint256 result, string operation);
    event ResultUpdated(uint256 newResult);
    
    /**
     * @dev 加法运算
     * @param a 第一个操作数
     * @param b 第二个操作数
     * @return result 运算结果
     */
    function add(uint256 a, uint256 b) public returns (uint256 result) {
        result = a + b;
        lastResult = result;
        
        // 记录操作历史
        operations.push(Operation({
            operand1: a,
            operand2: b,
            result: result,
            operation: "add",
            timestamp: block.timestamp
        }));
        
        emit OperationPerformed(a, b, result, "add");
        emit ResultUpdated(result);
        
        return result;
    }
    
    /**
     * @dev 减法运算
     * @param a 被减数
     * @param b 减数
     * @return result 运算结果
     */
    function subtract(uint256 a, uint256 b) public returns (uint256 result) {
        require(a >= b, "Subtraction would result in negative number");
        
        result = a - b;
        lastResult = result;
        
        // 记录操作历史
        operations.push(Operation({
            operand1: a,
            operand2: b,
            result: result,
            operation: "subtract",
            timestamp: block.timestamp
        }));
        
        emit OperationPerformed(a, b, result, "subtract");
        emit ResultUpdated(result);
        
        return result;
    }
    
    /**
     * @dev 乘法运算
     * @param a 第一个操作数
     * @param b 第二个操作数
     * @return result 运算结果
     */
    function multiply(uint256 a, uint256 b) public returns (uint256 result) {
        result = a * b;
        lastResult = result;
        
        // 记录操作历史
        operations.push(Operation({
            operand1: a,
            operand2: b,
            result: result,
            operation: "multiply",
            timestamp: block.timestamp
        }));
        
        emit OperationPerformed(a, b, result, "multiply");
        emit ResultUpdated(result);
        
        return result;
    }
    
    /**
     * @dev 除法运算
     * @param a 被除数
     * @param b 除数
     * @return result 运算结果
     */
    function divide(uint256 a, uint256 b) public returns (uint256 result) {
        require(b != 0, "Division by zero");
        
        result = a / b;
        lastResult = result;
        
        // 记录操作历史
        operations.push(Operation({
            operand1: a,
            operand2: b,
            result: result,
            operation: "divide",
            timestamp: block.timestamp
        }));
        
        emit OperationPerformed(a, b, result, "divide");
        emit ResultUpdated(result);
        
        return result;
    }
    
    /**
     * @dev 获取操作历史记录数量
     * @return count 操作历史记录数量
     */
    function getOperationCount() public view returns (uint256 count) {
        return operations.length;
    }
    
    /**
     * @dev 获取指定索引的操作记录
     * @param index 操作记录索引
     * @return operation 操作记录
     */
    function getOperation(uint256 index) public view returns (Operation memory operation) {
        require(index < operations.length, "Index out of bounds");
        return operations[index];
    }
    
    /**
     * @dev 重置最后结果
     */
    function resetLastResult() public {
        lastResult = 0;
        emit ResultUpdated(0);
    }
}
