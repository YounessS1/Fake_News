const FakeNewsVerifier = artifacts.require("FakeNewsVerifier");
const truffleAssert = require("truffle-assertions");
const { expectRevert } = require("@openzeppelin/test-helpers");

contract("FakeNewsVerifier (frontend-compatible + RBAC + Oracle)", (accounts) => {
  const [admin, moderator, oracle, user1, user2] = accounts;

  let c;

  beforeEach(async () => {
    // Deploy with RBAC:
    // admin = accounts[0]
    // moderator = accounts[1]
    // oracle = accounts[2]
    c = await FakeNewsVerifier.new([moderator], [oracle], { from: admin });
  });

  it("starts with 0 informations", async () => {
    const count = await c.getInformationsCount();
    assert.equal(count.toString(), "0");
  });

  it("submitInformation adds an information and emits InformationSubmitted", async () => {
    const hash = web3.utils.keccak256("test news");

    const tx = await c.submitInformation(hash, "https://source.com", 75, { from: user1 });

    truffleAssert.eventEmitted(tx, "InformationSubmitted", (ev) => {
      return (
        ev.index.toString() === "0" &&
        ev.author === user1 &&
        ev.contentHash === hash &&
        ev.source === "https://source.com" &&
        ev.reliabilityScore.toString() === "75"
      );
    });

    const count = await c.getInformationsCount();
    assert.equal(count.toString(), "1");

    const info = await c.informations(0);
    assert.equal(info.contentHash, hash);
    assert.equal(info.source, "https://source.com");
    assert.equal(info.reliabilityScore.toString(), "75");
    assert.equal(info.validated, false);
    assert.equal(info.author, user1);
    assert.isTrue(info.timestamp.toNumber() > 0);
  });

  it("submitInformation rejects score > 100", async () => {
    const hash = web3.utils.keccak256("bad score");
    await expectRevert(
      c.submitInformation(hash, "src", 150, { from: user1 }),
      "Score out of range"
    );
  });

  it("submitInformation rejects empty hash", async () => {
    const zeroHash =
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    await expectRevert(
      c.submitInformation(zeroHash, "src", 50, { from: user1 }),
      "Invalid hash"
    );
  });

  it("validateInformation sets validated=true and emits InformationValidated (kept public for frontend)", async () => {
    const hash = web3.utils.keccak256("to validate");
    await c.submitInformation(hash, "src", 60, { from: user1 });

    const tx = await c.validateInformation(0, { from: user2 });

    truffleAssert.eventEmitted(tx, "InformationValidated", (ev) => {
      return ev.index.toString() === "0" && ev.validator === user2;
    });

    const info = await c.informations(0);
    assert.equal(info.validated, true);
    assert.equal(info.validator, user2);
    assert.isTrue(info.validatedAt.toNumber() > 0);
  });

  it("validateInformation rejects invalid index", async () => {
    await expectRevert(
      c.validateInformation(0, { from: user1 }),
      "Invalid index"
    );
  });

  it("only ORACLE_ROLE can set ML result", async () => {
    const hash = web3.utils.keccak256("ml item");
    await c.submitInformation(hash, "src", 40, { from: user1 });

    // ❗ AccessControl uses custom errors => no revert string.
    // Use expectRevert.unspecified.
    await expectRevert.unspecified(
      c.setMLResult(0, 80, true, "v1", { from: user1 })
    );

    // Oracle can set ML
    const tx = await c.setMLResult(0, 80, true, "v1", { from: oracle });

    truffleAssert.eventEmitted(tx, "InformationScored", (ev) => {
      return (
        ev.index.toString() === "0" &&
        ev.score.toString() === "80" &&
        ev.label === true &&
        ev.modelVersion === "v1" &&
        ev.oracle === oracle
      );
    });

    const info = await c.informations(0);
    assert.equal(info.mlScore.toString(), "80");
    assert.equal(info.mlLabel, true);
    assert.equal(info.modelVersion, "v1");
    assert.equal(info.oracle, oracle);
    assert.isTrue(info.scoredAt.toNumber() > 0);
  });

  it("moderatorValidateInformation requires MODERATOR_ROLE", async () => {
    const hash = web3.utils.keccak256("moderator validate");
    await c.submitInformation(hash, "src", 55, { from: user1 });

    // ❗ AccessControl uses custom errors => no revert string.
    await expectRevert.unspecified(
      c.moderatorValidateInformation(0, { from: user1 })
    );

    // Moderator can validate
    const tx = await c.moderatorValidateInformation(0, { from: moderator });

    truffleAssert.eventEmitted(tx, "InformationValidated", (ev) => {
      return ev.index.toString() === "0" && ev.validator === moderator;
    });

    const info = await c.informations(0);
    assert.equal(info.validated, true);
    assert.equal(info.validator, moderator);
    assert.isTrue(info.validatedAt.toNumber() > 0);
  });
});
