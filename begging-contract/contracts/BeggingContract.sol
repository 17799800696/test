// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// 自定义错误，节省gas
error OnlyOwner();
error DonationAmountZero();
error NoFundsToWithdraw();
error WithdrawalFailed();
error InvalidTimeRange();
error DonationNotStarted();
error DonationEnded();
error ReentrantCall();

contract BeggingContract {
    // 合约所有者
    address public owner;
    
    // 重入攻击防护
    bool private _locked;
    
    // 时间限制相关变量（优化存储布局）
    bool public timeLimitEnabled;
    uint256 public donationStartTime;
    uint256 public donationEndTime;
    
    // 记录每个捐赠者的捐赠金额
    mapping(address => uint256) public donations;
    
    // 捐赠者地址数组，用于排行榜
    address[] public donors;
    
    // 记录地址是否已经捐赠过（避免重复添加到数组）
    mapping(address => bool) public hasDonated;
    
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
    
    // 重入攻击防护修饰符
    modifier nonReentrant() {
        if (_locked) revert ReentrantCall();
        _locked = true;
        _;
        _locked = false;
    }
    
    // 修饰符：只有合约所有者可以调用
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }
    
    // 修饰符：检查捐赠时间限制
    modifier withinDonationTime() {
        if (timeLimitEnabled) {
            if (block.timestamp < donationStartTime) revert DonationNotStarted();
            if (block.timestamp > donationEndTime) revert DonationEnded();
        }
        _;
    }
    
    // 设置捐赠时间窗口
    function setDonationTime(uint256 _startTime, uint256 _endTime) external onlyOwner {
        if (_startTime >= _endTime || _endTime <= block.timestamp) {
            revert InvalidTimeRange();
        }
        
        donationStartTime = _startTime;
        donationEndTime = _endTime;
        timeLimitEnabled = true;
        
        emit DonationTimeSet(_startTime, _endTime);
    }
    
    // 禁用时间限制
    function disableTimeLimit() external onlyOwner {
        timeLimitEnabled = false;
    }
    
    // 内部捐赠逻辑，避免代码重复
    function _processDonation() internal {
        if (msg.value == 0) revert DonationAmountZero();
        
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
    
    // 捐赠函数 - 允许用户向合约发送以太币
    function donate() external payable withinDonationTime {
        _processDonation();
    }
    
    // 提款函数 - 允许合约所有者提取所有资金
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFundsToWithdraw();
        
        // 触发提款事件（遵循checks-effects-interactions模式）
        emit Withdrawal(owner, balance, block.timestamp);
        
        // 将资金转给合约所有者
        (bool success, ) = owner.call{value: balance}("");
        if (!success) revert WithdrawalFailed();
    }
    
    // 获取前3名捐赠者（优化算法，从O(n³)降低到O(n)）
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
        
        // 一次遍历找出前3名（插入排序思想）
        for (uint i = 0; i < donorCount; i++) {
            address currentDonor = donors[i];
            uint256 currentAmount = donations[currentDonor];
            
            // 检查是否能进入前3名
            if (currentAmount > topAmounts[2]) {
                // 找到插入位置并移动数组
                if (currentAmount > topAmounts[0]) {
                    // 插入第1位
                    topAmounts[2] = topAmounts[1];
                    topDonors[2] = topDonors[1];
                    topAmounts[1] = topAmounts[0];
                    topDonors[1] = topDonors[0];
                    topAmounts[0] = currentAmount;
                    topDonors[0] = currentDonor;
                } else if (currentAmount > topAmounts[1]) {
                    // 插入第2位
                    topAmounts[2] = topAmounts[1];
                    topDonors[2] = topDonors[1];
                    topAmounts[1] = currentAmount;
                    topDonors[1] = currentDonor;
                } else {
                    // 插入第3位
                    topAmounts[2] = currentAmount;
                    topDonors[2] = currentDonor;
                }
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
        _processDonation();
    }
}