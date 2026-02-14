import { ConnectButton } from "@rainbow-me/rainbowkit";
import React from "react";
import { CustomConnectButton } from "./ConnectButton.custom";

const Nav = () => {
  return (
    <nav>
      <div className="flex justify-between py-3 w-[90%] mx-auto">
        <div>
          <h1 className="text-4xl">
            <span>Logers.</span>
            <span className="text-primary">Watch</span>
          </h1>
        </div>
        <CustomConnectButton />
      </div>
    </nav>
  );
};

export default Nav;
