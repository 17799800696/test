const hre = require("hardhat");

async function main() {
  console.log("=== BeggingContract 交互脚本 ===\n");

  // 合约地址（部署后需要更新）
  const CONTRACT_ADDRESS = "0x265955CcD91D63D65c6aC2705372A16955Ac09Cf";
  
  // 获取签名者
  const [owner, user1, user2] = await hre.ethers.getSigners();
  
  console.log("当前用户:", owner.address);
  console.log("用户1:", user1.address);
  console.log("用户2:", user2.address);
  console.log("合约地址:", CONTRACT_ADDRESS);
  console.log("");

  // 连接到已部署的合约
  const BeggingContract = await hre.ethers.getContractFactory("BeggingContract");
  const contract = BeggingContract.attach(CONTRACT_ADDRESS);

  // 显示菜单
  console.log("请选择操作:");
  console.log("1. 查看合约信息");
  console.log("2. 捐赠以太币");
  console.log("3. 查询捐赠金额");
  console.log("4. 提取资金（仅所有者）");
  console.log("5. 查看合约余额");
  console.log("6. 退出");
  console.log("");

  // 这里可以添加交互逻辑
  // 由于这是脚本示例，我们直接执行一些基本操作
  
  console.log("=== 合约信息 ===");
  const contractOwner = await contract.getOwner();
  const contractBalance = await contract.getContractBalance();
  
  console.log("合约所有者:", contractOwner);
  console.log("合约余额:", hre.ethers.formatEther(contractBalance), "ETH");
  console.log("当前用户是否为所有者:", contractOwner === owner.address);
  
  console.log("\n=== 捐赠测试 ===");
  const donationAmount = hre.ethers.parseEther("0.01"); // 0.01 ETH
  
  try {
    console.log("用户1捐赠", hre.ethers.formatEther(donationAmount), "ETH");
    const tx = await contract.connect(user1).donate({ value: donationAmount });
    await tx.wait();
    console.log("✅ 捐赠成功!");
    
    // 查询捐赠金额
    const donation = await contract.getDonation(user1.address);
    console.log("用户1的捐赠金额:", hre.ethers.formatEther(donation), "ETH");
    
    // 查看合约余额
    const newBalance = await contract.getContractBalance();
    console.log("合约新余额:", hre.ethers.formatEther(newBalance), "ETH");
    
  } catch (error) {
    console.log("❌ 捐赠失败:", error.message);
  }
  
  console.log("\n=== 权限测试 ===");
  try {
    // 非所有者尝试提款
    await contract.connect(user1).withdraw();
    console.log("❌ 权限控制失败");
  } catch (error) {
    console.log("✅ 权限控制正常: 非所有者无法提款");
  }
  
  console.log("\n=== 脚本完成 ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("脚本执行失败:", error);
    process.exit(1);
  }); 