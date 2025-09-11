const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("开始部署TrackerToken合约...");
    
    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    
    // 获取账户余额
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("账户余额:", ethers.formatEther(balance), "ETH");
    
    // 获取网络信息
    const network = await ethers.provider.getNetwork();
    console.log("网络:", network.name, "(Chain ID:", network.chainId.toString(), ")");
    
    // 合约参数
    const tokenName = "TrackerToken";
    const tokenSymbol = "TKT";
    const initialOwner = deployer.address;
    
    console.log("\n合约参数:");
    console.log("- 代币名称:", tokenName);
    console.log("- 代币符号:", tokenSymbol);
    console.log("- 初始所有者:", initialOwner);
    
    // 部署合约
    console.log("\n正在部署合约...");
    const TrackerToken = await ethers.getContractFactory("TrackerToken");
    const trackerToken = await TrackerToken.deploy(tokenName, tokenSymbol, initialOwner);
    
    // 等待部署完成
    await trackerToken.waitForDeployment();
    const contractAddress = await trackerToken.getAddress();
    
    console.log("\n✅ 合约部署成功!");
    console.log("合约地址:", contractAddress);
    
    // 验证合约信息
    console.log("\n验证合约信息...");
    const contractInfo = await trackerToken.getContractInfo();
    console.log("- 代币名称:", contractInfo.tokenName);
    console.log("- 代币符号:", contractInfo.tokenSymbol);
    console.log("- 小数位数:", contractInfo.tokenDecimals.toString());
    console.log("- 总供应量:", ethers.formatEther(contractInfo.tokenTotalSupply));
    console.log("- 最大供应量:", ethers.formatEther(contractInfo.maxSupply));
    console.log("- 合约所有者:", contractInfo.contractOwner);
    
    // 保存部署信息
    const deploymentInfo = {
        network: {
            name: network.name,
            chainId: network.chainId.toString()
        },
        contract: {
            name: "TrackerToken",
            address: contractAddress,
            deployer: deployer.address,
            deploymentTime: new Date().toISOString(),
            blockNumber: await ethers.provider.getBlockNumber()
        },
        token: {
            name: contractInfo.tokenName,
            symbol: contractInfo.tokenSymbol,
            decimals: contractInfo.tokenDecimals.toString(),
            maxSupply: contractInfo.maxSupply.toString()
        },
        transactionHash: trackerToken.deploymentTransaction().hash
    };
    
    // 创建deployments目录
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    // 保存部署记录
    const timestamp = Date.now();
    const deploymentFile = path.join(deploymentsDir, `deployment-${timestamp}.json`);
    const latestFile = path.join(deploymentsDir, "latest.json");
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n📄 部署信息已保存:");
    console.log("- 详细记录:", deploymentFile);
    console.log("- 最新部署:", latestFile);
    
    // 输出环境变量配置
    console.log("\n🔧 环境变量配置:");
    if (network.chainId === 11155111n) {
        console.log(`SEPOLIA_CONTRACT_ADDRESS=${contractAddress}`);
    } else if (network.chainId === 84532n) {
        console.log(`BASE_SEPOLIA_CONTRACT_ADDRESS=${contractAddress}`);
    } else {
        console.log(`CONTRACT_ADDRESS_${network.chainId}=${contractAddress}`);
    }
    
    console.log("\n🎉 部署完成!");
    console.log("\n下一步:");
    console.log("1. 更新.env文件中的合约地址");
    console.log("2. 运行测试脚本验证合约功能");
    console.log("3. 启动Go后端服务开始监听事件");
    
    return {
        contract: trackerToken,
        address: contractAddress,
        deploymentInfo
    };
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ 部署失败:", error);
            process.exit(1);
        });
}

module.exports = main;