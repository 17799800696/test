const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyNFT", function () {
  let myNFT;
  let owner;
  let addr1;
  let addr2;
  
  const NFT_NAME = "Test NFT";
  const NFT_SYMBOL = "TNFT";
  const SAMPLE_TOKEN_URI = "ipfs://QmSampleHash123";
  
  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const MyNFT = await ethers.getContractFactory("MyNFT");
    myNFT = await MyNFT.deploy(NFT_NAME, NFT_SYMBOL);
    await myNFT.waitForDeployment();
  });
  
  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await myNFT.name()).to.equal(NFT_NAME);
      expect(await myNFT.symbol()).to.equal(NFT_SYMBOL);
    });
    
    it("Should set the right owner", async function () {
      expect(await myNFT.owner()).to.equal(owner.address);
    });
    
    it("Should start with token ID 1", async function () {
      expect(await myNFT.getNextTokenId()).to.equal(1);
    });
    
    it("Should start with zero total supply", async function () {
      expect(await myNFT.totalSupply()).to.equal(0);
    });
  });
  
  describe("Minting", function () {
    it("Should mint NFT to specified address", async function () {
      await myNFT.mintNFT(addr1.address, SAMPLE_TOKEN_URI);
      
      expect(await myNFT.ownerOf(1)).to.equal(addr1.address);
      expect(await myNFT.tokenURI(1)).to.equal(SAMPLE_TOKEN_URI);
      expect(await myNFT.balanceOf(addr1.address)).to.equal(1);
    });
    
    it("Should increment token ID after minting", async function () {
      await myNFT.mintNFT(addr1.address, SAMPLE_TOKEN_URI);
      expect(await myNFT.getNextTokenId()).to.equal(2);
      
      await myNFT.mintNFT(addr2.address, SAMPLE_TOKEN_URI);
      expect(await myNFT.getNextTokenId()).to.equal(3);
    });
    
    it("Should update total supply after minting", async function () {
      await myNFT.mintNFT(addr1.address, SAMPLE_TOKEN_URI);
      expect(await myNFT.totalSupply()).to.equal(1);
      
      await myNFT.mintNFT(addr2.address, SAMPLE_TOKEN_URI);
      expect(await myNFT.totalSupply()).to.equal(2);
    });
    
    it("Should emit NFTMinted event", async function () {
      await expect(myNFT.mintNFT(addr1.address, SAMPLE_TOKEN_URI))
        .to.emit(myNFT, "NFTMinted")
        .withArgs(addr1.address, 1, SAMPLE_TOKEN_URI);
    });
    
    it("Should only allow owner to mint", async function () {
      await expect(
        myNFT.connect(addr1).mintNFT(addr2.address, SAMPLE_TOKEN_URI)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  
  describe("Batch Minting", function () {
    it("Should batch mint multiple NFTs", async function () {
      const tokenURIs = [
        "ipfs://QmHash1",
        "ipfs://QmHash2",
        "ipfs://QmHash3"
      ];
      
      await myNFT.batchMint(addr1.address, tokenURIs);
      
      expect(await myNFT.balanceOf(addr1.address)).to.equal(3);
      expect(await myNFT.totalSupply()).to.equal(3);
      expect(await myNFT.getNextTokenId()).to.equal(4);
      
      for (let i = 0; i < tokenURIs.length; i++) {
        expect(await myNFT.tokenURI(i + 1)).to.equal(tokenURIs[i]);
        expect(await myNFT.ownerOf(i + 1)).to.equal(addr1.address);
      }
    });
  });
  
  describe("Token URI", function () {
    it("Should return correct token URI", async function () {
      await myNFT.mintNFT(addr1.address, SAMPLE_TOKEN_URI);
      expect(await myNFT.tokenURI(1)).to.equal(SAMPLE_TOKEN_URI);
    });
    
    it("Should revert for non-existent token", async function () {
      await expect(myNFT.tokenURI(999))
        .to.be.revertedWith("ERC721: invalid token ID");
    });
  });
});
