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
    console.log("=== 执行解质押脚本 ===");
    
    const [signer] = await ethers.getSigners();
    console.log("执行账户:", signer.address);
    
    // 参数（可以修改这些值）
    const POOL_ID = 0; // 要执行解质押的池ID
    const REQUEST_INDEX = 0; // 要执行的解质押请求索引
    
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
        
        // 获取用户信息
        const userInfo = await stakeContract.userInfo(POOL_ID, signer.address);
        const currentBlock = await ethers.provider.getBlockNumber();
        
        console.log("\n=== 执行前状态 ===");
        console.log(`当前区块: ${currentBlock}`);
        console.log(`当前质押数量: ${ethers.formatEther(userInfo.stAmount)}`);
        console.log(`解质押请求数: ${userInfo.requests.length}`);
        
        if (userInfo.requests.length === 0) {
            throw new Error("没有解质押请求");
        }
        
        if (REQUEST_INDEX >= userInfo.requests.length) {
            throw new Error(`请求索引 ${REQUEST_INDEX} 超出范围，最大索引: ${userInfo.requests.length - 1}`);
        }
        
        const request = userInfo.requests[REQUEST_INDEX];
        const canExecute = currentBlock >= request.unlockBlock;
        
        console.log("\n=== 目标解质押请求 ===");
        console.log(`请求索引: ${REQUEST_INDEX}`);
        console.log(`解质押数量: ${ethers.formatEther(request.amount)}`);
        console.log(`解锁区块: ${request.unlockBlock}`);
        console.log(`当前区块: ${currentBlock}`);
        console.log(`状态: ${canExecute ? '✅ 可执行' : '🔒 锁定中'}`);
        
        if (!canExecute) {
            const blocksLeft = request.unlockBlock - currentBlock;
            throw new Error(`解质押请求仍在锁定期，还需等待 ${blocksLeft} 个区块`);
        }
        
        // 显示所有解质押请求
        console.log("\n=== 所有解质押请求 ===");
        for (let i = 0; i < userInfo.requests.length; i++) {
            const req = userInfo.requests[i];
            const executable = currentBlock >= req.unlockBlock;
            console.log(`请求 ${i}: ${ethers.formatEther(req.amount)}, 解锁区块: ${req.unlockBlock}, 状态: ${executable ? '✅ 可执行' : '🔒 锁定中'}`);
        }
        
        // 获取执行前的余额
        const poolInfo = await stakeContract.poolInfo(POOL_ID);
        let balanceBefore;
        
        if (poolInfo.stTokenAddress === ethers.ZeroAddress) {
            // ETH池
            balanceBefore = await ethers.provider.getBalance(signer.address);
            console.log(`\n执行前ETH余额: ${ethers.formatEther(balanceBefore)} ETH`);
        } else {
            // ERC20池
            const token = await ethers.getContractAt("IERC20", poolInfo.stTokenAddress);
            balanceBefore = await token.balanceOf(signer.address);
            console.log(`\n执行前代币余额: ${ethers.formatEther(balanceBefore)}`);
        }
        
        // 执行解质押
        console.log("\n开始执行解质押...");
        const tx = await stakeContract.executeUnstake(POOL_ID, REQUEST_INDEX, {
            gasLimit: 300000 // 设置gas限制
        });
        
        console.log("交易哈希:", tx.hash);
        console.log("等待交易确认...");
        
        const receipt = await tx.wait();
        console.log("交易确认! Gas使用:", receipt.gasUsed.toString());
        
        // 获取执行后的状态
        const userInfoAfter = await stakeContract.userInfo(POOL_ID, signer.address);
        
        let balanceAfter;
        if (poolInfo.stTokenAddress === ethers.ZeroAddress) {
            // ETH池
            balanceAfter = await ethers.provider.getBalance(signer.address);
            console.log(`\n执行后ETH余额: ${ethers.formatEther(balanceAfter)} ETH`);
        } else {
            // ERC20池
            const token = await ethers.getContractAt("IERC20", poolInfo.stTokenAddress);
            balanceAfter = await token.balanceOf(signer.address);
            console.log(`\n执行后代币余额: ${ethers.formatEther(balanceAfter)}`);
        }
        
        console.log("\n=== 执行后状态 ===");
        console.log(`当前质押数量: ${ethers.formatEther(userInfoAfter.stAmount)}`);
        console.log(`剩余解质押请求数: ${userInfoAfter.requests.length}`);
        
        // 计算实际收到的金额（需要考虑gas费用）
        if (poolInfo.stTokenAddress === ethers.ZeroAddress) {
            // ETH池 - 需要考虑gas费用
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const netReceived = balanceAfter - balanceBefore + gasUsed;
            console.log(`实际收到ETH: ${ethers.formatEther(netReceived)} ETH (不含gas费)`);
            console.log(`Gas费用: ${ethers.formatEther(gasUsed)} ETH`);
        } else {
            // ERC20池
            const received = balanceAfter - balanceBefore;
            console.log(`实际收到代币: ${ethers.formatEther(received)}`);
        }
        
        // 显示剩余的解质押请求
        if (userInfoAfter.requests.length > 0) {
            console.log("\n=== 剩余解质押请求 ===");
            for (let i = 0; i < userInfoAfter.requests.length; i++) {
                const req = userInfoAfter.requests[i];
                const executable = currentBlock >= req.unlockBlock;
                console.log(`请求 ${i}: ${ethers.formatEther(req.amount)}, 解锁区块: ${req.unlockBlock}, 状态: ${executable ? '✅ 可执行' : '🔒 锁定中'}`);
            }
        }
        
        // 显示事件日志
        const executeEvents = receipt.logs.filter(log => {
            try {
                const parsed = stakeContract.interface.parseLog(log);
                return parsed.name === 'ExecuteUnstake';
            } catch {
                return false;
            }
        });
        
        if (executeEvents.length > 0) {
            const executeEvent = stakeContract.interface.parseLog(executeEvents[0]);
            console.log("\n=== 执行解质押事件 ===");
            console.log(`用户: ${executeEvent.args.user}`);
            console.log(`池ID: ${executeEvent.args.pid}`);
            console.log(`数量: ${ethers.formatEther(executeEvent.args.amount)}`);
        }
        
        console.log("\n✅ 解质押执行成功!");
        
    } catch (error) {
        console.error("❌ 执行解质押失败:", error.message);
        
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

// 运行执行解质押脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });