import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("MetaNodeToken", function () {
    // 部署fixture
    async function deployMetaNodeTokenFixture() {
        const [owner, minter, user1, user2] = await ethers.getSigners();
        
        const MetaNodeToken = await ethers.getContractFactory("MetaNodeToken");
        const metaNodeToken = await MetaNodeToken.deploy(
            "MetaNode Token",
            "MNT",
            ethers.parseEther("1000000") // 100万初始供应量
        );
        
        return {
            metaNodeToken,
            owner,
            minter,
            user1,
            user2
        };
    }
    
    describe("部署和初始化", function () {
        it("应该正确设置代币信息", async function () {
            const { metaNodeToken, owner } = await loadFixture(deployMetaNodeTokenFixture);
            
            expect(await metaNodeToken.name()).to.equal("MetaNode Token");
            expect(await metaNodeToken.symbol()).to.equal("MNT");
            expect(await metaNodeToken.decimals()).to.equal(18);
            expect(await metaNodeToken.totalSupply()).to.equal(ethers.parseEther("1000000"));
            expect(await metaNodeToken.balanceOf(owner.address)).to.equal(ethers.parseEther("1000000"));
        });
        
        it("应该设置正确的所有者", async function () {
            const { metaNodeToken, owner } = await loadFixture(deployMetaNodeTokenFixture);
            
            expect(await metaNodeToken.owner()).to.equal(owner.address);
        });
        
        it("应该支持零初始供应量", async function () {
            const [owner] = await ethers.getSigners();
            
            const MetaNodeToken = await ethers.getContractFactory("MetaNodeToken");
            const token = await MetaNodeToken.deploy("Test Token", "TEST", 0);
            
            expect(await token.totalSupply()).to.equal(0);
            expect(await token.balanceOf(owner.address)).to.equal(0);
        });
    });
    
    describe("铸造者管理", function () {
        it("应该能够添加铸造者", async function () {
            const { metaNodeToken, minter } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.addMinter(minter.address))
                .to.emit(metaNodeToken, "MinterAdded")
                .withArgs(minter.address);
            
            expect(await metaNodeToken.minters(minter.address)).to.be.true;
        });
        
        it("应该能够移除铸造者", async function () {
            const { metaNodeToken, minter } = await loadFixture(deployMetaNodeTokenFixture);
            
            // 先添加铸造者
            await metaNodeToken.addMinter(minter.address);
            expect(await metaNodeToken.minters(minter.address)).to.be.true;
            
            // 移除铸造者
            await expect(metaNodeToken.removeMinter(minter.address))
                .to.emit(metaNodeToken, "MinterRemoved")
                .withArgs(minter.address);
            
            expect(await metaNodeToken.minters(minter.address)).to.be.false;
        });
        
        it("应该拒绝添加零地址作为铸造者", async function () {
            const { metaNodeToken } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.addMinter(ethers.ZeroAddress))
                .to.be.revertedWith("MetaNodeToken: minter cannot be zero address");
        });
        
        it("应该拒绝重复添加铸造者", async function () {
            const { metaNodeToken, minter } = await loadFixture(deployMetaNodeTokenFixture);
            
            await metaNodeToken.addMinter(minter.address);
            
            await expect(metaNodeToken.addMinter(minter.address))
                .to.be.revertedWith("MetaNodeToken: minter already exists");
        });
        
        it("应该拒绝移除不存在的铸造者", async function () {
            const { metaNodeToken, minter } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.removeMinter(minter.address))
                .to.be.revertedWith("MetaNodeToken: minter does not exist");
        });
        
        it("非所有者不能管理铸造者", async function () {
            const { metaNodeToken, user1, minter } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.connect(user1).addMinter(minter.address))
                .to.be.reverted;
            
            await expect(metaNodeToken.connect(user1).removeMinter(minter.address))
                .to.be.reverted;
        });
    });
    
    describe("铸造功能", function () {
        it("授权的铸造者应该能够铸造代币", async function () {
            const { metaNodeToken, minter, user1 } = await loadFixture(deployMetaNodeTokenFixture);
            
            // 先添加铸造者权限
            await metaNodeToken.addMinter(minter.address);
            
            const mintAmount = ethers.parseEther("1000");
            const balanceBefore = await metaNodeToken.balanceOf(user1.address);
            const totalSupplyBefore = await metaNodeToken.totalSupply();
            
            await metaNodeToken.connect(minter).mint(user1.address, mintAmount);
            
            const balanceAfter = await metaNodeToken.balanceOf(user1.address);
            const totalSupplyAfter = await metaNodeToken.totalSupply();
            
            expect(balanceAfter - balanceBefore).to.equal(mintAmount);
            expect(totalSupplyAfter - totalSupplyBefore).to.equal(mintAmount);
        });
        
        it("应该拒绝向零地址铸造", async function () {
            const { metaNodeToken, minter } = await loadFixture(deployMetaNodeTokenFixture);
            
            // 先添加铸造者权限
            await metaNodeToken.addMinter(minter.address);
            
            await expect(metaNodeToken.connect(minter).mint(ethers.ZeroAddress, ethers.parseEther("1000")))
                .to.be.revertedWith("MetaNodeToken: mint to zero address");
        });
        
        it("应该拒绝铸造零数量", async function () {
            const { metaNodeToken, minter, user1 } = await loadFixture(deployMetaNodeTokenFixture);
            
            // 先添加铸造者权限
            await metaNodeToken.addMinter(minter.address);
            
            await expect(metaNodeToken.connect(minter).mint(user1.address, 0))
                .to.be.revertedWith("MetaNodeToken: mint amount must be greater than 0");
        });
        
        it("非铸造者不能铸造代币", async function () {
            const { metaNodeToken, user1, user2 } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.connect(user1).mint(user2.address, ethers.parseEther("1000")))
                .to.be.revertedWith("MetaNodeToken: caller is not a minter");
        });
        
        it("合约暂停时不能铸造", async function () {
            const { metaNodeToken, minter, user1 } = await loadFixture(deployMetaNodeTokenFixture);
            
            await metaNodeToken.pause();
            
            await expect(metaNodeToken.connect(minter).mint(user1.address, ethers.parseEther("1000")))
                .to.be.reverted;
        });
    });
    
    describe("销毁功能", function () {
        it("应该能够销毁自己的代币", async function () {
            const { metaNodeToken, owner } = await loadFixture(deployMetaNodeTokenFixture);
            
            const burnAmount = ethers.parseEther("1000");
            const balanceBefore = await metaNodeToken.balanceOf(owner.address);
            const totalSupplyBefore = await metaNodeToken.totalSupply();
            
            await metaNodeToken.burn(burnAmount);
            
            const balanceAfter = await metaNodeToken.balanceOf(owner.address);
            const totalSupplyAfter = await metaNodeToken.totalSupply();
            
            expect(balanceBefore - balanceAfter).to.equal(burnAmount);
            expect(totalSupplyBefore - totalSupplyAfter).to.equal(burnAmount);
        });
        
        it("应该拒绝销毁零数量", async function () {
            const { metaNodeToken } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.burn(0))
                .to.be.revertedWith("MetaNodeToken: burn amount must be greater than 0");
        });
        
        it("应该拒绝销毁超过余额的数量", async function () {
            const { metaNodeToken, user1 } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.connect(user1).burn(ethers.parseEther("1")))
                .to.be.reverted;
        });
    });
    
    describe("转账功能", function () {
        it("应该能够正常转账", async function () {
            const { metaNodeToken, owner, user1 } = await loadFixture(deployMetaNodeTokenFixture);
            
            const transferAmount = ethers.parseEther("1000");
            
            await expect(metaNodeToken.transfer(user1.address, transferAmount))
                .to.emit(metaNodeToken, "Transfer")
                .withArgs(owner.address, user1.address, transferAmount);
            
            expect(await metaNodeToken.balanceOf(user1.address)).to.equal(transferAmount);
        });
        
        it("应该能够正常授权转账", async function () {
            const { metaNodeToken, owner, user1, user2 } = await loadFixture(deployMetaNodeTokenFixture);
            
            const transferAmount = ethers.parseEther("1000");
            
            // 授权
            await metaNodeToken.approve(user1.address, transferAmount);
            
            // 授权转账
            await expect(metaNodeToken.connect(user1).transferFrom(owner.address, user2.address, transferAmount))
                .to.emit(metaNodeToken, "Transfer")
                .withArgs(owner.address, user2.address, transferAmount);
            
            expect(await metaNodeToken.balanceOf(user2.address)).to.equal(transferAmount);
        });
        
        it("合约暂停时不能转账", async function () {
            const { metaNodeToken, owner, user1 } = await loadFixture(deployMetaNodeTokenFixture);
            
            await metaNodeToken.pause();
            
            await expect(metaNodeToken.transfer(user1.address, ethers.parseEther("1000")))
                .to.be.reverted;
        });
        
        it("合约暂停时不能授权转账", async function () {
            const { metaNodeToken, owner, user1, user2 } = await loadFixture(deployMetaNodeTokenFixture);
            
            const transferAmount = ethers.parseEther("1000");
            
            // 先授权
            await metaNodeToken.approve(user1.address, transferAmount);
            
            // 暂停合约
            await metaNodeToken.pause();
            
            await expect(metaNodeToken.connect(user1).transferFrom(owner.address, user2.address, transferAmount))
                .to.be.reverted;
        });
    });
    
    describe("暂停功能", function () {
        it("所有者应该能够暂停合约", async function () {
            const { metaNodeToken } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.pause())
                .to.emit(metaNodeToken, "Paused");
            
            expect(await metaNodeToken.paused()).to.be.true;
        });
        
        it("所有者应该能够恢复合约", async function () {
            const { metaNodeToken } = await loadFixture(deployMetaNodeTokenFixture);
            
            await metaNodeToken.pause();
            expect(await metaNodeToken.paused()).to.be.true;
            
            await expect(metaNodeToken.unpause())
                .to.emit(metaNodeToken, "Unpaused");
            
            expect(await metaNodeToken.paused()).to.be.false;
        });
        
        it("非所有者不能暂停合约", async function () {
            const { metaNodeToken, user1 } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.connect(user1).pause())
                .to.be.reverted;
        });
        
        it("非所有者不能恢复合约", async function () {
            const { metaNodeToken, user1 } = await loadFixture(deployMetaNodeTokenFixture);
            
            await metaNodeToken.pause();
            
            await expect(metaNodeToken.connect(user1).unpause())
                .to.be.reverted;
        });
    });
    
    describe("所有权管理", function () {
        it("应该能够转移所有权", async function () {
            const { metaNodeToken, owner, user1 } = await loadFixture(deployMetaNodeTokenFixture);
            
            await expect(metaNodeToken.transferOwnership(user1.address))
                .to.emit(metaNodeToken, "OwnershipTransferred")
                .withArgs(owner.address, user1.address);
            
            expect(await metaNodeToken.owner()).to.equal(user1.address);
        });
        
        it("新所有者应该能够管理铸造者", async function () {
            const { metaNodeToken, user1, minter } = await loadFixture(deployMetaNodeTokenFixture);
            
            // 转移所有权
            await metaNodeToken.transferOwnership(user1.address);
            
            // 新所有者添加铸造者
            await expect(metaNodeToken.connect(user1).addMinter(minter.address))
                .to.emit(metaNodeToken, "MinterAdded")
                .withArgs(minter.address);
            
            expect(await metaNodeToken.minters(minter.address)).to.be.true;
        });
        
        it("原所有者转移所有权后不能管理铸造者", async function () {
            const { metaNodeToken, owner, user1, minter } = await loadFixture(deployMetaNodeTokenFixture);
            
            // 转移所有权
            await metaNodeToken.transferOwnership(user1.address);
            
            // 原所有者不能添加铸造者
            await expect(metaNodeToken.connect(owner).addMinter(minter.address))
                .to.be.reverted;
        });
    });
});