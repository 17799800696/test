// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MetaNodeToken
 * @dev ERC20代币合约，用作质押系统的奖励代币
 * 只有授权的质押合约可以铸造代币
 */
contract MetaNodeToken is ERC20, Ownable, Pausable {
    // 授权的铸造者映射
    mapping(address => bool) public minters;
    
    // 事件
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    
    // 修饰符：只有授权的铸造者可以调用
    modifier onlyMinter() {
        require(minters[msg.sender], "MetaNodeToken: caller is not a minter");
        _;
    }
    
    /**
     * @dev 构造函数
     * @param _name 代币名称
     * @param _symbol 代币符号
     * @param _initialSupply 初始供应量
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        // 给部署者铸造初始供应量
        if (_initialSupply > 0) {
            _mint(msg.sender, _initialSupply);
        }
    }
    
    /**
     * @dev 添加铸造者
     * @param _minter 铸造者地址
     */
    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "MetaNodeToken: minter cannot be zero address");
        require(!minters[_minter], "MetaNodeToken: minter already exists");
        
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }
    
    /**
     * @dev 移除铸造者
     * @param _minter 铸造者地址
     */
    function removeMinter(address _minter) external onlyOwner {
        require(minters[_minter], "MetaNodeToken: minter does not exist");
        
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }
    
    /**
     * @dev 铸造代币（只有授权的铸造者可以调用）
     * @param _to 接收者地址
     * @param _amount 铸造数量
     */
    function mint(address _to, uint256 _amount) external onlyMinter whenNotPaused {
        require(_to != address(0), "MetaNodeToken: mint to zero address");
        require(_amount > 0, "MetaNodeToken: mint amount must be greater than 0");
        
        _mint(_to, _amount);
    }
    
    /**
     * @dev 销毁代币
     * @param _amount 销毁数量
     */
    function burn(uint256 _amount) external {
        require(_amount > 0, "MetaNodeToken: burn amount must be greater than 0");
        _burn(msg.sender, _amount);
    }
    
    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 重写transfer函数，添加暂停检查
     */
    function transfer(address to, uint256 amount) public virtual override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }
    
    /**
     * @dev 重写transferFrom函数，添加暂停检查
     */
    function transferFrom(address from, address to, uint256 amount) public virtual override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}