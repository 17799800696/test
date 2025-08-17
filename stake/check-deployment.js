import pkg from "hardhat";
const { ethers } = pkg;
import fs from 'fs';

async function checkDeployment() {
    try {
        // 读取部署信息
        const deploymentInfo = JSON.parse(fs.readFileSync('./deployments/latest.json', 'utf8'));
        const contractAddress = deploymentInfo.contracts.StakeContract.address;
        
        console.log('检查合约地址:', contractAddress);
        
        // 检查地址上是否有代码
        const code = await ethers.provider.getCode(contractAddress);
        console.log('合约代码长度:', code.length);
        console.log('合约代码前100字符:', code.substring(0, 100));
        
        if (code === '0x') {
            console.log('❌ 合约地址上没有代码！');
            console.log('这意味着合约没有正确部署或者网络不匹配');
        } else {
            console.log('✅ 合约代码存在');
        }
        
        // 检查网络信息
        const network = await ethers.provider.getNetwork();
        console.log('当前网络:', network.name, 'Chain ID:', network.chainId.toString());
        
        // 检查区块高度
        const blockNumber = await ethers.provider.getBlockNumber();
        console.log('当前区块高度:', blockNumber);
        
    } catch (error) {
        console.error('检查失败:', error.message);
    }
}

checkDeployment();