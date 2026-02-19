// SPDX-License-Identifier:MIT

/**
 * @title LogersWatch
 * @author Atul Thakre
 * @notice Watch as you pay plaform.
 */

import {Ownable} from "@openzeppelin-contracts/access/Ownable.sol";
import {IERC20Permit} from "@openzeppelin-contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IERC20} from "@openzeppelin-contracts/interfaces/IERC20.sol";
import {AccessControl} from "@openzeppelin-contracts/access/AccessControl.sol";
import {MerkleProof} from "@openzeppelin-contracts/utils/cryptography/MerkleProof.sol";

pragma solidity ^0.8.24;

contract LogersWatch is Ownable, AccessControl {
    error LogersWatch__TokenNotSupported();
    error LogersWatch__AmountMustMoreThanZero();
    error LogersWatch__PermitFailed();
    error LogersWatch__ClaimFail();
    error LogersWatch__UnAuthorizedAccount();

    mapping(address creator => bool status) isVerifiedCreator;
    mapping(address creator => uint256 withdrawn) creatorWithdrawn;
    mapping(address tokenAddress => bool status) isSupportedTokens;
    mapping(address user => uint256 balance) userDepositAmount;
    mapping(address creator => uint256 feesPaid) totalPlatformFeePaidByCreator;

    address[] private supportedTokensList;
    address[] private creatorsList;

    uint256 private constant PRECISION_FACTOR = 1e18;

    uint256 private PLATFORM_FEE = 1e17;
    bytes32 private MERKLE_ROOT;
    bytes32 private CREATOR_CLAIM_ROLE =
        keccak256("LOGERS_WATCH_CREATOR_ROLE_ACCESS_CHECK");

    event Deposited(address indexed user, uint256 indexed amount);
    event Claimed(address indexed creator, uint256 indexed amount);
    event RootChange();
    event AddCreator(address indexed creator);
    event BanCreator(address indexed creator);
    event AddNewTokenSupport(address indexed newToken);
    event RemoveTokenSupport(address indexed token);
    event GrantClaimRole(address indexed creator);
    event RevokeClaimRole(address indexed creator);
    event ChangePlatformFee(uint256 newFee);

    constructor() Ownable(msg.sender) {}

    modifier amountNotZero(uint256 value) {
        if (value <= 0) revert LogersWatch__AmountMustMoreThanZero();
        _;
    }

    modifier isTokenSupported(address token) {
        if (!isSupportedTokens[token]) {
            revert LogersWatch__TokenNotSupported();
        }
        _;
    }

    function deposit(
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public amountNotZero(value) isTokenSupported(token) {
        try
            IERC20Permit(token).permit(
                msg.sender,
                address(this),
                value,
                deadline,
                v,
                r,
                s
            )
        {} catch {
            revert LogersWatch__PermitFailed();
        }

        IERC20(token).transferFrom(msg.sender, address(this), value);
        userDepositAmount[msg.sender] += value;
        emit Deposited(msg.sender, value);
    }

    function depositWithoutPermit(
        address token,
        uint256 value
    ) public amountNotZero(value) isTokenSupported(token) {
        IERC20(token).transferFrom(msg.sender, address(this), value);
        userDepositAmount[msg.sender] += value;
        emit Deposited(msg.sender, value);
    }

    function claim(
        bytes32[] memory proof,
        uint256 totalEarnings,
        address token
    ) public onlyRole(CREATOR_CLAIM_ROLE) isTokenSupported(token) {
        if (!isVerifiedCreator[msg.sender]) {
            revert LogersWatch__UnAuthorizedAccount();
        }
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(msg.sender, totalEarnings)))
        );

        bool success = MerkleProof.verify(proof, MERKLE_ROOT, leaf);
        if (!success) revert LogersWatch__ClaimFail();

        uint256 amountToWithdraw = totalEarnings - creatorWithdrawn[msg.sender];
        creatorWithdrawn[msg.sender] = totalEarnings;

        uint256 platformFee = calculateFlatformFee(amountToWithdraw);
        totalPlatformFeePaidByCreator[msg.sender] = platformFee;
        IERC20(token).transferFrom(
            address(this),
            msg.sender,
            amountToWithdraw - platformFee
        );
        emit Claimed(msg.sender, amountToWithdraw - platformFee);
    }

    function grantClaimRoleToCreator(address creator) public onlyOwner {
        grantRole(CREATOR_CLAIM_ROLE, creator);
        emit GrantClaimRole(creator);
    }

    function revokeCreatorClaimRole(address creator) public onlyOwner {
        revokeRole(CREATOR_CLAIM_ROLE, creator);
        emit RevokeClaimRole(creator);
    }

    function addCreator(address creator) public onlyOwner {
        creatorsList.push(creator);
        isVerifiedCreator[creator] = true;
        grantClaimRoleToCreator(creator);
        emit AddCreator(creator);
    }

    function addNewTokenSupport(address newToken) public onlyOwner {
        supportedTokensList.push(newToken);
        isSupportedTokens[newToken] = true;
        emit AddNewTokenSupport(newToken);
    }

    function banCreator(address creator) public onlyOwner {
        isVerifiedCreator[creator] = false;
        revokeCreatorClaimRole(creator);
        emit BanCreator(creator);
    }

    function banTokenSupport(address newToken) public onlyOwner {
        isSupportedTokens[newToken] = false;
        emit RemoveTokenSupport(newToken);
    }

    function calculateFlatformFee(
        uint256 amountToWithdraw
    ) private view returns (uint256) {
        return (amountToWithdraw * PLATFORM_FEE) / PRECISION_FACTOR;
    }

    function setMerkleRoot(bytes32 root) public onlyOwner {
        MERKLE_ROOT = root;
        emit RootChange();
    }

    function changePlatformFee(uint256 newFee) public onlyOwner {
        PLATFORM_FEE = newFee;
        emit ChangePlatformFee(newFee);
    }

    function getPlatformFee() public view returns (uint256) {
        return PLATFORM_FEE;
    }

    function getCreators() public view returns (address[] memory) {
        return creatorsList;
    }

    function getSupportedTokens() public view returns (address[] memory) {
        return supportedTokensList;
    }

    function getTokenStatus(address token) public view returns (bool) {
        return isSupportedTokens[token];
    }

    function getCreatorStstus() public view returns (bool) {
        return isVerifiedCreator[msg.sender];
    }

    function getTotalWithdrawnByCreator(
        address creator
    ) public view returns (uint256) {
        return creatorWithdrawn[creator];
    }

    function getTotalPlatformFeesPaidByCreator(
        address creator
    ) public view returns (uint256) {
        return totalPlatformFeePaidByCreator[creator];
    }

    function getTotaldepositedByUser(
        address user
    ) public view returns (uint256) {
        return userDepositAmount[user];
    }
}

/*
1. Deposit
2. Claim
3. Update pltform Fee
4. Set Merkle root
5. Getters
*/

////////////////////////////////////////////////////////////
//////////////////////// Structure /////////////////////////
////////////////////////////////////////////////////////////

// This is considered an Exogenous, Decentralized, Anchored (pegged), Crypto Collateralized low volitility coin

// Layout of Contract:
// version
// imports
// interfaces, libraries, contracts
// errors
// Type declarations
// State variables
// Events
// Modifiers
// Functions

// Layout of Functions:
// constructor
// receive function (if exists)
// fallback function (if exists)
// external
// public
// internal
// private
// view & pure functions

// Core Requirements:
// 1. Store the address of the RebaseToken contract (passed in constructor).
// 2. Implement a deposit function:
//    - Accepts ETH from the user.
//    - Mints RebaseTokens to the user, equivalent to the ETH sent (1:1 peg initially).
// 3. Implement a redeem function:
//    - Burns the user's RebaseTokens.
//    - Sends the corresponding amount of ETH back to the user.
// 4. Implement a mechanism to add ETH rewards to the vault.
