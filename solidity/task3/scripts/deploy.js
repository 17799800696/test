const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 开始部署 MyNFT 合约...");
  
  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("📝 部署账户:", deployer.address);
  
  // 检查账户余额
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(balance), "ETH");
  
  // 部署合约
  const MyNFT = await ethers.getContractFactory("MyNFT");
  const myNFT = await MyNFT.deploy(
    "Dylan's Awesome NFT",  // NFT集合名称
    "DAN"                   // NFT集合符号
  );
  
  await myNFT.waitForDeployment();
  const contractAddress = await myNFT.getAddress();
  
  console.log("✅ MyNFT 合约部署成功!");
  console.log("📍 合约地址:", contractAddress);
  console.log("🔗 网络:", network.name);
  
  // 验证部署
  console.log("\n🔍 验证合约信息...");
  const name = await myNFT.name();
  const symbol = await myNFT.symbol();
  const owner = await myNFT.owner();
  const nextTokenId = await myNFT.getNextTokenId();
  
  console.log("📛 NFT名称:", name);
  console.log("🏷️  NFT符号:", symbol);
  console.log("👤 合约所有者:", owner);
  console.log("🔢 下一个TokenId:", nextTokenId.toString());
  
  // 保存部署信息
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: network.name,
    deployer: deployer.address,
    name: name,
    symbol: symbol,
    deploymentTime: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };
  
  console.log("\n📋 部署信息:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n🔗 查看合约:");
    if (network.name === "sepolia") {
      console.log(`https://sepolia.etherscan.io/address/${contractAddress}`);
    } else if (network.name === "goerli") {
      console.log(`https://goerli.etherscan.io/address/${contractAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });