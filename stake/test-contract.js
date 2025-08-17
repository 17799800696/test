import pkg from "hardhat";
const { ethers } = pkg;
import fs from 'fs';
import path from 'path';

async function testContract() {
    try {
        // 读取部署信息
        const deploymentInfo = JSON.parse(fs.readFileSync('./deployments/latest.json', 'utf8'));
        console.log('合约地址:', deploymentInfo.contracts.StakeContract.address);
        
        // 获取合约实例
        const stakeContract = await ethers.getContractAt(
            "StakeContract", 
            deploymentInfo.contracts.StakeContract.address
        );
        
        console.log('合约实例创建成功');
        
        // 测试基本调用
        const poolLength = await stakeContract.poolLength();
        console.log('池数量:', poolLength.toString());
        
        const rewardPerBlock = await stakeContract.rewardPerBlock();
        console.log('每区块奖励:', ethers.formatEther(rewardPerBlock));
        
        const totalWeight = await stakeContract.totalWeight();
        console.log('总权重:', totalWeight.toString());
        
    } catch (error) {
        console.error('测试失败:', error.message);
        console.error('错误详情:', error);
    }
}

testContract();