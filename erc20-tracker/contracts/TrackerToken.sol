// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrackerToken
 * @dev ERC20代币合约，支持mint和burn功能，用于代币追踪系统
 */
contract TrackerToken is ERC20, ERC20Burnable, Ownable {
    // 事件：代币铸造
    event TokenMinted(address indexed to, uint256 amount, uint256 timestamp);
    
    // 事件：代币销毁
    event TokenBurned(address indexed from, uint256 amount, uint256 timestamp);
    
    // 事件：代币转移（继承自ERC20的Transfer事件）
    
    // 最大供应量（可选限制）
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 10亿代币
    
    /**
     * @dev 构造函数
     * @param name 代币名称
     * @param symbol 代币符号
     * @param initialOwner 初始所有者地址
     */
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        // 初始化时不铸造任何代币
    }
    
    /**
     * @dev 铸造代币（仅所有者可调用）
     * @param to 接收地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(to != address(0), "TrackerToken: mint to zero address");
        require(amount > 0, "TrackerToken: mint amount must be greater than 0");
        require(totalSupply() + amount <= MAX_SUPPLY, "TrackerToken: exceeds max supply");
        
        _mint(to, amount);
        emit TokenMinted(to, amount, block.timestamp);
    }
    
    /**
     * @dev 批量铸造代币（仅所有者可调用）
     * @param recipients 接收地址数组
     * @param amounts 铸造数量数组
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "TrackerToken: arrays length mismatch");
        require(recipients.length > 0, "TrackerToken: empty arrays");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        require(totalSupply() + totalAmount <= MAX_SUPPLY, "TrackerToken: exceeds max supply");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "TrackerToken: mint to zero address");
            require(amounts[i] > 0, "TrackerToken: mint amount must be greater than 0");
            
            _mint(recipients[i], amounts[i]);
            emit TokenMinted(recipients[i], amounts[i], block.timestamp);
        }
    }
    
    /**
     * @dev 销毁代币（重写以添加事件）
     * @param amount 销毁数量
     */
    function burn(uint256 amount) public override {
        require(amount > 0, "TrackerToken: burn amount must be greater than 0");
        
        super.burn(amount);
        emit TokenBurned(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev 从指定地址销毁代币（重写以添加事件）
     * @param account 账户地址
     * @param amount 销毁数量
     */
    function burnFrom(address account, uint256 amount) public override {
        require(amount > 0, "TrackerToken: burn amount must be greater than 0");
        
        super.burnFrom(account, amount);
        emit TokenBurned(account, amount, block.timestamp);
    }
    
    /**
     * @dev 所有者销毁指定地址的代币
     * @param from 被销毁代币的地址
     * @param amount 销毁数量
     */
    function ownerBurn(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "TrackerToken: burn from zero address");
        require(amount > 0, "TrackerToken: burn amount must be greater than 0");
        require(balanceOf(from) >= amount, "TrackerToken: burn amount exceeds balance");
        
        _burn(from, amount);
        emit TokenBurned(from, amount, block.timestamp);
    }
    
    /**
     * @dev 重写transfer函数以确保事件正确触发
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        require(to != address(0), "TrackerToken: transfer to zero address");
        require(amount > 0, "TrackerToken: transfer amount must be greater than 0");
        
        return super.transfer(to, amount);
    }
    
    /**
     * @dev 重写transferFrom函数以确保事件正确触发
     */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(from != address(0), "TrackerToken: transfer from zero address");
        require(to != address(0), "TrackerToken: transfer to zero address");
        require(amount > 0, "TrackerToken: transfer amount must be greater than 0");
        
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev 获取合约信息
     */
    function getContractInfo() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 tokenTotalSupply,
        uint256 maxSupply,
        address contractOwner
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_SUPPLY,
            owner()
        );
    }
    
    /**
     * @dev 紧急暂停功能
     * 在紧急情况下可以暂停所有转账
     */
    bool private _paused = false;
    
    event Paused(address account);
    event Unpaused(address account);
    
    modifier whenNotPaused() {
        require(!_paused, "TrackerToken: token transfer while paused");
        _;
    }
    
    function paused() public view returns (bool) {
        return _paused;
    }
    
    function pause() external onlyOwner {
        _paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() external onlyOwner {
        _paused = false;
        emit Unpaused(msg.sender);
    }
    
    // 重写转账函数以支持暂停功能
    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        super._update(from, to, value);
    }
}