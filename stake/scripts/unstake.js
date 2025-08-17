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
    console.log("=== 解质押请求脚本 ===");
    
    const [signer] = await ethers.getSigners();
    console.log("解质押账户:", signer.address);
    
    // 参数（可以修改这些值）
    const POOL_ID = 0; // 要解质押的池ID
    const UNSTAKE_AMOUNT = "0.005"; // 解质押0.005 ETH
    
    try {
        // 读取部署信息
        const deploymentInfo = getDeploymentInfo();
        
        // 获取合约实例
        const stakeContract = await ethers.getContractAt(
            "StakeContract", 
            deploymentInfo.contracts.StakeContract.address
        );
        
        console.log("StakeContract地址:", await stakeContract.getAddress());
        
        // 检查池是否存在
        const poolLength = await stakeContract.poolLength();
        if (POOL_ID >= poolLength) {
            throw new Error(`池ID ${POOL_ID} 不存在，当前池数量: ${poolLength}`);
        }
        
        const unstakeAmountWei = ethers.parseEther(UNSTAKE_AMOUNT);
        
        // 获取用户信息
        const userInfoBefore = await stakeContract.userInfo(POOL_ID, signer.address);
        const poolInfo = await stakeContract.poolInfo(POOL_ID);
        
        console.log("\n=== 解质押前状态 ===");
        console.log(`当前质押数量: ${ethers.formatEther(userInfoBefore.stAmount)}`);
        console.log(`准备解质押数量: ${UNSTAKE_AMOUNT}`);
        console.log(`解质押锁定区块数: ${poolInfo.unstakeLockedBlocks}`);
        console.log(`当前解质押请求数: ${userInfoBefore.requests.length}`);
        
        if (userInfoBefore.stAmount === 0n) {
            throw new Error("没有质押代币可以解质押");
        }
        
        if (unstakeAmountWei > userInfoBefore.stAmount) {
            throw new Error(`解质押数量超过质押数量。最大可解质押: ${ethers.formatEther(userInfoBefore.stAmount)}`);
        }
        
        // 显示现有的解质押请求
        if (userInfoBefore.requests.length > 0) {
            console.log("\n=== 现有解质押请求 ===");
            const currentBlock = await ethers.provider.getBlockNumber();
            for (let i = 0; i < userInfoBefore.requests.length; i++) {
                const request = userInfoBefore.requests[i];
                const canExecute = currentBlock >= request.unlockBlock;
                console.log(`请求 ${i}: ${ethers.formatEther(request.amount)}, 解锁区块: ${request.unlockBlock}, 状态: ${canExecute ? '可执行' : '锁定中'}`);
            }
        }
        
        // 执行解质押请求
        console.log("\n开始请求解质押...");
        const tx = await stakeContract.requestUnstake(POOL_ID, unstakeAmountWei, {
            gasLimit: 300000 // 设置gas限制
        });
        
        console.log("交易哈希:", tx.hash);
        console.log("等待交易确认...");
        
        const receipt = await tx.wait();
        console.log("交易确认! Gas使用:", receipt.gasUsed.toString());
        
        // 获取解质押后的状态
        const userInfoAfter = await stakeContract.userInfo(POOL_ID, signer.address);
        const currentBlock = await ethers.provider.getBlockNumber();
        
        console.log("\n=== 解质押后状态 ===");
        console.log(`当前质押数量: ${ethers.formatEther(userInfoAfter.stAmount)}`);
        console.log(`减少数量: ${ethers.formatEther(userInfoBefore.stAmount - userInfoAfter.stAmount)}`);
        console.log(`当前解质押请求数: ${userInfoAfter.requests.length}`);
        
        // 显示最新的解质押请求
        if (userInfoAfter.requests.length > 0) {
            console.log("\n=== 解质押请求列表 ===");
            for (let i = 0; i < userInfoAfter.requests.length; i++) {
                const request = userInfoAfter.requests[i];
                const blocksLeft = request.unlockBlock > currentBlock ? request.unlockBlock - currentBlock : 0;
                const canExecute = currentBlock >= request.unlockBlock;
                
                console.log(`请求 ${i}:`);
                console.log(`  数量: ${ethers.formatEther(request.amount)}`);
                console.log(`  解锁区块: ${request.unlockBlock}`);
                console.log(`  剩余区块: ${blocksLeft}`);
                console.log(`  状态: ${canExecute ? '✅ 可执行' : '🔒 锁定中'}`);
                
                if (canExecute) {
                    console.log(`  执行命令: npx hardhat run scripts/execute-unstake.js --network <network>`);
                }
            }
        }
        
        // 显示事件日志
        const unstakeEvents = receipt.logs.filter(log => {
            try {
                const parsed = stakeContract.interface.parseLog(log);
                return parsed.name === 'RequestUnstake';
            } catch {
                return false;
            }
        });
        
        if (unstakeEvents.length > 0) {
            const unstakeEvent = stakeContract.interface.parseLog(unstakeEvents[0]);
            console.log("\n=== 解质押请求事件 ===");
            console.log(`用户: ${unstakeEvent.args.user}`);
            console.log(`池ID: ${unstakeEvent.args.pid}`);
            console.log(`数量: ${ethers.formatEther(unstakeEvent.args.amount)}`);
            console.log(`解锁区块: ${unstakeEvent.args.unlockBlock}`);
        }
        
        console.log("\n✅ 解质押请求成功!");
        console.log(`⏰ 请等待 ${poolInfo.unstakeLockedBlocks} 个区块后执行解质押`);
        
    } catch (error) {
        console.error("❌ 解质押请求失败:", error.message);
        
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

// 运行解质押请求脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });