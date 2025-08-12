const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// 加载最新的部署信息
function loadDeployment() {
    const deploymentPath = path.join(__dirname, "..", "deployments", "latest.json");
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("未找到部署信息，请先运行部署脚本");
    }
    return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

async function main() {
    console.log("开始与NFT拍卖市场合约交互...");
    
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log("部署者地址:", deployer.address);
    console.log("用户1地址:", user1.address);
    console.log("用户2地址:", user2.address);
    
    // 加载部署信息
    const deployment = loadDeployment();
    const contracts = deployment.contracts;
    
    // 获取合约实例
    const nftContract = await ethers.getContractAt("AuctionNFT", contracts.auctionNFT);
    const auctionContract = await ethers.getContractAt("NFTAuction", contracts.nftAuction);
    const usdcContract = await ethers.getContractAt("MockERC20", contracts.mockUSDC);
    const factoryContract = await ethers.getContractAt("AuctionFactory", contracts.auctionFactory);
    const upgradeableContract = await ethers.getContractAt("UpgradeableAuction", contracts.upgradeableAuction);
    const ethUsdPriceFeed = await ethers.getContractAt("MockV3Aggregator", contracts.ethUsdPriceFeed);
    const erc20UsdPriceFeed = await ethers.getContractAt("MockV3Aggregator", contracts.erc20UsdPriceFeed);
    
    try {
        // 1. 测试价格预言机
        console.log("\n=== 1. 测试价格预言机 ===");
        
        // 获取ETH/USD价格
        const ethPriceData = await ethUsdPriceFeed.latestRoundData();
        const ethPrice = ethers.formatUnits(ethPriceData.answer, 8);
        console.log(`ETH/USD 价格: $${ethPrice}`);
        
        // 获取ERC20/USD价格
        const erc20PriceData = await erc20UsdPriceFeed.latestRoundData();
        const erc20Price = ethers.formatUnits(erc20PriceData.answer, 8);
        console.log(`ERC20/USD 价格: $${erc20Price}`);
        
        // 更新价格（演示动态价格）
        console.log("\n更新价格...");
        await ethUsdPriceFeed.updateAnswer(ethers.parseUnits("2100", 8)); // ETH涨到$2100
        await erc20UsdPriceFeed.updateAnswer(ethers.parseUnits("0.99", 8)); // ERC20降到$0.99
        
        const newEthPriceData = await ethUsdPriceFeed.latestRoundData();
        const newEthPrice = ethers.formatUnits(newEthPriceData.answer, 8);
        console.log(`新的ETH/USD 价格: $${newEthPrice}`);
        
        const newErc20PriceData = await erc20UsdPriceFeed.latestRoundData();
        const newErc20Price = ethers.formatUnits(newErc20PriceData.answer, 8);
        console.log(`新的ERC20/USD 价格: $${newErc20Price}`);
        
        // 2. 查看NFT信息
        console.log("\n=== 2. NFT合约信息 ===");
        const nftName = await nftContract.name();
        const nftSymbol = await nftContract.symbol();
        const totalSupply = await nftContract.totalSupply();
        console.log(`NFT名称: ${nftName}`);
        console.log(`NFT符号: ${nftSymbol}`);
        console.log(`总供应量: ${totalSupply}`);
        
        // 3. 分发测试代币给用户
        console.log("\n=== 3. 分发测试代币 ===");
        const testAmount = ethers.parseUnits("5000", 6); // 5000 USDC
        await usdcContract.mint(user1.address, testAmount);
        await usdcContract.mint(user2.address, testAmount);
        console.log(`给用户1分发 ${ethers.formatUnits(testAmount, 6)} USDC`);
        console.log(`给用户2分发 ${ethers.formatUnits(testAmount, 6)} USDC`);
        
        // 4. 铸造NFT给用户1
        console.log("\n=== 4. 铸造NFT给用户1 ===");
        const tokenURI = "https://example.com/nft/auction-test.json";
        const mintTx = await nftContract.mintNFT(user1.address, tokenURI);
        await mintTx.wait();
        const newTokenId = await nftContract.totalSupply() - 1n;
        console.log(`NFT铸造完成，TokenID: ${newTokenId}`);
        
        // 5. 用户1授权NFT给拍卖合约
        console.log("\n=== 5. 授权NFT给拍卖合约 ===");
        const nftContractUser1 = nftContract.connect(user1);
        await nftContractUser1.approve(contracts.nftAuction, newTokenId);
        console.log("NFT授权完成");
        
        // 6. 创建拍卖
        console.log("\n=== 6. 创建拍卖 ===");
        const auctionContractUser1 = auctionContract.connect(user1);
        const startPriceUSD = ethers.parseEther("100"); // 100 USD
        const reservePriceUSD = ethers.parseEther("150"); // 150 USD
        const duration = 3600; // 1小时
        const bidIncrementUSD = ethers.parseEther("10"); // 10 USD
        
        const createTx = await auctionContractUser1.createAuction(
            contracts.auctionNFT,
            newTokenId,
            startPriceUSD,
            reservePriceUSD,
            duration,
            bidIncrementUSD
        );
        const receipt = await createTx.wait();
        
        // 从事件中获取拍卖ID
        const auctionCreatedEvent = receipt.logs.find(
            log => log.fragment && log.fragment.name === "AuctionCreated"
        );
        const auctionId = auctionCreatedEvent.args[0];
        console.log(`拍卖创建完成，拍卖ID: ${auctionId}`);
        
        // 7. 查看拍卖信息
        console.log("\n=== 7. 拍卖信息 ===");
        const auction = await auctionContract.getAuction(auctionId);
        console.log(`卖家: ${auction.seller}`);
        console.log(`NFT合约: ${auction.nftContract}`);
        console.log(`TokenID: ${auction.tokenId}`);
        console.log(`起拍价: ${ethers.formatEther(auction.startPrice)} USD`);
        console.log(`保留价: ${ethers.formatEther(auction.reservePrice)} USD`);
        console.log(`状态: ${auction.status}`);
        
        // 8. 用户2使用ETH出价
        console.log("\n=== 8. 用户2使用ETH出价 ===");
        const auctionContractUser2 = auctionContract.connect(user2);
        const ethBidAmount = ethers.parseEther("0.05"); // 0.05 ETH
        
        const bidTx = await auctionContractUser2.bidWithETH(auctionId, {
            value: ethBidAmount
        });
        await bidTx.wait();
        console.log(`ETH出价完成: ${ethers.formatEther(ethBidAmount)} ETH`);
        
        // 9. 用户1使用USDC出价
        console.log("\n=== 9. 用户1使用USDC出价 ===");
        const usdcBidAmount = ethers.parseUnits("200", 6); // 200 USDC
        const usdcContractUser1 = usdcContract.connect(user1);
        
        // 授权USDC给拍卖合约
        await usdcContractUser1.approve(contracts.nftAuction, usdcBidAmount);
        
        const usdcBidTx = await auctionContractUser1.bidWithERC20(
            auctionId,
            contracts.mockUSDC,
            usdcBidAmount
        );
        await usdcBidTx.wait();
        console.log(`USDC出价完成: ${ethers.formatUnits(usdcBidAmount, 6)} USDC`);
        
        // 10. 查看更新后的拍卖信息
        console.log("\n=== 10. 更新后的拍卖信息 ===");
        const updatedAuction = await auctionContract.getAuction(auctionId);
        console.log(`最高出价者: ${updatedAuction.highestBidder}`);
        console.log(`最高出价(USD): ${ethers.formatEther(updatedAuction.highestBidUSD)} USD`);
        console.log(`出价代币: ${updatedAuction.bidToken}`);
        console.log(`出价数量: ${updatedAuction.bidToken === ethers.ZeroAddress ? 
            ethers.formatEther(updatedAuction.bidAmount) + ' ETH' : 
            ethers.formatUnits(updatedAuction.bidAmount, 6) + ' USDC'}`);
        
        // 11. 测试工厂合约
        console.log("\n=== 11. 测试工厂合约 ===");
        const factoryTx = await factoryContract.createAuctionContract(
            "测试拍卖市场",
            "这是一个测试拍卖市场",
            ethers.ZeroAddress, // 使用默认价格预言机
            ethers.ZeroAddress  // 使用默认手续费接收者
        );
        const factoryReceipt = await factoryTx.wait();
        
        const contractCreatedEvent = factoryReceipt.logs.find(
            log => log.fragment && log.fragment.name === "AuctionContractCreated"
        );
        const newContractId = contractCreatedEvent.args[0];
        const newContractAddress = contractCreatedEvent.args[1];
        console.log(`新拍卖合约创建完成`);
        console.log(`合约ID: ${newContractId}`);
        console.log(`合约地址: ${newContractAddress}`);
        
        // 12. 测试可升级合约
        console.log("\n=== 12. 测试可升级合约 ===");
        const version = await upgradeableContract.getVersion();
        const implementation = await upgradeableContract.getImplementation();
        console.log(`当前版本: ${version}`);
        console.log(`实现合约地址: ${implementation}`);
        
        // 13. 查看活跃拍卖
        console.log("\n=== 13. 活跃拍卖列表 ===");
        const activeAuctions = await auctionContract.getActiveAuctions();
        console.log(`活跃拍卖数量: ${activeAuctions.length}`);
        activeAuctions.forEach((id, index) => {
            console.log(`拍卖 ${index + 1}: ID ${id}`);
        });
        
        // 14. 查看用户拍卖历史
         console.log("\n=== 14. 用户拍卖历史 ===");
         const user1Auctions = await auctionContract.getUserAuctions(user1.address);
         const user1Bids = await auctionContract.getUserBids(user1.address);
        const user2Bids = await auctionContract.getUserBids(user2.address);
        
        console.log(`用户1创建的拍卖: ${user1Auctions.length}`);
        console.log(`用户1参与的出价: ${user1Bids.length}`);
        console.log(`用户2参与的出价: ${user2Bids.length}`);
        
        console.log("\n=== 交互测试完成 ===");
        console.log("所有功能测试正常！");
        
    } catch (error) {
        console.error("交互测试失败:", error);
        throw error;
    }
}

