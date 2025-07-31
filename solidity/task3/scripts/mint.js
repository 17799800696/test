const { ethers } = require("hardhat");

async function main() {
  console.log("🎨 开始铸造 NFT...");
  
  // 合约地址 (部署后需要更新)
  const CONTRACT_ADDRESS = "0x877C4e8E0F9f3A412810BC6330cAa4A10A34eE65";
  
  // IPFS 元数据 URI (上传到 IPFS 后获得)
  const TOKEN_URI = "ipfs://QmXoaFeihuaTh44aWnpWWK2Aih1zV3QyzwZdpFiwTX5qgH";
  
  // 获取签名者
  const [signer] = await ethers.getSigners();
  console.log("👤 铸造者地址:", signer.address);
  
  // 连接到已部署的合约
  const MyNFT = await ethers.getContractFactory("MyNFT");
  const myNFT = MyNFT.attach(CONTRACT_ADDRESS);
  
  // 铸造 NFT
  console.log("⏳ 正在铸造 NFT...");
  const tx = await myNFT.mintNFT(signer.address, TOKEN_URI);
  const receipt = await tx.wait();
  
  // 获取铸造的 token ID
  const event = receipt.logs.find(log => {
    try {
      const parsed = myNFT.interface.parseLog(log);
      return parsed.name === "NFTMinted";
    } catch {
      return false;
    }
  });
  
  if (event) {
    const parsed = myNFT.interface.parseLog(event);
    const tokenId = parsed.args.tokenId;
    
    console.log("✅ NFT 铸造成功!");
    console.log("🎯 Token ID:", tokenId.toString());
    console.log("📍 合约地址:", CONTRACT_ADDRESS);
    console.log("🔗 元数据 URI:", TOKEN_URI);
    console.log("📝 交易哈希:", tx.hash);
    
    if (network.name === "sepolia") {
      console.log(`\n🌐 在 OpenSea 查看: https://testnets.opensea.io/assets/sepolia/${CONTRACT_ADDRESS}/${tokenId}`);
      console.log(`🔍 在 Etherscan 查看: https://sepolia.etherscan.io/tx/${tx.hash}`);
    } else if (network.name === "goerli") {
      console.log(`\n🌐 在 OpenSea 查看: https://testnets.opensea.io/assets/goerli/${CONTRACT_ADDRESS}/${tokenId}`);
      console.log(`🔍 在 Etherscan 查看: https://goerli.etherscan.io/tx/${tx.hash}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 铸造失败:", error);
    process.exit(1);
  });
