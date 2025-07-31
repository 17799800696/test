// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
// 当前使用的是 Counters，在新版本中已被弃用
// 建议更新为更现代的实现
import "@openzeppelin/contracts/utils/Counters.sol";

// 推荐改为：
// 直接使用 uint256 计数器，更节省gas

/**
 * @title MyNFT
 * @dev ERC721 NFT contract with IPFS metadata support
 */
contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        // Token ID starts from 1
        _tokenIdCounter.increment();
    }
    
    /**
     * @dev Mint a new NFT to the specified address
     * @param to The address to mint the NFT to
     * @param tokenURI The metadata URI for the NFT
     * @return The token ID of the minted NFT
     */
    function mintNFT(address to, string memory tokenURI) public onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        emit NFTMinted(to, tokenId, tokenURI);
        return tokenId;
    }
    
    /**
     * @dev Batch mint NFTs
     * @param to The address to mint NFTs to
     * @param tokenURIs Array of metadata URIs
     */
    function batchMint(address to, string[] memory tokenURIs) public onlyOwner {
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            mintNFT(to, tokenURIs[i]);
        }
    }
    
    /**
     * @dev Get the next token ID to be minted
     */
    function getNextTokenId() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev Get total supply of minted tokens
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter.current() - 1;
    }
    
    // Override required functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
