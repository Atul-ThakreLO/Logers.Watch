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

    mapping(address creator => uint256 withdrawn) creatorWithdrawn;
    mapping(address tokenAddress => bool status) supportedToken;
    mapping(address user => uint256 balance) userBalance;
    mapping(address creator => uint256 feesPaid) totalPlatformFeePaidByCreator;

    uint256 private constant PRECISION_FACTOR = 1e18;

    uint256 private PLATFORM_FEE = 1e17;
    bytes32 private MERKLE_ROOT;
    bytes32 private CREATOR_CLAIM_ROLE =
        keccak256("LOGERS_WATCH_CREATOR_ROLE_ACCESS_CHECK");

    constructor() Ownable(msg.sender) {}

    modifier amountNotZero(uint256 value) {
        if (value <= 0) revert LogersWatch__AmountMustMoreThanZero();
        _;
    }

    modifier isTokenSupported(address token) {
        if (!supportedToken[token]) {
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
        userBalance[msg.sender] += value;
    }

    function depositWithoutPermit(
        address token,
        uint256 value
    ) public amountNotZero(value) {
        if (!supportedToken[token]) {
            revert LogersWatch__TokenNotSupported();
        }
        IERC20(token).transferFrom(msg.sender, address(this), value);
        userBalance[msg.sender] += value;
    }

    function claim(
        bytes32[] memory proof,
        uint256 totalEarnings,
        address token
    ) public onlyRole(CREATOR_CLAIM_ROLE) isTokenSupported(token) {
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
    }

    function revokeCreatorClaimRole(address creator) public onlyOwner {
        revokeRole(CREATOR_CLAIM_ROLE, creator);
    }

    function calculateFlatformFee(
        uint256 amountToWithdraw
    ) private view returns (uint256) {
        return (amountToWithdraw * PLATFORM_FEE) / PRECISION_FACTOR;
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
