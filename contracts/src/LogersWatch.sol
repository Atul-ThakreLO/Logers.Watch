// SPDX-License-Identifier:MIT

/**
 * @title LogersWatch
 * @author Atul Thakre
 * @notice Watch as you pay plaform.
 */

import {Ownable} from "@openzeppelin-contracts/access/Ownable.sol";
import {
    IERC20Permit
} from "@openzeppelin-contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IERC20} from "@openzeppelin-contracts/interfaces/IERC20.sol";
import {AccessControl} from "@openzeppelin-contracts/access/AccessControl.sol";
import {
    MerkleProof
} from "@openzeppelin-contracts/utils/cryptography/MerkleProof.sol";
import {
    ReentrancyGuard
} from "@openzeppelin-contracts/utils/ReentrancyGuard.sol";

pragma solidity ^0.8.24;

contract LogersWatch is Ownable, AccessControl, ReentrancyGuard {
    ////////////////////////////////////////////////////////////
    ////////////////////////// Errors //////////////////////////
    ////////////////////////////////////////////////////////////
    error LogersWatch__TokenNotSupported();
    error LogersWatch__AmountMustMoreThanZero();
    error LogersWatch__PermitFailed();
    error LogersWatch__ClaimFail();
    error LogersWatch__UnAuthorizedAccount();
    error LogersWatch__MerkleRootNotSet();

    ////////////////////////////////////////////////////////////
    /////////////// State Variables and Mappings ///////////////
    ////////////////////////////////////////////////////////////
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

    ////////////////////////////////////////////////////////////
    ////////////////////////// Events //////////////////////////
    ////////////////////////////////////////////////////////////
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

    ////////////////////////////////////////////////////////////
    /////////////////////// Constructor ////////////////////////
    ////////////////////////////////////////////////////////////
    /**
     * @param supportedTokens Array of token addresses that are supported from deployment.
     * @notice Initializes supported token mapping at contract creation.
     */
    constructor(address[] memory supportedTokens) Ownable(msg.sender) {
        for (uint8 i = 0; i < supportedTokens.length; i++) {
            isSupportedTokens[supportedTokens[i]] = true;
        }
    }

    ////////////////////////////////////////////////////////////
    //////////////////////// Modifiers /////////////////////////
    ////////////////////////////////////////////////////////////
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

    ////////////////////////////////////////////////////////////
    //////////////////////// Functions /////////////////////////
    ////////////////////////////////////////////////////////////
    /**
     *
     * @param token Token address, that will be deposit
     * @param value Amount of token to be deposit.
     * @param deadline Expiration time for permit
     * @param v signature component
     * @param r signature component
     * @param s signature component
     * @dev Put Permit logic inside try catch try block to handle signature failures gracefully
     * without reverting the entire transaction. This allows the contract to proceed with a
     * fallback mechanism (like using transferFrom if allowance already exists)
     */
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

    /**
     *
     * @param token Token address, that will be deposit.
     * @param value Amount of token to be deposit.
     * @notice The allowance of token is needed to the contract.
     */
    function depositWithoutPermit(
        address token,
        uint256 value
    ) public amountNotZero(value) isTokenSupported(token) {
        IERC20(token).transferFrom(msg.sender, address(this), value);
        userDepositAmount[msg.sender] += value;
        emit Deposited(msg.sender, value);
    }

    /**
     *
     * @param proof Merkle Proof array to claim earnings.
     * @param totalEarnings The exact amount of earnings, that is set while creating merkle tree.
     * @param token Address of a token, need to claim.
     * @notice This function transfer the pending earning to creator account, and deducts platform fee
     * The Pending earning is calculated by subtracting past claimed amount and newly released total earning.
     * For example:
     * totalEarning = $20
     * and creatorWithdrawn[creatorAddress] = $10
     * claimable amount will be $10 ($20 - $10)
     * PLTFORM_FEE = 1e17 i.e 10%
     * 10% of claimable amount -> 10% of $10 = $1
     * final amount to claim $10 - $1 = $9
     */
    function claim(
        bytes32[] memory proof,
        uint256 totalEarnings,
        address token
    ) public nonReentrant onlyRole(CREATOR_CLAIM_ROLE) isTokenSupported(token) {
        if (MERKLE_ROOT == bytes32(0)) {
            revert LogersWatch__MerkleRootNotSet();
        }
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
        IERC20(token).transfer(msg.sender, amountToWithdraw - platformFee);
        emit Claimed(msg.sender, amountToWithdraw - platformFee);
    }

    /**
     * @param creator Creator address, to grant a claim role
     * @notice This function grant access to creator form claiming earnings and verifying the creator.
     */
    function grantClaimRoleToCreator(address creator) public onlyOwner {
        _grantRole(CREATOR_CLAIM_ROLE, creator);
        emit GrantClaimRole(creator);
    }

    /**
     *
     * @param creator Creator address, to revoke a claim role
     * @notice This function revoke claim role
     */
    function revokeCreatorClaimRole(address creator) public onlyOwner {
        _revokeRole(CREATOR_CLAIM_ROLE, creator);
        emit RevokeClaimRole(creator);
    }

    /**
     * @param creator Creator address to verify and allow claiming.
     * @notice Adds creator to verified list and grants claim role.
     */
    function addCreator(address creator) public onlyOwner {
        creatorsList.push(creator);
        isVerifiedCreator[creator] = true;
        grantClaimRoleToCreator(creator);
        emit AddCreator(creator);
    }

    /**
     * @param newToken Token address to mark as supported.
     * @notice Adds a new ERC20 token that can be used for deposits and claims.
     */
    function addNewTokenSupport(address newToken) public onlyOwner {
        supportedTokensList.push(newToken);
        isSupportedTokens[newToken] = true;
        emit AddNewTokenSupport(newToken);
    }

    /**
     * @param creator Creator address to ban.
     * @notice Removes creator verification and revokes claim role.
     */
    function banCreator(address creator) public onlyOwner {
        isVerifiedCreator[creator] = false;
        revokeCreatorClaimRole(creator);
        emit BanCreator(creator);
    }

    /**
     * @param newToken Token address to disable.
     * @notice Removes token support for future deposits and claims.
     */
    function banTokenSupport(address newToken) public onlyOwner {
        isSupportedTokens[newToken] = false;
        emit RemoveTokenSupport(newToken);
    }

    /**
     * @param amountToWithdraw Gross amount creator can withdraw.
     * @return Platform fee amount based on current PLATFORM_FEE rate.
     * @notice Calculates platform fee using 1e18 precision factor.
     */
    function calculateFlatformFee(
        uint256 amountToWithdraw
    ) private view returns (uint256) {
        return (amountToWithdraw * PLATFORM_FEE) / PRECISION_FACTOR;
    }

    /**
     * @param root New Merkle root used for claim verification.
     * @notice Updates Merkle root for creator earnings distribution.
     */
    function setMerkleRoot(bytes32 root) public onlyOwner {
        MERKLE_ROOT = root;
        emit RootChange();
    }

    /**
     * @param newFee New platform fee in 1e18 precision format.
     * @notice Updates global platform fee rate.
     */
    function changePlatformFee(uint256 newFee) public onlyOwner {
        PLATFORM_FEE = newFee;
        emit ChangePlatformFee(newFee);
    }

    ////////////////////////////////////////////////////////////
    ///////////////////// Getter Functions /////////////////////
    ////////////////////////////////////////////////////////////
    /**
     * @return Current platform fee in 1e18 precision format.
     */
    function getPlatformFee() public view returns (uint256) {
        return PLATFORM_FEE;
    }

    /**
     * @return Array of all creators added through addCreator.
     */
    function getCreators() public view returns (address[] memory) {
        return creatorsList;
    }

    /**
     * @return Array of token addresses that were added as supported tokens.
     */
    function getSupportedTokens() public view returns (address[] memory) {
        return supportedTokensList;
    }

    /**
     * @param token Token address to check support status.
     * @return True if token is currently supported.
     */
    function getTokenStatus(address token) public view returns (bool) {
        return isSupportedTokens[token];
    }

    /**
     * @return True if msg.sender is a verified creator.
     */
    function getCreatorStstus() public view returns (bool) {
        return isVerifiedCreator[msg.sender];
    }

    /**
     * @param creator Creator address to query.
     * @return Total amount already withdrawn by creator.
     */
    function getTotalWithdrawnByCreator(
        address creator
    ) public view returns (uint256) {
        return creatorWithdrawn[creator];
    }

    /**
     * @param creator Creator address to query.
     * @return Total platform fees paid by creator across claims.
     */
    function getTotalPlatformFeesPaidByCreator(
        address creator
    ) public view returns (uint256) {
        return totalPlatformFeePaidByCreator[creator];
    }

    /**
     * @param user User address to query deposited balance.
     * @return Total deposited amount tracked for the user.
     */
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
