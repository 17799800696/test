const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// 从部署记录中获取合约地址
function getContractAddress() {
    const latestFile = path.join(__dirname, "..", "deployments", "latest.json");
    if (!fs.existsSync(latestFile)) {
        throw new Error("未找到部署记录文件，请先部署合约");
    }
    
    const deploymentInfo = JSON.parse(fs.readFileSync(latestFile, "utf8"));
    return deploymentInfo.contract.address;
}

// 格式化代币数量显示
function formatTokenAmount(amount, decimals = 18) {
    return ethers.formatUnits(amount, decimals);
}

// 解析代币数量输入
function parseTokenAmount(amount, decimals = 18) {
    return ethers.parseUnits(amount.toString(), decimals);
}

// 等待交易确认并显示信息
async function waitForTransaction(tx, description) {
    console.log(`\n📤 ${description}`);
    console.log(`交易哈希: ${tx.hash}`);
    console.log(`等待确认...`);
    
    const receipt = await tx.wait();
    console.log(`✅ 交易确认! Gas使用: ${receipt.gasUsed.toString()}`);
    
    return receipt;
}

// 显示账户余额
async function showBalance(contract, address, label) {
    const balance = await contract.balanceOf(address);
    console.log(`${label}: ${formatTokenAmount(balance)} TKT`);
    return balance;
}