// 辅助函数：结束拍卖
async function endAuction(auctionId) {
    const deployment = loadDeployment();
    const auctionContract = await ethers.getContractAt("NFTAuction", deployment.contracts.nftAuction);
    
    console.log(`\n结束拍卖 ${auctionId}...`);
    const tx = await auctionContract.endAuction(auctionId);
    await tx.wait();
    console.log("拍卖结束完成");
    
    const auction = await auctionContract.getAuction(auctionId);
    console.log(`获胜者: ${auction.highestBidder}`);
    console.log(`成交价: ${ethers.formatEther(auction.highestBidUSD)} USD`);
}

// 辅助函数：查看余额
async function checkBalances() {
    const [deployer, user1, user2] = await ethers.getSigners();
    const deployment = loadDeployment();
    const usdcContract = await ethers.getContractAt("MockERC20", deployment.contracts.mockUSDC);
    
    console.log("\n=== 账户余额 ===");
    
    for (const [name, signer] of [["部署者", deployer], ["用户1", user1], ["用户2", user2]]) {
        const ethBalance = await ethers.provider.getBalance(signer.address);
        const usdcBalance = await usdcContract.balanceOf(signer.address);
        
        console.log(`${name} (${signer.address}):`);
        console.log(`  ETH: ${ethers.formatEther(ethBalance)}`);
        console.log(`  USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
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

module.exports = { main, endAuction, checkBalances };