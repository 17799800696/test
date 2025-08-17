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
    console.log("=== 领取奖励脚本 ===");
    
    const [signer] = await ethers.getSigners();
    console.log("领取账户:", signer.address);
    
    // 参数（可以修改这些值）
    const POOL_ID = 0; // 要领取奖励的池ID，可以改为1来领取ERC20池的奖励
    
    try {
        // 读取部署信息
        const deploymentInfo = getDeploymentInfo();
        
        // 获取合约实例
        const stakeContract = await ethers.getContractAt(
            "StakeContract", 
            deploymentInfo.contracts.StakeContract.address
        );
        
        const metaNodeToken = await ethers.getContractAt(
            "MetaNodeToken", 
            deploymentInfo.contracts.MetaNodeToken.address
        );
        
        console.log("StakeContract地址:", await stakeContract.getAddress());
        console.log("MetaNodeToken地址:", await metaNodeToken.getAddress());
        
        // 检查池是否存在
        const poolLength = await stakeContract.poolLength();
        if (POOL_ID >= poolLength) {
            throw new Error(`池ID ${POOL_ID} 不存在，当前池数量: ${poolLength}`);
        }
        
        // 获取用户信息
        const userInfo = await stakeContract.userInfo(POOL_ID, signer.address);
        const pendingReward = await stakeContract.pendingReward(POOL_ID, signer.address);
        const mntBalanceBefore = await metaNodeToken.balanceOf(signer.address);
        
        console.log("\n=== 领取前状态 ===");
        console.log(`质押数量: ${ethers.formatEther(userInfo.stAmount)}`);
        console.log(`已分配奖励: ${ethers.formatEther(userInfo.finishedMetaNode)} MNT`);
        console.log(`待领取奖励: ${ethers.formatEther(userInfo.pendingMetaNode)} MNT`);
        console.log(`实时待领取奖励: ${ethers.formatEther(pendingReward)} MNT`);
        console.log(`当前MNT余额: ${ethers.formatEther(mntBalanceBefore)} MNT`);
        
        if (pendingReward === 0n) {
            console.log("\n⚠️ 没有可领取的奖励");
            return;
        }
        
        // 执行领取奖励
        console.log("\n开始领取奖励...");
        const tx = await stakeContract.claimReward(POOL_ID, {
            gasLimit: 200000 // 设置gas限制
        });
        
        console.log("交易哈希:", tx.hash);
        console.log("等待交易确认...");
        
        const receipt = await tx.wait();
        console.log("交易确认! Gas使用:", receipt.gasUsed.toString());
        
        // 获取领取后的状态
        const userInfoAfter = await stakeContract.userInfo(POOL_ID, signer.address);
        const pendingRewardAfter = await stakeContract.pendingReward(POOL_ID, signer.address);
        const mntBalanceAfter = await metaNodeToken.balanceOf(signer.address);
        
        console.log("\n=== 领取后状态 ===");
        console.log(`质押数量: ${ethers.formatEther(userInfoAfter.stAmount)}`);
        console.log(`已分配奖励: ${ethers.formatEther(userInfoAfter.finishedMetaNode)} MNT`);
        console.log(`待领取奖励: ${ethers.formatEther(userInfoAfter.pendingMetaNode)} MNT`);
        console.log(`实时待领取奖励: ${ethers.formatEther(pendingRewardAfter)} MNT`);
        console.log(`当前MNT余额: ${ethers.formatEther(mntBalanceAfter)} MNT`);
        
        const claimedAmount = mntBalanceAfter - mntBalanceBefore;
        console.log("\n=== 领取结果 ===");
        console.log(`实际领取数量: ${ethers.formatEther(claimedAmount)} MNT`);
        
        // 显示事件日志
        const claimEvents = receipt.logs.filter(log => {
            try {
                const parsed = stakeContract.interface.parseLog(log);
                return parsed.name === 'ClaimReward';
            } catch {
                return false;
            }
        });
        
        if (claimEvents.length > 0) {
            const claimEvent = stakeContract.interface.parseLog(claimEvents[0]);
            console.log("\n=== 领取事件 ===");
            console.log(`用户: ${claimEvent.args.user}`);
            console.log(`池ID: ${claimEvent.args.pid}`);
            console.log(`奖励数量: ${ethers.formatEther(claimEvent.args.amount)} MNT`);
        }
        
        // 显示转账事件（MetaNodeToken的Transfer事件）
        const transferEvents = receipt.logs.filter(log => {
            try {
                const parsed = metaNodeToken.interface.parseLog(log);
                return parsed.name === 'Transfer' && parsed.args.to === signer.address;
            } catch {
                return false;
            }
        });
        
        if (transferEvents.length > 0) {
            const transferEvent = metaNodeToken.interface.parseLog(transferEvents[0]);
            console.log("\n=== 转账事件 ===");
            console.log(`从: ${transferEvent.args.from}`);
            console.log(`到: ${transferEvent.args.to}`);
            console.log(`数量: ${ethers.formatEther(transferEvent.args.value)} MNT`);
        }
        
        console.log("\n✅ 奖励领取成功!");
        
    } catch (error) {
        console.error("❌ 领取失败:", error.message);
        
        // 如果是合约错误，尝试解析
        if (error.data) {
            try {
                const deploymentInfo = getDeploymentInfo();
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

// 运行领取脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });