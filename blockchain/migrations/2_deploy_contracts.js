const FakeNewsVerifier = artifacts.require("FakeNewsVerifier");

module.exports = async function (deployer, network, accounts) {
  // Exemple:
  // accounts[0] = admin (deployer)
  // accounts[1] = moderator
  // accounts[2] = oracle ML
  const moderators = [accounts[1]];
  const oracles = [accounts[2]];

  await deployer.deploy(FakeNewsVerifier, moderators, oracles);
};
