const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MemeToken", function () {
  let owner, user, mkt, liq, pair, router;
  let token;

  beforeEach(async function () {
    [owner, user, mkt, liq, pair, router] = await ethers.getSigners();
    const MemeToken = await ethers.getContractFactory("MemeToken");
    token = await MemeToken.deploy("MemeToken", "MEME", liq.address, mkt.address, router.address);
    await token.waitForDeployment();
    await token.setTradingEnabled(true);
    // 新增：测试中关闭交易频率限制，避免冷却时间等影响既有用例
    await token.updateFrequencyLimits(false, 0, false, 1000);
  });

  describe("基础功能", function () {
    it("should mint max supply to owner", async function () {
      const total = await token.totalSupply();
      expect(await token.balanceOf(owner.address)).to.equal(total);
    });

    it("should take transfer tax on normal transfer when not excluded", async function () {
      // 确保转出地址不在免税名单
      await token.setExcludedFromTax(owner.address, false);

      const amount = ethers.parseEther("1000");
      await token.transfer(user.address, amount);
      const transferTax = await token.transferTaxRate();
      const tax = amount * transferTax / 10000n;
      const received = amount - tax;
      expect(await token.balanceOf(user.address)).to.equal(received);
      expect(await token.balanceOf(await token.getAddress())).to.be.greaterThan(0);
    });

    it("owner can update tax rates and limits", async function () {
      await token.updateTaxRates(300, 500, 100);
      const [buy, sell, transfer] = await token.getTaxInfo();
      expect(buy).to.equal(300);
      expect(sell).to.equal(500);
      expect(transfer).to.equal(100);

      await token.updateLimits(2, 3);
      const [maxTx, maxWallet] = await token.getLimitsInfo();
      expect(maxTx).to.equal(await token.MAX_SUPPLY() * 2n / 100n);
      expect(maxWallet).to.equal(await token.MAX_SUPPLY() * 3n / 100n);
    });
  });

  describe("买入/卖出税路径", function () {
    beforeEach(async function () {
      // 设置 AMM 交易对
      await token.setAMMPair(pair.address, true);
      // 给交易对一些代币
      await token.transfer(pair.address, ethers.parseEther("1000000"));
      // 确保 owner 不在免税名单
      await token.setExcludedFromTax(owner.address, false);
    });

    it("should apply buy tax when buying from AMM pair", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(pair).transfer(user.address, amount);
      
      const buyTax = await token.buyTaxRate();
      const tax = amount * buyTax / 10000n;
      const received = amount - tax;
      
      expect(await token.balanceOf(user.address)).to.equal(received);
      expect(await token.balanceOf(await token.getAddress())).to.be.greaterThan(0);
    });

    it("should apply sell tax when selling to AMM pair", async function () {
      const amount = ethers.parseEther("1000");
      // 先给用户足够的代币
      await token.transfer(user.address, amount * 2n);
      await token.setExcludedFromTax(user.address, false);
      
      const initialPairBalance = await token.balanceOf(pair.address);
      await token.connect(user).transfer(pair.address, amount);
      
      const sellTax = await token.sellTaxRate();
      const tax = amount * sellTax / 10000n;
      const received = amount - tax;
      const finalPairBalance = await token.balanceOf(pair.address);
      
      // 检查交易对收到的代币（减去税费）
      expect(finalPairBalance - initialPairBalance).to.equal(received);
    });
  });

  describe("交易限制", function () {
    beforeEach(async function () {
      await token.setAMMPair(pair.address, true);
      await token.transfer(pair.address, ethers.parseEther("10000000"));
      await token.setExcludedFromLimits(owner.address, false);
    });

    it("should enforce max transaction amount", async function () {
      const maxTx = await token.maxTransactionAmount();
      const overLimit = maxTx + 1n;
      
      await expect(token.transfer(user.address, overLimit))
        .to.be.revertedWith("Transfer amount exceeds limit");
    });

    it("should enforce max wallet amount on buy", async function () {
      // 先设置较小的钱包限制用于测试
      await token.updateLimits(50, 1); // 1% 钱包限制
      const maxWallet = await token.maxWalletAmount();
      const overLimit = maxWallet + ethers.parseEther("1000");
      
      await expect(token.connect(pair).transfer(user.address, overLimit))
        .to.be.revertedWith("Wallet amount exceeds limit");
    });

    it("should allow excluded addresses to bypass limits", async function () {
      await token.setExcludedFromLimits(user.address, true);
      const maxTx = await token.maxTransactionAmount();
      const overLimit = maxTx + 1n;
      
      await expect(token.transfer(user.address, overLimit)).to.not.be.reverted;
    });
  });

  describe("黑名单功能", function () {
    it("should prevent blacklisted addresses from trading", async function () {
      await token.setBlacklisted(user.address, true);
      
      await expect(token.transfer(user.address, ethers.parseEther("100")))
        .to.be.revertedWith("Blacklisted address");
      
      await expect(token.connect(user).transfer(owner.address, ethers.parseEther("100")))
        .to.be.revertedWith("Blacklisted address");
    });
  });

  describe("自动换币与分配", function () {
    beforeEach(async function () {
      await token.setExcludedFromTax(owner.address, false);
    });

    it("should trigger swapAndLiquify when threshold reached", async function () {
      // 降低阈值，便于在测试中快速触发
      await token.setSwapTokensAtAmount(ethers.parseEther("1000"));

      const initialMktBalance = await token.balanceOf(mkt.address);
      const initialLiqBalance = await token.balanceOf(liq.address);
      const initialTotalBurned = await token.totalBurned();

      const transferAmount = ethers.parseEther("100000"); // 每次转账 10 万，按 2% 税每次累积 2000 代币

      // 第一次转账：累积税费到合约
      await token.transfer(user.address, transferAmount);
      // 第二次转账：由于上次已达到阈值，这次进入时会触发自动分配
      await token.transfer(user.address, transferAmount);

      const finalMktBalance = await token.balanceOf(mkt.address);
      expect(finalMktBalance).to.be.greaterThan(initialMktBalance);

      const finalLiqBalance = await token.balanceOf(liq.address);
      expect(finalLiqBalance).to.be.greaterThan(initialLiqBalance);

      const finalTotalBurned = await token.totalBurned();
      expect(finalTotalBurned).to.be.greaterThan(initialTotalBurned);
    });

    it("should allow manual swap and liquify", async function () {
      // 先累积一些税费
      await token.transfer(user.address, ethers.parseEther("100000"));
      
      const contractBalance = await token.balanceOf(await token.getAddress());
      expect(contractBalance).to.be.greaterThan(0);
      
      await token.manualSwapAndLiquify();
      
      const contractBalanceAfter = await token.balanceOf(await token.getAddress());
      expect(contractBalanceAfter).to.equal(0);
    });
  });

  describe("税费分配更新", function () {
    it("should update tax distribution correctly", async function () {
      await token.updateTaxDistribution(5000, 3000, 2000); // 50%, 30%, 20%
      
      const [, , , liquidity, marketing, burn] = await token.getTaxInfo();
      expect(liquidity).to.equal(5000);
      expect(marketing).to.equal(3000);
      expect(burn).to.equal(2000);
    });

    it("should revert if distribution doesn't sum to 100%", async function () {
      await expect(token.updateTaxDistribution(5000, 3000, 1000)) // 90% total
        .to.be.revertedWith("Shares must sum to 100%");
    });

    it("should enforce tax rate limits", async function () {
      await expect(token.updateTaxRates(1100, 500, 200)) // 11% buy tax
        .to.be.revertedWith("Buy tax too high");
      
      await expect(token.updateTaxRates(500, 1600, 200)) // 16% sell tax
        .to.be.revertedWith("Sell tax too high");
      
      await expect(token.updateTaxRates(500, 800, 600)) // 6% transfer tax
        .to.be.revertedWith("Transfer tax too high");
    });
  });

  describe("紧急提取功能", function () {
    it("should allow owner to emergency withdraw ETH", async function () {
      // 给合约发送一些 ETH
      await owner.sendTransaction({
        to: await token.getAddress(),
        value: ethers.parseEther("1")
      });
      
      const contractETHBalance = await ethers.provider.getBalance(await token.getAddress());
      expect(contractETHBalance).to.equal(ethers.parseEther("1"));
      
      await token.emergencyWithdrawETH();
      
      const contractETHBalanceAfter = await ethers.provider.getBalance(await token.getAddress());
      expect(contractETHBalanceAfter).to.equal(0);
    });

    it("should revert emergency withdraw ETH when no balance", async function () {
      await expect(token.emergencyWithdrawETH())
        .to.be.revertedWith("No ETH to withdraw");
    });

    it("should revert emergency withdraw tokens for own token", async function () {
      await expect(token.emergencyWithdrawTokens(await token.getAddress()))
        .to.be.revertedWith("Cannot withdraw own tokens");
    });

    it("should only allow owner to call emergency functions", async function () {
      await expect(token.connect(user).emergencyWithdrawETH())
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
      
      await expect(token.connect(user).manualSwapAndLiquify())
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
        .withArgs(user.address);
    });
  });

  describe("查询函数", function () {
    it("should return correct tax info", async function () {
      const [buy, sell, transfer, liq, mkt, burn] = await token.getTaxInfo();
      expect(buy).to.equal(500);
      expect(sell).to.equal(800);
      expect(transfer).to.equal(200);
      expect(liq).to.equal(4000);
      expect(mkt).to.equal(3000);
      expect(burn).to.equal(3000);
    });

    it("should return correct limits info", async function () {
      const [maxTx, maxWallet, swapThreshold] = await token.getLimitsInfo();
      const maxSupply = await token.MAX_SUPPLY();
      expect(maxTx).to.equal(maxSupply * 1n / 100n);
      expect(maxWallet).to.equal(maxSupply * 2n / 100n);
      expect(swapThreshold).to.equal(maxSupply * 5n / 10000n);
    });

    it("should return correct stats", async function () {
      const [totalSupply_, totalTaxCollected_, totalBurned_, tradingEnabled_, swapEnabled_] = await token.getStats();
      expect(totalSupply_).to.equal(await token.totalSupply());
      expect(totalTaxCollected_).to.equal(await token.totalTaxCollected());
      expect(totalBurned_).to.equal(await token.totalBurned());
      expect(tradingEnabled_).to.equal(true);
      expect(swapEnabled_).to.equal(true);
    });
  });
});