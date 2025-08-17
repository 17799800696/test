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
    console.log("=== ERC20代币质押脚本 ===");
    
    const [signer] = await ethers.getSigners();
    console.log("质押账户:", signer.address);
    
    // 质押参数（可以修改这些值）
    const POOL_ID = 1; // ERC20池ID
    const STAKE_AMOUNT = "100"; // 质押100个代币
    
    try {
        // 读取部署信息
        const deploymentInfo = getDeploymentInfo();
        
        if (!deploymentInfo.contracts.MockERC20) {
            throw new Error("未找到MockERC20合约，请确保在测试网络上部署");
        }
        
        // 获取合约实例
        const stakeContract = await ethers.getContractAt(
            "StakeContract", 
            deploymentInfo.contracts.StakeContract.address
        );
        
        const mockToken = await ethers.getContractAt(
            "MockERC20", 
            deploymentInfo.contracts.MockERC20.address
        );
        
        console.log("StakeContract地址:", await stakeContract.getAddress());
        console.log("MockERC20地址:", await mockToken.getAddress());
        
        const stakeAmountWei = ethers.parseEther(STAKE_AMOUNT);
        
        // 检查代币余额
        const tokenBalance = await mockToken.balanceOf(signer.address);
        console.log(`账户代币余额: ${ethers.formatEther(tokenBalance)} MST`);
        console.log(`准备质押: ${STAKE_AMOUNT} MST`);
        
        // 如果余额不足，先铸造一些代币
        if (tokenBalance < stakeAmountWei) {
            console.log("\n余额不足，正在铸造代币...");
            const mintAmount = ethers.parseEther("1000"); // 铸造1000个代币
            const mintTx = await mockToken.mint(signer.address, mintAmount);
            await mintTx.wait();
            console.log(`已铸造 ${ethers.formatEther(mintAmount)} MST`);
            
            const newBalance = await mockToken.balanceOf(signer.address);
            console.log(`新余额: ${ethers.formatEther(newBalance)} MST`);
        }
        
        // 检查池信息
        const poolLength = await stakeContract.poolLength();
        if (POOL_ID >= poolLength) {
            throw new Error(`池ID ${POOL_ID} 不存在，当前池数量: ${poolLength}`);
        }
        
        const poolInfo = await stakeContract.pools(POOL_ID);
        console.log(`池最小质押量: ${ethers.formatEther(poolInfo.minDepositAmount)} MST`);
        
        if (stakeAmountWei < poolInfo.minDepositAmount) {
            throw new Error(`质押量低于最小要求: ${ethers.formatEther(poolInfo.minDepositAmount)} MST`);
        }
        
        // 检查授权
        const allowance = await mockToken.allowance(signer.address, await stakeContract.getAddress());
        console.log(`当前授权量: ${ethers.formatEther(allowance)} MST`);
        
        if (allowance < stakeAmountWei) {
            console.log("\n授权不足，正在授权...");
            const approveTx = await mockToken.approve(
                await stakeContract.getAddress(), 
                ethers.parseEther("10000") // 授权10000个代币
            );
            await approveTx.wait();
            console.log("授权完成");
        }
        
        // 获取质押前的用户信息
        const userInfoBefore = await stakeContract.userInfo(POOL_ID, signer.address);
        console.log(`质押前数量: ${ethers.formatEther(userInfoBefore.stAmount)} MST`);
        
        // 执行质押
        console.log("\n开始质押...");
        const tx = await stakeContract.stake(POOL_ID, stakeAmountWei, {
            gasLimit: 300000 // 设置gas限制
        });
        
        console.log("交易哈希:", tx.hash);
        console.log("等待交易确认...");
        
        const receipt = await tx.wait();
        console.log("交易确认! Gas使用:", receipt.gasUsed.toString());
        
        // 获取质押后的用户信息
        const userInfoAfter = await stakeContract.userInfo(POOL_ID, signer.address);
        const pendingReward = await stakeContract.pendingReward(POOL_ID, signer.address);
        const newTokenBalance = await mockToken.balanceOf(signer.address);
        
        console.log("\n=== 质押结果 ===");
        console.log(`质押后数量: ${ethers.formatEther(userInfoAfter.stAmount)} MST`);
        console.log(`增加数量: ${ethers.formatEther(userInfoAfter.stAmount - userInfoBefore.stAmount)} MST`);
        console.log(`剩余代币余额: ${ethers.formatEther(newTokenBalance)} MST`);
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
            console.log(`数量: ${ethers.formatEther(stakeEvent.args.amount)} MST`);
        }
        
        console.log("\n✅ ERC20代币质押成功!");
        
    } catch (error) {
        console.error("❌ 质押失败:", error.message);
        
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

// 运行质押脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });