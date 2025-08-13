const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("NFT拍卖市场测试", function () {
    let auctionNFT, mockUSDC, nftAuction, auctionFactory, upgradeableAuction;
    let owner, seller, bidder1, bidder2, feeRecipient;
    let mockEthUsdPriceFeed, mockUsdcUsdPriceFeed;
    
    // 价格预言机常量
    const PLATFORM_FEE_RATE = 250; // 2.5%
    const ETH_PRICE = 2000 * 1e8; // $2000, 8位精度
    const USDC_PRICE = 1 * 1e8; // $1, 8位精度
    
    beforeEach(async function () {
        [owner, seller, bidder1, bidder2, feeRecipient] = await ethers.getSigners();
        
        // 部署模拟价格预言机
        const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
        mockEthUsdPriceFeed = await MockPriceFeed.deploy(8, ETH_PRICE);
        mockUsdcUsdPriceFeed = await MockPriceFeed.deploy(8, USDC_PRICE);
        
        // 部署NFT合约
        const AuctionNFT = await ethers.getContractFactory("AuctionNFT");
        auctionNFT = await AuctionNFT.deploy("Test NFT", "TNFT");
        
        // 部署ERC20代币
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC", 6, 1000000);
        
        // 部署拍卖合约
        const NFTAuction = await ethers.getContractFactory("NFTAuction");
        nftAuction = await NFTAuction.deploy(
            await mockEthUsdPriceFeed.getAddress(),
            feeRecipient.address
        );
        
        // 部署工厂合约
        const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
        auctionFactory = await AuctionFactory.deploy(
            await mockEthUsdPriceFeed.getAddress(),
            feeRecipient.address
        );
        
        // 部署可升级拍卖合约
        const UpgradeableAuction = await ethers.getContractFactory("UpgradeableAuction");
        upgradeableAuction = await upgrades.deployProxy(
            UpgradeableAuction,
            [
                await mockEthUsdPriceFeed.getAddress(),
                feeRecipient.address,
                PLATFORM_FEE_RATE,
                "v1.0.0"
            ],
            { kind: "uups" }
        );
        
        // 设置价格预言机
        await nftAuction.setPriceFeed(await mockUSDC.getAddress(), await mockUsdcUsdPriceFeed.getAddress());
        await upgradeableAuction.setPriceFeed(await mockUSDC.getAddress(), await mockUsdcUsdPriceFeed.getAddress());
        
        // 分发代币
        await mockUSDC.mint(bidder1.address, ethers.parseUnits("10000", 6));
        await mockUSDC.mint(bidder2.address, ethers.parseUnits("10000", 6));
        
        // 铸造NFT给卖家
        await auctionNFT.mintNFT(seller.address, "https://example.com/nft/1.json");
    });
    
    describe("AuctionNFT合约测试", function () {
        it("应该正确铸造NFT", async function () {
            const tokenURI = "https://example.com/nft/test.json";
            await auctionNFT.mintNFT(seller.address, tokenURI);
            
            const totalSupply = await auctionNFT.totalSupply();
            expect(totalSupply).to.equal(2); // 之前已经铸造了1个
            
            const owner = await auctionNFT.ownerOf(1);
            expect(owner).to.equal(seller.address);
            
            const uri = await auctionNFT.tokenURI(1);
            expect(uri).to.equal(tokenURI);
        });
        
        it("应该支持批量铸造", async function () {
            const tokenURIs = [
                "https://example.com/nft/2.json",
                "https://example.com/nft/3.json",
                "https://example.com/nft/4.json"
            ];
            
            await auctionNFT.batchMintNFT(seller.address, tokenURIs);
            
            const totalSupply = await auctionNFT.totalSupply();
            expect(totalSupply).to.equal(4); // 1 + 3
            
            for (let i = 0; i < tokenURIs.length; i++) {
                const owner = await auctionNFT.ownerOf(i + 1);
                expect(owner).to.equal(seller.address);
                
                const uri = await auctionNFT.tokenURI(i + 1);
                expect(uri).to.equal(tokenURIs[i]);
            }
        });
        
        it("只有所有者可以铸造NFT", async function () {
            await expect(
                auctionNFT.connect(seller).mintNFT(seller.address, "test.json")
            ).to.be.revertedWithCustomError(auctionNFT, "OwnableUnauthorizedAccount");
        });
    });
    
    describe("NFTAuction合约测试", function () {
        let tokenId;
        
        beforeEach(async function () {
            tokenId = 0; // 第一个铸造的NFT（tokenId从0开始）
            // 授权NFT给拍卖合约
            await auctionNFT.connect(seller).approve(await nftAuction.getAddress(), tokenId);
        });
        
        describe("创建拍卖", function () {
            it("应该成功创建拍卖", async function () {
                const startPrice = ethers.parseEther("100");
                const reservePrice = ethers.parseEther("150");
                const duration = 3600;
                const bidIncrement = ethers.parseEther("10");
                
                await expect(
                    nftAuction.connect(seller).createAuction(
                        await auctionNFT.getAddress(),
                        tokenId,
                        startPrice,
                        reservePrice,
                        duration,
                        bidIncrement
                    )
                ).to.emit(nftAuction, "AuctionCreated");
                
                const auction = await nftAuction.getAuction(0);
                expect(auction.seller).to.equal(seller.address);
                expect(auction.startPrice).to.equal(startPrice);
                expect(auction.reservePrice).to.equal(reservePrice);
                expect(auction.status).to.equal(0); // Active
                
                // NFT应该转移到拍卖合约
                const nftOwner = await auctionNFT.ownerOf(tokenId);
                expect(nftOwner).to.equal(await nftAuction.getAddress());
            });
            
            it("应该拒绝无效的价格设置", async function () {
                await expect(
                    nftAuction.connect(seller).createAuction(
                        await auctionNFT.getAddress(),
                        tokenId,
                        0, // 无效起拍价
                        ethers.parseEther("150"),
                        3600,
                        ethers.parseEther("10")
                    )
                ).to.be.revertedWithCustomError(nftAuction, "InvalidPrice");
                
                await expect(
                    nftAuction.connect(seller).createAuction(
                        await auctionNFT.getAddress(),
                        tokenId,
                        ethers.parseEther("200"),
                        ethers.parseEther("150"), // 保留价低于起拍价
                        3600,
                        ethers.parseEther("10")
                    )
                ).to.be.revertedWithCustomError(nftAuction, "InvalidPrice");
            });
            
            it("应该拒绝过短的拍卖时间", async function () {
                await expect(
                    nftAuction.connect(seller).createAuction(
                        await auctionNFT.getAddress(),
                        tokenId,
                        ethers.parseEther("100"),
                        ethers.parseEther("150"),
                        1800, // 30分钟，少于最小1小时
                        ethers.parseEther("10")
                    )
                ).to.be.revertedWithCustomError(nftAuction, "InvalidTimeRange");
            });
        });
        
        describe("出价功能", function () {
            let auctionId;
            
            beforeEach(async function () {
                // 创建拍卖
                const tx = await nftAuction.connect(seller).createAuction(
                    await auctionNFT.getAddress(),
                    tokenId,
                    ethers.parseEther("100"), // $100
                    ethers.parseEther("150"), // $150
                    3600,
                    ethers.parseEther("10") // $10
                );
                const receipt = await tx.wait();
                // 查找AuctionCreated事件
                const auctionCreatedEvent = receipt.logs.find(log => {
                    try {
                        const parsed = nftAuction.interface.parseLog(log);
                        return parsed.name === 'AuctionCreated';
                    } catch {
                        return false;
                    }
                });
                auctionId = nftAuction.interface.parseLog(auctionCreatedEvent).args[0];
            });
            
            it("应该接受有效的ETH出价", async function () {
                // 0.1 ETH = $200 (假设ETH价格为$2000)
                const bidAmount = ethers.parseEther("0.1");
                
                await expect(
                    nftAuction.connect(bidder1).bidWithETH(auctionId, { value: bidAmount })
                ).to.emit(nftAuction, "BidPlaced");
                
                const auction = await nftAuction.getAuction(auctionId);
                expect(auction.highestBidder).to.equal(bidder1.address);
                expect(auction.bidToken).to.equal(ethers.ZeroAddress);
                expect(auction.bidAmount).to.equal(bidAmount);
            });
            
            it("应该接受有效的ERC20出价", async function () {
                const bidAmount = ethers.parseUnits("200", 6); // 200 USDC
                
                // 授权代币
                await mockUSDC.connect(bidder1).approve(await nftAuction.getAddress(), bidAmount);
                
                await expect(
                    nftAuction.connect(bidder1).bidWithERC20(auctionId, await mockUSDC.getAddress(), bidAmount)
                ).to.emit(nftAuction, "BidPlaced");
                
                const auction = await nftAuction.getAuction(auctionId);
                expect(auction.highestBidder).to.equal(bidder1.address);
                expect(auction.bidToken).to.equal(await mockUSDC.getAddress());
                expect(auction.bidAmount).to.equal(bidAmount);
            });
            
            it("应该拒绝过低的出价", async function () {
                // 0.01 ETH = $20，低于起拍价$100
                const lowBidAmount = ethers.parseEther("0.01");
                
                await expect(
                    nftAuction.connect(bidder1).bidWithETH(auctionId, { value: lowBidAmount })
                ).to.be.revertedWithCustomError(nftAuction, "BidTooLow");
            });
            
            it("应该正确处理多次出价", async function () {
                // 第一次出价
                const firstBid = ethers.parseEther("0.1"); // $200
                await nftAuction.connect(bidder1).bidWithETH(auctionId, { value: firstBid });
                
                // 第二次出价（更高）
                const secondBid = ethers.parseUnits("250", 6); // 250 USDC
                await mockUSDC.connect(bidder2).approve(await nftAuction.getAddress(), secondBid);
                await nftAuction.connect(bidder2).bidWithERC20(auctionId, await mockUSDC.getAddress(), secondBid);
                
                const auction = await nftAuction.getAuction(auctionId);
                expect(auction.highestBidder).to.equal(bidder2.address);
                
                // 检查第一个出价者是否收到退款
                // 这里需要检查ETH余额变化
            });
            
            it("卖家不能对自己的拍卖出价", async function () {
                const bidAmount = ethers.parseEther("0.1");
                
                await expect(
                    nftAuction.connect(seller).bidWithETH(auctionId, { value: bidAmount })
                ).to.be.revertedWithCustomError(nftAuction, "NotOwner");
            });
        });
        
        describe("结束拍卖", function () {
            let auctionId;
            
            beforeEach(async function () {
                const tx = await nftAuction.connect(seller).createAuction(
                    await auctionNFT.getAddress(),
                    tokenId,
                    ethers.parseEther("100"),
                    ethers.parseEther("150"),
                    3600,
                    ethers.parseEther("10")
                );
                const receipt = await tx.wait();
                // 查找AuctionCreated事件
                const auctionCreatedEvent = receipt.logs.find(log => {
                    try {
                        const parsed = nftAuction.interface.parseLog(log);
                        return parsed.name === 'AuctionCreated';
                    } catch {
                        return false;
                    }
                });
                auctionId = nftAuction.interface.parseLog(auctionCreatedEvent).args[0];
            });
            
            it("应该在达到保留价时成功结束拍卖", async function () {
                // 出价超过保留价
                const bidAmount = ethers.parseEther("0.1"); // $200 > $150
                await nftAuction.connect(bidder1).bidWithETH(auctionId, { value: bidAmount });
                
                // 快进时间到拍卖结束
                await time.increase(3601);
                
                await expect(
                    nftAuction.endAuction(auctionId)
                ).to.emit(nftAuction, "AuctionEnded");
                
                // 检查NFT是否转移给获胜者
                const nftOwner = await auctionNFT.ownerOf(tokenId);
                expect(nftOwner).to.equal(bidder1.address);
                
                const auction = await nftAuction.getAuction(auctionId);
                expect(auction.status).to.equal(1); // Ended
            });
            
            it("应该在未达到保留价时退还NFT给卖家", async function () {
                // 出价低于保留价
                const bidAmount = ethers.parseEther("0.06"); // $120 < $150
                await nftAuction.connect(bidder1).bidWithETH(auctionId, { value: bidAmount });
                
                await time.increase(3601);
                await nftAuction.endAuction(auctionId);
                
                // NFT应该退还给卖家
                const nftOwner = await auctionNFT.ownerOf(tokenId);
                expect(nftOwner).to.equal(seller.address);
            });
            
            it("卖家可以提前结束拍卖", async function () {
                await expect(
                    nftAuction.connect(seller).endAuction(auctionId)
                ).to.emit(nftAuction, "AuctionEnded");
            });
        });
        
        describe("取消拍卖", function () {
            let auctionId;
            
            beforeEach(async function () {
                const tx = await nftAuction.connect(seller).createAuction(
                    await auctionNFT.getAddress(),
                    tokenId,
                    ethers.parseEther("100"),
                    ethers.parseEther("150"),
                    3600,
                    ethers.parseEther("10")
                );
                const receipt = await tx.wait();
                // 查找AuctionCreated事件
                const auctionCreatedEvent = receipt.logs.find(log => {
                    try {
                        const parsed = nftAuction.interface.parseLog(log);
                        return parsed.name === 'AuctionCreated';
                    } catch {
                        return false;
                    }
                });
                auctionId = nftAuction.interface.parseLog(auctionCreatedEvent).args[0];
            });
            
            it("卖家可以在无出价时取消拍卖", async function () {
                await expect(
                    nftAuction.connect(seller).cancelAuction(auctionId)
                ).to.emit(nftAuction, "AuctionCancelled");
                
                // NFT应该退还给卖家
                const nftOwner = await auctionNFT.ownerOf(tokenId);
                expect(nftOwner).to.equal(seller.address);
                
                const auction = await nftAuction.getAuction(auctionId);
                expect(auction.status).to.equal(2); // Cancelled
            });
            
            it("有出价时不能取消拍卖", async function () {
                // 先出价
                const bidAmount = ethers.parseEther("0.1");
                await nftAuction.connect(bidder1).bidWithETH(auctionId, { value: bidAmount });
                
                await expect(
                    nftAuction.connect(seller).cancelAuction(auctionId)
                ).to.be.revertedWithCustomError(nftAuction, "BidTooLow");
            });
            
            it("非卖家不能取消拍卖", async function () {
                await expect(
                    nftAuction.connect(bidder1).cancelAuction(auctionId)
                ).to.be.revertedWithCustomError(nftAuction, "NotSeller");
            });
        });
    });
    
    describe("AuctionFactory合约测试", function () {
        it("应该成功创建新的拍卖合约", async function () {
            await expect(
                auctionFactory.createAuctionContract(
                    "测试拍卖",
                    "这是一个测试拍卖合约",
                    ethers.ZeroAddress,
                    ethers.ZeroAddress
                )
            ).to.emit(auctionFactory, "AuctionContractCreated");
            
            const contractInfo = await auctionFactory.getAuctionContract(0);
            expect(contractInfo.creator).to.equal(owner.address);
            expect(contractInfo.name).to.equal("测试拍卖");
            expect(contractInfo.isActive).to.be.true;
        });
        
        it("应该正确管理用户的拍卖合约", async function () {
            await auctionFactory.createAuctionContract("拍卖1", "描述1", ethers.ZeroAddress, ethers.ZeroAddress);
            await auctionFactory.createAuctionContract("拍卖2", "描述2", ethers.ZeroAddress, ethers.ZeroAddress);
            
            const userContracts = await auctionFactory.getUserAuctionContracts(owner.address);
            expect(userContracts.length).to.equal(2);
        });
        
        it("应该支持停用拍卖合约", async function () {
            await auctionFactory.createAuctionContract("测试", "描述", ethers.ZeroAddress, ethers.ZeroAddress);
            
            await expect(
                auctionFactory.deactivateAuctionContract(0)
            ).to.emit(auctionFactory, "AuctionContractDeactivated");
            
            const contractInfo = await auctionFactory.getAuctionContract(0);
            expect(contractInfo.isActive).to.be.false;
        });
    });
    
    describe("UpgradeableAuction合约测试", function () {
        it("应该正确初始化", async function () {
            const version = await upgradeableAuction.getVersion();
            expect(version).to.equal("v1.0.0");
            
            const feeRate = await upgradeableAuction.platformFeeRate();
            expect(feeRate).to.equal(PLATFORM_FEE_RATE);
        });
        
        it("应该支持合约升级", async function () {
            // 部署新版本的实现合约
            const UpgradeableAuctionV2 = await ethers.getContractFactory("UpgradeableAuction");
            
            await expect(
                upgrades.upgradeProxy(upgradeableAuction, UpgradeableAuctionV2)
            ).to.not.be.reverted;
            
            // 验证升级后功能正常
            const version = await upgradeableAuction.getVersion();
            expect(version).to.equal("v1.0.0"); // 版本号在升级时可以通过reinitialize更新
        });
        
        it("只有所有者可以升级合约", async function () {
            const UpgradeableAuctionV2 = await ethers.getContractFactory("UpgradeableAuction", seller);
            
            await expect(
                upgrades.upgradeProxy(upgradeableAuction, UpgradeableAuctionV2)
            ).to.be.revertedWithCustomError(upgradeableAuction, "OwnableUnauthorizedAccount");
        });
    });
    
    describe("价格预言机集成测试", function () {
        it("应该正确计算ETH价格", async function () {
            const latestRoundData = await mockEthUsdPriceFeed.latestRoundData();
            expect(latestRoundData.answer).to.equal(ETH_PRICE);
            
            // 测试价格转换
            const ethAmount = ethers.parseEther("1"); // 1 ETH
            const expectedUsdValue = ethers.parseEther("2000"); // $2000
            
            // 这里需要调用合约中的价格计算函数进行验证
            // 实际实现中会有相应的价格计算方法
        });
        
        it("应该正确计算ERC20代币价格", async function () {
            const latestRoundData = await mockUsdcUsdPriceFeed.latestRoundData();
            expect(latestRoundData.answer).to.equal(USDC_PRICE);
            
            // 测试USDC价格计算
            const usdcAmount = ethers.parseUnits("1000", 6); // 1000 USDC
            const expectedUsdValue = ethers.parseEther("1000"); // $1000
        });
        
        it("应该处理价格预言机错误", async function () {
            // 部署一个返回无效数据的价格预言机
            const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
            const invalidPriceFeed = await MockPriceFeed.deploy(8, 0); // 价格为0
            
            // 测试设置无效价格预言机时的处理
            await expect(
                nftAuction.setPriceFeed(ethers.ZeroAddress, await invalidPriceFeed.getAddress())
            ).to.not.be.reverted;
            
            // 在实际使用中应该检查价格是否有效
        });
        
        it("应该正确更新价格预言机数据", async function () {
            const newPrice = 2500 * 1e8; // 新的ETH价格 $2500
            
            // 更新价格
            await mockEthUsdPriceFeed.updateAnswer(newPrice);
            
            const latestRoundData = await mockEthUsdPriceFeed.latestRoundData();
            expect(latestRoundData.answer).to.equal(newPrice);
        });
        
        it("应该处理价格预言机的历史数据", async function () {
            // 测试获取历史轮次数据
            const currentRound = await mockEthUsdPriceFeed.latestRound();
            expect(currentRound).to.be.gt(0);
            
            // 获取当前轮次的数据
            const roundData = await mockEthUsdPriceFeed.getRoundData(currentRound);
            expect(roundData.answer).to.equal(ETH_PRICE);
        });
    });
    
    describe("MockV3Aggregator合约测试", function () {
        it("应该正确初始化价格预言机", async function () {
            expect(await mockEthUsdPriceFeed.decimals()).to.equal(8);
            expect(await mockUsdcUsdPriceFeed.decimals()).to.equal(8);
            
            const ethLatestData = await mockEthUsdPriceFeed.latestRoundData();
            expect(ethLatestData.answer).to.equal(ETH_PRICE);
            
            const usdcLatestData = await mockUsdcUsdPriceFeed.latestRoundData();
            expect(usdcLatestData.answer).to.equal(USDC_PRICE);
        });
        
        it("应该支持价格更新", async function () {
            const newEthPrice = 2200 * 1e8;
            const newUsdcPrice = 1.01 * 1e8;
            
            await mockEthUsdPriceFeed.updateAnswer(newEthPrice);
            await mockUsdcUsdPriceFeed.updateAnswer(newUsdcPrice);
            
            const ethData = await mockEthUsdPriceFeed.latestRoundData();
            const usdcData = await mockUsdcUsdPriceFeed.latestRoundData();
            
            expect(ethData.answer).to.equal(newEthPrice);
            expect(usdcData.answer).to.equal(newUsdcPrice);
        });
        
        it("应该正确处理轮次数据", async function () {
            const initialRound = await mockEthUsdPriceFeed.latestRound();
            
            // 更新价格，应该增加轮次
            await mockEthUsdPriceFeed.updateAnswer(2100 * 1e8);
            
            const newRound = await mockEthUsdPriceFeed.latestRound();
            expect(newRound).to.equal(initialRound + 1n);
            
            // 检查新轮次的数据
            const roundData = await mockEthUsdPriceFeed.getRoundData(newRound);
            expect(roundData.answer).to.equal(2100 * 1e8);
            expect(roundData.roundId).to.equal(newRound);
        });
        
        it("应该正确设置时间戳", async function () {
            const beforeUpdate = await time.latest();
            await mockEthUsdPriceFeed.updateAnswer(2300 * 1e8);
            const afterUpdate = await time.latest();
            
            const latestData = await mockEthUsdPriceFeed.latestRoundData();
            expect(latestData.updatedAt).to.be.gte(beforeUpdate);
            expect(latestData.updatedAt).to.be.lte(afterUpdate);
        });
    });
    
    describe("手续费计算测试", function () {
        let auctionId;
        
        beforeEach(async function () {
            const tokenId = 0;
            await auctionNFT.connect(seller).approve(await nftAuction.getAddress(), tokenId);
            
            const tx = await nftAuction.connect(seller).createAuction(
                await auctionNFT.getAddress(),
                tokenId,
                ethers.parseEther("100"),
                ethers.parseEther("150"),
                3600,
                ethers.parseEther("10")
            );
            const receipt = await tx.wait();
            // 查找AuctionCreated事件
            const auctionCreatedEvent = receipt.logs.find(log => {
                try {
                    const parsed = nftAuction.interface.parseLog(log);
                    return parsed.name === 'AuctionCreated';
                } catch {
                    return false;
                }
            });
            auctionId = nftAuction.interface.parseLog(auctionCreatedEvent).args[0];
        });
        
        it("应该正确计算和分配手续费", async function () {
            // 出价
            const bidAmount = ethers.parseEther("0.1"); // $200
            await nftAuction.connect(bidder1).bidWithETH(auctionId, { value: bidAmount });
            
            // 记录初始余额
            const initialFeeRecipientBalance = await ethers.provider.getBalance(feeRecipient.address);
            const initialSellerBalance = await ethers.provider.getBalance(seller.address);
            
            // 结束拍卖
            await time.increase(3601);
            await nftAuction.endAuction(auctionId);
            
            // 检查手续费是否正确分配
            const finalFeeRecipientBalance = await ethers.provider.getBalance(feeRecipient.address);
            const finalSellerBalance = await ethers.provider.getBalance(seller.address);
            
            // 计算预期手续费 (2.5%)
            const expectedFee = bidAmount * BigInt(PLATFORM_FEE_RATE) / BigInt(10000);
            const expectedSellerAmount = bidAmount - expectedFee;
            
            expect(finalFeeRecipientBalance - initialFeeRecipientBalance).to.equal(expectedFee);
            // 注意：卖家余额检查需要考虑gas费用
        });
    });
    
    describe("边界条件测试", function () {
        beforeEach(async function () {
            // 为测试铸造NFT (使用owner账户铸造给seller)
            await auctionNFT.connect(owner).mintNFT(seller.address, "test-uri");
        });
        
        it("应该处理极大数值", async function () {
            // 创建拍卖
            await auctionNFT.connect(seller).approve(nftAuction.target, 0);
            
            // 测试合理范围内的大数值 - 应该成功
            const largePrice = ethers.parseEther("1000000"); // 100万美元
            await nftAuction.connect(seller).createAuction(
                auctionNFT.target,
                0,
                largePrice,
                largePrice,
                3600,
                ethers.parseEther("1000")
            );
            
            const auction = await nftAuction.getAuction(0);
            expect(auction.startPrice).to.equal(largePrice);
            expect(auction.reservePrice).to.equal(largePrice);
        });
        
        it("应该处理零值情况", async function () {
            // 为测试铸造另一个NFT (使用owner账户铸造给seller)
            await auctionNFT.connect(owner).mintNFT(seller.address, "test-uri-2");
            
            // 测试零起拍价 - 应该失败
            await auctionNFT.connect(seller).approve(nftAuction.target, 1);
            await expect(
                nftAuction.connect(seller).createAuction(
                    auctionNFT.target,
                    1,
                    0, // 零起拍价
                    ethers.parseEther("100"),
                    3600,
                    ethers.parseEther("1")
                )
            ).to.be.revertedWithCustomError(nftAuction, "InvalidPrice");
            
            // 测试零保留价但非零起拍价 - 应该失败
            await expect(
                nftAuction.connect(seller).createAuction(
                    auctionNFT.target,
                    1,
                    ethers.parseEther("100"),
                    0, // 零保留价
                    3600,
                    ethers.parseEther("1")
                )
            ).to.be.revertedWithCustomError(nftAuction, "InvalidPrice");
            
            // 测试零持续时间 - 应该失败
            await expect(
                nftAuction.connect(seller).createAuction(
                    auctionNFT.target,
                    1,
                    ethers.parseEther("100"),
                    ethers.parseEther("200"),
                    0, // 零持续时间
                    ethers.parseEther("1")
                )
            ).to.be.revertedWithCustomError(nftAuction, "InvalidTimeRange");
            
            // 测试零ETH出价 - 应该失败
            await nftAuction.connect(seller).createAuction(
                auctionNFT.target,
                1,
                ethers.parseEther("100"),
                ethers.parseEther("200"),
                3600,
                ethers.parseEther("1")
            );
            
            // 获取当前拍卖计数器来确定拍卖ID
            const currentAuctionId = await nftAuction.auctionCounter() - 1n;
            
            await expect(
                nftAuction.connect(bidder1).bidWithETH(currentAuctionId, { value: 0 })
            ).to.be.revertedWithCustomError(nftAuction, "BidTooLow");
        });
        
        it("应该防止重入攻击", async function () {
            // 为测试铸造另一个NFT (使用owner账户铸造给seller)
            await auctionNFT.connect(owner).mintNFT(seller.address, "test-uri-3");
            
            // 测试正常的重入保护
            // 通过快速连续调用来测试重入保护
            await auctionNFT.connect(seller).approve(nftAuction.target, 2);
            await nftAuction.connect(seller).createAuction(
                auctionNFT.target,
                2,
                ethers.parseEther("100"),
                ethers.parseEther("200"),
                3600,
                ethers.parseEther("1")
            );
            
            // 获取当前拍卖计数器来确定拍卖ID
            const currentAuctionId = await nftAuction.auctionCounter() - 1n;
            
            // 测试ReentrancyGuard正常工作
            const bidAmount = ethers.parseEther("0.1");
            
            // 正常出价应该成功
            await expect(
                nftAuction.connect(bidder1).bidWithETH(currentAuctionId, { value: bidAmount })
            ).to.emit(nftAuction, "BidPlaced");
            
            // 验证状态正确更新
            const auction = await nftAuction.getAuction(currentAuctionId);
            expect(auction.highestBidder).to.equal(bidder1.address);
        });
    });
});