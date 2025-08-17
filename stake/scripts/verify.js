const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("开始验证合约...");
    
    const network = await ethers.provider.getNetwork();
    console.log("网络:", network.name, "(Chain ID:", network.chainId, ")");
    
    // 检查是否为支持验证的网络
    if (network.chainId !== 11155111n) { // Sepolia
        console.log("当前网络不支持Etherscan验证");
        return;
    }
    
    if (!process.env.ETHERSCAN_API_KEY) {
        console.log("请在.env文件中设置ETHERSCAN_API_KEY");
        return;
    }
    
    try {
        // 读取部署信息
        const deploymentsDir = path.join(__dirname, '..', 'deployments');
        const latestFile = path.join(deploymentsDir, 'latest.json');
        
        if (!fs.existsSync(latestFile)) {
            throw new Error("找不到部署信息文件，请先运行部署脚本");
        }
        
        const deploymentInfo = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        
        // 验证MetaNodeToken
        console.log("\n验证MetaNodeToken...");
        try {
            await hre.run("verify:verify", {
                address: deploymentInfo.contracts.MetaNodeToken.address,
                constructorArguments: [
                    "MetaNode Token",
                    "MNT",
                    ethers.parseEther(deploymentInfo.contracts.MetaNodeToken.initialSupply)
                ],
            });
            console.log("✅ MetaNodeToken 验证成功");
        } catch (error) {
            if (error.message.includes("Already Verified")) {
                console.log("✅ MetaNodeToken 已经验证过了");
            } else {
                console.log("❌ MetaNodeToken 验证失败:", error.message);
            }
        }
        
        // 验证MockERC20（如果存在）
        if (deploymentInfo.contracts.MockERC20) {
            console.log("\n验证MockERC20...");
            try {
                await hre.run("verify:verify", {
                    address: deploymentInfo.contracts.MockERC20.address,
                    constructorArguments: [
                        "Mock Stake Token",
                        "MST",
                        ethers.parseEther(deploymentInfo.contracts.MockERC20.supply)
                    ],
                });
                console.log("✅ MockERC20 验证成功");
            } catch (error) {
                if (error.message.includes("Already Verified")) {
                    console.log("✅ MockERC20 已经验证过了");
                } else {
                    console.log("❌ MockERC20 验证失败:", error.message);
                }
            }
        }
        
        // 注意：代理合约的验证需要特殊处理
        console.log("\n注意: StakeContract使用了代理模式，需要在Etherscan上手动验证代理合约");
        console.log("代理地址:", deploymentInfo.contracts.StakeContract.address);
        console.log("请访问 https://sepolia.etherscan.io/proxyContractChecker 进行代理验证");
        
        console.log("\n=== 验证完成 ===");
        
    } catch (error) {
        console.error("验证失败:", error);
        process.exit(1);
    }
}

// 运行验证脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });