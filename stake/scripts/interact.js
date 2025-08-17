import pkg from "hardhat";
const { ethers } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取部署信息
function getDeploymentInfo() {
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    const latestFile = path.join(deploymentsDir, 'latest.json');
    
    if (!fs.existsSync(latestFile)) {
        throw new Error("找不到部署信息文件，请先运行部署脚本");
    }
    
    return JSON.parse(fs.readFileSync(latestFile, 'utf8'));
}

// 格式化显示数值
function formatAmount(amount, decimals = 18) {
    return ethers.formatUnits(amount, decimals);
}

// 显示用户信息
async function showUserInfo(stakeContract, userAddress, poolId) {
    console.log(`\n=== 用户 ${userAddress} 在池 ${poolId} 的信息 ===`);
    
    const userInfo = await stakeContract.users(poolId, userAddress);
    const pendingReward = await stakeContract.pendingReward(poolId, userAddress);
    
    console.log(`质押数量: ${formatAmount(userInfo.stAmount)} 代币`);
    console.log(`已分配奖励: ${formatAmount(userInfo.finishedMetaNode)} MNT`);
    console.log(`待领取奖励: ${formatAmount(userInfo.pendingMetaNode)} MNT`);
    console.log(`实时待领取奖励: ${formatAmount(pendingReward)} MNT`);
    
    // 获取解质押请求信息
    const requestsLength = await stakeContract.getUserRequestsLength(poolId, userAddress);
    if (requestsLength > 0) {
        console.log(`\n解质押请求:`);
        for (let i = 0; i < requestsLength; i++) {
            const [amount, unlockBlock] = await stakeContract.getUserRequest(poolId, userAddress, i);
            const currentBlock = await ethers.provider.getBlockNumber();
            const canExecute = currentBlock >= unlockBlock;
            
            console.log(`  请求 ${i + 1}: ${formatAmount(amount)} 代币, 解锁区块: ${unlockBlock}, 状态: ${canExecute ? '可执行' : '锁定中'}`);
        }
    } else {
        console.log(`\n无解质押请求`);
    }
}

// 显示池信息
async function showPoolInfo(stakeContract, poolId) {
    console.log(`\n=== 池 ${poolId} 信息 ===`);
    
    const poolInfo = await stakeContract.pools(poolId);
    const poolLength = await stakeContract.poolLength();
    
    if (poolId >= poolLength) {
        console.log("池不存在");
        return;
    }
    
    console.log(`质押代币地址: ${poolInfo.stTokenAddress === ethers.ZeroAddress ? 'ETH' : poolInfo.stTokenAddress}`);
    console.log(`池权重: ${poolInfo.poolWeight}`);
    console.log(`最后奖励区块: ${poolInfo.lastRewardBlock}`);
    console.log(`累积每代币奖励: ${formatAmount(poolInfo.accMetaNodePerST)}`);
    console.log(`总质押量: ${formatAmount(poolInfo.stTokenAmount)}`);
    console.log(`最小质押量: ${formatAmount(poolInfo.minDepositAmount)}`);
    console.log(`解质押锁定区块数: ${poolInfo.unstakeLockedBlocks}`);
}

// 主交互函数
async function main() {
    console.log("=== Stake合约交互脚本 ===");
    
    const [signer] = await ethers.getSigners();
    console.log("当前账户:", signer.address);
    console.log("账户余额:", formatAmount(await ethers.provider.getBalance(signer.address)), "ETH");
    
    const network = await ethers.provider.getNetwork();
    console.log("网络:", network.name, "(Chain ID:", network.chainId, ")");
    
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
        
        let mockToken = null;
        if (deploymentInfo.contracts.MockERC20) {
            mockToken = await ethers.getContractAt(
                "MockERC20", 
                deploymentInfo.contracts.MockERC20.address
            );
        }
        
        console.log("\n=== 合约地址 ===");
        console.log("StakeContract:", await stakeContract.getAddress());
        console.log("MetaNodeToken:", await metaNodeToken.getAddress());
        if (mockToken) {
            console.log("MockERC20:", await mockToken.getAddress());
        }
        
        // 显示合约基本信息
        console.log("\n=== 合约基本信息 ===");
        const poolLength = await stakeContract.poolLength();
        const rewardPerBlock = await stakeContract.metaNodePerBlock();
        const totalWeight = await stakeContract.totalPoolWeight();
        
        console.log(`池数量: ${poolLength}`);
        console.log(`每区块奖励: ${formatAmount(rewardPerBlock)} MNT`);
        console.log(`总权重: ${totalWeight}`);
        
        // 显示所有池信息
        for (let i = 0; i < poolLength; i++) {
            await showPoolInfo(stakeContract, i);
        }
        
        // 显示用户信息
        for (let i = 0; i < poolLength; i++) {
            await showUserInfo(stakeContract, signer.address, i);
        }
        
        // 显示MetaNode代币余额
        const mntBalance = await metaNodeToken.balanceOf(signer.address);
        console.log(`\n=== MetaNode代币余额 ===`);
        console.log(`MNT余额: ${formatAmount(mntBalance)} MNT`);
        
        // 如果有MockToken，显示余额
        if (mockToken) {
            const mockBalance = await mockToken.balanceOf(signer.address);
            console.log(`Mock代币余额: ${formatAmount(mockBalance)} MST`);
        }
        
        console.log("\n=== 可用操作 ===");
        console.log("1. 质押ETH: npx hardhat run scripts/stake-eth.js --network <network>");
        console.log("2. 质押ERC20: npx hardhat run scripts/stake-token.js --network <network>");
        console.log("3. 请求解质押: npx hardhat run scripts/unstake.js --network <network>");
        console.log("4. 执行解质押: npx hardhat run scripts/execute-unstake.js --network <network>");
        console.log("5. 领取奖励: npx hardhat run scripts/claim-reward.js --network <network>");
        
    } catch (error) {
        console.error("交互失败:", error);
        process.exit(1);
    }
}

// 运行交互脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });