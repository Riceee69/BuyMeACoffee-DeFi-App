import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("BuyMeACoffe Contract Tests", function () {

  async function deployFixture() {
    const BuyMeACoffee = await hre.ethers.getContractFactory("BuyMeACoffee");
    const [owner, tipper1] = await hre.ethers.getSigners();

    const _BuyMeACoffee = await BuyMeACoffee.deploy();
    await _BuyMeACoffee.waitForDeployment();

    return {_BuyMeACoffee, owner, tipper1}
  }

  describe("Deployment test", function(){
    it("Should set msg.sender as contract owner", async() => {
      const {_BuyMeACoffee, owner} = await loadFixture(deployFixture);

      expect(await _BuyMeACoffee.owner()).to.equal(owner.address);
    });
  });

  describe("Contract Transaction Tests", function(){
    it("Should not execute buyCoffee() if no tip is sent", async() => {
      const {_BuyMeACoffee, tipper1} = await loadFixture(deployFixture);

      const tip = {value: hre.ethers.parseEther("0")};
      await expect(
        _BuyMeACoffee.connect(tipper1).buyCoffee("Alice", "Hello there!", tip)
      ).to.be.revertedWith("can't buy coffee for free!");
    });

    it("Should execute buyCoffee() if tip is sent,create a memo and update contract balance", async() => {
      const {_BuyMeACoffee, tipper1} = await loadFixture(deployFixture);

      const tip = {value: hre.ethers.parseEther("1")};
      await _BuyMeACoffee.connect(tipper1).buyCoffee("Alice", "Hello there!", tip);

      const [memo] = await _BuyMeACoffee.getMemos();
      expect(memo.from).to.equals(tipper1.address);
      expect(memo.timestamp).to.exist;
      //or can do this to check timestamp
      // const latestBlock = await hre.ethers.provider.getBlock('latest');
      // expect(memo.timestamp).to.be.closeTo(latestBlock.timestamp, 2); // Allow 2 seconds difference
      expect(memo.name).to.equals("Alice");
      expect(memo.message).to.equals("Hello there!");
      expect(await hre.ethers.provider.getBalance(_BuyMeACoffee.target)).to.equal(
        tip.value
      );
    });

    it("Should allow only the owner to withdraw all the tips", async() => {
      const {_BuyMeACoffee, owner, tipper1} = await loadFixture(deployFixture);
      const tip = {value: hre.ethers.parseEther("1")};
      await _BuyMeACoffee.connect(tipper1).buyCoffee("Alice", "Hello there!", tip);
  
      await expect( _BuyMeACoffee.connect(tipper1).withdrawTips()).to.be.revertedWith(
        "Only owner can withdraw tips"
      );
      
      const initialBalance = await hre.ethers.provider.getBalance(owner.address);
  
      const tx = await _BuyMeACoffee.withdrawTips();
      const receipt = await tx.wait();
      const gasCost = BigInt(receipt?.gasUsed ?? 0) * BigInt(receipt?.gasPrice ?? 0);
  
      const finalBalance = await hre.ethers.provider.getBalance(owner.address);
      expect(finalBalance - initialBalance + gasCost).to.equal(tip.value);
  });
  
});  

});


