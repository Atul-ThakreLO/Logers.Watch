// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LogersWatch} from "../../src/LogersWatch.sol";
import {Deployer} from "../../script/Deployer.s.sol";
import {HelperConfig} from "../../script/Helper/HelperConfig.s.sol";
import {ERC20Mock} from "@openzeppelin-contracts/mocks/token/ERC20Mock.sol";
import {IERC20} from "@openzeppelin-contracts/interfaces/IERC20.sol";
import {TestTokenMock} from "../Mocks/TestTokenMock.sol";

contract LogersWatchTest is Test {
    LogersWatch lw;
    address token1;
    address token2;

    address user;
    address owner;
    uint256 userPrivateKey;

    uint256 constant INITIAL_BALANCE_OF_USER = 200e18;
    uint256 constant DEPOSIT_AMOUNT = INITIAL_BALANCE_OF_USER / 2;

    bytes32 ROOT =
        0x9d5752ade6ceebdf350d992cceeda1dbe9fd54b0926decc4bae5723cdcfc5f23;
    bytes32 PROOF1 =
        0xb6bde19bd6f0edcab0c9c6563e8405609b09ab29a6f0d1ebbee028fb57e8e8e4;
    bytes32 PROOF2 =
        0x205ca9639b73a8c7fcbcfd6fcb9b80601b8850858c3fb9f04f380babeadf2128;
    address creator = 0x6CA6d1e2D5347Bfab1d91e883F1915560e09129D;
    uint256 TOTAL_EARNINGS = 25200;

    bytes32[] PROOF = [PROOF1, PROOF2];

    function setUp() public {
        (user, userPrivateKey) = makeAddrAndKey("USER");
        owner = makeAddr("OWNER");
        Deployer deployer = new Deployer();
        (address lwAddress, HelperConfig.NetworkConfig memory config) = deployer
            .deploy(owner);
        lw = LogersWatch(lwAddress);
        token1 = config.supportedTokens[0];
        token2 = config.supportedTokens[1];

        ERC20Mock(token1).mint(user, INITIAL_BALANCE_OF_USER);
        ERC20Mock(token2).mint(user, INITIAL_BALANCE_OF_USER);
    }

    function testCanDepositeWithoutPermit() public {
        vm.startPrank(user);
        IERC20(token1).approve(address(lw), DEPOSIT_AMOUNT);
        lw.depositWithoutPermit(token1, DEPOSIT_AMOUNT);
        vm.stopPrank();

        uint256 balanceAfterDeposit = IERC20(token1).balanceOf(address(lw));
        uint256 userBalance = IERC20(token1).balanceOf(user);

        assertEq(balanceAfterDeposit, DEPOSIT_AMOUNT);
        assertEq(INITIAL_BALANCE_OF_USER - DEPOSIT_AMOUNT, userBalance);
    }

    function testCanDeposite() public {
        uint256 value = DEPOSIT_AMOUNT;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = TestTokenMock(token1).nonces(user);

        bytes32 digest = _buildPermitDigest(
            user,
            address(lw),
            value,
            nonce,
            deadline
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);

        assertEq(TestTokenMock(token1).allowance(user, address(lw)), 0);

        vm.prank(user);
        lw.deposit(token1, value, deadline, v, r, s);

        uint256 balanceAfterDeposit = IERC20(token1).balanceOf(address(lw));
        uint256 userBalance = IERC20(token1).balanceOf(user);

        assertEq(balanceAfterDeposit, DEPOSIT_AMOUNT);
        assertEq(INITIAL_BALANCE_OF_USER - DEPOSIT_AMOUNT, userBalance);
    }

    function testClaim() public {
        // Deposit
        uint256 value = DEPOSIT_AMOUNT;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = TestTokenMock(token1).nonces(user);
        bytes32 digest = _buildPermitDigest(
            user,
            address(lw),
            value,
            nonce,
            deadline
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        vm.prank(user);
        lw.deposit(token1, value, deadline, v, r, s);

        // Claim
        vm.startPrank(owner);
        lw.addCreator(creator);
        lw.setMerkleRoot(ROOT);
        vm.stopPrank();
        vm.prank(creator);
        lw.claim(PROOF, TOTAL_EARNINGS, token1);

        uint256 creatorBalance = IERC20(token1).balanceOf(creator);
        uint256 balanceAfterClaim = IERC20(token1).balanceOf(address(lw));

        // Platform fee is 10%, so creator receives 90% of earnings
        uint256 expectedCreatorBalance = TOTAL_EARNINGS -
            ((TOTAL_EARNINGS * lw.getPlatformFee()) / 1e18);
        assertEq(creatorBalance, expectedCreatorBalance);
        assertEq(balanceAfterClaim, DEPOSIT_AMOUNT - expectedCreatorBalance);
    }

    function _buildPermitDigest(
        address _owner,
        address _spender,
        uint256 _value,
        uint256 _nonce,
        uint256 _deadline
    ) private view returns (bytes32) {
        bytes32 PERMIT_TYPEHASH = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                _owner,
                _spender,
                _value,
                _nonce,
                _deadline
            )
        );

        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01", // EIP-712 prefix
                    TestTokenMock(token1).DOMAIN_SEPARATOR(), // chain + contract fingerprint
                    structHash
                )
            );
    }
}
