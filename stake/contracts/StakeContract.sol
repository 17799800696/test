// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MetaNodeToken.sol";

/**
 * @title StakeContract
 * @dev 多代币质押系统合约，支持多个质押池和奖励分配
 */
contract StakeContract is 
    Initializable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    using SafeERC20 for IERC20;
    
    // 角色定义
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // 质押池结构
    struct Pool {
        address stTokenAddress;        // 质押代币地址（address(0)表示ETH）
        uint256 poolWeight;           // 池权重
        uint256 lastRewardBlock;      // 最后奖励区块
        uint256 accMetaNodePerST;     // 每个质押代币累积的MetaNode数量
        uint256 stTokenAmount;        // 池中总质押代币量
        uint256 minDepositAmount;     // 最小质押金额
        uint256 unstakeLockedBlocks;  // 解质押锁定区块数
    }
    
    // 解质押请求结构
    struct UnstakeRequest {
        uint256 amount;               // 解质押数量
        uint256 unlockBlock;          // 解锁区块号
    }
    
    // 用户信息结构
    struct User {
        uint256 stAmount;             // 质押数量
        uint256 finishedMetaNode;     // 已分配的MetaNode数量
        uint256 pendingMetaNode;      // 待领取的MetaNode数量
        UnstakeRequest[] requests;    // 解质押请求列表
    }
    
    // 状态变量
    MetaNodeToken public metaNodeToken;     // MetaNode代币合约
    uint256 public metaNodePerBlock;        // 每个区块产生的MetaNode数量
    uint256 public totalPoolWeight;        // 总池权重
    uint256 public startBlock;              // 开始区块
    
    // 映射
    Pool[] public pools;                    // 质押池数组
    mapping(uint256 => mapping(address => User)) public users; // 池ID => 用户地址 => 用户信息
    
    // 暂停控制
    mapping(string => bool) public operationPaused; // 操作暂停状态
    
    // 事件
    event PoolAdded(uint256 indexed pid, address indexed stTokenAddress, uint256 poolWeight, uint256 minDepositAmount, uint256 unstakeLockedBlocks);
    event PoolUpdated(uint256 indexed pid, uint256 poolWeight, uint256 minDepositAmount, uint256 unstakeLockedBlocks);
    event Staked(address indexed user, uint256 indexed pid, uint256 amount);
    event UnstakeRequested(address indexed user, uint256 indexed pid, uint256 amount, uint256 unlockBlock);
    event Unstaked(address indexed user, uint256 indexed pid, uint256 amount);
    event RewardClaimed(address indexed user, uint256 indexed pid, uint256 amount);
    event OperationPausedChanged(string operation, bool paused);
    
    // 修饰符
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "StakeContract: caller is not admin");
        _;
    }
    
    modifier operationNotPaused(string memory operation) {
        require(!operationPaused[operation], "StakeContract: operation is paused");
        _;
    }
    
    modifier validPool(uint256 _pid) {
        require(_pid < pools.length, "StakeContract: invalid pool id");
        _;
    }
    
    /**
     * @dev 初始化函数
     */
    function initialize(
        address _metaNodeToken,
        uint256 _metaNodePerBlock,
        uint256 _startBlock
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        require(_metaNodeToken != address(0), "StakeContract: invalid token address");
        require(_metaNodePerBlock > 0, "StakeContract: invalid reward per block");
        
        metaNodeToken = MetaNodeToken(_metaNodeToken);
        metaNodePerBlock = _metaNodePerBlock;
        startBlock = _startBlock > 0 ? _startBlock : block.number;
        
        // 设置角色
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }
    
    /**
     * @dev 添加质押池
     */
    function addPool(
        address _stTokenAddress,
        uint256 _poolWeight,
        uint256 _minDepositAmount,
        uint256 _unstakeLockedBlocks
    ) external onlyAdmin {
        require(_poolWeight > 0, "StakeContract: invalid pool weight");
        require(_minDepositAmount > 0, "StakeContract: invalid min deposit amount");
        
        // 更新所有池的奖励
        massUpdatePools();
        
        pools.push(Pool({
            stTokenAddress: _stTokenAddress,
            poolWeight: _poolWeight,
            lastRewardBlock: block.number > startBlock ? block.number : startBlock,
            accMetaNodePerST: 0,
            stTokenAmount: 0,
            minDepositAmount: _minDepositAmount,
            unstakeLockedBlocks: _unstakeLockedBlocks
        }));
        
        totalPoolWeight += _poolWeight;
        
        emit PoolAdded(pools.length - 1, _stTokenAddress, _poolWeight, _minDepositAmount, _unstakeLockedBlocks);
    }
    
    /**
     * @dev 更新质押池
     */
    function updatePool(
        uint256 _pid,
        uint256 _poolWeight,
        uint256 _minDepositAmount,
        uint256 _unstakeLockedBlocks
    ) external onlyAdmin validPool(_pid) {
        require(_poolWeight > 0, "StakeContract: invalid pool weight");
        require(_minDepositAmount > 0, "StakeContract: invalid min deposit amount");
        
        // 更新所有池的奖励
        massUpdatePools();
        
        Pool storage pool = pools[_pid];
        totalPoolWeight = totalPoolWeight - pool.poolWeight + _poolWeight;
        
        pool.poolWeight = _poolWeight;
        pool.minDepositAmount = _minDepositAmount;
        pool.unstakeLockedBlocks = _unstakeLockedBlocks;
        
        emit PoolUpdated(_pid, _poolWeight, _minDepositAmount, _unstakeLockedBlocks);
    }
    
    /**
     * @dev 质押代币
     */
    function stake(uint256 _pid, uint256 _amount) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        operationNotPaused("stake") 
        validPool(_pid) 
    {
        Pool storage pool = pools[_pid];
        User storage user = users[_pid][msg.sender];
        
        require(_amount >= pool.minDepositAmount, "StakeContract: amount below minimum");
        
        // 更新池奖励
        updatePool(_pid);
        
        // 处理待领取奖励
        if (user.stAmount > 0) {
            uint256 pending = (user.stAmount * pool.accMetaNodePerST / 1e12) - user.finishedMetaNode;
            if (pending > 0) {
                user.pendingMetaNode += pending;
            }
        }
        
        // 转移代币
        if (pool.stTokenAddress == address(0)) {
            // ETH质押
            require(msg.value == _amount, "StakeContract: incorrect ETH amount");
        } else {
            // ERC20代币质押
            require(msg.value == 0, "StakeContract: should not send ETH");
            IERC20(pool.stTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        }
        
        // 更新用户和池状态
        user.stAmount += _amount;
        pool.stTokenAmount += _amount;
        user.finishedMetaNode = user.stAmount * pool.accMetaNodePerST / 1e12;
        
        emit Staked(msg.sender, _pid, _amount);
    }
    
    /**
     * @dev 请求解质押
     */
    function requestUnstake(uint256 _pid, uint256 _amount) 
        external 
        nonReentrant 
        whenNotPaused 
        operationNotPaused("unstake") 
        validPool(_pid) 
    {
        Pool storage pool = pools[_pid];
        User storage user = users[_pid][msg.sender];
        
        require(_amount > 0, "StakeContract: amount must be greater than 0");
        require(user.stAmount >= _amount, "StakeContract: insufficient staked amount");
        
        // 更新池奖励
        updatePool(_pid);
        
        // 处理待领取奖励
        uint256 pending = (user.stAmount * pool.accMetaNodePerST / 1e12) - user.finishedMetaNode;
        if (pending > 0) {
            user.pendingMetaNode += pending;
        }
        
        // 更新用户和池状态
        user.stAmount -= _amount;
        pool.stTokenAmount -= _amount;
        user.finishedMetaNode = user.stAmount * pool.accMetaNodePerST / 1e12;
        
        // 添加解质押请求
        uint256 unlockBlock = block.number + pool.unstakeLockedBlocks;
        user.requests.push(UnstakeRequest({
            amount: _amount,
            unlockBlock: unlockBlock
        }));
        
        emit UnstakeRequested(msg.sender, _pid, _amount, unlockBlock);
    }
    
    /**
     * @dev 执行解质押
     */
    function unstake(uint256 _pid, uint256 _requestIndex) 
        external 
        nonReentrant 
        whenNotPaused 
        operationNotPaused("unstake") 
        validPool(_pid) 
    {
        Pool storage pool = pools[_pid];
        User storage user = users[_pid][msg.sender];
        
        require(_requestIndex < user.requests.length, "StakeContract: invalid request index");
        
        UnstakeRequest storage request = user.requests[_requestIndex];
        require(block.number >= request.unlockBlock, "StakeContract: still locked");
        
        uint256 amount = request.amount;
        
        // 移除请求（将最后一个元素移到当前位置）
        user.requests[_requestIndex] = user.requests[user.requests.length - 1];
        user.requests.pop();
        
        // 转移代币
        if (pool.stTokenAddress == address(0)) {
            // 转移ETH
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "StakeContract: ETH transfer failed");
        } else {
            // 转移ERC20代币
            IERC20(pool.stTokenAddress).safeTransfer(msg.sender, amount);
        }
        
        emit Unstaked(msg.sender, _pid, amount);
    }
    
    /**
     * @dev 领取奖励
     */
    function claimReward(uint256 _pid) 
        external 
        nonReentrant 
        whenNotPaused 
        operationNotPaused("claim") 
        validPool(_pid) 
    {
        Pool storage pool = pools[_pid];
        User storage user = users[_pid][msg.sender];
        
        // 更新池奖励
        updatePool(_pid);
        
        // 计算总奖励
        uint256 pending = (user.stAmount * pool.accMetaNodePerST / 1e12) - user.finishedMetaNode;
        uint256 totalReward = user.pendingMetaNode + pending;
        
        require(totalReward > 0, "StakeContract: no reward to claim");
        
        // 重置奖励状态
        user.pendingMetaNode = 0;
        user.finishedMetaNode = user.stAmount * pool.accMetaNodePerST / 1e12;
        
        // 铸造并转移奖励代币
        metaNodeToken.mint(msg.sender, totalReward);
        
        emit RewardClaimed(msg.sender, _pid, totalReward);
    }
    
    /**
     * @dev 更新单个池的奖励
     */
    function updatePool(uint256 _pid) public validPool(_pid) {
        Pool storage pool = pools[_pid];
        
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        
        if (pool.stTokenAmount == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        
        uint256 blockReward = (block.number - pool.lastRewardBlock) * metaNodePerBlock * pool.poolWeight / totalPoolWeight;
        pool.accMetaNodePerST += blockReward * 1e12 / pool.stTokenAmount;
        pool.lastRewardBlock = block.number;
    }
    
    /**
     * @dev 批量更新所有池的奖励
     */
    function massUpdatePools() public {
        for (uint256 i = 0; i < pools.length; i++) {
            updatePool(i);
        }
    }
    
    /**
     * @dev 获取用户待领取奖励
     */
    function pendingReward(uint256 _pid, address _user) external view validPool(_pid) returns (uint256) {
        Pool storage pool = pools[_pid];
        User storage user = users[_pid][_user];
        
        uint256 accMetaNodePerST = pool.accMetaNodePerST;
        
        if (block.number > pool.lastRewardBlock && pool.stTokenAmount > 0) {
            uint256 blockReward = (block.number - pool.lastRewardBlock) * metaNodePerBlock * pool.poolWeight / totalPoolWeight;
            accMetaNodePerST += blockReward * 1e12 / pool.stTokenAmount;
        }
        
        uint256 pending = (user.stAmount * accMetaNodePerST / 1e12) - user.finishedMetaNode;
        return user.pendingMetaNode + pending;
    }
    
    /**
     * @dev 获取用户解质押请求数量
     */
    function getUserRequestsLength(uint256 _pid, address _user) external view returns (uint256) {
        return users[_pid][_user].requests.length;
    }
    
    /**
     * @dev 获取用户解质押请求信息
     */
    function getUserRequest(uint256 _pid, address _user, uint256 _index) 
        external 
        view 
        returns (uint256 amount, uint256 unlockBlock) 
    {
        UnstakeRequest storage request = users[_pid][_user].requests[_index];
        return (request.amount, request.unlockBlock);
    }
    
    /**
     * @dev 获取池数量
     */
    function poolLength() external view returns (uint256) {
        return pools.length;
    }
    
    /**
     * @dev 设置操作暂停状态
     */
    function setOperationPaused(string memory _operation, bool _paused) external onlyAdmin {
        operationPaused[_operation] = _paused;
        emit OperationPausedChanged(_operation, _paused);
    }
    
    /**
     * @dev 设置每区块奖励数量
     */
    function setMetaNodePerBlock(uint256 _metaNodePerBlock) external onlyAdmin {
        require(_metaNodePerBlock > 0, "StakeContract: invalid reward per block");
        massUpdatePools();
        metaNodePerBlock = _metaNodePerBlock;
    }
    
    /**
     * @dev 暂停合约
     */
    function pause() external onlyAdmin {
        _pause();
    }
    
    /**
     * @dev 恢复合约
     */
    function unpause() external onlyAdmin {
        _unpause();
    }
    
    /**
     * @dev 紧急提取（仅管理员）
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyAdmin {
        if (_token == address(0)) {
            (bool success, ) = msg.sender.call{value: _amount}("");
            require(success, "StakeContract: ETH transfer failed");
        } else {
            IERC20(_token).safeTransfer(msg.sender, _amount);
        }
    }
    
    /**
     * @dev 授权升级函数，只有管理员可以升级合约
     * @param newImplementation 新实现合约地址
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
    
    /**
     * @dev 接收ETH
     */
    receive() external payable {}
}