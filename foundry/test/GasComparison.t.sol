// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {ArithmeticContract} from "../src/Counter.sol";
import {ArithmeticOptimized1} from "../src/ArithmeticOptimized1.sol";
import {ArithmeticOptimized2} from "../src/ArithmeticOptimized2.sol";

/**
 * @title GasComparisonTest
 * @dev 对比三个版本合约的Gas消耗
 */
contract GasComparisonTest is Test {
    ArithmeticContract public originalContract;
    ArithmeticOptimized1 public optimized1Contract;
    ArithmeticOptimized2 public optimized2Contract;
    
    // Gas消耗记录结构
    struct GasComparison {
        string operation;
        uint256 originalGas;
        uint256 optimized1Gas;
        uint256 optimized2Gas;
        uint256 savings1;
        uint256 savings2;
        uint256 percentSavings1;
        uint256 percentSavings2;
    }
    
    GasComparison[] public gasComparisons;
    
    function setUp() public {
        originalContract = new ArithmeticContract();
        optimized1Contract = new ArithmeticOptimized1();
        optimized2Contract = new ArithmeticOptimized2();
    }
    
    /**
     * @dev 对比加法运算的Gas消耗
     */
    function testCompareAddGas() public {
        uint256 a = 100;
        uint256 b = 50;
        
        // 测试原始合约
        uint256 gasBeforeOriginal = gasleft();
        originalContract.add(a, b);
        uint256 gasAfterOriginal = gasleft();
        uint256 originalGas = gasBeforeOriginal - gasAfterOriginal;
        
        // 测试优化版本1
        uint256 gasBeforeOpt1 = gasleft();
        optimized1Contract.add(a, b);
        uint256 gasAfterOpt1 = gasleft();
        uint256 opt1Gas = gasBeforeOpt1 - gasAfterOpt1;
        
        // 测试优化版本2
        uint256 gasBeforeOpt2 = gasleft();
        optimized2Contract.add(a, b);
        uint256 gasAfterOpt2 = gasleft();
        uint256 opt2Gas = gasBeforeOpt2 - gasAfterOpt2;
        
        // 记录对比数据
        _recordGasComparison("add", originalGas, opt1Gas, opt2Gas);
        
        console.log("=== ADD Operation Gas Comparison ===");
        console.log("Original contract gas:", originalGas);
        console.log("Optimized1 contract gas:", opt1Gas);
        console.log("Optimized2 contract gas:", opt2Gas);
        console.log("Savings with Opt1:", originalGas > opt1Gas ? originalGas - opt1Gas : 0);
        console.log("Savings with Opt2:", originalGas > opt2Gas ? originalGas - opt2Gas : 0);
    }
    
    /**
     * @dev 对比减法运算的Gas消耗
     */
    function testCompareSubtractGas() public {
        uint256 a = 100;
        uint256 b = 30;
        
        // 测试原始合约
        uint256 gasBeforeOriginal = gasleft();
        originalContract.subtract(a, b);
        uint256 gasAfterOriginal = gasleft();
        uint256 originalGas = gasBeforeOriginal - gasAfterOriginal;
        
        // 测试优化版本1
        uint256 gasBeforeOpt1 = gasleft();
        optimized1Contract.subtract(a, b);
        uint256 gasAfterOpt1 = gasleft();
        uint256 opt1Gas = gasBeforeOpt1 - gasAfterOpt1;
        
        // 测试优化版本2
        uint256 gasBeforeOpt2 = gasleft();
        optimized2Contract.subtract(a, b);
        uint256 gasAfterOpt2 = gasleft();
        uint256 opt2Gas = gasBeforeOpt2 - gasAfterOpt2;
        
        // 记录对比数据
        _recordGasComparison("subtract", originalGas, opt1Gas, opt2Gas);
        
        console.log("=== SUBTRACT Operation Gas Comparison ===");
        console.log("Original contract gas:", originalGas);
        console.log("Optimized1 contract gas:", opt1Gas);
        console.log("Optimized2 contract gas:", opt2Gas);
        console.log("Savings with Opt1:", originalGas > opt1Gas ? originalGas - opt1Gas : 0);
        console.log("Savings with Opt2:", originalGas > opt2Gas ? originalGas - opt2Gas : 0);
    }
    
    /**
     * @dev 对比乘法运算的Gas消耗
     */
    function testCompareMultiplyGas() public {
        uint256 a = 12;
        uint256 b = 8;
        
        // 测试原始合约
        uint256 gasBeforeOriginal = gasleft();
        originalContract.multiply(a, b);
        uint256 gasAfterOriginal = gasleft();
        uint256 originalGas = gasBeforeOriginal - gasAfterOriginal;
        
        // 测试优化版本1
        uint256 gasBeforeOpt1 = gasleft();
        optimized1Contract.multiply(a, b);
        uint256 gasAfterOpt1 = gasleft();
        uint256 opt1Gas = gasBeforeOpt1 - gasAfterOpt1;
        
        // 测试优化版本2
        uint256 gasBeforeOpt2 = gasleft();
        optimized2Contract.multiply(a, b);
        uint256 gasAfterOpt2 = gasleft();
        uint256 opt2Gas = gasBeforeOpt2 - gasAfterOpt2;
        
        // 记录对比数据
        _recordGasComparison("multiply", originalGas, opt1Gas, opt2Gas);
        
        console.log("=== MULTIPLY Operation Gas Comparison ===");
        console.log("Original contract gas:", originalGas);
        console.log("Optimized1 contract gas:", opt1Gas);
        console.log("Optimized2 contract gas:", opt2Gas);
        console.log("Savings with Opt1:", originalGas > opt1Gas ? originalGas - opt1Gas : 0);
        console.log("Savings with Opt2:", originalGas > opt2Gas ? originalGas - opt2Gas : 0);
    }
    
    /**
     * @dev 对比除法运算的Gas消耗
     */
    function testCompareDivideGas() public {
        uint256 a = 100;
        uint256 b = 5;
        
        // 测试原始合约
        uint256 gasBeforeOriginal = gasleft();
        originalContract.divide(a, b);
        uint256 gasAfterOriginal = gasleft();
        uint256 originalGas = gasBeforeOriginal - gasAfterOriginal;
        
        // 测试优化版本1
        uint256 gasBeforeOpt1 = gasleft();
        optimized1Contract.divide(a, b);
        uint256 gasAfterOpt1 = gasleft();
        uint256 opt1Gas = gasBeforeOpt1 - gasAfterOpt1;
        
        // 测试优化版本2
        uint256 gasBeforeOpt2 = gasleft();
        optimized2Contract.divide(a, b);
        uint256 gasAfterOpt2 = gasleft();
        uint256 opt2Gas = gasBeforeOpt2 - gasAfterOpt2;
        
        // 记录对比数据
        _recordGasComparison("divide", originalGas, opt1Gas, opt2Gas);
        
        console.log("=== DIVIDE Operation Gas Comparison ===");
        console.log("Original contract gas:", originalGas);
        console.log("Optimized1 contract gas:", opt1Gas);
        console.log("Optimized2 contract gas:", opt2Gas);
        console.log("Savings with Opt1:", originalGas > opt1Gas ? originalGas - opt1Gas : 0);
        console.log("Savings with Opt2:", originalGas > opt2Gas ? originalGas - opt2Gas : 0);
    }
    
    /**
     * @dev 测试批量操作的Gas效率
     */
    function testBatchOperationsGas() public {
        console.log("=== BATCH Operations Gas Comparison ===");
        
        // 准备批量操作数据
        uint8[] memory operations = new uint8[](4);
        uint256[] memory operands1 = new uint256[](4);
        uint256[] memory operands2 = new uint256[](4);
        
        operations[0] = 0; // add
        operations[1] = 1; // subtract
        operations[2] = 2; // multiply
        operations[3] = 3; // divide
        
        operands1[0] = 10;
        operands1[1] = 20;
        operands1[2] = 6;
        operands1[3] = 100;
        
        operands2[0] = 5;
        operands2[1] = 8;
        operands2[2] = 7;
        operands2[3] = 4;
        
        // 测试单独操作的总Gas消耗
        uint256 gasBeforeIndividual = gasleft();
        originalContract.add(operands1[0], operands2[0]);
        originalContract.subtract(operands1[1], operands2[1]);
        originalContract.multiply(operands1[2], operands2[2]);
        originalContract.divide(operands1[3], operands2[3]);
        uint256 gasAfterIndividual = gasleft();
        uint256 individualGas = gasBeforeIndividual - gasAfterIndividual;
        
        // 测试优化版本1的批量操作
        uint256 gasBeforeBatch1 = gasleft();
        optimized1Contract.batchCalculate(operations, operands1, operands2);
        uint256 gasAfterBatch1 = gasleft();
        uint256 batch1Gas = gasBeforeBatch1 - gasAfterBatch1;
        
        // 测试优化版本2的纯函数批量操作
        uint256 gasBeforeBatch2 = gasleft();
        optimized2Contract.batchCalculatePure(operations, operands1, operands2);
        uint256 gasAfterBatch2 = gasleft();
        uint256 batch2Gas = gasBeforeBatch2 - gasAfterBatch2;
        
        console.log("Individual operations total gas:", individualGas);
        console.log("Batch operations (Opt1) gas:", batch1Gas);
        console.log("Batch operations (Opt2) gas:", batch2Gas);
        console.log("Batch savings (Opt1):", individualGas > batch1Gas ? individualGas - batch1Gas : 0);
        console.log("Batch savings (Opt2):", individualGas > batch2Gas ? individualGas - batch2Gas : 0);
    }
    
    /**
     * @dev 测试纯函数版本的Gas消耗
     */
    function testPureFunctionGas() public {
        console.log("=== PURE Function Gas Comparison ===");
        
        uint256 a = 50;
        uint256 b = 25;
        
        // 测试优化版本2的纯函数
        uint256 gasBeforePureAdd = gasleft();
        optimized2Contract.calculate(a, b, 0); // add
        uint256 gasAfterPureAdd = gasleft();
        uint256 pureAddGas = gasBeforePureAdd - gasAfterPureAdd;
        
        uint256 gasBeforePureSub = gasleft();
        optimized2Contract.calculate(a, b, 1); // subtract
        uint256 gasAfterPureSub = gasleft();
        uint256 pureSubGas = gasBeforePureSub - gasAfterPureSub;
        
        uint256 gasBeforePureMul = gasleft();
        optimized2Contract.calculate(a, b, 2); // multiply
        uint256 gasAfterPureMul = gasleft();
        uint256 pureMulGas = gasBeforePureMul - gasAfterPureMul;
        
        uint256 gasBeforePureDiv = gasleft();
        optimized2Contract.calculate(a, b, 3); // divide
        uint256 gasAfterPureDiv = gasleft();
        uint256 pureDivGas = gasBeforePureDiv - gasAfterPureDiv;
        
        console.log("Pure function add gas:", pureAddGas);
        console.log("Pure function subtract gas:", pureSubGas);
        console.log("Pure function multiply gas:", pureMulGas);
        console.log("Pure function divide gas:", pureDivGas);
    }
    
    /**
     * @dev 综合Gas分析报告
     */
    function testGenerateGasReport() public {
        // 运行所有对比测试
        testCompareAddGas();
        testCompareSubtractGas();
        testCompareMultiplyGas();
        testCompareDivideGas();
        
        console.log("\n=== COMPREHENSIVE GAS ANALYSIS REPORT ===");
        console.log("Total comparisons:", gasComparisons.length);
        
        uint256 totalOriginalGas = 0;
        uint256 totalOpt1Gas = 0;
        uint256 totalOpt2Gas = 0;
        
        for (uint256 i = 0; i < gasComparisons.length; i++) {
            GasComparison memory comp = gasComparisons[i];
            totalOriginalGas += comp.originalGas;
            totalOpt1Gas += comp.optimized1Gas;
            totalOpt2Gas += comp.optimized2Gas;
            
            console.log("\nOperation:", comp.operation);
            console.log("  Original:", comp.originalGas, "gas");
            console.log("  Optimized1:", comp.optimized1Gas, "gas");
            console.log("  Optimized2:", comp.optimized2Gas, "gas");
            console.log("  Savings1:", comp.savings1, "gas");
            console.log("  Savings1 percentage:", comp.percentSavings1, "%");
            console.log("  Savings2:", comp.savings2, "gas");
            console.log("  Savings2 percentage:", comp.percentSavings2, "%");
        }
        
        console.log("\n=== TOTAL SAVINGS ===");
        console.log("Total original gas:", totalOriginalGas);
        console.log("Total optimized1 gas:", totalOpt1Gas);
        console.log("Total optimized2 gas:", totalOpt2Gas);
        console.log("Total savings with Opt1:", totalOriginalGas > totalOpt1Gas ? totalOriginalGas - totalOpt1Gas : 0);
        console.log("Total savings with Opt2:", totalOriginalGas > totalOpt2Gas ? totalOriginalGas - totalOpt2Gas : 0);
        
        if (totalOriginalGas > 0) {
            uint256 percentSavings1 = totalOriginalGas > totalOpt1Gas ? 
                ((totalOriginalGas - totalOpt1Gas) * 100) / totalOriginalGas : 0;
            uint256 percentSavings2 = totalOriginalGas > totalOpt2Gas ? 
                ((totalOriginalGas - totalOpt2Gas) * 100) / totalOriginalGas : 0;
            console.log("Percentage savings with Opt1:", percentSavings1, "%");
            console.log("Percentage savings with Opt2:", percentSavings2, "%");
        }
    }
    
    /**
     * @dev 记录Gas对比数据
     */
    function _recordGasComparison(
        string memory operation,
        uint256 originalGas,
        uint256 opt1Gas,
        uint256 opt2Gas
    ) internal {
        uint256 savings1 = originalGas > opt1Gas ? originalGas - opt1Gas : 0;
        uint256 savings2 = originalGas > opt2Gas ? originalGas - opt2Gas : 0;
        
        uint256 percentSavings1 = originalGas > 0 ? (savings1 * 100) / originalGas : 0;
        uint256 percentSavings2 = originalGas > 0 ? (savings2 * 100) / originalGas : 0;
        
        gasComparisons.push(GasComparison({
            operation: operation,
            originalGas: originalGas,
            optimized1Gas: opt1Gas,
            optimized2Gas: opt2Gas,
            savings1: savings1,
            savings2: savings2,
            percentSavings1: percentSavings1,
            percentSavings2: percentSavings2
        }));
    }
}