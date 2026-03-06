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
}
