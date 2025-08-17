import hre from "hardhat";
const { ethers, upgrades } = hre;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("开始部署质押系统合约...");
    
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("账户余额:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    
    const network = await ethers.provider.getNetwork();
    console.log("网络:", network.name, "(Chain ID:", network.chainId, ")");
    
    // 部署参数
    const INITIAL_SUPPLY = ethers.parseEther("10000000"); // 1000万初始供应量
    const REWARD_PER_BLOCK = ethers.parseEther("1"); // 每区块1个MetaNode奖励
    const START_BLOCK = 0; // 使用当前区块作为开始区块
    
    try {
        // 1. 部署MetaNodeToken
        console.log("\n1. 部署MetaNodeToken...");
        const MetaNodeToken = await ethers.getContractFactory("MetaNodeToken");
        const metaNodeToken = await MetaNodeToken.deploy(
            "MetaNode Token",
            "MNT",
            INITIAL_SUPPLY
        );
        await metaNodeToken.waitForDeployment();
        const metaNodeTokenAddress = await metaNodeToken.getAddress();
        console.log("MetaNodeToken 部署到:", metaNodeTokenAddress);
        
        // 2. 部署StakeContract（可升级代理）
        console.log("\n2. 部署StakeContract（可升级）...");
        const StakeContract = await ethers.getContractFactory("StakeContract");
        const stakeContract = await upgrades.deployProxy(
            StakeContract,
            [
                metaNodeTokenAddress,
                REWARD_PER_BLOCK,
                START_BLOCK
            ],
            { 
                initializer: "initialize",
                kind: "uups" // 使用UUPS代理模式
            }
        );
        await stakeContract.waitForDeployment();
        const stakeContractAddress = await stakeContract.getAddress();
        console.log("StakeContract 代理部署到:", stakeContractAddress);
        
        // 3. 将StakeContract设置为MetaNodeToken的铸造者
        console.log("\n3. 设置StakeContract为MetaNodeToken的铸造者...");
        const addMinterTx = await metaNodeToken.addMinter(stakeContractAddress);
        await addMinterTx.wait();
        console.log("铸造者权限设置完成");
        
        // 4. 部署MockERC20用于测试（仅在测试网络）
        let mockTokenAddress = null;
        if (network.chainId === 1337n || network.chainId === 11155111n) { // Hardhat本地网络或Sepolia
            console.log("\n4. 部署MockERC20测试代币...");
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const mockToken = await MockERC20.deploy(
                "Mock Stake Token",
                "MST",
                ethers.parseEther("1000000") // 100万供应量
            );
            await mockToken.waitForDeployment();
            mockTokenAddress = await mockToken.getAddress();
            console.log("MockERC20 部署到:", mockTokenAddress);
        }
        
        // 5. 添加默认质押池
        console.log("\n5. 添加默认质押池...");
        
        // ETH质押池
        const addEthPoolTx = await stakeContract.addPool(
            ethers.ZeroAddress, // ETH池
            100, // 权重
            ethers.parseEther("0.01"), // 最小质押0.01 ETH
            100 // 锁定100个区块
        );
        await addEthPoolTx.wait();
        console.log("ETH质押池添加完成 (池ID: 0)");
        
        // ERC20测试池（仅在测试网络）
        if (mockTokenAddress) {
            const addTokenPoolTx = await stakeContract.addPool(
                mockTokenAddress,
                200, // 权重
                ethers.parseEther("10"), // 最小质押10个代币
                200 // 锁定200个区块
            );
            await addTokenPoolTx.wait();
            console.log("ERC20测试池添加完成 (池ID: 1)");
        }
        
        // 6. 保存部署信息
        const deploymentInfo = {
            network: {
                name: network.name,
                chainId: network.chainId.toString()
            },
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            blockNumber: await ethers.provider.getBlockNumber(),
            contracts: {
                MetaNodeToken: {
                    address: metaNodeTokenAddress,
                    name: "MetaNode Token",
                    symbol: "MNT",
                    initialSupply: ethers.formatEther(INITIAL_SUPPLY)
                },
                StakeContract: {
                    address: stakeContractAddress,
                    rewardPerBlock: ethers.formatEther(REWARD_PER_BLOCK),
                    startBlock: START_BLOCK
                }
            },
            pools: [
                {
                    id: 0,
                    name: "ETH Pool",
                    stTokenAddress: ethers.ZeroAddress,
                    weight: 100,
                    minDepositAmount: "0.01",
                    unstakeLockedBlocks: 100
                }
            ]
        };
        
        if (mockTokenAddress) {
            deploymentInfo.contracts.MockERC20 = {
                address: mockTokenAddress,
                name: "Mock Stake Token",
                symbol: "MST",
                supply: "1000000"
            };
            
            deploymentInfo.pools.push({
                id: 1,
                name: "Mock Token Pool",
                stTokenAddress: mockTokenAddress,
                weight: 200,
                minDepositAmount: "10",
                unstakeLockedBlocks: 200
            });
        }
        
        // 创建deployments目录
        const deploymentsDir = path.join(__dirname, '..', 'deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        // 保存部署信息
        const timestamp = Date.now();
        const deploymentFile = path.join(deploymentsDir, `deployment-${timestamp}.json`);
        const latestFile = path.join(deploymentsDir, 'latest.json');
        
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));
        
        console.log("\n=== 部署完成 ===");
        console.log("MetaNodeToken:", metaNodeTokenAddress);
        console.log("StakeContract:", stakeContractAddress);
        if (mockTokenAddress) {
            console.log("MockERC20:", mockTokenAddress);
        }
        console.log("部署信息已保存到:", deploymentFile);
        
        // 验证合约（仅在Sepolia网络）
        if (network.chainId === 11155111n && process.env.ETHERSCAN_API_KEY) {
            console.log("\n开始验证合约...");
            try {
                await hre.run("verify:verify", {
                    address: metaNodeTokenAddress,
                    constructorArguments: [
                        "MetaNode Token",
                        "MNT",
                        INITIAL_SUPPLY
                    ],
                });
                console.log("MetaNodeToken 验证完成");
            } catch (error) {
                console.log("合约验证失败:", error.message);
            }
        }
        
    } catch (error) {
        console.error("部署失败:", error);
        process.exit(1);
    }
}

// 运行部署脚本
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });