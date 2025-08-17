import pkg from "hardhat";
const { ethers } = pkg;
import fs from "fs";
import path from "path";

// 格式化金额显示
function formatAmount(amount, decimals = 18) {
    return parseFloat(ethers.formatUnits(amount, decimals)).toFixed(6);
}

// 等待指定数量的区块
async function mineBlocks(blocks) {
    console.log(`⏳ 挖掘 ${blocks} 个区块...`);
    for (let i = 0; i < blocks; i++) {
        await ethers.provider.send("evm_mine", []);
    }
    console.log(`✅ 已挖掘 ${blocks} 个区块`);
}

// 显示分隔线
function showSeparator(title) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎯 ${title}`);
    console.log(`${'='.repeat(50)}`);
}

async function main() {
    console.log("🚀 MetaNode质押系统演示脚本");
    
    // 获取部署信息
    const deploymentDir = './deployments';
    const deploymentFiles = fs.readdirSync(deploymentDir).filter(f => f.startsWith('deployment-') && f.endsWith('.json'));
    if (deploymentFiles.length === 0) {
        throw new Error("未找到部署文件，请先运行部署脚本");
    }
    
    const latestDeployment = deploymentFiles.sort().pop();
    const deploymentPath = path.join(deploymentDir, latestDeployment);
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    console.log(`📄 使用部署文件: ${latestDeployment}`);
    
    // 获取合约实例
    const stakeContract = await ethers.getContractAt("StakeContract", deployment.contracts.StakeContract.address);
    const metaNodeToken = await ethers.getContractAt("MetaNodeToken", deployment.contracts.MetaNodeToken.address);
    const mockToken = await ethers.getContractAt("MockERC20", deployment.contracts.MockERC20.address);
    
    // 获取账户
    const [deployer, user1, user2] = await ethers.getSigners();
    
    showSeparator("初始状态");
    console.log(`👤 演示账户: ${user1.address}`);
    console.log(`💰 ETH余额: ${formatAmount(await ethers.provider.getBalance(user1.address))} ETH`);
    console.log(`🪙 MNT余额: ${formatAmount(await metaNodeToken.balanceOf(user1.address))} MNT`);
    
    const currentBlock = await ethers.provider.getBlockNumber();
    console.log(`📦 当前区块: ${currentBlock}`);
    
    showSeparator("步骤1: 质押ETH");
    const stakeAmount = ethers.parseEther("1.0"); // 质押1 ETH
    console.log(`💎 质押 ${formatAmount(stakeAmount)} ETH 到池 0...`);
    
    const stakeTx = await stakeContract.connect(user1).stake(0, stakeAmount, { value: stakeAmount });
    await stakeTx.wait();
    console.log(`✅ 质押成功! 交易哈希: ${stakeTx.hash}`);
    
    // 显示质押后状态
    const userInfo = await stakeContract.users(0, user1.address);
    console.log(`📊 用户质押数量: ${formatAmount(userInfo.stAmount)} ETH`);
    
    showSeparator("步骤2: 等待奖励累积");
    await mineBlocks(10); // 挖掘10个区块来累积奖励
    
    const pendingReward = await stakeContract.pendingReward(0, user1.address);
    console.log(`🎁 待领取奖励: ${formatAmount(pendingReward)} MNT`);
    
    showSeparator("步骤3: 领取奖励");
    console.log(`💰 领取奖励...`);
    
    const claimTx = await stakeContract.connect(user1).claimReward(0);
    await claimTx.wait();
    console.log(`✅ 奖励领取成功! 交易哈希: ${claimTx.hash}`);
    
    const mntBalance = await metaNodeToken.balanceOf(user1.address);
    console.log(`🪙 MNT余额: ${formatAmount(mntBalance)} MNT`);
    
    showSeparator("步骤4: 请求解质押");
    const unstakeAmount = ethers.parseEther("0.5"); // 解质押0.5 ETH
    console.log(`🔓 请求解质押 ${formatAmount(unstakeAmount)} ETH...`);
    
    const unstakeTx = await stakeContract.connect(user1).requestUnstake(0, unstakeAmount);
    await unstakeTx.wait();
    console.log(`✅ 解质押请求成功! 交易哈希: ${unstakeTx.hash}`);
    
    // 显示解质押请求信息
    const requestsLength = await stakeContract.getUserRequestsLength(0, user1.address);
    if (requestsLength > 0) {
        const [amount, unlockBlock] = await stakeContract.getUserRequest(0, user1.address, 0);
        const currentBlock2 = await ethers.provider.getBlockNumber();
        console.log(`📋 解质押请求: ${formatAmount(amount)} ETH, 解锁区块: ${unlockBlock}, 当前区块: ${currentBlock2}`);
        console.log(`⏰ 需要等待 ${Number(unlockBlock) - Number(currentBlock2)} 个区块`);
    }
    
    showSeparator("步骤5: 等待解锁期");
    await mineBlocks(100); // 挖掘100个区块等待解锁
    
    showSeparator("步骤6: 执行解质押");
    console.log(`💸 执行解质押...`);
    
    const executeUnstakeTx = await stakeContract.connect(user1).unstake(0, 0);
    await executeUnstakeTx.wait();
    console.log(`✅ 解质押执行成功! 交易哈希: ${executeUnstakeTx.hash}`);
    
    showSeparator("最终状态");
    const finalUserInfo = await stakeContract.users(0, user1.address);
    const finalMntBalance = await metaNodeToken.balanceOf(user1.address);
    const finalEthBalance = await ethers.provider.getBalance(user1.address);
    
    console.log(`👤 用户: ${user1.address}`);
    console.log(`💰 ETH余额: ${formatAmount(finalEthBalance)} ETH`);
    console.log(`🪙 MNT余额: ${formatAmount(finalMntBalance)} MNT`);
    console.log(`📊 剩余质押: ${formatAmount(finalUserInfo.stAmount)} ETH`);
    
    const finalPendingReward = await stakeContract.pendingReward(0, user1.address);
    console.log(`🎁 待领取奖励: ${formatAmount(finalPendingReward)} MNT`);
    
    console.log(`\n🎉 演示完成! MetaNode质押系统运行正常!`);
    console.log(`\n📚 更多操作请参考:`);
    console.log(`   - 查看状态: npx hardhat run scripts/interact.js --network localhost`);
    console.log(`   - 质押ERC20: npx hardhat run scripts/stake-token.js --network localhost`);
    console.log(`   - 运行测试: npx hardhat test`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 演示失败:", error);
        process.exit(1);
    });