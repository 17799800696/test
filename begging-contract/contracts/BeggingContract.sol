// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BeggingContract {
    // 合约所有者
    address public owner;
    
    // 记录每个捐赠者的捐赠金额
    mapping(address => uint256) public donations;
    
    // 捐赠者地址数组，用于排行榜
    address[] public donors;
    
    // 记录地址是否已经捐赠过（避免重复添加到数组）
    mapping(address => bool) public hasDonated;
    
    // 时间限制相关变量
    uint256 public donationStartTime;
    uint256 public donationEndTime;
    bool public timeLimitEnabled;
    
    // 捐赠事件
    event Donation(address indexed donor, uint256 amount, uint256 timestamp);
    
    // 提款事件
    event Withdrawal(address indexed owner, uint256 amount, uint256 timestamp);
    
    // 时间窗口设置事件
    event DonationTimeSet(uint256 startTime, uint256 endTime);
    
    // 构造函数，设置合约所有者
    constructor() {
        owner = msg.sender;
        timeLimitEnabled = false;
    }
    
    // 修饰符：只有合约所有者可以调用
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    // 修饰符：检查捐赠时间限制
    modifier withinDonationTime() {
        if (timeLimitEnabled) {
            require(block.timestamp >= donationStartTime, "Donation period has not started yet");
            require(block.timestamp <= donationEndTime, "Donation period has ended");
        }
        _;
    }
    
    // 设置捐赠时间窗口
    function setDonationTime(uint256 _startTime, uint256 _endTime) external onlyOwner {
        require(_startTime < _endTime, "Start time must be before end time");
        require(_endTime > block.timestamp, "End time must be in the future");
        
        donationStartTime = _startTime;
        donationEndTime = _endTime;
        timeLimitEnabled = true;
        
        emit DonationTimeSet(_startTime, _endTime);
    }
    
    // 禁用时间限制
    function disableTimeLimit() external onlyOwner {
        timeLimitEnabled = false;
    }
    
    // 捐赠函数 - 允许用户向合约发送以太币
    function donate() external payable withinDonationTime {
        require(msg.value > 0, "Donation amount must be greater than 0");
        
        // 如果是首次捐赠，添加到捐赠者数组
        if (!hasDonated[msg.sender]) {
            donors.push(msg.sender);
            hasDonated[msg.sender] = true;
        }
        
        // 记录捐赠金额
        donations[msg.sender] += msg.value;
        
        // 触发捐赠事件
        emit Donation(msg.sender, msg.value, block.timestamp);
    }
    
    // 提款函数 - 允许合约所有者提取所有资金
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        // 将资金转给合约所有者
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Withdrawal failed");
        
        // 触发提款事件
        emit Withdrawal(owner, balance, block.timestamp);
    }
    
    // 获取前3名捐赠者
    function getTopDonors() external view returns (address[3] memory topDonors, uint256[3] memory topAmounts) {
        uint256 donorCount = donors.length;
        
        // 初始化返回数组
        for (uint i = 0; i < 3; i++) {
            topDonors[i] = address(0);
            topAmounts[i] = 0;
        }
        
        // 如果没有捐赠者，返回空数组
        if (donorCount == 0) {
            return (topDonors, topAmounts);
        }
        
        // 找出前3名捐赠者（简单的选择排序）
        for (uint i = 0; i < donorCount && i < 3; i++) {
            uint256 maxAmount = 0;
            address maxDonor = address(0);
            uint256 maxIndex = 0;
            
            // 找出当前最大的捐赠者（排除已经选中的）
            for (uint j = 0; j < donorCount; j++) {
                address currentDonor = donors[j];
                uint256 currentAmount = donations[currentDonor];
                
                // 检查是否已经在前面的位置中
                bool alreadySelected = false;
                for (uint k = 0; k < i; k++) {
                    if (topDonors[k] == currentDonor) {
                        alreadySelected = true;
                        break;
                    }
                }
                
                if (!alreadySelected && currentAmount > maxAmount) {
                    maxAmount = currentAmount;
                    maxDonor = currentDonor;
                    maxIndex = j;
                }
            }
            
            if (maxDonor != address(0)) {
                topDonors[i] = maxDonor;
                topAmounts[i] = maxAmount;
            }
        }
        
        return (topDonors, topAmounts);
    }
    
    // 获取捐赠者总数
    function getDonorCount() external view returns (uint256) {
        return donors.length;
    }
    
    // 查询某个地址的捐赠金额
    function getDonation(address donor) external view returns (uint256) {
        return donations[donor];
    }
    
    // 获取合约总余额
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // 获取合约所有者地址
    function getOwner() external view returns (address) {
        return owner;
    }
    
    // 获取当前时间限制设置
    function getDonationTimeInfo() external view returns (bool enabled, uint256 startTime, uint256 endTime, uint256 currentTime) {
        return (timeLimitEnabled, donationStartTime, donationEndTime, block.timestamp);
    }
    
    // 接收以太币的回退函数
    receive() external payable withinDonationTime {
        // 如果是首次捐赠，添加到捐赠者数组
        if (!hasDonated[msg.sender]) {
            donors.push(msg.sender);
            hasDonated[msg.sender] = true;
        }
        
        // 自动记录为捐赠
        donations[msg.sender] += msg.value;
        emit Donation(msg.sender, msg.value, block.timestamp);
    }
}