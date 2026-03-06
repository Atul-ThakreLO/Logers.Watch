// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import {ERC20Permit, ERC20} from "@openzeppelin-contracts/token/ERC20/extensions/ERC20Permit.sol";

contract TestTokenMock is ERC20, ERC20Permit {
    constructor() ERC20("Mock Token", "MTK") ERC20Permit("Mock Token") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}