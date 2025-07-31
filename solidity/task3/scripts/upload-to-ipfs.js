const { create } = require('ipfs-http-client');
const fs = require('fs');
const path = require('path');

// 连接到本地 IPFS 节点
const ipfs = create({
  host: 'localhost',
  port: 5001,
  protocol: 'http'
});

async function uploadImageToIPFS(imagePath) {
  try {
    console.log('正在上传图片到本地 IPFS...');
    const file = fs.readFileSync(imagePath);
    const result = await ipfs.add({
      path: path.basename(imagePath),
      content: file
    });
    
    const imageHash = result.cid.toString();
    console.log('图片上传成功！');
    console.log('IPFS Hash:', imageHash);
    console.log('图片 URL:', `http://localhost:8080/ipfs/${imageHash}`);
    console.log('公共网关 URL:', `https://ipfs.io/ipfs/${imageHash}`);
    
    return imageHash;
  } catch (error) {
    console.error('图片上传失败:', error);
    throw error;
  }
}

async function uploadMetadataToIPFS(metadata) {
  try {
    console.log('正在上传元数据到本地 IPFS...');
    const result = await ipfs.add({
      path: 'metadata.json',
      content: JSON.stringify(metadata, null, 2)
    });
    
    const metadataHash = result.cid.toString();
    console.log('元数据上传成功！');
    console.log('IPFS Hash:', metadataHash);
    console.log('元数据 URL:', `http://localhost:8080/ipfs/${metadataHash}`);
    console.log('公共网关 URL:', `https://ipfs.io/ipfs/${metadataHash}`);
    
    return metadataHash;
  } catch (error) {
    console.error('元数据上传失败:', error);
    throw error;
  }
}

async function main() {
  try {
    // 1. 上传图片
    const imagePath = './assets/hello.jpg'; // 请确保图片存在
    
    if (!fs.existsSync(imagePath)) {
      console.log('⚠️  图片文件不存在，跳过图片上传');
      console.log('📝 请将您的 NFT 图片放在 ./assets/hello.jpg');
      return;
    }
    
    const imageHash = await uploadImageToIPFS(imagePath);
    
    // 2. 创建元数据
    const metadata = {
      name: "Dylan's Awesome NFT #1",
      description: "This is my first NFT created for the blockchain course homework. It represents my journey into the world of Web3 and decentralized applications.",
      image: `ipfs://${imageHash}`,
      attributes: [
        {
          trait_type: "Creator",
          value: "Dylan"
        },
        {
          trait_type: "Course",
          value: "Blockchain Development"
        },
        {
          trait_type: "Assignment",
          value: "Homework 2"
        },
        {
          trait_type: "Rarity",
          value: "Legendary"
        },
        {
          trait_type: "Creation Date",
          value: new Date().toISOString().split('T')[0]
        }
      ],
      external_url: "https://github.com/dylan",
      background_color: "000000"
    };
    
    // 3. 上传元数据
    const metadataHash = await uploadMetadataToIPFS(metadata);
    
    console.log('\n🎉 上传完成!');
    console.log('📋 完整的元数据:');
    console.log(JSON.stringify(metadata, null, 2));
    console.log('\n📝 使用说明:');
    console.log(`1. 复制元数据 URI: ipfs://${metadataHash}`);
    console.log('2. 在 mint.js 中更新 TOKEN_URI');
    console.log('3. 运行铸造脚本: npm run mint');
    
  } catch (error) {
    console.error('❌ 上传过程失败:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { uploadImageToIPFS, uploadMetadataToIPFS };
