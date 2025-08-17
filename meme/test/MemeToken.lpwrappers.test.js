const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MemeToken - 用户级 LP 包装器", function () {
  let owner, user, mkt, liq, routerEOA;
  let token, mockRouter, mockLPToken;

  beforeEach(async function () {
    [owner, user, mkt, liq, routerEOA] = await ethers.getSigners();

    // 部署 Mock Router
    const MockRouter = await ethers.getContractFactory("MockUniswapV2Router");
    mockRouter = await MockRouter.deploy(ethers.ZeroAddress);
    await mockRouter.waitForDeployment();

    // 部署 Mock LP Token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockLPToken = await MockERC20.deploy("Mock LP", "MLP", ethers.parseEther("1000000"));
    await mockLPToken.waitForDeployment();

    // 部署 Token，Router 地址使用 Mock
    const MemeToken = await ethers.getContractFactory("MemeToken");
    token = await MemeToken.deploy("MemeToken", "MEME", liq.address, mkt.address, await mockRouter.getAddress());
    await token.waitForDeployment();

    await token.setTradingEnabled(true);
    // 使用 mockLPToken 地址作为交易对
    await token.setAMMPair(await mockLPToken.getAddress(), true);

    // 关闭频率限制，避免干扰
    await token.updateFrequencyLimits(false, 0, false, 1000);

    // 给用户一些代币
    await token.transfer(user.address, ethers.parseEther("100000"));
  });

  it("userAddLiquidityETH 成功路径应发出事件并不回退", async function () {
    // 设置 Mock 返回值
    await mockRouter.setMockReturnValues(ethers.parseEther("500"), ethers.parseEther("1"), ethers.parseEther("100"));

    await expect(
      token.connect(user).userAddLiquidityETH(
        ethers.parseEther("1000"), // token amount
        0, // tokenAmountMin
        0, // ethAmountMin
        { value: ethers.parseEther("1") }
      )
    ).to.emit(token, "UserAddLiquidity");
  });

  it("userAddLiquidityETH 失败时应退回资产并带原因", async function () {
    await mockRouter.setMockBehavior(true, "Mock failure", false);

    const beforeToken = await token.balanceOf(user.address);

    await expect(
      token.connect(user).userAddLiquidityETH(
        ethers.parseEther("100"),
        0,
        0,
        { value: ethers.parseEther("0.1") }
      )
    ).to.be.revertedWith("AddLiquidity failed: Mock failure");

    const afterToken = await token.balanceOf(user.address);
    expect(afterToken).to.equal(beforeToken);
  });

  it("userRemoveLiquidityETH 成功路径应发出事件", async function () {
    // 给 Mock Router 一些代币和 ETH
    await token.transfer(await mockRouter.getAddress(), ethers.parseEther("1000"));
    await owner.sendTransaction({
      to: await mockRouter.getAddress(),
      value: ethers.parseEther("2")
    });
    
    // 给用户一些 LP 代币
    await mockLPToken.transfer(user.address, ethers.parseEther("20"));
    
    // 用户授权合约使用 LP 代币
    await mockLPToken.connect(user).approve(await token.getAddress(), ethers.parseEther("20"));
    
    await mockRouter.setMockReturnValues(ethers.parseEther("500"), ethers.parseEther("1"), ethers.parseEther("100"));

    await expect(
      token.connect(user).userRemoveLiquidityETH(
        ethers.parseEther("10"),
        0,
        0
      )
    ).to.emit(token, "UserRemoveLiquidity");
  });

  it("userRemoveLiquidityETH 失败应回退并带原因", async function () {
    // 给用户一些 LP 代币
    await mockLPToken.transfer(user.address, ethers.parseEther("20"));
    
    // 用户授权合约使用 LP 代币
    await mockLPToken.connect(user).approve(await token.getAddress(), ethers.parseEther("20"));
    
    await mockRouter.setMockBehavior(true, "Mock remove fail", false);

    await expect(
      token.connect(user).userRemoveLiquidityETH(
        ethers.parseEther("10"),
        0,
        0
      )
    ).to.be.reverted;
  });
});