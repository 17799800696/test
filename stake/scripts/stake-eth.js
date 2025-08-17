const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// 读取部署信息
function getDeploymentInfo() {
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    const latestFile = path.join(deploymentsDir, 'latest.json');
    
    if (!fs.existsSync(latestFile)) {
        throw new Error("找不到部署信息文件，请先运行部署脚本");
    }
    
    return JSON.parse(fs.readFileSync(latestFile, 'utf8'));
}

async function main() {
    console.log("=== ETH质押脚本 ===");
    
    const [signer] = await ethers.getSigners();
    console.log("质押账户:", signer.address);
    
    // 质押参数（可以修改这些值）
    const POOL_ID = 0; // ETH池ID
    const STAKE_AMOUNT = "0.01"; // 质押0.01 ETH
    
    try {
        // 读取部署信息
        const deploymentInfo = getDeploymentInfo();
        
        // 获取合约实例
        const stakeContract = await ethers.getContractAt(
            "StakeContract", 
            deploymentInfo.contracts.StakeContract.address
        );
        
        console.log("StakeContract地址:", await stakeContract.getAddress());
        
        // 检查账户余额
        const balance = await ethers.provider.getBalance(signer.address);
        const stakeAmountWei = ethers.parseEther(STAKE_AMOUNT);
        
        console.log(`账户ETH余额: ${ethers.formatEther(balance)} ETH`);
        console.log(`准备质押: ${STAKE_AMOUNT} ETH`);
        
        if (balance < stakeAmountWei) {
            throw new Error("账户余额不足");
        }
        
        // 检查池信息
        const poolInfo = await stakeContract.pools(POOL_ID);
        console.log(`池最小质押量: ${ethers.formatEther(poolInfo.minDepositAmount)} ETH`);
        
        if (stakeAmountWei < poolInfo.minDepositAmount) {
            throw new Error(`质押量低于最小要求: ${ethers.formatEther(poolInfo.minDepositAmount)} ETH`);
        }
        
        // 获取质押前的用户信息
        const userInfoBefore = await stakeContract.userInfo(POOL_ID, signer.address);
        console.log(`质押前数量: ${ethers.formatEther(userInfoBefore.stAmount)} ETH`);
        
        // 执行质押
        console.log("\n开始质押...");
        const tx = await stakeContract.stake(POOL_ID, { 
            value: stakeAmountWei,
            gasLimit: 300000 // 设置gas限制
        });
        
        console.log("交易哈希:", tx.hash);
        console.log("等待交易确认...");
        
        const receipt = await tx.wait();
        console.log("交易确认! Gas使用:", receipt.gasUsed.toString());
        
        // 获取质押后的用户信息
        const userInfoAfter = await stakeContract.userInfo(POOL_ID, signer.address);
        const pendingReward = await stakeContract.pendingReward(POOL_ID, signer.address);
        
        console.log("\n=== 质押结果 ===");
        console.log(`质押后数量: ${ethers.formatEther(userInfoAfter.stAmount)} ETH`);
        console.log(`增加数量: ${ethers.formatEther(userInfoAfter.stAmount - userInfoBefore.stAmount)} ETH`);
        console.log(`待领取奖励: ${ethers.formatEther(pendingReward)} MNT`);
        
        // 显示事件日志
        const stakeEvents = receipt.logs.filter(log => {
            try {
                const parsed = stakeContract.interface.parseLog(log);
                return parsed.name === 'Stake';
            } catch {
                return false;
            }
        });
        
        if (stakeEvents.length > 0) {
            const stakeEvent = stakeContract.interface.parseLog(stakeEvents[0]);
            console.log("\n=== 质押事件 ===");
            console.log(`用户: ${stakeEvent.args.user}`);
            console.log(`池ID: ${stakeEvent.args.pid}`);
            console.log(`数量: ${ethers.formatEther(stakeEvent.args.amount)} ETH`);
        }
        
        console.log("\n✅ ETH质押成功!");
        
    } catch (error) {
        console.error("❌ 质押失败:", error.message);
        
        // 如果是合约错误，尝试解析
        if (error.data) {
            try {
                const stakeContract = await ethers.getContractAt(
                    "StakeContract", 
                    deploymentInfo.contracts.StakeContract.address
                );
                const decodedError = stakeContract.interface.parseError(error.data);
                console.error("合约错误:", decodedError.name, decodedError.args);
            } catch {
                console.error("无法解析合约错误");
            }
        }
        
        process.exit(1);
    }
}

// 运行质押脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });