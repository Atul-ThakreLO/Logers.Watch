// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {TestTokenMock} from "../../test/Mocks/TestTokenMock.sol";

contract HelperConfig is Script {
    struct NetworkConfig {
        address[] supportedTokens;
    }

    NetworkConfig activeNetworkCOnfig;

    uint256 private constant SEPOLIA_CHAIN_ID = 11_155_111;

    constructor() {
        if (block.chainid == SEPOLIA_CHAIN_ID) {
            activeNetworkCOnfig = getSepoliaConfig();
        } else {
            activeNetworkCOnfig = getOrCreateAnvilConfig();
        }
    }

    function getConfig() public view returns (NetworkConfig memory) {
        return activeNetworkCOnfig;
    }

    function getSepoliaConfig() private pure returns (NetworkConfig memory) {
        address[] memory tokens = new address[](2);
        tokens[0] = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        tokens[1] = 0x93C5d30a7509E60871B77A3548a5BD913334cd35;
        return NetworkConfig({supportedTokens: tokens});
    }

    function getOrCreateAnvilConfig() private returns (NetworkConfig memory) {
        TestTokenMock mock1 = new TestTokenMock();
        TestTokenMock mock2 = new TestTokenMock();
        address[] memory tokens = new address[](2);
        tokens[0] = address(mock1);
        tokens[1] = address(mock2);
        return NetworkConfig({supportedTokens: tokens});
    }
}
