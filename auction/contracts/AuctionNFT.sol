// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AuctionNFT
 * @dev ERC721 NFT合约，支持铸造和转移，用于拍卖市场
 */
contract AuctionNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    
    // 事件
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    
    constructor(string memory name, string memory symbol) 
        ERC721(name, symbol) 
        Ownable(msg.sender) 
    {}
    
    /**
     * @dev 铸造NFT
     * @param to 接收者地址
     * @param tokenURI NFT元数据URI
     * @return tokenId 新铸造的NFT ID
     */
    function mintNFT(address to, string memory tokenURI) 
        public 
        onlyOwner 
        returns (uint256) 
    {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        emit NFTMinted(to, tokenId, tokenURI);
        return tokenId;
    }
    
    /**
     * @dev 批量铸造NFT
     * @param to 接收者地址
     * @param tokenURIs NFT元数据URI数组
     * @return tokenIds 新铸造的NFT ID数组
     */
    function batchMintNFT(address to, string[] memory tokenURIs) 
        public 
        onlyOwner 
        returns (uint256[] memory) 
    {
        uint256[] memory tokenIds = new uint256[](tokenURIs.length);
        uint256 tokenURIsLen = tokenURIs.length;
        for (uint256 i = 0; i <tokenURIsLen; i++) {
            tokenIds[i] = mintNFT(to, tokenURIs[i]);
        }
        
        return tokenIds;
    }
    
    /**
     * @dev 获取下一个token ID
     */
    function getNextTokenId() public view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @dev 获取总供应量
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
    
    // 重写必要的函数
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}