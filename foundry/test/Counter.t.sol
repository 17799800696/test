// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {ArithmeticContract} from "../src/Counter.sol";

/**
 * @title ArithmeticContractTest
 * @dev 算术合约的单元测试，包含Gas消耗分析
 */
contract ArithmeticContractTest is Test {
    ArithmeticContract public arithmeticContract;
    
    // Gas消耗记录
    struct GasRecord {
        string operation;
        uint256 gasUsed;
        uint256 operand1;
        uint256 operand2;
        uint256 result;
    }
    
    GasRecord[] public gasRecords;
    
    function setUp() public {
        arithmeticContract = new ArithmeticContract();
    }
    
    /**
     * @dev 测试加法运算
     */
    function testAdd() public {
        uint256 gasBefore = gasleft();
        uint256 result = arithmeticContract.add(10, 5);
        uint256 gasAfter = gasleft();
        uint256 gasUsed = gasBefore - gasAfter;
        
        // 记录Gas消耗
        gasRecords.push(GasRecord({
            operation: "add",
            gasUsed: gasUsed,
            operand1: 10,
            operand2: 5,
            result: result
        }));
        
        assertEq(result, 15);
        assertEq(arithmeticContract.lastResult(), 15);
        assertEq(arithmeticContract.getOperationCount(), 1);
        
        console.log("Add operation gas used:", gasUsed);
    }
    
    /**
     * @dev 测试减法运算
     */
    function testSubtract() public {
        uint256 gasBefore = gasleft();
        uint256 result = arithmeticContract.subtract(20, 8);
        uint256 gasAfter = gasleft();
        uint256 gasUsed = gasBefore - gasAfter;
        
        // 记录Gas消耗
        gasRecords.push(GasRecord({
            operation: "subtract",
            gasUsed: gasUsed,
            operand1: 20,
            operand2: 8,
            result: result
        }));
        
        assertEq(result, 12);
        assertEq(arithmeticContract.lastResult(), 12);
        
        console.log("Subtract operation gas used:", gasUsed);
    }
    
    /**
     * @dev 测试减法运算的边界条件（负数检查）
     */
    function testSubtractRevert() public {
        vm.expectRevert("Subtraction would result in negative number");
        arithmeticContract.subtract(5, 10);
    }
    
    /**
     * @dev 测试乘法运算
     */
    function testMultiply() public {
        uint256 gasBefore = gasleft();
        uint256 result = arithmeticContract.multiply(6, 7);
        uint256 gasAfter = gasleft();
        uint256 gasUsed = gasBefore - gasAfter;
        
        // 记录Gas消耗
        gasRecords.push(GasRecord({
            operation: "multiply",
            gasUsed: gasUsed,
            operand1: 6,
            operand2: 7,
            result: result
        }));
        
        assertEq(result, 42);
        assertEq(arithmeticContract.lastResult(), 42);
        
        console.log("Multiply operation gas used:", gasUsed);
    }
    
    /**
     * @dev 测试除法运算
     */
    function testDivide() public {
        uint256 gasBefore = gasleft();
        uint256 result = arithmeticContract.divide(20, 4);
        uint256 gasAfter = gasleft();
        uint256 gasUsed = gasBefore - gasAfter;
        
        // 记录Gas消耗
        gasRecords.push(GasRecord({
            operation: "divide",
            gasUsed: gasUsed,
            operand1: 20,
            operand2: 4,
            result: result
        }));
        
        assertEq(result, 5);
        assertEq(arithmeticContract.lastResult(), 5);
        
        console.log("Divide operation gas used:", gasUsed);
    }
    
    /**
     * @dev 测试除法运算的边界条件（除零检查）
     */
    function testDivideByZeroRevert() public {
        vm.expectRevert("Division by zero");
        arithmeticContract.divide(10, 0);
    }
    
    /**
     * @dev 测试操作历史记录功能
     */
    function testOperationHistory() public {
        arithmeticContract.add(1, 2);
        arithmeticContract.subtract(10, 3);
        arithmeticContract.multiply(4, 5);
        
        assertEq(arithmeticContract.getOperationCount(), 3);
        
        // 检查第一个操作记录
        ArithmeticContract.Operation memory op1 = arithmeticContract.getOperation(0);
        assertEq(op1.operand1, 1);
        assertEq(op1.operand2, 2);
        assertEq(op1.result, 3);
        assertEq(op1.operation, "add");
        
        // 检查第二个操作记录
        ArithmeticContract.Operation memory op2 = arithmeticContract.getOperation(1);
        assertEq(op2.operand1, 10);
        assertEq(op2.operand2, 3);
        assertEq(op2.result, 7);
        assertEq(op2.operation, "subtract");
    }
    
    /**
     * @dev 测试重置功能
     */
    function testResetLastResult() public {
        arithmeticContract.add(10, 5);
        assertEq(arithmeticContract.lastResult(), 15);
        
        arithmeticContract.resetLastResult();
        assertEq(arithmeticContract.lastResult(), 0);
    }
    
    /**
     * @dev 测试事件发射
     */
    function testEvents() public {
        // 测试OperationPerformed事件
        vm.expectEmit(true, true, true, true);
        emit ArithmeticContract.OperationPerformed(10, 5, 15, "add");
        
        // 测试ResultUpdated事件
        vm.expectEmit(true, true, true, true);
        emit ArithmeticContract.ResultUpdated(15);
        
        arithmeticContract.add(10, 5);
    }
    
    /**
     * @dev 综合Gas消耗测试
     */
    function testGasConsumption() public {
        console.log("=== Gas Consumption Analysis ===");
        
        // 测试多次相同操作的Gas消耗
        uint256[] memory addGasCosts = new uint256[](5);
        
        for (uint i = 0; i < 5; i++) {
            uint256 gasBefore = gasleft();
            arithmeticContract.add(i + 1, i + 2);
            uint256 gasAfter = gasleft();
            addGasCosts[i] = gasBefore - gasAfter;
            console.log("Add operation", i + 1, "gas used:", addGasCosts[i]);
        }
        
        // 分析Gas消耗趋势
        console.log("First add gas:", addGasCosts[0]);
        console.log("Last add gas:", addGasCosts[4]);
        
        // 安全地计算Gas增长
        if (addGasCosts[4] >= addGasCosts[0]) {
            console.log("Gas increase per operation:", addGasCosts[4] - addGasCosts[0]);
        } else {
            console.log("Gas decrease per operation:", addGasCosts[0] - addGasCosts[4]);
        }
    }
    
    /**
     * @dev 模糊测试加法运算
     */
    function testFuzzAdd(uint128 a, uint128 b) public {
        // 使用uint128避免溢出
        uint256 result = arithmeticContract.add(a, b);
        assertEq(result, uint256(a) + uint256(b));
        assertEq(arithmeticContract.lastResult(), result);
    }
    
    /**
     * @dev 模糊测试减法运算
     */
    function testFuzzSubtract(uint256 a, uint256 b) public {
        vm.assume(a >= b); // 确保不会产生负数
        
        uint256 result = arithmeticContract.subtract(a, b);
        assertEq(result, a - b);
        assertEq(arithmeticContract.lastResult(), result);
    }
    
    /**
     * @dev 模糊测试乘法运算
     */
    function testFuzzMultiply(uint128 a, uint128 b) public {
        // 使用uint128避免溢出
        uint256 result = arithmeticContract.multiply(a, b);
        assertEq(result, uint256(a) * uint256(b));
        assertEq(arithmeticContract.lastResult(), result);
    }
    
    /**
     * @dev 模糊测试除法运算
     */
    function testFuzzDivide(uint256 a, uint256 b) public {
        vm.assume(b != 0); // 确保除数不为零
        
        uint256 result = arithmeticContract.divide(a, b);
        assertEq(result, a / b);
        assertEq(arithmeticContract.lastResult(), result);
    }
}
