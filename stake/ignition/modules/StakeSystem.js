const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("StakeSystemModule", (m) => {
    // 部署参数
    const initialSupply = m.getParameter("initialSupply", "10000000000000000000000000"); // 1000万 * 10^18
    const rewardPerBlock = m.getParameter("rewardPerBlock", "1000000000000000000"); // 1 * 10^18
    const startBlock = m.getParameter("startBlock", 0);
    
    // 1. 部署MetaNodeToken
    const metaNodeToken = m.contract("MetaNodeToken", [
        "MetaNode Token",
        "MNT",
        initialSupply
    ]);
    
    // 2. 部署StakeContract实现合约
    const stakeContractImpl = m.contract("StakeContract");
    
    // 3. 部署代理合约
    // 注意：这里需要手动处理代理部署，因为Ignition不直接支持OpenZeppelin的upgrades
    // 在实际使用中，建议使用deploy.js脚本进行部署
    
    // 4. 部署MockERC20（用于测试）
    const mockToken = m.contract("MockERC20", [
        "Mock Stake Token",
        "MST",
        "1000000000000000000000000" // 100万 * 10^18
    ]);
    
    return {
        metaNodeToken,
        stakeContractImpl,
        mockToken
    };
});