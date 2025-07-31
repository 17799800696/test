// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleERC20
 * @dev 实现基本的 ERC20 代币合约，参考 OpenZeppelin 标准
 */
contract SimpleERC20 {
    // 代币基本信息
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    // 合约所有者
    address public owner;
    
    // 账户余额映射
    mapping(address => uint256) public balanceOf;
    
    // 授权映射：owner => spender => amount
    mapping(address => mapping(address => uint256)) public allowance;
    
    // 事件定义
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // 修饰符：仅所有者可调用
    modifier onlyOwner() {
        require(msg.sender == owner, "SimpleERC20: caller is not the owner");
        _;
    }
    
    /**
     * @dev 构造函数
     * @param _name 代币名称
     * @param _symbol 代币符号
     * @param _decimals 小数位数
     * @param _initialSupply 初始供应量
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply
    ) {
        require(bytes(_name).length > 0, "SimpleERC20: name cannot be empty");
        require(bytes(_symbol).length > 0, "SimpleERC20: symbol cannot be empty");
        
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _initialSupply * 10**_decimals;
        owner = msg.sender;
        balanceOf[msg.sender] = totalSupply;
        
        emit Transfer(address(0), msg.sender, totalSupply);
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    /**
     * @dev 转账函数
     * @param _to 接收地址
     * @param _value 转账金额
     * @return success 是否成功
     */
    function transfer(address _to, uint256 _value) public returns (bool success) {
        require(_to != address(0), "SimpleERC20: transfer to the zero address");
        require(balanceOf[msg.sender] >= _value, "SimpleERC20: transfer amount exceeds balance");
        
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        
        emit Transfer(msg.sender, _to, _value);
        return true;
    }
    
    /**
     * @dev 授权函数
     * @param _spender 被授权地址
     * @param _value 授权金额
     * @return success 是否成功
     */
    function approve(address _spender, uint256 _value) public returns (bool success) {
        require(_spender != address(0), "SimpleERC20: approve to the zero address");
        
        allowance[msg.sender][_spender] = _value;
        
        emit Approval(msg.sender, _spender, _value);
        return true;
    }
    
    /**
     * @dev 代扣转账函数
     * @param _from 发送地址
     * @param _to 接收地址
     * @param _value 转账金额
     * @return success 是否成功
     */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        require(_from != address(0), "SimpleERC20: transfer from the zero address");
        require(_to != address(0), "SimpleERC20: transfer to the zero address");
        require(balanceOf[_from] >= _value, "SimpleERC20: transfer amount exceeds balance");
        require(allowance[_from][msg.sender] >= _value, "SimpleERC20: transfer amount exceeds allowance");
        
        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;
        
        emit Transfer(_from, _to, _value);
        return true;
    }
    
    /**
     * @dev 增发代币函数（仅所有者可调用）
     * @param _to 接收地址
     * @param _value 增发金额
     */
    function mint(address _to, uint256 _value) public onlyOwner {
        require(_to != address(0), "SimpleERC20: mint to the zero address");
        require(_value > 0, "SimpleERC20: mint amount must be greater than 0");
        
        totalSupply += _value;
        balanceOf[_to] += _value;
        
        emit Transfer(address(0), _to, _value);
        emit Mint(_to, _value);
    }
    
    /**
     * @dev 增加授权额度
     * @param _spender 被授权地址
     * @param _addedValue 增加的授权金额
     * @return success 是否成功
     */
    function increaseAllowance(address _spender, uint256 _addedValue) public returns (bool success) {
        require(_spender != address(0), "SimpleERC20: approve to the zero address");
        
        allowance[msg.sender][_spender] += _addedValue;
        
        emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
        return true;
    }
    
    /**
     * @dev 减少授权额度
     * @param _spender 被授权地址
     * @param _subtractedValue 减少的授权金额
     * @return success 是否成功
     */
    function decreaseAllowance(address _spender, uint256 _subtractedValue) public returns (bool success) {
        require(_spender != address(0), "SimpleERC20: approve to the zero address");
        uint256 currentAllowance = allowance[msg.sender][_spender];
        require(currentAllowance >= _subtractedValue, "SimpleERC20: decreased allowance below zero");
        
        allowance[msg.sender][_spender] = currentAllowance - _subtractedValue;
        
        emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
        return true;
    }
    
    /**
     * @dev 转移所有权
     * @param newOwner 新所有者地址
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "SimpleERC20: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    /**
     * @dev 放弃所有权
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }
}