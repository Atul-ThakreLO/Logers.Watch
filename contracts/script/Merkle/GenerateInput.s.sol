// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

contract GenerateInput is Script {
    string constant FILE_PATH = "script/target/input.json";

    function run() public {
        string[] memory types = new string[](2);
        types[0] = "address";
        types[1] = "uint";

        uint256 amount = 25 * 1e18;

        address[] memory whitelist = new address[](4);
        whitelist[0] = 0x6CA6d1e2D5347Bfab1d91e883F1915560e09129D; // Test address
        whitelist[1] = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // Example addresses
        whitelist[2] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        whitelist[3] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

        string memory json = createJson(types, amount, whitelist);
        vm.writeFile(FILE_PATH, json);
    }

    function createJson(string[] memory _types, uint256 _amount, address[] memory _whitelist)
        internal
        pure
        returns (string memory)
    {
        string memory json = "{";

        // Types
        json = string.concat(json, "\"types\":[");
        for (uint256 i = 0; i < _types.length; i++) {
            json = string.concat(json, "\"", _types[i], "\"");
            if (i < _types.length - 1) {
                json = string.concat(json, ",");
            }
        }
        json = string.concat(json, "],");

        // Add count
        json = string.concat(json, "\"count\":", vm.toString(_whitelist.length), ",");

        // Add values

        json = string.concat(json, "\"values\": {");
        for (uint256 i = 0; i < _whitelist.length; i++) {
            json = string.concat(
                json,
                "\"",
                vm.toString(i),
                "\": {",
                "\"0\":\"",
                vm.toString(_whitelist[i]),
                "\",",
                "\"1\":\"",
                vm.toString(_amount),
                "\"}"
            );

            if (i < _whitelist.length - 1) {
                json = string.concat(json, ",");
            }
        }

        json = string.concat(json, "}}");

        return json;
    }
}