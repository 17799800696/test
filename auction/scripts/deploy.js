const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("开始部署NFT拍卖市场合约...");
    
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("账户余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
    
    // 部署配置
    const config = {
        // Sepolia测试网的Chainlink价格预言机地址
        ethUsdPriceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // ETH/USD
        usdcUsdPriceFeed: "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E", // USDC/USD (如果需要)
        feeRecipient: deployer.address, // 手续费接收者
        platformFeeRate: 250, // 2.5%
    };
    
    const deployedContracts = {};
    
    try {
        // 1. 部署MockV3Aggregator (ETH/USD价格预言机)
        console.log("\n1. 部署MockV3Aggregator (ETH/USD)合约...");
        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        const ethUsdPriceFeed = await MockV3Aggregator.deploy(
            8, // decimals
            ethers.parseUnits("2000", 8) // $2000 per ETH
        );
        await ethUsdPriceFeed.waitForDeployment();
        deployedContracts.ethUsdPriceFeed = await ethUsdPriceFeed.getAddress();
        console.log("ETH/USD Price Feed部署地址:", deployedContracts.ethUsdPriceFeed);
        
        // 2. 部署NFT合约
        console.log("\n2. 部署AuctionNFT合约...");
        const AuctionNFT = await ethers.getContractFactory("AuctionNFT");
        const auctionNFT = await AuctionNFT.deploy("Auction NFT", "ANFT");
        await auctionNFT.waitForDeployment();
        deployedContracts.auctionNFT = await auctionNFT.getAddress();
        console.log("AuctionNFT部署地址:", deployedContracts.auctionNFT);
        
        // 3. 部署MockV3Aggregator (ERC20/USD价格预言机)
        console.log("\n3. 部署MockV3Aggregator (ERC20/USD)合约...");
        const erc20UsdPriceFeed = await MockV3Aggregator.deploy(
            8, // decimals
            ethers.parseUnits("1", 8) // $1 per token
        );
        await erc20UsdPriceFeed.waitForDeployment();
        deployedContracts.erc20UsdPriceFeed = await erc20UsdPriceFeed.getAddress();
        console.log("ERC20/USD Price Feed部署地址:", deployedContracts.erc20UsdPriceFeed);
        
        // 4. 部署测试ERC20代币
        console.log("\n4. 部署MockERC20合约...");
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockUSDC = await MockERC20.deploy(
            "Mock USDC",
            "mUSDC",
            6, // USDC精度
            1000000 // 初始供应量
        );
        await mockUSDC.waitForDeployment();
        deployedContracts.mockUSDC = await mockUSDC.getAddress();
        console.log("MockERC20 (USDC)部署地址:", deployedContracts.mockUSDC);
        
        // 5. 部署基础拍卖合约
        console.log("\n5. 部署NFTAuction合约...");
        const NFTAuction = await ethers.getContractFactory("NFTAuction");
        const nftAuction = await NFTAuction.deploy(
            deployedContracts.ethUsdPriceFeed,
            config.feeRecipient
        );
        await nftAuction.waitForDeployment();
        deployedContracts.nftAuction = await nftAuction.getAddress();
        console.log("NFTAuction部署地址:", deployedContracts.nftAuction);
        
        // 6. 部署拍卖工厂合约
        console.log("\n6. 部署AuctionFactory合约...");
        const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
        const auctionFactory = await AuctionFactory.deploy(
            deployedContracts.ethUsdPriceFeed,
            config.feeRecipient
        );
        await auctionFactory.waitForDeployment();
        deployedContracts.auctionFactory = await auctionFactory.getAddress();
        console.log("AuctionFactory部署地址:", deployedContracts.auctionFactory);
        
        // 7. 部署可升级拍卖合约
        console.log("\n7. 部署UpgradeableAuction合约(UUPS代理)...");
        const UpgradeableAuction = await ethers.getContractFactory("UpgradeableAuction");
        const upgradeableAuction = await upgrades.deployProxy(
            UpgradeableAuction,
            [
                deployedContracts.ethUsdPriceFeed,
                config.feeRecipient,
                config.platformFeeRate,
                "v1.0.0"
            ],
            {
                kind: "uups",
                initializer: "initialize"
            }
        );
        await upgradeableAuction.waitForDeployment();
        deployedContracts.upgradeableAuction = await upgradeableAuction.getAddress();
        deployedContracts.upgradeableAuctionImpl = await upgrades.erc1967.getImplementationAddress(
            deployedContracts.upgradeableAuction
        );
        console.log("UpgradeableAuction代理地址:", deployedContracts.upgradeableAuction);
        console.log("UpgradeableAuction实现地址:", deployedContracts.upgradeableAuctionImpl);
        
        // 8. 配置价格预言机
        console.log("\n8. 配置价格预言机...");
        await nftAuction.setPriceFeed(deployedContracts.mockUSDC, deployedContracts.erc20UsdPriceFeed);
        await upgradeableAuction.setPriceFeed(deployedContracts.mockUSDC, deployedContracts.erc20UsdPriceFeed);
        console.log("USDC价格预言机配置完成");
        
        // 为AuctionFactory设置默认配置
        await auctionFactory.setDefaultConfig(
            deployedContracts.ethUsdPriceFeed,
            config.feeRecipient,
            config.platformFeeRate
        );
        console.log("工厂合约默认配置完成");
        
        // 9. 铸造一些测试NFT
        console.log("\n9. 铸造测试NFT...");
        const nftContract = await ethers.getContractAt("AuctionNFT", deployedContracts.auctionNFT);
        const tokenURIs = [
            "https://example.com/nft/1.json",
            "https://example.com/nft/2.json",
            "https://example.com/nft/3.json"
        ];
        
        for (let i = 0; i < tokenURIs.length; i++) {
            const tx = await nftContract.mintNFT(deployer.address, tokenURIs[i]);
            await tx.wait();
            console.log(`NFT ${i + 1} 铸造完成，TokenID: ${i}`);
        }
        
        // 10. 分发一些测试代币
        console.log("\n10. 分发测试代币...");
        const usdcContract = await ethers.getContractAt("MockERC20", deployedContracts.mockUSDC);
        const testAmount = ethers.parseUnits("10000", 6); // 10000 USDC
        await usdcContract.mint(deployer.address, testAmount);
        console.log("测试USDC分发完成:", ethers.formatUnits(testAmount, 6));
        
        // 11. 保存部署信息
        const deploymentInfo = {
            network: "sepolia", // 或其他测试网
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: deployedContracts,
            config: config,
            gasUsed: {
                // 这里可以记录各合约的gas使用情况
            }
        };
        
        const deploymentPath = path.join(__dirname, "..", "deployments");
        if (!fs.existsSync(deploymentPath)) {
            fs.mkdirSync(deploymentPath, { recursive: true });
        }
        
        const fileName = `deployment-${Date.now()}.json`;
        fs.writeFileSync(
            path.join(deploymentPath, fileName),
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        // 也保存最新的部署信息
        fs.writeFileSync(
            path.join(deploymentPath, "latest.json"),
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        console.log("\n=== 部署完成 ===");
        console.log("部署信息已保存到:", path.join(deploymentPath, fileName));
        console.log("\n合约地址汇总:");
        Object.entries(deployedContracts).forEach(([name, address]) => {
            console.log(`${name}: ${address}`);
        });
        
        console.log("\n验证合约命令:");
        console.log(`npx hardhat verify --network sepolia ${deployedContracts.auctionNFT} "Auction NFT" "ANFT"`);
        console.log(`npx hardhat verify --network sepolia ${deployedContracts.mockUSDC} "Mock USDC" "mUSDC" 6 1000000`);
        console.log(`npx hardhat verify --network sepolia ${deployedContracts.nftAuction} ${config.ethUsdPriceFeed} ${config.feeRecipient}`);
        console.log(`npx hardhat verify --network sepolia ${deployedContracts.auctionFactory} ${config.ethUsdPriceFeed} ${config.feeRecipient}`);
        
        return deployedContracts;
        
    } catch (error) {
        console.error("部署失败:", error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = main;