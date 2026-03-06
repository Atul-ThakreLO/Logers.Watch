// SPDX-License-Identifier:MIT

import {Script} from "forge-std/Script.sol";

pragma solidity ^0.8.24;

import {HelperConfig} from "./Helper/HelperConfig.s.sol";
import {LogersWatch} from "../src/LogersWatch.sol";

contract Deployer is Script {
    function run() public returns (address, HelperConfig.NetworkConfig memory) {
        return deploy(msg.sender);
    }

    function deploy(
        address owner
    ) public returns (address, HelperConfig.NetworkConfig memory) {
        vm.startBroadcast(owner);
        HelperConfig helperConfig = new HelperConfig();
        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();
        LogersWatch lw = new LogersWatch(config.supportedTokens);
        vm.stopBroadcast();
        return (address(lw), config);
    }
}
