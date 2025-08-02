const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("BeggingContract", function () {
  let beggingContract;
  let owner;
  let donor1;
  let donor2;
  let donor3;
  let donor4;
  let nonOwner;

  beforeEach(async function () {
    // 获取测试账户
    [owner, donor1, donor2, donor3, donor4, nonOwner] = await ethers.getSigners();

    // 部署合约
    const BeggingContract = await ethers.getContractFactory("BeggingContract");
    beggingContract = await BeggingContract.deploy();
    await beggingContract.waitForDeployment();
  });

  describe("部署测试", function () {
    it("应该正确设置合约所有者", async function () {
      expect(await beggingContract.getOwner()).to.equal(owner.address);
    });

    it("初始合约余额应该为 0", async function () {
      expect(await beggingContract.getContractBalance()).to.equal(0);
    });

    it("初始时间限制应该被禁用", async function () {
      const timeInfo = await beggingContract.getDonationTimeInfo();
      expect(timeInfo.enabled).to.be.false;
    });
  });

  describe("捐赠功能测试", function () {
    it("应该能够接收捐赠", async function () {
      const donationAmount = ethers.parseEther("1.0");
      
      await expect(
        beggingContract.connect(donor1).donate({ value: donationAmount })
      ).to.emit(beggingContract, "Donation")
        .withArgs(donor1.address, donationAmount, anyValue);

      expect(await beggingContract.getDonation(donor1.address)).to.equal(donationAmount);
      expect(await beggingContract.getContractBalance()).to.equal(donationAmount);
    });

    it("应该能够记录多个捐赠者的捐赠", async function () {
      const donation1 = ethers.parseEther("1.0");
      const donation2 = ethers.parseEther("2.0");

      await beggingContract.connect(donor1).donate({ value: donation1 });
      await beggingContract.connect(donor2).donate({ value: donation2 });

      expect(await beggingContract.getDonation(donor1.address)).to.equal(donation1);
      expect(await beggingContract.getDonation(donor2.address)).to.equal(donation2);
      expect(await beggingContract.getContractBalance()).to.equal(donation1 + donation2);
    });

    it("同一捐赠者多次捐赠应该累加", async function () {
      const donation1 = ethers.parseEther("1.0");
      const donation2 = ethers.parseEther("0.5");

      await beggingContract.connect(donor1).donate({ value: donation1 });
      await beggingContract.connect(donor1).donate({ value: donation2 });

      expect(await beggingContract.getDonation(donor1.address)).to.equal(donation1 + donation2);
    });

    it("应该拒绝 0 金额的捐赠", async function () {
      await expect(
        beggingContract.connect(donor1).donate({ value: 0 })
      ).to.be.revertedWith("Donation amount must be greater than 0");
    });

    it("应该正确记录捐赠者到数组中", async function () {
      await beggingContract.connect(donor1).donate({ value: ethers.parseEther("1.0") });
      await beggingContract.connect(donor2).donate({ value: ethers.parseEther("2.0") });
      
      expect(await beggingContract.getDonorCount()).to.equal(2);
      expect(await beggingContract.donors(0)).to.equal(donor1.address);
      expect(await beggingContract.donors(1)).to.equal(donor2.address);
    });

    it("同一捐赠者多次捐赠不应该重复添加到数组", async function () {
      await beggingContract.connect(donor1).donate({ value: ethers.parseEther("1.0") });
      await beggingContract.connect(donor1).donate({ value: ethers.parseEther("0.5") });
      
      expect(await beggingContract.getDonorCount()).to.equal(1);
      expect(await beggingContract.donors(0)).to.equal(donor1.address);
    });
  });

  describe("提取功能测试", function () {
    beforeEach(async function () {
      // 先进行一些捐赠
      await beggingContract.connect(donor1).donate({ value: ethers.parseEther("2.0") });
      await beggingContract.connect(donor2).donate({ value: ethers.parseEther("1.0") });
    });

    it("合约所有者应该能够提取资金", async function () {
      const initialBalance = await beggingContract.getContractBalance();
      
      await expect(
        beggingContract.connect(owner).withdraw()
      ).to.emit(beggingContract, "Withdrawal")
        .withArgs(owner.address, initialBalance, anyValue);

      expect(await beggingContract.getContractBalance()).to.equal(0);
    });

    it("非所有者不应该能够提取资金", async function () {
      await expect(
        beggingContract.connect(donor1).withdraw()
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("余额为 0 时不应该能够提取", async function () {
      // 先提取所有资金
      await beggingContract.connect(owner).withdraw();
      
      // 再次尝试提取应该失败
      await expect(
        beggingContract.connect(owner).withdraw()
      ).to.be.revertedWith("No funds to withdraw");
    });
  });

  describe("查询功能测试", function () {
    it("应该能够查询捐赠金额", async function () {
      const donationAmount = ethers.parseEther("1.5");
      
      await beggingContract.connect(donor1).donate({ value: donationAmount });
      
      expect(await beggingContract.getDonation(donor1.address)).to.equal(donationAmount);
    });

    it("未捐赠的地址查询结果应该为 0", async function () {
      expect(await beggingContract.getDonation(nonOwner.address)).to.equal(0);
    });

    it("应该能够正确查询合约余额", async function () {
      const donation1 = ethers.parseEther("1.0");
      const donation2 = ethers.parseEther("2.0");

      await beggingContract.connect(donor1).donate({ value: donation1 });
      expect(await beggingContract.getContractBalance()).to.equal(donation1);

      await beggingContract.connect(donor2).donate({ value: donation2 });
      expect(await beggingContract.getContractBalance()).to.equal(donation1 + donation2);
    });
  });

  describe("捐赠排行榜功能测试", function () {
    it("应该正确返回前3名捐赠者（按金额排序）", async function () {
      // 设置不同金额的捐赠
      await beggingContract.connect(donor1).donate({ value: ethers.parseEther("1.0") }); // 第3名
      await beggingContract.connect(donor2).donate({ value: ethers.parseEther("3.0") }); // 第1名
      await beggingContract.connect(donor3).donate({ value: ethers.parseEther("2.0") }); // 第2名
      await beggingContract.connect(donor4).donate({ value: ethers.parseEther("0.5") }); // 第4名

      const [topDonors, topAmounts] = await beggingContract.getTopDonors();
      
      // 验证排序正确性
      expect(topDonors[0]).to.equal(donor2.address); // 第1名: 3.0 ETH
      expect(topAmounts[0]).to.equal(ethers.parseEther("3.0"));
      
      expect(topDonors[1]).to.equal(donor3.address); // 第2名: 2.0 ETH
      expect(topAmounts[1]).to.equal(ethers.parseEther("2.0"));
      
      expect(topDonors[2]).to.equal(donor1.address); // 第3名: 1.0 ETH
      expect(topAmounts[2]).to.equal(ethers.parseEther("1.0"));
    });

    it("同一捐赠者多次捐赠应该累加计算排名", async function () {
      await beggingContract.connect(donor1).donate({ value: ethers.parseEther("1.0") });
      await beggingContract.connect(donor1).donate({ value: ethers.parseEther("1.5") }); // 总计 2.5 ETH
      await beggingContract.connect(donor2).donate({ value: ethers.parseEther("2.0") });

      const [topDonors, topAmounts] = await beggingContract.getTopDonors();
      
      expect(topDonors[0]).to.equal(donor1.address); // 第1名: 2.5 ETH
      expect(topAmounts[0]).to.equal(ethers.parseEther("2.5"));
      
      expect(topDonors[1]).to.equal(donor2.address); // 第2名: 2.0 ETH
      expect(topAmounts[1]).to.equal(ethers.parseEther("2.0"));
    });

    it("少于3个捐赠者时应该正确处理", async function () {
      await beggingContract.connect(donor1).donate({ value: ethers.parseEther("1.0") });
      await beggingContract.connect(donor2).donate({ value: ethers.parseEther("2.0") });

      const [topDonors, topAmounts] = await beggingContract.getTopDonors();
      
      expect(topDonors[0]).to.equal(donor2.address);
      expect(topAmounts[0]).to.equal(ethers.parseEther("2.0"));
      
      expect(topDonors[1]).to.equal(donor1.address);
      expect(topAmounts[1]).to.equal(ethers.parseEther("1.0"));
      
      // 第3个位置应该为空
      expect(topDonors[2]).to.equal(ethers.ZeroAddress);
      expect(topAmounts[2]).to.equal(0);
    });

    it("没有捐赠者时应该返回空数组", async function () {
      const [topDonors, topAmounts] = await beggingContract.getTopDonors();
      
      for (let i = 0; i < 3; i++) {
        expect(topDonors[i]).to.equal(ethers.ZeroAddress);
        expect(topAmounts[i]).to.equal(0);
      }
    });
  });

  describe("时间限制功能测试", function () {
    it("所有者应该能够设置捐赠时间窗口", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = currentTime + 100; // 100秒后开始
      const endTime = currentTime + 3600; // 1小时后结束

      await expect(
        beggingContract.connect(owner).setDonationTime(startTime, endTime)
      ).to.emit(beggingContract, "DonationTimeSet")
        .withArgs(startTime, endTime);

      const timeInfo = await beggingContract.getDonationTimeInfo();
      expect(timeInfo.enabled).to.be.true;
      expect(timeInfo.startTime).to.equal(startTime);
      expect(timeInfo.endTime).to.equal(endTime);
    });

    it("非所有者不应该能够设置时间窗口", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = currentTime + 100;
      const endTime = currentTime + 3600;

      await expect(
        beggingContract.connect(donor1).setDonationTime(startTime, endTime)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("应该拒绝无效的时间设置", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      
      // 开始时间晚于结束时间
      await expect(
        beggingContract.connect(owner).setDonationTime(currentTime + 3600, currentTime + 100)
      ).to.be.revertedWith("Start time must be before end time");
      
      // 结束时间在过去
      await expect(
        beggingContract.connect(owner).setDonationTime(currentTime - 3600, currentTime - 100)
      ).to.be.revertedWith("End time must be in the future");
    });

    it("在时间窗口外应该拒绝捐赠", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = currentTime + 3600; // 1小时后开始
      const endTime = currentTime + 7200; // 2小时后结束

      await beggingContract.connect(owner).setDonationTime(startTime, endTime);

      // 在开始时间之前捐赠应该失败
      await expect(
        beggingContract.connect(donor1).donate({ value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Donation period has not started yet");
    });

    it("所有者应该能够禁用时间限制", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = currentTime + 3600;
      const endTime = currentTime + 7200;

      // 先设置时间限制
      await beggingContract.connect(owner).setDonationTime(startTime, endTime);
      
      // 禁用时间限制
      await beggingContract.connect(owner).disableTimeLimit();
      
      const timeInfo = await beggingContract.getDonationTimeInfo();
      expect(timeInfo.enabled).to.be.false;
      
      // 现在应该能够正常捐赠
      await expect(
        beggingContract.connect(donor1).donate({ value: ethers.parseEther("1.0") })
      ).to.not.be.reverted;
    });

    it("fallback函数也应该受时间限制影响", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = currentTime + 3600;
      const endTime = currentTime + 7200;

      await beggingContract.connect(owner).setDonationTime(startTime, endTime);

      // 通过直接转账应该也会失败
      await expect(
        donor1.sendTransaction({
          to: await beggingContract.getAddress(),
          value: ethers.parseEther("1.0")
        })
      ).to.be.revertedWith("Donation period has not started yet");
    });
  });

  describe("Fallback 函数测试", function () {
    it("应该能够通过直接转账接收以太币", async function () {
      const donationAmount = ethers.parseEther("1.0");
      
      await expect(
        donor1.sendTransaction({
          to: await beggingContract.getAddress(),
          value: donationAmount
        })
      ).to.emit(beggingContract, "Donation")
        .withArgs(donor1.address, donationAmount, anyValue);

      expect(await beggingContract.getDonation(donor1.address)).to.equal(donationAmount);
    });

    it("fallback函数也应该正确记录捐赠者", async function () {
      await donor1.sendTransaction({
        to: await beggingContract.getAddress(),
        value: ethers.parseEther("1.0")
      });
      
      expect(await beggingContract.getDonorCount()).to.equal(1);
      expect(await beggingContract.donors(0)).to.equal(donor1.address);
    });
  });
});