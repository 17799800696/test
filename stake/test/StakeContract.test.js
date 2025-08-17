import { expect } from "chai";
import hre from "hardhat";
const { ethers, upgrades } = hre;
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("StakeContract", function () {
    // 部署fixture
    async function deployStakeContractFixture() {
        const [owner, user1, user2, user3] = await ethers.getSigners();
        
        // 部署MetaNodeToken
        const MetaNodeToken = await ethers.getContractFactory("MetaNodeToken");
        const metaNodeToken = await MetaNodeToken.deploy(
            "MetaNode Token",
            "MNT",
            ethers.parseEther("1000000") // 100万初始供应量
        );
        
        // 部署MockERC20用于测试
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockToken = await MockERC20.deploy(
            "Mock Token",
            "MOCK",
            ethers.parseEther("1000000")
        );
        
        // 部署StakeContract（可升级）
        const StakeContract = await ethers.getContractFactory("StakeContract");
        const stakeContract = await upgrades.deployProxy(
            StakeContract,
            [
                await metaNodeToken.getAddress(),
                ethers.parseEther("1"), // 每区块1个MetaNode奖励
                0 // 使用当前区块作为开始区块
            ],
            { initializer: "initialize" }
        );
        
        // 将StakeContract设置为MetaNodeToken的铸造者
        await metaNodeToken.addMinter(await stakeContract.getAddress());
        
        // 给用户分发一些测试代币
        await mockToken.transfer(user1.address, ethers.parseEther("10000"));
        await mockToken.transfer(user2.address, ethers.parseEther("10000"));
        await mockToken.transfer(user3.address, ethers.parseEther("10000"));
        
        // 添加默认质押池
        // 池ID 0: ETH质押池
        await stakeContract.addPool(
            ethers.ZeroAddress, // ETH池
            100, // 权重
            ethers.parseEther("0.1"), // 最小质押0.1 ETH
            100 // 锁定100个区块
        );
        
        // 池ID 1: ERC20质押池
        await stakeContract.addPool(
            await mockToken.getAddress(), // ERC20池
            50, // 权重
            ethers.parseEther("10"), // 最小质押10个代币
            50 // 锁定50个区块
        );
        
        return {
            stakeContract,
            metaNodeToken,
            mockToken,
            owner,
            user1,
            user2,
            user3
        };
    }
    
    describe("部署和初始化", function () {
        it("应该正确初始化合约", async function () {
            const { stakeContract, metaNodeToken } = await loadFixture(deployStakeContractFixture);
            
            expect(await stakeContract.metaNodeToken()).to.equal(await metaNodeToken.getAddress());
            expect(await stakeContract.metaNodePerBlock()).to.equal(ethers.parseEther("1"));
            expect(await stakeContract.totalPoolWeight()).to.equal(150); // ETH池权重100 + ERC20池权重50
            expect(await stakeContract.poolLength()).to.equal(2); // 已添加2个池
        });
        
        it("应该设置正确的角色", async function () {
            const { stakeContract, owner } = await loadFixture(deployStakeContractFixture);
            
            const ADMIN_ROLE = await stakeContract.ADMIN_ROLE();
            const UPGRADER_ROLE = await stakeContract.UPGRADER_ROLE();
            
            expect(await stakeContract.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
            expect(await stakeContract.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
        });
    });
    
    describe("池管理", function () {
        it("应该能够添加ETH质押池", async function () {
            const { stakeContract } = await loadFixture(deployStakeContractFixture);
            
            await expect(stakeContract.addPool(
                ethers.ZeroAddress, // ETH池
                100, // 权重
                ethers.parseEther("0.1"), // 最小质押0.1 ETH
                100 // 锁定100个区块
            )).to.emit(stakeContract, "PoolAdded")
              .withArgs(2, ethers.ZeroAddress, 100, ethers.parseEther("0.1"), 100);
            
            expect(await stakeContract.poolLength()).to.equal(3);
            expect(await stakeContract.totalPoolWeight()).to.equal(250);
            
            const pool = await stakeContract.pools(2);
            expect(pool.stTokenAddress).to.equal(ethers.ZeroAddress);
            expect(pool.poolWeight).to.equal(100);
            expect(pool.minDepositAmount).to.equal(ethers.parseEther("0.1"));
            expect(pool.unstakeLockedBlocks).to.equal(100);
        });
        
        it("应该能够添加ERC20质押池", async function () {
            const { stakeContract, mockToken } = await loadFixture(deployStakeContractFixture);
            
            await expect(stakeContract.addPool(
                await mockToken.getAddress(),
                50,
                ethers.parseEther("10"),
                50
            )).to.emit(stakeContract, "PoolAdded")
              .withArgs(2, await mockToken.getAddress(), 50, ethers.parseEther("10"), 50);
            
            const pool = await stakeContract.pools(2);
            expect(pool.stTokenAddress).to.equal(await mockToken.getAddress());
            expect(pool.poolWeight).to.equal(50);
            expect(pool.minDepositAmount).to.equal(ethers.parseEther("10"));
            expect(pool.unstakeLockedBlocks).to.equal(50);
        });
        
        it("应该能够更新池配置", async function () {
            const { stakeContract, mockToken } = await loadFixture(deployStakeContractFixture);
            
            // 先添加一个池
            await expect(stakeContract.addPool(
                await mockToken.getAddress(),
                100,
                ethers.parseEther("10"),
                100
            )).to.emit(stakeContract, "PoolAdded")
              .withArgs(2, await mockToken.getAddress(), 100, ethers.parseEther("10"), 100);
            
            // 更新池配置
            await expect(stakeContract.updatePool(
                2,
                300,
                ethers.parseEther("20"),
                150
            )).to.emit(stakeContract, "PoolUpdated")
              .withArgs(2, 300, ethers.parseEther("20"), 150);
            
            const pool = await stakeContract.pools(2);
            expect(pool.poolWeight).to.equal(300);
            expect(pool.minDepositAmount).to.equal(ethers.parseEther("20"));
            expect(pool.unstakeLockedBlocks).to.equal(150);
            expect(await stakeContract.totalPoolWeight()).to.equal(450); // 100 + 50 + 300
        });
        
        it("非管理员不能添加或更新池", async function () {
            const { stakeContract, user1 } = await loadFixture(deployStakeContractFixture);
            
            await expect(stakeContract.connect(user1).addPool(
                ethers.ZeroAddress,
                100,
                ethers.parseEther("0.1"),
                100
            )).to.be.revertedWith("StakeContract: caller is not admin");
        });
    });
    
    describe("ETH质押功能", function () {
        // 使用已存在的ETH质押池（池ID 0）
        // 不需要beforeEach，因为fixture已经创建了ETH池
        
        it("应该能够质押ETH", async function () {
            const { stakeContract, user1 } = await loadFixture(deployStakeContractFixture);
            
            const stakeAmount = ethers.parseEther("1");
            
            await expect(stakeContract.connect(user1).stake(0, stakeAmount, {
                value: stakeAmount
            })).to.emit(stakeContract, "Staked")
              .withArgs(user1.address, 0, stakeAmount);
            
            const user = await stakeContract.users(0, user1.address);
            expect(user.stAmount).to.equal(stakeAmount);
            
            const pool = await stakeContract.pools(0);
            expect(pool.stTokenAmount).to.equal(stakeAmount);
        });
        
        it("应该拒绝低于最小金额的质押", async function () {
            const { stakeContract, user1 } = await loadFixture(deployStakeContractFixture);
            
            const stakeAmount = ethers.parseEther("0.05"); // 低于最小值0.1
            
            await expect(stakeContract.connect(user1).stake(0, stakeAmount, {
                value: stakeAmount
            })).to.be.revertedWith("StakeContract: amount below minimum");
        });
        
        it("应该拒绝ETH数量不匹配的质押", async function () {
            const { stakeContract, user1 } = await loadFixture(deployStakeContractFixture);
            
            const stakeAmount = ethers.parseEther("1");
            const wrongValue = ethers.parseEther("0.5");
            
            await expect(stakeContract.connect(user1).stake(0, stakeAmount, {
                value: wrongValue
            })).to.be.revertedWith("StakeContract: incorrect ETH amount");
        });
    });
    
    describe("ERC20质押功能", function () {
        it("应该能够质押ERC20代币", async function () {
            const { stakeContract, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            const stakeAmount = ethers.parseEther("100");
            
            // 授权
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            
            await expect(stakeContract.connect(user1).stake(1, stakeAmount))
                .to.emit(stakeContract, "Staked")
                .withArgs(user1.address, 1, stakeAmount);
            
            const user = await stakeContract.users(1, user1.address);
            expect(user.stAmount).to.equal(stakeAmount);
        });
        
        it("应该拒绝未授权的ERC20质押", async function () {
            const { stakeContract, user1 } = await loadFixture(deployStakeContractFixture);
            
            const stakeAmount = ethers.parseEther("100");
            
            await expect(stakeContract.connect(user1).stake(1, stakeAmount))
                .to.be.reverted;
        });
        
        it("ERC20质押时不应该发送ETH", async function () {
            const { stakeContract, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            const stakeAmount = ethers.parseEther("100");
            
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            
            await expect(stakeContract.connect(user1).stake(1, stakeAmount, {
                value: ethers.parseEther("0.1")
            })).to.be.revertedWith("StakeContract: should not send ETH");
        });
    });
    
    describe("解质押功能", function () {
        it("应该能够请求解质押", async function () {
            const { stakeContract, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            // 用户质押一些代币到池ID 1 (ERC20池)
            const stakeAmount = ethers.parseEther("100");
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            await stakeContract.connect(user1).stake(1, stakeAmount);
            
            const unstakeAmount = ethers.parseEther("50");
            const currentBlock = await ethers.provider.getBlockNumber();
            
            await expect(stakeContract.connect(user1).requestUnstake(1, unstakeAmount))
                .to.emit(stakeContract, "UnstakeRequested")
                .withArgs(user1.address, 1, unstakeAmount, currentBlock + 1 + 50);
            
            const user = await stakeContract.users(1, user1.address);
            expect(user.stAmount).to.equal(ethers.parseEther("50")); // 剩余50
            
            const requestsLength = await stakeContract.getUserRequestsLength(1, user1.address);
            expect(requestsLength).to.equal(1);
            
            const [amount, unlockBlock] = await stakeContract.getUserRequest(1, user1.address, 0);
            expect(amount).to.equal(unstakeAmount);
            expect(unlockBlock).to.equal(currentBlock + 1 + 50);
        });
        
        it("应该拒绝超过质押数量的解质押请求", async function () {
            const { stakeContract, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            // 用户质押一些代币到池ID 1 (ERC20池)
            const stakeAmount = ethers.parseEther("100");
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            await stakeContract.connect(user1).stake(1, stakeAmount);
            
            const unstakeAmount = ethers.parseEther("200"); // 超过质押的100
            
            await expect(stakeContract.connect(user1).requestUnstake(1, unstakeAmount))
                .to.be.revertedWith("StakeContract: insufficient staked amount");
        });
        
        it("应该能够在锁定期后执行解质押", async function () {
            const { stakeContract, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            // 用户质押一些代币到池ID 1 (ERC20池)
            const stakeAmount = ethers.parseEther("100");
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            await stakeContract.connect(user1).stake(1, stakeAmount);
            
            const unstakeAmount = ethers.parseEther("50");
            
            // 请求解质押
            await stakeContract.connect(user1).requestUnstake(1, unstakeAmount);
            
            // 挖掘50个区块以通过锁定期
            await time.advanceBlockTo(await ethers.provider.getBlockNumber() + 50);
            
            const balanceBefore = await mockToken.balanceOf(user1.address);
            
            await expect(stakeContract.connect(user1).unstake(1, 0))
                .to.emit(stakeContract, "Unstaked")
                .withArgs(user1.address, 1, unstakeAmount);
            
            const balanceAfter = await mockToken.balanceOf(user1.address);
            expect(balanceAfter - balanceBefore).to.equal(unstakeAmount);
            
            // 请求应该被移除
            const requestsLength = await stakeContract.getUserRequestsLength(1, user1.address);
            expect(requestsLength).to.equal(0);
        });
        
        it("应该拒绝在锁定期内的解质押", async function () {
            const { stakeContract, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            // 用户质押一些代币到池ID 1 (ERC20池)
            const stakeAmount = ethers.parseEther("100");
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            await stakeContract.connect(user1).stake(1, stakeAmount);
            
            const unstakeAmount = ethers.parseEther("50");
            
            // 请求解质押
            await stakeContract.connect(user1).requestUnstake(1, unstakeAmount);
            
            // 立即尝试解质押
            await expect(stakeContract.connect(user1).unstake(1, 0))
                .to.be.revertedWith("StakeContract: still locked");
        });
    });
    
    describe("奖励功能", function () {
        beforeEach(async function () {
            const { stakeContract, mockToken, user1, user2 } = await loadFixture(deployStakeContractFixture);
            
            // 用户质押到已存在的池
            const stakeAmount = ethers.parseEther("100");
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            await stakeContract.connect(user1).stake(1, stakeAmount); // ERC20池
            
            await stakeContract.connect(user2).stake(0, ethers.parseEther("1"), {
                value: ethers.parseEther("1")
            }); // ETH池
        });
        
        it("应该正确计算待领取奖励", async function () {
            const { stakeContract, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            // 用户质押一些代币到池ID 1 (ERC20池)
            const stakeAmount = ethers.parseEther("100");
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            await stakeContract.connect(user1).stake(1, stakeAmount);
            
            // 挖掘一些区块
            await time.advanceBlockTo(await ethers.provider.getBlockNumber() + 10);
            
            const pendingReward = await stakeContract.pendingReward(1, user1.address);
            expect(pendingReward).to.be.gt(0);
        });
        
        it("应该能够领取奖励", async function () {
            const { stakeContract, metaNodeToken, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            // 用户质押一些代币到池ID 1 (ERC20池)
            const stakeAmount = ethers.parseEther("100");
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            await stakeContract.connect(user1).stake(1, stakeAmount);
            
            // 挖掘一些区块
            await time.advanceBlockTo(await ethers.provider.getBlockNumber() + 10);
            
            const pendingBefore = await stakeContract.pendingReward(1, user1.address);
            const balanceBefore = await metaNodeToken.balanceOf(user1.address);
            
            await expect(stakeContract.connect(user1).claimReward(1))
                .to.emit(stakeContract, "RewardClaimed");
            
            const balanceAfter = await metaNodeToken.balanceOf(user1.address);
            expect(balanceAfter - balanceBefore).to.be.gt(0);
            
            const pendingAfter = await stakeContract.pendingReward(1, user1.address);
            expect(pendingAfter).to.equal(0);
        });
        
        it("没有奖励时不能领取", async function () {
            const { stakeContract, user1 } = await loadFixture(deployStakeContractFixture);
            
            // 用户没有质押任何代币，直接尝试领取奖励
            await expect(stakeContract.connect(user1).claimReward(1))
                .to.be.revertedWith("StakeContract: no reward to claim");
        });
    });
    
    describe("管理功能", function () {
        it("应该能够设置每区块奖励", async function () {
            const { stakeContract } = await loadFixture(deployStakeContractFixture);
            
            const newReward = ethers.parseEther("2");
            await stakeContract.setMetaNodePerBlock(newReward);
            
            expect(await stakeContract.metaNodePerBlock()).to.equal(newReward);
        });
        
        it("应该能够暂停和恢复操作", async function () {
            const { stakeContract } = await loadFixture(deployStakeContractFixture);
            
            // 暂停质押操作
            await expect(stakeContract.setOperationPaused("stake", true))
                .to.emit(stakeContract, "OperationPausedChanged")
                .withArgs("stake", true);
            
            expect(await stakeContract.operationPaused("stake")).to.be.true;
            
            // 恢复质押操作
            await stakeContract.setOperationPaused("stake", false);
            expect(await stakeContract.operationPaused("stake")).to.be.false;
        });
        
        it("应该能够暂停整个合约", async function () {
            const { stakeContract, user1 } = await loadFixture(deployStakeContractFixture);
            
            await stakeContract.pause();
            expect(await stakeContract.paused()).to.be.true;
            
            // 暂停时不能质押
            await expect(stakeContract.connect(user1).stake(0, ethers.parseEther("1"), {
                value: ethers.parseEther("1")
            })).to.be.reverted;
            
            // 恢复合约
            await stakeContract.unpause();
            expect(await stakeContract.paused()).to.be.false;
        });
        
        it("应该能够紧急提取", async function () {
            const { stakeContract, mockToken, owner } = await loadFixture(deployStakeContractFixture);
            
            // 向合约发送一些代币
            const amount = ethers.parseEther("100");
            await mockToken.transfer(await stakeContract.getAddress(), amount);
            
            const balanceBefore = await mockToken.balanceOf(owner.address);
            
            await stakeContract.emergencyWithdraw(await mockToken.getAddress(), amount);
            
            const balanceAfter = await mockToken.balanceOf(owner.address);
            expect(balanceAfter - balanceBefore).to.equal(amount);
        });
        
        it("非管理员不能执行管理操作", async function () {
            const { stakeContract, user1 } = await loadFixture(deployStakeContractFixture);
            
            await expect(stakeContract.connect(user1).setMetaNodePerBlock(ethers.parseEther("2")))
                .to.be.revertedWith("StakeContract: caller is not admin");
            
            await expect(stakeContract.connect(user1).pause())
                .to.be.revertedWith("StakeContract: caller is not admin");
            
            await expect(stakeContract.connect(user1).setOperationPaused("stake", true))
                .to.be.revertedWith("StakeContract: caller is not admin");
        });
    });
    
    describe("边界情况和错误处理", function () {
        it("应该拒绝无效的池ID", async function () {
            const { stakeContract, user1 } = await loadFixture(deployStakeContractFixture);
            
            await expect(stakeContract.connect(user1).stake(999, ethers.parseEther("1")))
                .to.be.revertedWith("StakeContract: invalid pool id");
        });
        
        it("应该拒绝无效的请求索引", async function () {
            const { stakeContract, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            // 使用已存在的ERC20池并质押
            const stakeAmount = ethers.parseEther("100");
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            await stakeContract.connect(user1).stake(1, stakeAmount);
            
            await expect(stakeContract.connect(user1).unstake(1, 999))
                .to.be.revertedWith("StakeContract: invalid request index");
        });
        
        it("应该正确处理多个解质押请求", async function () {
            const { stakeContract, mockToken, user1 } = await loadFixture(deployStakeContractFixture);
            
            // 使用已存在的ERC20池并质押
            const stakeAmount = ethers.parseEther("100");
            await mockToken.connect(user1).approve(await stakeContract.getAddress(), stakeAmount);
            await stakeContract.connect(user1).stake(1, stakeAmount);
            
            // 创建多个解质押请求
            await stakeContract.connect(user1).requestUnstake(1, ethers.parseEther("30"));
            await stakeContract.connect(user1).requestUnstake(1, ethers.parseEther("20"));
            await stakeContract.connect(user1).requestUnstake(1, ethers.parseEther("10"));
            
            expect(await stakeContract.getUserRequestsLength(1, user1.address)).to.equal(3);
            
            // 等待锁定期
            await time.advanceBlockTo(await ethers.provider.getBlockNumber() + 50);
            
            // 执行第二个请求（索引1）
            await stakeContract.connect(user1).unstake(1, 1);
            
            // 应该还有2个请求
            expect(await stakeContract.getUserRequestsLength(1, user1.address)).to.equal(2);
        });
    });
});