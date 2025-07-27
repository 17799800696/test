// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AlgorithmContract {
    
    // ===== 1. 反转字符串 =====
    function reverseString(string memory input) public pure returns (string memory) {
        bytes memory inputBytes = bytes(input);
        uint256 length = inputBytes.length;
        
        if (length == 0) {
            return input;
        }
        
        bytes memory reversed = new bytes(length);
        
        for (uint256 i = 0; i < length; i++) {
            reversed[i] = inputBytes[length - 1 - i];
        }
        
        return string(reversed);
    }
    
    // ===== 2. 整数转罗马数字 =====
    function intToRoman(uint256 num) public pure returns (string memory) {
        require(num > 0 && num <= 3999, "Number must be between 1 and 3999");
        
        uint256[] memory values = new uint256[](13);
        values[0] = 1000; values[1] = 900; values[2] = 500; values[3] = 400;
        values[4] = 100; values[5] = 90; values[6] = 50; values[7] = 40;
        values[8] = 10; values[9] = 9; values[10] = 5; values[11] = 4; values[12] = 1;
        
        string[] memory symbols = new string[](13);
        symbols[0] = "M"; symbols[1] = "CM"; symbols[2] = "D"; symbols[3] = "CD";
        symbols[4] = "C"; symbols[5] = "XC"; symbols[6] = "L"; symbols[7] = "XL";
        symbols[8] = "X"; symbols[9] = "IX"; symbols[10] = "V"; symbols[11] = "IV"; symbols[12] = "I";
        
        string memory result = "";
        
        for (uint256 i = 0; i < 13; i++) {
            while (num >= values[i]) {
                result = string(abi.encodePacked(result, symbols[i]));
                num -= values[i];
            }
        }
        
        return result;
    }
    
    // ===== 3. 罗马数字转整数 =====
    function romanToInt(string memory s) public pure returns (uint256) {
        bytes memory romanBytes = bytes(s);
        uint256 result = 0;
        uint256 length = romanBytes.length;
        
        for (uint256 i = 0; i < length; i++) {
            uint256 current = getRomanValue(romanBytes[i]);
            
            if (i + 1 < length) {
                uint256 next = getRomanValue(romanBytes[i + 1]);
                if (current < next) {
                    result += (next - current);
                    i++; // 跳过下一个字符
                } else {
                    result += current;
                }
            } else {
                result += current;
            }
        }
        
        return result;
    }
    
    function getRomanValue(bytes1 char) private pure returns (uint256) {
        if (char == 'I') return 1;
        if (char == 'V') return 5;
        if (char == 'X') return 10;
        if (char == 'L') return 50;
        if (char == 'C') return 100;
        if (char == 'D') return 500;
        if (char == 'M') return 1000;
        return 0;
    }
    
    // ===== 4. 合并两个有序数组 =====
    function mergeSortedArrays(uint256[] memory nums1, uint256[] memory nums2) 
        public pure returns (uint256[] memory) {
        
        uint256 m = nums1.length;
        uint256 n = nums2.length;
        uint256[] memory result = new uint256[](m + n);
        
        uint256 i = 0; // nums1的指针
        uint256 j = 0; // nums2的指针
        uint256 k = 0; // result的指针
        
        // 合并两个数组
        while (i < m && j < n) {
            if (nums1[i] <= nums2[j]) {
                result[k] = nums1[i];
                i++;
            } else {
                result[k] = nums2[j];
                j++;
            }
            k++;
        }
        
        // 复制nums1剩余元素
        while (i < m) {
            result[k] = nums1[i];
            i++;
            k++;
        }
        
        // 复制nums2剩余元素
        while (j < n) {
            result[k] = nums2[j];
            j++;
            k++;
        }
        
        return result;
    }
    
    // ===== 5. 二分查找 =====
    function binarySearch(uint256[] memory nums, uint256 target) 
        public pure returns (int256) {
        
        uint256 left = 0;
        uint256 right = nums.length;
        
        if (right == 0) {
            return -1;
        }
        
        right = right - 1;
        
        while (left <= right) {
            uint256 mid = left + (right - left) / 2;
            
            if (nums[mid] == target) {
                return int256(mid);
            } else if (nums[mid] < target) {
                left = mid + 1;
            } else {
                if (mid == 0) {
                    break;
                }
                right = mid - 1;
            }
        }
        
        return -1; // 未找到
    }
    
    // ===== 辅助函数：测试所有功能 =====
    function testAllFunctions() public pure returns (
        string memory,
        string memory,
        uint256,
        uint256[] memory,
        int256
    ) {
        // 测试反转字符串
        string memory reversed = reverseString("abcde");
        
        // 测试整数转罗马数字
        string memory roman = intToRoman(1994);
        
        // 测试罗马数字转整数
        uint256 integer = romanToInt("MCMXCIV");
        
        // 测试合并有序数组
        uint256[] memory arr1 = new uint256[](3);
        arr1[0] = 1; arr1[1] = 3; arr1[2] = 5;
        uint256[] memory arr2 = new uint256[](3);
        arr2[0] = 2; arr2[1] = 4; arr2[2] = 6;
        uint256[] memory merged = mergeSortedArrays(arr1, arr2);
        
        // 测试二分查找
        uint256[] memory sortedArray = new uint256[](5);
        sortedArray[0] = 1; sortedArray[1] = 3; sortedArray[2] = 5; 
        sortedArray[3] = 7; sortedArray[4] = 9;
        int256 index = binarySearch(sortedArray, 5);
        
        return (reversed, roman, integer, merged, index);
    }
    
    // ===== 事件定义 =====
    event StringReversed(string original, string reversed);
    event IntegerToRoman(uint256 number, string roman);
    event RomanToInteger(string roman, uint256 number);
    event ArraysMerged(uint256[] array1, uint256[] array2, uint256[] result);
    event BinarySearchResult(uint256[] array, uint256 target, int256 index);
    
    // ===== 带事件的函数版本 =====
    function reverseStringWithEvent(string memory input) public returns (string memory) {
        string memory result = reverseString(input);
        emit StringReversed(input, result);
        return result;
    }
    
    function intToRomanWithEvent(uint256 num) public returns (string memory) {
        string memory result = intToRoman(num);
        emit IntegerToRoman(num, result);
        return result;
    }
    
    function romanToIntWithEvent(string memory s) public returns (uint256) {
        uint256 result = romanToInt(s);
        emit RomanToInteger(s, result);
        return result;
    }
    
    function mergeSortedArraysWithEvent(uint256[] memory nums1, uint256[] memory nums2) 
        public returns (uint256[] memory) {
        uint256[] memory result = mergeSortedArrays(nums1, nums2);
        emit ArraysMerged(nums1, nums2, result);
        return result;
    }
    
    function binarySearchWithEvent(uint256[] memory nums, uint256 target) 
        public returns (int256) {
        int256 result = binarySearch(nums, target);
        emit BinarySearchResult(nums, target, result);
        return result;
    }
}