// 主要交互函数
async function main() {
    console.log("🚀 开始与TrackerToken合约交互...");
    
    try {
        // 获取合约地址
        const contractAddress = getContractAddress();
        console.log(`合约地址: ${contractAddress}`);
        
        // 获取签名者
        const signers = await ethers.getSigners();
        const deployer = signers[0];
        const user1 = signers[1] || deployer; // 如果没有第二个账户，使用部署者
        const user2 = signers[2] || deployer; // 如果没有第三个账户，使用部署者
        
        console.log(`\n👤 账户信息:`);
        console.log(`部署者: ${deployer.address}`);
        if (signers.length > 1) {
            console.log(`用户1: ${user1.address}`);
            console.log(`用户2: ${user2.address}`);
        } else {
            console.log(`注意: 只有一个账户，将使用部署者账户进行所有测试`);
        }
        
        // 连接合约
        const TrackerToken = await ethers.getContractFactory("TrackerToken");
        const contract = TrackerToken.attach(contractAddress);
        
        // 显示合约信息
        console.log(`\n📋 合约信息:`);
        const contractInfo = await contract.getContractInfo();
        console.log(`代币名称: ${contractInfo.tokenName}`);
        console.log(`代币符号: ${contractInfo.tokenSymbol}`);
        console.log(`小数位数: ${contractInfo.tokenDecimals}`);
        console.log(`当前总供应量: ${formatTokenAmount(contractInfo.tokenTotalSupply)} TKT`);
        console.log(`最大供应量: ${formatTokenAmount(contractInfo.maxSupply)} TKT`);
        
        // 显示初始余额
        console.log(`\n💰 初始余额:`);
        await showBalance(contract, deployer.address, "部署者");
        await showBalance(contract, user1.address, "用户1");
        await showBalance(contract, user2.address, "用户2");
        
        // 测试参数（可以通过环境变量或命令行参数自定义）
        const amount1 = process.env.MINT_AMOUNT || "1000"; // 铸造数量
        const amount2 = process.env.BURN_AMOUNT || "200";  // 销毁数量
        const amount3 = process.env.TRANSFER_AMOUNT || "300"; // 转移数量
        
        console.log(`\n🎯 测试参数:`);
        console.log(`铸造数量: ${amount1} TKT`);
        console.log(`销毁数量: ${amount2} TKT`);
        console.log(`转移数量: ${amount3} TKT`);
        
        // 1. 铸造代币测试
        console.log(`\n\n=== 1. 铸造代币测试 ===`);
        
        // 给部署者铸造代币
        const mintAmount1 = parseTokenAmount(amount1);
        const mintTx1 = await contract.mint(deployer.address, mintAmount1);
        await waitForTransaction(mintTx1, `给部署者铸造 ${amount1} TKT`);
        
        // 给用户1铸造代币
        const mintAmount2 = parseTokenAmount("500");
        const mintTx2 = await contract.mint(user1.address, mintAmount2);
        await waitForTransaction(mintTx2, `给用户1铸造 500 TKT`);
        
        // 显示铸造后余额
        console.log(`\n💰 铸造后余额:`);
        await showBalance(contract, deployer.address, "部署者");
        await showBalance(contract, user1.address, "用户1");
        
        // 2. 转移代币测试
        console.log(`\n\n=== 2. 转移代币测试 ===`);
        
        // 部署者向用户2转移代币
        const transferAmount = parseTokenAmount(amount3);
        const transferTx = await contract.transfer(user2.address, transferAmount);
        await waitForTransaction(transferTx, `部署者向用户2转移 ${amount3} TKT`);
        
        // 用户1向用户2转移代币
        const user1Contract = contract.connect(user1);
        const transferAmount2 = parseTokenAmount("100");
        const transferTx2 = await user1Contract.transfer(user2.address, transferAmount2);
        await waitForTransaction(transferTx2, `用户1向用户2转移 100 TKT`);
        
        // 显示转移后余额
        console.log(`\n💰 转移后余额:`);
        await showBalance(contract, deployer.address, "部署者");
        await showBalance(contract, user1.address, "用户1");
        await showBalance(contract, user2.address, "用户2");
        
        // 3. 销毁代币测试
        console.log(`\n\n=== 3. 销毁代币测试 ===`);
        
        // 部署者销毁自己的代币
        const burnAmount = parseTokenAmount(amount2);
        const burnTx = await contract.burn(burnAmount);
        await waitForTransaction(burnTx, `部署者销毁 ${amount2} TKT`);
        
        // 用户2销毁自己的代币
        const user2Contract = contract.connect(user2);
        const burnAmount2 = parseTokenAmount("50");
        const burnTx2 = await user2Contract.burn(burnAmount2);
        await waitForTransaction(burnTx2, `用户2销毁 50 TKT`);
        
        // 显示最终余额
        console.log(`\n💰 最终余额:`);
        await showBalance(contract, deployer.address, "部署者");
        await showBalance(contract, user1.address, "用户1");
        await showBalance(contract, user2.address, "用户2");
        
        // 显示最终总供应量
        const finalTotalSupply = await contract.totalSupply();
        console.log(`\n📊 最终总供应量: ${formatTokenAmount(finalTotalSupply)} TKT`);
        
        // 4. 批量铸造测试（可选）
        console.log(`\n\n=== 4. 批量铸造测试 ===`);
        const recipients = [user1.address, user2.address];
        const amounts = [parseTokenAmount("50"), parseTokenAmount("75")];
        
        const batchMintTx = await contract.batchMint(recipients, amounts);
        await waitForTransaction(batchMintTx, "批量铸造代币");
        
        console.log(`\n💰 批量铸造后余额:`);
        await showBalance(contract, user1.address, "用户1");
        await showBalance(contract, user2.address, "用户2");
        
        // 生成测试报告
        const testReport = {
            timestamp: new Date().toISOString(),
            contract: contractAddress,
            network: (await ethers.provider.getNetwork()).name,
            tests: {
                mint: {
                    amount1: amount1,
                    amount2: "500",
                    status: "✅ 成功"
                },
                transfer: {
                    amount1: amount3,
                    amount2: "100",
                    status: "✅ 成功"
                },
                burn: {
                    amount1: amount2,
                    amount2: "50",
                    status: "✅ 成功"
                },
                batchMint: {
                    recipients: recipients.length,
                    totalAmount: "125",
                    status: "✅ 成功"
                }
            },
            finalBalances: {
                deployer: formatTokenAmount(await contract.balanceOf(deployer.address)),
                user1: formatTokenAmount(await contract.balanceOf(user1.address)),
                user2: formatTokenAmount(await contract.balanceOf(user2.address))
            },
            totalSupply: formatTokenAmount(await contract.totalSupply())
        };
        
        // 保存测试报告
        const reportsDir = path.join(__dirname, "..", "reports");
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const reportFile = path.join(reportsDir, `test-report-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(testReport, null, 2));
        
        console.log(`\n\n🎉 所有测试完成!`);
        console.log(`📄 测试报告已保存: ${reportFile}`);
        console.log(`\n✅ 合约功能验证成功，可以启动Go后端服务进行事件监听`);
        
    } catch (error) {
        console.error(`\n❌ 交互失败:`, error.message);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ 脚本执行失败:", error);
            process.exit(1);
        });
}

module.exports = main;