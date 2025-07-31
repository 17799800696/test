const { expect } = require("chai");
const { ethers } = require("hardhat");

// ethers v6+ parseUnits 变更
const parseUnits = (value, decimals) => ethers.parseUnits ? ethers.parseUnits(value, decimals) : ethers.utils.parseUnits(value, decimals);

describe("SimpleERC20", function () {
    let token;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    
    const TOKEN_NAME = "Test Token";
    const TOKEN_SYMBOL = "TEST";
    const TOKEN_DECIMALS = 18;
    const INITIAL_SUPPLY = 1000000;
    const TOTAL_SUPPLY = parseUnits(INITIAL_SUPPLY.toString(), TOKEN_DECIMALS);
    
    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        
        const SimpleERC20 = await ethers.getContractFactory("SimpleERC20");
        token = await SimpleERC20.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS, INITIAL_SUPPLY);
        await token.waitForDeployment();
    });
    
    describe("部署", function () {
        it("应该设置正确的代币信息", async function () {
            expect(await token.name()).to.equal(TOKEN_NAME);
            expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
            expect(await token.decimals()).to.equal(TOKEN_DECIMALS);
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
        });
        
        it("应该将所有代币分配给所有者", async function () {
            expect(await token.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
        });
        
        it("应该设置正确的所有者", async function () {
            expect(await token.owner()).to.equal(owner.address);
        });
    });
    
    describe("转账", function () {
        it("应该能够转账代币", async function () {
            const amount = parseUnits("100", TOKEN_DECIMALS);
            
            await expect(token.transfer(addr1.address, amount))
                .to.emit(token, "Transfer")
                .withArgs(owner.address, addr1.address, amount);
            
            expect(await token.balanceOf(addr1.address)).to.equal(amount);
            expect(await token.balanceOf(owner.address)).to.equal((TOTAL_SUPPLY - amount).toString());
        });
        
        it("应该拒绝余额不足的转账", async function () {
            const amount = (BigInt(TOTAL_SUPPLY) + 1n).toString();
            
            await expect(token.transfer(addr1.address, amount))
                .to.be.revertedWith("SimpleERC20: transfer amount exceeds balance");
        });
        
        it("应该拒绝转账到零地址", async function () {
            const amount = parseUnits("100", TOKEN_DECIMALS);
            
            await expect(token.transfer(ethers.ZeroAddress, amount))
                .to.be.revertedWith("SimpleERC20: transfer to the zero address");
        });
    });
    
    describe("授权", function () {
        it("应该能够授权代币", async function () {
            const amount = parseUnits("100", TOKEN_DECIMALS);
            
            await expect(token.approve(addr1.address, amount))
                .to.emit(token, "Approval")
                .withArgs(owner.address, addr1.address, amount);
            
            expect(await token.allowance(owner.address, addr1.address)).to.equal(amount);
        });
        
        it("应该能够使用 transferFrom", async function () {
            const amount = parseUnits("100", TOKEN_DECIMALS);
            
            await token.approve(addr1.address, amount);
            
            await expect(token.connect(addr1).transferFrom(owner.address, addr2.address, amount))
                .to.emit(token, "Transfer")
                .withArgs(owner.address, addr2.address, amount);
            
            expect(await token.balanceOf(addr2.address)).to.equal(amount);
            expect(await token.allowance(owner.address, addr1.address)).to.equal(0);
        });
    });
    
    describe("增发", function () {
        it("所有者应该能够增发代币", async function () {
            const amount = parseUnits("1000", TOKEN_DECIMALS);
            
            await expect(token.mint(addr1.address, amount))
                .to.emit(token, "Transfer")
                .withArgs(ethers.ZeroAddress, addr1.address, amount)
                .and.to.emit(token, "Mint")
                .withArgs(addr1.address, amount);
            
            expect(await token.balanceOf(addr1.address)).to.equal(amount);
            expect(await token.totalSupply()).to.equal((BigInt(TOTAL_SUPPLY) + BigInt(amount)).toString());
        });
        
        it("非所有者不应该能够增发代币", async function () {
            const amount = parseUnits("1000", TOKEN_DECIMALS);
            
            await expect(token.connect(addr1).mint(addr2.address, amount))
                .to.be.revertedWith("SimpleERC20: caller is not the owner");
        });
    });
});