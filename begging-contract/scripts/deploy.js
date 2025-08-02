const hre = require("hardhat");

async function main() {
  console.log("开始部署 BeggingContract...");

  // 获取合约工厂
  const BeggingContract = await hre.ethers.getContractFactory("BeggingContract");
  
  // 部署合约
  const beggingContract = await BeggingContract.deploy();
  
  // 等待部署完成
  await beggingContract.waitForDeployment();
  
  // 获取合约地址
  const contractAddress = await beggingContract.getAddress();
  
  console.log("BeggingContract 部署成功!");
  console.log("合约地址:", contractAddress);
  console.log("合约所有者:", await beggingContract.getOwner());
  
  return contractAddress;
}

// 运行部署脚本
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  }); 