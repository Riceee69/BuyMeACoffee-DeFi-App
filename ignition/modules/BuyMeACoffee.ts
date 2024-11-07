import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BuyMeACoffeModule", (m) => {
  const _BuyMeACoffee =  m.contract("BuyMeACoffee");

  return {_BuyMeACoffee}
});