const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MemeToken - 频率限制", function () {
  let owner, user, user2, mkt, liq, pair, router;
  let token;

  beforeEach(async function () {
    [owner, user, user2, mkt, liq, pair, router] = await ethers.getSigners();
    const MemeToken = await ethers.getContractFactory("MemeToken");
    token = await MemeToken.deploy("MemeToken", "MEME", liq.address, mkt.address, router.address);
    await token.waitForDeployment();
    await token.setTradingEnabled(true);
    await token.setAMMPair(pair.address, true);
    
    // 临时将 user 设为免限制，避免转账时记录频率
    await token.setExcludedFromLimits(user.address, true);
    // 保持 owner 免税状态进行转账
    await token.transfer(user.address, ethers.parseEther("10000"));
    // 转账完成后恢复设置
    await token.setExcludedFromTax(owner.address, false);
    await token.setExcludedFromLimits(user.address, false);
  });

  it("冷却时间：连续卖出应因 cooldown 回退，跨时段应成功", async function () {
    // 开启冷却 5s，关闭每日限制
    await token.updateFrequencyLimits(true, 5, false, 1000);

    // 检查配置
    const freqInfo = await token.getFrequencyInfo();
    console.log("冷却配置:", freqInfo);

    // 检查用户余额
    const userBalance = await token.balanceOf(user.address);
    console.log("用户余额:", ethers.formatEther(userBalance));

    // 第一次卖出
    console.log("执行第一次卖出...");
    await expect(token.connect(user).transfer(pair.address, ethers.parseEther("10"))).to.not.be.reverted;
    console.log("第一次卖出成功");

    // 紧接第二次卖出，应该被回退
    console.log("执行第二次卖出（应该失败）...");
    await expect(token.connect(user).transfer(pair.address, ethers.parseEther("1")))
      .to.be.revertedWith("Cooldown: wait");
    console.log("第二次卖出正确被拒绝");

    // 获取当前区块时间
    const blockBefore = await ethers.provider.getBlock('latest');
    console.log("时间旅行前区块时间:", blockBefore.timestamp);

    // 时间旅行 6s（超过冷却时间）
    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []); // 挖掘新区块使时间生效

    // 获取时间旅行后的区块时间
    const blockAfter = await ethers.provider.getBlock('latest');
    console.log("时间旅行后区块时间:", blockAfter.timestamp);
    console.log("时间差:", blockAfter.timestamp - blockBefore.timestamp);

    // 现在应该可以再次卖出
    console.log("执行第三次卖出（应该成功）...");
    await expect(token.connect(user).transfer(pair.address, ethers.parseEther("1"))).to.not.be.reverted;
    console.log("第三次卖出成功");
  });

  it("每日次数：到达上限应回退，跨自然日自动重置", async function () {
    // 关闭冷却，开启每日限制 2 次
    await token.updateFrequencyLimits(false, 0, true, 2);

    // 检查配置
    const freqInfo = await token.getFrequencyInfo();
    console.log("每日配置:", freqInfo);

    // 第一次转账
    await expect(token.connect(user).transfer(user2.address, ethers.parseEther("1"))).to.not.be.reverted;

    // 第二次转账
    await expect(token.connect(user).transfer(user2.address, ethers.parseEther("1"))).to.not.be.reverted;

    // 第三次转账应该被回退
    await expect(token.connect(user).transfer(user2.address, ethers.parseEther("1")))
      .to.be.revertedWith("Daily tx limit exceeded");

    // 时间旅行到第二天
    await ethers.provider.send("evm_increaseTime", [86401]); // 超过 1 天
    await ethers.provider.send("evm_mine"); // 挖掘新区块使时间生效

    // 现在应该可以再次转账（新的一天重置计数）
    await expect(token.connect(user).transfer(user2.address, ethers.parseEther("1"))).to.not.be.reverted;
  });

  it("豁免：owner/合约/营销/流动性/路由/交易对与免限地址不受限", async function () {
    // 开启严格限制：2s 冷却 + 每日 1 次
    await token.updateFrequencyLimits(true, 2, true, 1);

    // owner 转账给 user2 不受限（尽管开了冷却+每日=1）
    await expect(token.transfer(user2.address, ethers.parseEther("100"))).to.not.be.reverted;

    // 将 user2 设为免限后，连续多次向 pair 卖出应不受限制
    await token.setExcludedFromLimits(user2.address, true);
    await token.connect(owner).transfer(user2.address, ethers.parseEther("100"));
    await expect(token.connect(user2).transfer(pair.address, ethers.parseEther("1"))).to.not.be.reverted;
    await expect(token.connect(user2).transfer(pair.address, ethers.parseEther("1"))).to.not.be.reverted;
    await expect(token.connect(user2).transfer(pair.address, ethers.parseEther("1"))).to.not.be.reverted;
  });
});