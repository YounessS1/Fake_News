const FakeNewsVerifier = artifacts.require("FakeNewsVerifier");

module.exports = function (deployer) {
  deployer.deploy(FakeNewsVerifier);
};
