const { ethers } = require("hardhat");

async function main() {
    console.log("开始部署 SimpleERC20 合约...");
    
    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    
    // 检查账户余额
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("账户余额:", ethers.formatEther(balance), "ETH");
    
    if (balance === 0n) {
        console.log("⚠️  警告: 账户余额为 0，请确保有足够的 ETH 支付 gas 费用");
    }
    
    // 合约参数
    const tokenName = "MyToken";
    const tokenSymbol = "MTK";
    const tokenDecimals = 18;
    const initialSupply = 1000000; // 1,000,000 tokens
    
    console.log("合约参数:");
    console.log("- 名称:", tokenName);
    console.log("- 符号:", tokenSymbol);
    console.log("- 小数位:", tokenDecimals);
    console.log("- 初始供应量:", initialSupply.toLocaleString());
    
    try {
        // 获取合约工厂
        const SimpleERC20 = await ethers.getContractFactory("SimpleERC20");
        
        // 部署合约
        console.log("\n正在部署合约...");
        const token = await SimpleERC20.deploy(
            tokenName,
            tokenSymbol,
            tokenDecimals,
            initialSupply
        );
        
        // 等待部署完成
        
        console.log("\n✅ 合约部署成功!");
        const deploymentTx = await token.deploymentTransaction();
        console.log("合约地址:", token.target);
        console.log("部署交易哈希:", deploymentTx.hash);
        
        // 验证合约信息
        console.log("\n验证合约信息:");
        console.log("- 代币名称:", await token.name());
        console.log("- 代币符号:", await token.symbol());
        console.log("- 小数位数:", await token.decimals());
        console.log("- 总供应量:", ethers.formatUnits(await token.totalSupply(), tokenDecimals));
        console.log("- 合约所有者:", await token.owner());
        console.log("- 部署者余额:", ethers.formatUnits(await token.balanceOf(deployer.address), tokenDecimals));
        
        // 保存部署信息
        const deploymentInfo = {
            contractAddress: token.target,
            deployerAddress: deployer.address,
            transactionHash: deploymentTx.hash,
            blockNumber: deploymentTx.blockNumber,
            gasUsed: deploymentTx.gasLimit?.toString(),
            timestamp: new Date().toISOString(),
            network: hre.network.name,
            tokenInfo: {
                name: tokenName,
                symbol: tokenSymbol,
                decimals: tokenDecimals,
                initialSupply: initialSupply
            }
        };
        
        const fs = require('fs');
        fs.writeFileSync(
            'deployment-info.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        console.log("\n📄 部署信息已保存到 deployment-info.json");
        
        // 如果是 Sepolia 网络，提供验证命令
        if (hre.network.name === "sepolia") {
            console.log("\n🔍 验证合约命令:");
            console.log(`npx hardhat verify --network sepolia ${token.target} "${tokenName}" "${tokenSymbol}" ${tokenDecimals} ${initialSupply}`);
            
            console.log("\n🦊 添加到 MetaMask:");
            console.log("1. 打开 MetaMask");
            console.log("2. 切换到 Sepolia 测试网");
            console.log("3. 点击 '导入代币'");
            console.log("4. 输入合约地址:", token.target);
            console.log("5. 代币符号和小数位会自动填充");
        }
        
    } catch (error) {
        console.error("\n❌ 部署失败:", error.message);
        
        if (error.message.includes("insufficient funds")) {
            console.log("\n💡 解决方案:");
            console.log("1. 确保您的钱包有足够的 ETH 支付 gas 费用");
            console.log("2. 如果是 Sepolia 测试网，可以从水龙头获取测试 ETH:");
            console.log("   - https://sepoliafaucet.com/");
            console.log("   - https://faucet.sepolia.dev/");
        } else if (error.message.includes("network")) {
            console.log("\n💡 解决方案:");
            console.log("1. 检查网络配置是否正确");
            console.log("2. 确保 RPC URL 可访问");
            console.log("3. 检查私钥是否正确设置");
        }
        
        process.exit(1);
    }
}

// 运行部署脚本
main()
    .then(() => {
        console.log("\n🎉 部署流程完成!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 部署流程出错:", error);
        process.exit(1);
    });