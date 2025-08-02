const hre = require("hardhat");

async function main() {
  console.log("开始测试 BeggingContract...");

  // 获取签名者
  const [owner, donor1, donor2] = await hre.ethers.getSigners();
  
  console.log("合约所有者:", owner.address);
  console.log("捐赠者1:", donor1.address);
  console.log("捐赠者2:", donor2.address);

  // 部署合约
  const BeggingContract = await hre.ethers.getContractFactory("BeggingContract");
  const beggingContract = await BeggingContract.deploy();
  await beggingContract.waitForDeployment();
  
  const contractAddress = await beggingContract.getAddress();
  console.log("合约地址:", contractAddress);

  // 测试1: 检查初始状态
  console.log("\n=== 测试1: 检查初始状态 ===");
  const initialBalance = await beggingContract.getContractBalance();
  const contractOwner = await beggingContract.getOwner();
  console.log("合约初始余额:", hre.ethers.formatEther(initialBalance), "ETH");
  console.log("合约所有者:", contractOwner);
  console.log("所有者地址:", owner.address);
  console.log("所有者匹配:", contractOwner === owner.address);

  // 测试2: 捐赠功能
  console.log("\n=== 测试2: 捐赠功能 ===");
  const donationAmount1 = hre.ethers.parseEther("0.1"); // 0.1 ETH
  const donationAmount2 = hre.ethers.parseEther("0.05"); // 0.05 ETH

  // 捐赠者1捐赠
  console.log("捐赠者1捐赠", hre.ethers.formatEther(donationAmount1), "ETH");
  const tx1 = await beggingContract.connect(donor1).donate({ value: donationAmount1 });
  await tx1.wait();
  
  // 捐赠者2捐赠
  console.log("捐赠者2捐赠", hre.ethers.formatEther(donationAmount2), "ETH");
  const tx2 = await beggingContract.connect(donor2).donate({ value: donationAmount2 });
  await tx2.wait();

  // 检查捐赠记录
  const donation1 = await beggingContract.getDonation(donor1.address);
  const donation2 = await beggingContract.getDonation(donor2.address);
  console.log("捐赠者1的捐赠金额:", hre.ethers.formatEther(donation1), "ETH");
  console.log("捐赠者2的捐赠金额:", hre.ethers.formatEther(donation2), "ETH");

  // 检查合约余额
  const balanceAfterDonations = await beggingContract.getContractBalance();
  console.log("捐赠后合约余额:", hre.ethers.formatEther(balanceAfterDonations), "ETH");

  // 测试3: 提款功能
  console.log("\n=== 测试3: 提款功能 ===");
  const ownerBalanceBefore = await hre.ethers.provider.getBalance(owner.address);
  console.log("提款前所有者余额:", hre.ethers.formatEther(ownerBalanceBefore), "ETH");

  // 所有者提款
  const withdrawTx = await beggingContract.connect(owner).withdraw();
  await withdrawTx.wait();
  console.log("提款成功!");

  // 检查提款后的状态
  const balanceAfterWithdrawal = await beggingContract.getContractBalance();
  const ownerBalanceAfter = await hre.ethers.provider.getBalance(owner.address);
  console.log("提款后合约余额:", hre.ethers.formatEther(balanceAfterWithdrawal), "ETH");
  console.log("提款后所有者余额:", hre.ethers.formatEther(ownerBalanceAfter), "ETH");

  // 测试4: 权限控制
  console.log("\n=== 测试4: 权限控制 ===");
  try {
    // 非所有者尝试提款
    await beggingContract.connect(donor1).withdraw();
    console.log("❌ 权限控制失败: 非所有者成功提款");
  } catch (error) {
    console.log("✅ 权限控制正常: 非所有者无法提款");
  }

  console.log("\n=== 测试完成 ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("测试失败:", error);
    process.exit(1);
  }); 