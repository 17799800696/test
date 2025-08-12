// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title UpgradeableAuction
 * @dev 可升级的NFT拍卖合约，使用UUPS代理模式
 */
contract UpgradeableAuction is 
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // 拍卖状态枚举
    enum AuctionStatus {
        Active,
        Ended,
        Cancelled
    }
    
    // 拍卖信息结构体
    struct Auction {
        address seller;           // 卖家地址
        address nftContract;      // NFT合约地址
        uint256 tokenId;          // NFT token ID
        uint256 startPrice;       // 起拍价（美元，18位精度）
        uint256 reservePrice;     // 保留价（美元，18位精度）
        uint256 startTime;        // 开始时间
        uint256 endTime;          // 结束时间
        address highestBidder;    // 最高出价者
        uint256 highestBidUSD;    // 最高出价（美元，18位精度）
        address bidToken;         // 出价代币地址（0x0表示ETH）
        uint256 bidAmount;        // 出价数量（原始代币精度）
        AuctionStatus status;     // 拍卖状态
        uint256 bidIncrement;     // 最小加价幅度（美元，18位精度）
    }
    
    // 状态变量
    mapping(uint256 => Auction) public auctions;
    mapping(address => uint256[]) public userAuctions;
    mapping(address => uint256[]) public userBids;
    uint256 public auctionCounter;
    uint256 public platformFeeRate;
    address public feeRecipient;
    
    // Chainlink价格预言机
    mapping(address => AggregatorV3Interface) public priceFeeds;
    AggregatorV3Interface public ethUsdPriceFeed;
    
    // 版本信息
    string public version;
    
    // 事件
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 startPrice,
        uint256 reservePrice,
        uint256 startTime,
        uint256 endTime
    );
    
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 bidAmountUSD,
        address bidToken,
        uint256 bidAmount
    );
    
    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBidUSD,
        address bidToken,
        uint256 bidAmount
    );
    
    event AuctionCancelled(uint256 indexed auctionId);
    event ContractUpgraded(string indexed newVersion);
    
    // 自定义错误
    error AuctionNotFound();
    error AuctionNotActive();
    error AuctionAlreadyEnded();
    error BidTooLow();
    error NotSeller();
    error NotOwner();
    error InvalidTimeRange();
    error InvalidPrice();
    error TransferFailed();
    error PriceFeedNotSet();
    error UnauthorizedUpgrade();
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev 初始化函数
     * @param _ethUsdPriceFeed ETH/USD价格预言机地址
     * @param _feeRecipient 手续费接收者地址
     * @param _platformFeeRate 平台手续费率（基数10000）
     * @param _version 合约版本
     */
    function initialize(
        address _ethUsdPriceFeed,
        address _feeRecipient,
        uint256 _platformFeeRate,
        string memory _version
    ) public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
        feeRecipient = _feeRecipient;
        platformFeeRate = _platformFeeRate;
        version = _version;
    }
    
    /**
     * @dev 重新初始化函数，用于升级时的数据迁移
     * @param _newVersion 新版本号
     */
    function reinitialize(string memory _newVersion) public reinitializer(2) {
        version = _newVersion;
        emit ContractUpgraded(_newVersion);
    }
    
    /**
     * @dev 授权升级函数，只有所有者可以升级
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // 可以在这里添加额外的升级验证逻辑
    }
    
    /**
     * @dev 设置ERC20代币的价格预言机
     * @param token ERC20代币地址
     * @param priceFeed 价格预言机地址
     */
    function setPriceFeed(address token, address priceFeed) external onlyOwner {
        priceFeeds[token] = AggregatorV3Interface(priceFeed);
    }
    
    /**
     * @dev 创建拍卖
     * @param nftContract NFT合约地址
     * @param tokenId NFT token ID
     * @param startPriceUSD 起拍价（美元，18位精度）
     * @param reservePriceUSD 保留价（美元，18位精度）
     * @param duration 拍卖持续时间（秒）
     * @param bidIncrementUSD 最小加价幅度（美元，18位精度）
     */
    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startPriceUSD,
        uint256 reservePriceUSD,
        uint256 duration,
        uint256 bidIncrementUSD
    ) external nonReentrant returns (uint256) {
        if (startPriceUSD == 0 || reservePriceUSD < startPriceUSD) {
            revert InvalidPrice();
        }
        if (duration < 3600) {
            revert InvalidTimeRange();
        }
        
        // 转移NFT到合约
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        
        uint256 auctionId = auctionCounter++;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;
        
        auctions[auctionId] = Auction({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            startPrice: startPriceUSD,
            reservePrice: reservePriceUSD,
            startTime: startTime,
            endTime: endTime,
            highestBidder: address(0),
            highestBidUSD: 0,
            bidToken: address(0),
            bidAmount: 0,
            status: AuctionStatus.Active,
            bidIncrement: bidIncrementUSD
        });
        
        userAuctions[msg.sender].push(auctionId);
        
        emit AuctionCreated(
            auctionId,
            msg.sender,
            nftContract,
            tokenId,
            startPriceUSD,
            reservePriceUSD,
            startTime,
            endTime
        );
        
        return auctionId;
    }
    
    /**
     * @dev 使用ETH出价
     * @param auctionId 拍卖ID
     */
    function bidWithETH(uint256 auctionId) external payable nonReentrant {
        Auction storage auction = auctions[auctionId];
        _validateBid(auction);
        
        uint256 bidUSD = _getETHPriceInUSD(msg.value);
        _processBid(auctionId, auction, bidUSD, address(0), msg.value);
    }
    
    /**
     * @dev 使用ERC20代币出价
     * @param auctionId 拍卖ID
     * @param token ERC20代币地址
     * @param amount 代币数量
     */
    function bidWithERC20(uint256 auctionId, address token, uint256 amount) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        _validateBid(auction);
        
        if (address(priceFeeds[token]) == address(0)) {
            revert PriceFeedNotSet();
        }
        
        uint256 bidUSD = _getTokenPriceInUSD(token, amount);
        
        // 转移代币到合约
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        _processBid(auctionId, auction, bidUSD, token, amount);
    }
    
    /**
     * @dev 结束拍卖
     * @param auctionId 拍卖ID
     */
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        if (auction.seller == address(0)) revert AuctionNotFound();
        if (auction.status != AuctionStatus.Active) revert AuctionNotActive();
        if (block.timestamp < auction.endTime && msg.sender != auction.seller) {
            revert AuctionAlreadyEnded();
        }
        
        auction.status = AuctionStatus.Ended;
        
        if (auction.highestBidder != address(0) && auction.highestBidUSD >= auction.reservePrice) {
            _executeAuction(auctionId, auction);
        } else {
            // 退还NFT给卖家
            IERC721(auction.nftContract).transferFrom(
                address(this),
                auction.seller,
                auction.tokenId
            );
            
            // 退还最高出价
            if (auction.highestBidder != address(0)) {
                _refundBid(auction);
            }
        }
        
        emit AuctionEnded(
            auctionId,
            auction.highestBidder,
            auction.highestBidUSD,
            auction.bidToken,
            auction.bidAmount
        );
    }
    
    /**
     * @dev 取消拍卖
     * @param auctionId 拍卖ID
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        if (auction.seller != msg.sender) revert NotSeller();
        if (auction.status != AuctionStatus.Active) revert AuctionNotActive();
        if (auction.highestBidder != address(0)) revert BidTooLow();
        
        auction.status = AuctionStatus.Cancelled;
        
        // 退还NFT给卖家
        IERC721(auction.nftContract).transferFrom(
            address(this),
            auction.seller,
            auction.tokenId
        );
        
        emit AuctionCancelled(auctionId);
    }
    
    // 内部函数
    function _validateBid(Auction storage auction) internal view {
        if (auction.seller == address(0)) revert AuctionNotFound();
        if (auction.status != AuctionStatus.Active) revert AuctionNotActive();
        if (block.timestamp >= auction.endTime) revert AuctionAlreadyEnded();
        if (msg.sender == auction.seller) revert NotOwner();
    }
    
    function _processBid(
        uint256 auctionId,
        Auction storage auction,
        uint256 bidUSD,
        address bidToken,
        uint256 bidAmount
    ) internal {
        uint256 minBid = auction.highestBidUSD == 0 
            ? auction.startPrice 
            : auction.highestBidUSD + auction.bidIncrement;
            
        if (bidUSD < minBid) revert BidTooLow();
        
        // 退还前一个出价者的资金
        if (auction.highestBidder != address(0)) {
            _refundBid(auction);
        }
        
        // 更新拍卖信息
        auction.highestBidder = msg.sender;
        auction.highestBidUSD = bidUSD;
        auction.bidToken = bidToken;
        auction.bidAmount = bidAmount;
        
        userBids[msg.sender].push(auctionId);
        
        emit BidPlaced(auctionId, msg.sender, bidUSD, bidToken, bidAmount);
    }
    
    function _executeAuction(uint256 auctionId, Auction storage auction) internal {
        // 转移NFT给获胜者
        IERC721(auction.nftContract).transferFrom(
            address(this),
            auction.highestBidder,
            auction.tokenId
        );
        
        // 计算平台费用
        uint256 platformFee = (auction.bidAmount * platformFeeRate) / 10000;
        uint256 sellerAmount = auction.bidAmount - platformFee;
        
        if (auction.bidToken == address(0)) {
            // ETH支付
            (bool success1, ) = payable(auction.seller).call{value: sellerAmount}("");
            (bool success2, ) = payable(feeRecipient).call{value: platformFee}("");
            if (!success1 || !success2) revert TransferFailed();
        } else {
            // ERC20代币支付
            IERC20(auction.bidToken).transfer(auction.seller, sellerAmount);
            IERC20(auction.bidToken).transfer(feeRecipient, platformFee);
        }
    }
    
    function _refundBid(Auction storage auction) internal {
        if (auction.bidToken == address(0)) {
            // 退还ETH
            (bool success, ) = payable(auction.highestBidder).call{value: auction.bidAmount}("");
            if (!success) revert TransferFailed();
        } else {
            // 退还ERC20代币
            IERC20(auction.bidToken).transfer(auction.highestBidder, auction.bidAmount);
        }
    }
    
    function _getETHPriceInUSD(uint256 ethAmount) internal view returns (uint256) {
        (, int256 price, , , ) = ethUsdPriceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        
        return (ethAmount * uint256(price) * 1e10) / 1e18;
    }
    
    function _getTokenPriceInUSD(address token, uint256 amount) internal view returns (uint256) {
        AggregatorV3Interface priceFeed = priceFeeds[token];
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        
        uint8 tokenDecimals = IERC20Metadata(token).decimals();
        return (amount * uint256(price) * 1e10) / (10 ** tokenDecimals);
    }
    
    // 查询函数
    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }
    
    function getUserAuctions(address user) external view returns (uint256[] memory) {
        return userAuctions[user];
    }
    
    function getUserBids(address user) external view returns (uint256[] memory) {
        return userBids[user];
    }
    
    function getActiveAuctions() external view returns (uint256[] memory) {
        uint256[] memory activeAuctions = new uint256[](auctionCounter);
        uint256 count = 0;
        
        for (uint256 i = 0; i < auctionCounter; i++) {
            if (auctions[i].status == AuctionStatus.Active && block.timestamp < auctions[i].endTime) {
                activeAuctions[count] = i;
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeAuctions[i];
        }
        
        return result;
    }
    
    // 管理员函数
    function setPlatformFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 1000, "Fee rate too high");
        platformFeeRate = _feeRate;
    }
    
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = payable(owner()).call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }
    
    /**
     * @dev 获取合约版本
     */
    function getVersion() external view returns (string memory) {
        return version;
    }
    
    /**
     * @dev 获取实现合约地址
     */
    function getImplementation() external view returns (address) {
        return ERC1967Utils.getImplementation();
    }
}