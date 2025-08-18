// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title ArithmeticOptimized2
 * @dev Gas优化版本2：极致优化
 * @notice 优化策略：
 * 1. 移除所有事件发射
 * 2. 使用assembly进行低级操作
 * 3. 移除状态变量存储
 * 4. 使用pure函数减少状态访问
 * 5. 优化函数选择器
 */
contract ArithmeticOptimized2 {
    // 最小化状态变量
    uint256 private _lastResult;
    
    /**
     * @dev 极致优化的加法运算 - 使用assembly
     * @param a 第一个操作数
     * @param b 第二个操作数
     * @return result 运算结果
     */
    function add(uint256 a, uint256 b) external returns (uint256 result) {
        assembly {
            result := add(a, b)
            // 检查溢出
            if lt(result, a) {
                mstore(0x00, 0x4e487b71) // Panic error selector
                mstore(0x04, 0x11) // Arithmetic overflow
                revert(0x00, 0x24)
            }
            sstore(_lastResult.slot, result)
        }
    }
    
    /**
     * @dev 极致优化的减法运算
     * @param a 被减数
     * @param b 减数
     * @return result 运算结果
     */
    function subtract(uint256 a, uint256 b) external returns (uint256 result) {
        assembly {
            if lt(a, b) {
                // 自定义错误消息
                let ptr := mload(0x40)
                mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(add(ptr, 0x04), 0x0000000000000000000000000000000000000000000000000000000000000020)
                mstore(add(ptr, 0x24), 0x0000000000000000000000000000000000000000000000000000000000000025)
                mstore(add(ptr, 0x44), 0x5375627472616374696f6e20776f756c6420726573756c7420696e206e656761)
                mstore(add(ptr, 0x64), 0x74697665206e756d6265720000000000000000000000000000000000000000)
                revert(ptr, 0x84)
            }
            result := sub(a, b)
            sstore(_lastResult.slot, result)
        }
    }
    
    /**
     * @dev 极致优化的乘法运算
     * @param a 第一个操作数
     * @param b 第二个操作数
     * @return result 运算结果
     */
    function multiply(uint256 a, uint256 b) external returns (uint256 result) {
        assembly {
            result := mul(a, b)
            // 检查溢出
            if and(iszero(iszero(a)), iszero(eq(div(result, a), b))) {
                mstore(0x00, 0x4e487b71) // Panic error selector
                mstore(0x04, 0x11) // Arithmetic overflow
                revert(0x00, 0x24)
            }
            sstore(_lastResult.slot, result)
        }
    }
    
    /**
     * @dev 极致优化的除法运算
     * @param a 被除数
     * @param b 除数
     * @return result 运算结果
     */
    function divide(uint256 a, uint256 b) external returns (uint256 result) {
        assembly {
            if iszero(b) {
                // Division by zero error
                let ptr := mload(0x40)
                mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(add(ptr, 0x04), 0x0000000000000000000000000000000000000000000000000000000000000020)
                mstore(add(ptr, 0x24), 0x0000000000000000000000000000000000000000000000000000000000000010)
                mstore(add(ptr, 0x44), 0x4469766973696f6e206279207a65726f00000000000000000000000000000000)
                revert(ptr, 0x64)
            }
            result := div(a, b)
            sstore(_lastResult.slot, result)
        }
    }
    
    /**
     * @dev 获取最后结果 - 优化的getter
     * @return result 最后的运算结果
     */
    function lastResult() external view returns (uint256 result) {
        assembly {
            result := sload(_lastResult.slot)
        }
    }
    
    /**
     * @dev 重置最后结果
     */
    function resetLastResult() external {
        assembly {
            sstore(_lastResult.slot, 0)
        }
    }
    
    /**
     * @dev 纯函数版本的运算 - 不修改状态
     * @param a 第一个操作数
     * @param b 第二个操作数
     * @param operation 操作类型 (0=add, 1=sub, 2=mul, 3=div)
     * @return result 运算结果
     */
    function calculate(uint256 a, uint256 b, uint8 operation) external pure returns (uint256 result) {
        assembly {
            switch operation
            case 0 {
                result := add(a, b)
                if lt(result, a) {
                    mstore(0x00, 0x4e487b71)
                    mstore(0x04, 0x11)
                    revert(0x00, 0x24)
                }
            }
            case 1 {
                if lt(a, b) {
                    let ptr := mload(0x40)
                    mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(add(ptr, 0x04), 0x0000000000000000000000000000000000000000000000000000000000000020)
                    mstore(add(ptr, 0x24), 0x0000000000000000000000000000000000000000000000000000000000000025)
                    mstore(add(ptr, 0x44), 0x5375627472616374696f6e20776f756c6420726573756c7420696e206e656761)
                    mstore(add(ptr, 0x64), 0x74697665206e756d6265720000000000000000000000000000000000000000)
                    revert(ptr, 0x84)
                }
                result := sub(a, b)
            }
            case 2 {
                result := mul(a, b)
                if and(iszero(iszero(a)), iszero(eq(div(result, a), b))) {
                    mstore(0x00, 0x4e487b71)
                    mstore(0x04, 0x11)
                    revert(0x00, 0x24)
                }
            }
            case 3 {
                if iszero(b) {
                    let ptr := mload(0x40)
                    mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(add(ptr, 0x04), 0x0000000000000000000000000000000000000000000000000000000000000020)
                    mstore(add(ptr, 0x24), 0x0000000000000000000000000000000000000000000000000000000000000010)
                    mstore(add(ptr, 0x44), 0x4469766973696f6e206279207a65726f00000000000000000000000000000000)
                    revert(ptr, 0x64)
                }
                result := div(a, b)
            }
            default {
                let ptr := mload(0x40)
                mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(add(ptr, 0x04), 0x0000000000000000000000000000000000000000000000000000000000000020)
                mstore(add(ptr, 0x24), 0x0000000000000000000000000000000000000000000000000000000000000011)
                mstore(add(ptr, 0x44), 0x496e76616c6964206f7065726174696f6e000000000000000000000000000000)
                revert(ptr, 0x64)
            }
        }
    }
    
    /**
     * @dev 批量纯函数运算 - 最优化版本
     * @param operations 操作类型数组
     * @param operands1 第一个操作数数组
     * @param operands2 第二个操作数数组
     * @return results 结果数组
     */
    function batchCalculatePure(
        uint8[] calldata operations,
        uint256[] calldata operands1,
        uint256[] calldata operands2
    ) external pure returns (uint256[] memory results) {
        assembly {
            let len := operations.length
            if or(iszero(eq(len, operands1.length)), iszero(eq(len, operands2.length))) {
                let ptr := mload(0x40)
                mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                mstore(add(ptr, 0x04), 0x0000000000000000000000000000000000000000000000000000000000000020)
                mstore(add(ptr, 0x24), 0x0000000000000000000000000000000000000000000000000000000000000018)
                mstore(add(ptr, 0x44), 0x41727261792066656e677468732066757374206d617463680000000000000000)
                revert(ptr, 0x64)
            }
            
            results := mload(0x40)
            mstore(results, len)
            let resultsData := add(results, 0x20)
            mstore(0x40, add(resultsData, mul(len, 0x20)))
            
            for { let i := 0 } lt(i, len) { i := add(i, 1) } {
                let op := byte(0, calldataload(add(operations.offset, i)))
                let a := calldataload(add(operands1.offset, mul(i, 0x20)))
                let b := calldataload(add(operands2.offset, mul(i, 0x20)))
                let result := 0
                
                switch op
                case 0 {
                    result := add(a, b)
                    if lt(result, a) {
                        mstore(0x00, 0x4e487b71)
                        mstore(0x04, 0x11)
                        revert(0x00, 0x24)
                    }
                }
                case 1 {
                    if lt(a, b) {
                        let ptr := mload(0x40)
                        mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                        mstore(add(ptr, 0x04), 0x0000000000000000000000000000000000000000000000000000000000000020)
                        mstore(add(ptr, 0x24), 0x0000000000000000000000000000000000000000000000000000000000000025)
                        mstore(add(ptr, 0x44), 0x5375627472616374696f6e20776f756c6420726573756c7420696e206e656761)
                        mstore(add(ptr, 0x64), 0x74697665206e756d6265720000000000000000000000000000000000000000)
                        revert(ptr, 0x84)
                    }
                    result := sub(a, b)
                }
                case 2 {
                    result := mul(a, b)
                    if and(iszero(iszero(a)), iszero(eq(div(result, a), b))) {
                        mstore(0x00, 0x4e487b71)
                        mstore(0x04, 0x11)
                        revert(0x00, 0x24)
                    }
                }
                case 3 {
                    if iszero(b) {
                        let ptr := mload(0x40)
                        mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                        mstore(add(ptr, 0x04), 0x0000000000000000000000000000000000000000000000000000000000000020)
                        mstore(add(ptr, 0x24), 0x0000000000000000000000000000000000000000000000000000000000000010)
                        mstore(add(ptr, 0x44), 0x4469766973696f6e206279207a65726f00000000000000000000000000000000)
                        revert(ptr, 0x64)
                    }
                    result := div(a, b)
                }
                default {
                    let ptr := mload(0x40)
                    mstore(ptr, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(add(ptr, 0x04), 0x0000000000000000000000000000000000000000000000000000000000000020)
                    mstore(add(ptr, 0x24), 0x0000000000000000000000000000000000000000000000000000000000000011)
                    mstore(add(ptr, 0x44), 0x496e76616c6964206f7065726174696f6e000000000000000000000000000000)
                    revert(ptr, 0x64)
                }
                
                mstore(add(resultsData, mul(i, 0x20)), result)
            }
        }
    }
}