const { ethers } = require("hardhat");
require("dotenv").config({ path: "../.env" });

async function main() {
  const name = process.env.TOKEN_NAME || "MemeToken";
  const symbol = process.env.TOKEN_SYMBOL || "MEME";
  const liquidityWallet = process.env.LIQ_WALLET || (await ethers.getSigners())[0].address;
  const marketingWallet = process.env.MKT_WALLET || (await ethers.getSigners())[0].address;
  const router = process.env.UNISWAP_V2_ROUTER || ethers.ZeroAddress;

  if (router === ethers.ZeroAddress) {
    console.warn("[WARN] 未设置 UNISWAP_V2_ROUTER，建议在 .env 中配置测试网路由地址。");
  }

  const MemeToken = await ethers.getContractFactory("MemeToken");
  const token = await MemeToken.deploy(name, symbol, liquidityWallet, marketingWallet, router);
  await token.waitForDeployment();

  console.log("MemeToken deployed at:", await token.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});