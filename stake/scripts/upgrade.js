const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("开始升级StakeContract...");
    
    const [deployer] = await ethers.getSigners();
    console.log("升级账户:", deployer.address);
    console.log("账户余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    
    const network = await ethers.provider.getNetwork();
    console.log("网络:", network.name, "(Chain ID:", network.chainId, ")");
    
    try {
        // 读取最新的部署信息
        const deploymentsDir = path.join(__dirname, '..', 'deployments');
        const latestFile = path.join(deploymentsDir, 'latest.json');
        
        if (!fs.existsSync(latestFile)) {
            throw new Error("找不到部署信息文件，请先运行部署脚本");
        }
        
        const deploymentInfo = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        const proxyAddress = deploymentInfo.contracts.StakeContract.address;
        
        console.log("当前代理地址:", proxyAddress);
        
        // 获取新的合约工厂
        const StakeContractV2 = await ethers.getContractFactory("StakeContract");
        
        // 升级合约
        console.log("\n升级合约中...");
        const upgraded = await upgrades.upgradeProxy(proxyAddress, StakeContractV2);
        await upgraded.waitForDeployment();
        
        console.log("合约升级完成!");
        console.log("代理地址保持不变:", proxyAddress);
        
        // 验证升级后的合约
        const upgradedContract = await ethers.getContractAt("StakeContract", proxyAddress);
        const rewardToken = await upgradedContract.rewardToken();
        console.log("验证 - 奖励代币地址:", rewardToken);
        
        // 更新部署信息
        deploymentInfo.lastUpgrade = {
            timestamp: new Date().toISOString(),
            blockNumber: await ethers.provider.getBlockNumber(),
            upgrader: deployer.address
        };
        
        // 保存更新的部署信息
        const timestamp = Date.now();
        const upgradeFile = path.join(deploymentsDir, `upgrade-${timestamp}.json`);
        
        fs.writeFileSync(upgradeFile, JSON.stringify(deploymentInfo, null, 2));
        fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));
        
        console.log("\n=== 升级完成 ===");
        console.log("升级信息已保存到:", upgradeFile);
        
    } catch (error) {
        console.error("升级失败:", error);
        process.exit(1);
    }
}

// 运行升级脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });