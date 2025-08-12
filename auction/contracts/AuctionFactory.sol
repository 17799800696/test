// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./NFTAuction.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AuctionFactory
 * @dev 拍卖工厂合约，使用工厂模式管理拍卖合约实例
 */
contract AuctionFactory is Ownable, ReentrancyGuard {
    // 拍卖合约信息结构体
    struct AuctionInfo {
        address auctionContract;
        address creator;
        uint256 createdAt;
        bool isActive;
        string name;
        string description;
    }
    
    // 状态变量
    mapping(uint256 => AuctionInfo) public auctionContracts;
    mapping(address => uint256[]) public userAuctionContracts;
    mapping(address => bool) public isAuctionContract;
    uint256 public auctionContractCounter;
    
    // 默认配置
    address public defaultEthUsdPriceFeed;
    address public defaultFeeRecipient;
    uint256 public defaultPlatformFeeRate = 250; // 2.5%
    
    // 模板合约地址（用于克隆）
    address public auctionTemplate;
    
    // 事件
    event AuctionContractCreated(
        uint256 indexed contractId,
        address indexed auctionContract,
        address indexed creator,
        string name,
        string description
    );
    
    event AuctionContractDeactivated(uint256 indexed contractId);
    event TemplateUpdated(address indexed newTemplate);
    event DefaultConfigUpdated(
        address ethUsdPriceFeed,
        address feeRecipient,
        uint256 platformFeeRate
    );
    
    // 自定义错误
    error InvalidTemplate();
    error ContractNotFound();
    error NotContractCreator();
    error ContractAlreadyDeactivated();
    error InvalidFeeRate();
    
    constructor(
        address _ethUsdPriceFeed,
        address _feeRecipient
    ) Ownable(msg.sender) {
        defaultEthUsdPriceFeed = _ethUsdPriceFeed;
        defaultFeeRecipient = _feeRecipient;
    }
    
    /**
     * @dev 设置拍卖合约模板
     * @param _template 模板合约地址
     */
    function setAuctionTemplate(address _template) external onlyOwner {
        if (_template == address(0)) revert InvalidTemplate();
        auctionTemplate = _template;
        emit TemplateUpdated(_template);
    }
    
    /**
     * @dev 创建新的拍卖合约
     * @param name 拍卖合约名称
     * @param description 拍卖合约描述
     * @param ethUsdPriceFeed ETH/USD价格预言机地址（可选，使用默认值）
     * @param feeRecipient 手续费接收者地址（可选，使用默认值）
     * @return contractId 新创建的拍卖合约ID
     * @return auctionContract 新创建的拍卖合约地址
     */
    function createAuctionContract(
        string memory name,
        string memory description,
        address ethUsdPriceFeed,
        address feeRecipient
    ) public nonReentrant returns (uint256 contractId, address auctionContract) {
        // 使用提供的参数或默认值
        address _ethUsdPriceFeed = ethUsdPriceFeed != address(0) ? ethUsdPriceFeed : defaultEthUsdPriceFeed;
        address _feeRecipient = feeRecipient != address(0) ? feeRecipient : defaultFeeRecipient;
        
        // 创建新的拍卖合约实例
        NFTAuction newAuction = new NFTAuction(_ethUsdPriceFeed, _feeRecipient);
        auctionContract = address(newAuction);
        
        // 转移所有权给创建者
        newAuction.transferOwnership(msg.sender);
        
        contractId = auctionContractCounter++;
        
        // 存储拍卖合约信息
        auctionContracts[contractId] = AuctionInfo({
            auctionContract: auctionContract,
            creator: msg.sender,
            createdAt: block.timestamp,
            isActive: true,
            name: name,
            description: description
        });
        
        userAuctionContracts[msg.sender].push(contractId);
        isAuctionContract[auctionContract] = true;
        
        emit AuctionContractCreated(
            contractId,
            auctionContract,
            msg.sender,
            name,
            description
        );
    }
    
    /**
     * @dev 使用最小代理模式创建拍卖合约（节省gas）
     * @param name 拍卖合约名称
     * @param description 拍卖合约描述
     * @param ethUsdPriceFeed ETH/USD价格预言机地址
     * @param feeRecipient 手续费接收者地址
     * @return contractId 新创建的拍卖合约ID
     * @return auctionContract 新创建的拍卖合约地址
     */
    function createAuctionContractClone(
        string memory name,
        string memory description,
        address ethUsdPriceFeed,
        address feeRecipient
    ) external nonReentrant returns (uint256 contractId, address auctionContract) {
        if (auctionTemplate == address(0)) revert InvalidTemplate();
        
        // 使用提供的参数或默认值
        address _ethUsdPriceFeed = ethUsdPriceFeed != address(0) ? ethUsdPriceFeed : defaultEthUsdPriceFeed;
        address _feeRecipient = feeRecipient != address(0) ? feeRecipient : defaultFeeRecipient;
        
        // 使用最小代理模式克隆合约
        auctionContract = _clone(auctionTemplate);
        
        // 初始化克隆的合约
        NFTAuction(auctionContract).initialize(_ethUsdPriceFeed, _feeRecipient, msg.sender);
        
        contractId = auctionContractCounter++;
        
        // 存储拍卖合约信息
        auctionContracts[contractId] = AuctionInfo({
            auctionContract: auctionContract,
            creator: msg.sender,
            createdAt: block.timestamp,
            isActive: true,
            name: name,
            description: description
        });
        
        userAuctionContracts[msg.sender].push(contractId);
        isAuctionContract[auctionContract] = true;
        
        emit AuctionContractCreated(
            contractId,
            auctionContract,
            msg.sender,
            name,
            description
        );
    }
    
    /**
     * @dev 停用拍卖合约
     * @param contractId 拍卖合约ID
     */
    function deactivateAuctionContract(uint256 contractId) external {
        AuctionInfo storage info = auctionContracts[contractId];
        
        if (info.auctionContract == address(0)) revert ContractNotFound();
        if (info.creator != msg.sender && msg.sender != owner()) revert NotContractCreator();
        if (!info.isActive) revert ContractAlreadyDeactivated();
        
        info.isActive = false;
        isAuctionContract[info.auctionContract] = false;
        
        emit AuctionContractDeactivated(contractId);
    }
    
    /**
     * @dev 批量创建拍卖合约
     * @param names 拍卖合约名称数组
     * @param descriptions 拍卖合约描述数组
     * @param ethUsdPriceFeeds ETH/USD价格预言机地址数组
     * @param feeRecipients 手续费接收者地址数组
     * @return contractIds 新创建的拍卖合约ID数组
     * @return auctionContracts 新创建的拍卖合约地址数组
     */
    function batchCreateAuctionContracts(
        string[] memory names,
        string[] memory descriptions,
        address[] memory ethUsdPriceFeeds,
        address[] memory feeRecipients
    ) external nonReentrant returns (uint256[] memory contractIds, address[] memory auctionContracts) {
        require(
            names.length == descriptions.length &&
            names.length == ethUsdPriceFeeds.length &&
            names.length == feeRecipients.length,
            "Arrays length mismatch"
        );
        
        contractIds = new uint256[](names.length);
        auctionContracts = new address[](names.length);
        
        for (uint256 i = 0; i < names.length; i++) {
            (contractIds[i], auctionContracts[i]) = createAuctionContract(
                names[i],
                descriptions[i],
                ethUsdPriceFeeds[i],
                feeRecipients[i]
            );
        }
    }
    
    // 查询函数
    function getAuctionContract(uint256 contractId) external view returns (AuctionInfo memory) {
        return auctionContracts[contractId];
    }
    
    function getUserAuctionContracts(address user) external view returns (uint256[] memory) {
        return userAuctionContracts[user];
    }
    
    function getAllActiveAuctionContracts() external view returns (uint256[] memory) {
        uint256[] memory activeContracts = new uint256[](auctionContractCounter);
        uint256 count = 0;
        
        for (uint256 i = 0; i < auctionContractCounter; i++) {
            if (auctionContracts[i].isActive) {
                activeContracts[count] = i;
                count++;
            }
        }
        
        // 调整数组大小
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeContracts[i];
        }
        
        return result;
    }
    
    function getAuctionContractsByCreator(address creator) external view returns (uint256[] memory) {
        uint256[] memory userContracts = userAuctionContracts[creator];
        uint256[] memory activeContracts = new uint256[](userContracts.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < userContracts.length; i++) {
            if (auctionContracts[userContracts[i]].isActive) {
                activeContracts[count] = userContracts[i];
                count++;
            }
        }
        
        // 调整数组大小
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeContracts[i];
        }
        
        return result;
    }
    
    // 管理员函数
    function setDefaultConfig(
        address _ethUsdPriceFeed,
        address _feeRecipient,
        uint256 _platformFeeRate
    ) external onlyOwner {
        if (_platformFeeRate > 1000) revert InvalidFeeRate(); // 最大10%
        
        defaultEthUsdPriceFeed = _ethUsdPriceFeed;
        defaultFeeRecipient = _feeRecipient;
        defaultPlatformFeeRate = _platformFeeRate;
        
        emit DefaultConfigUpdated(_ethUsdPriceFeed, _feeRecipient, _platformFeeRate);
    }
    
    // 内部函数 - 最小代理克隆
    function _clone(address implementation) internal returns (address instance) {
        bytes32 saltValue = salt();
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, implementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create2(0, ptr, 0x37, saltValue)
        }
        require(instance != address(0), "Clone failed");
    }
    
    function salt() internal view returns (bytes32) {
        return keccak256(abi.encodePacked(msg.sender, auctionContractCounter, block.timestamp));
    }
    
    // 统计函数
    function getTotalAuctionContracts() external view returns (uint256) {
        return auctionContractCounter;
    }
    
    function getActiveAuctionContractsCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < auctionContractCounter; i++) {
            if (auctionContracts[i].isActive) {
                count++;
            }
        }
        return count;
    }
}