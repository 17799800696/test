// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {ArithmeticContract} from "../src/Counter.sol";

contract ArithmeticContractScript is Script {
    ArithmeticContract public arithmeticContract;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        arithmeticContract = new ArithmeticContract();
        
        console.log("ArithmeticContract deployed at:", address(arithmeticContract));
        
        // 演示基本操作
        uint256 addResult = arithmeticContract.add(10, 5);
        console.log("10 + 5 =", addResult);
        
        uint256 subtractResult = arithmeticContract.subtract(20, 8);
        console.log("20 - 8 =", subtractResult);
        
        uint256 multiplyResult = arithmeticContract.multiply(6, 7);
        console.log("6 * 7 =", multiplyResult);
        
        uint256 divideResult = arithmeticContract.divide(20, 4);
        console.log("20 / 4 =", divideResult);
        
        console.log("Total operations:", arithmeticContract.getOperationCount());
        console.log("Last result:", arithmeticContract.lastResult());

        vm.stopBroadcast();
    }
}
