// app/src/services/blockchain.js
import { ethers } from "ethers";
import FakeNewsVerifierArtifact from "../contracts/FakeNewsVerifier.json";

// RPC Ganache (d'après ta configuration)
const GANACHE_RPC_URL = "http://127.0.0.1:7545";

function ensureMetaMask() {
  if (!window.ethereum) throw new Error("MetaMask n'est pas détecté.");
}

// Adresse depuis l'artifact Truffle (réseau 5777)
function getAddressFromArtifact() {
  const networks = FakeNewsVerifierArtifact.networks || {};
  const addr = networks["5777"]?.address;
  if (!addr) {
    throw new Error(
      "Adresse introuvable dans FakeNewsVerifier.json pour networks['5777']. " +
        "Refais: truffle migrate --reset puis copie l'artifact vers app/src/contracts.",
    );
  }
  return addr;
}

// ✅ export utile
export function getContractAddress() {
  return getAddressFromArtifact();
}

async function getMetaMaskProvider() {
  ensureMetaMask();
  return new ethers.BrowserProvider(window.ethereum);
}

async function assertContractExistsOnGanache(address) {
  const ganacheProvider = new ethers.JsonRpcProvider(GANACHE_RPC_URL);
  const code = await ganacheProvider.getCode(address);
  if (!code || code === "0x") {
    throw new Error(
      `Le contrat n'existe PAS sur Ganache (${GANACHE_RPC_URL}) à l'adresse ${address}. ` +
        "=> Redéploie (truffle migrate --reset) et recopie l'artifact.",
    );
  }
}

async function assertMetaMaskOnSameChain(address) {
  const mmProvider = await getMetaMaskProvider();
  const net = await mmProvider.getNetwork();

  const code = await mmProvider.getCode(address);
  if (!code || code === "0x") {
    throw new Error(
      `MetaMask ne voit aucun contrat à ${address} (chainId=${net.chainId}). ` +
        `=> MetaMask n'est pas sur la même instance Ganache que ${GANACHE_RPC_URL}. ` +
        "Corrige le réseau MetaMask + importe un compte Ganache.",
    );
  }
}

async function getContract(withSigner = false) {
  const address = getAddressFromArtifact();

  // Source de vérité : le contrat doit exister sur Ganache RPC
  await assertContractExistsOnGanache(address);

  // MetaMask doit être sur la même chaîne
  await assertMetaMaskOnSameChain(address);

  const mmProvider = await getMetaMaskProvider();
  const abi = FakeNewsVerifierArtifact.abi;

  if (withSigner) {
    const signer = await mmProvider.getSigner();
    return new ethers.Contract(address, abi, signer);
  }
  return new ethers.Contract(address, abi, mmProvider);
}

/**
 * ---- Wallet / Identity ----
 */
export async function connectWallet() {
  ensureMetaMask();
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });
  return accounts[0];
}

export async function getCurrentAccount() {
  ensureMetaMask();
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  return accounts?.[0] || "";
}

/**
 * ---- Role checks ----
 */
export async function getOwner() {
  const contract = await getContract(false);
  return await contract.owner();
}

export async function isModerator(address) {
  const contract = await getContract(false);
  return await contract.moderators(address);
}

export async function getMyRole() {
  const me = await getCurrentAccount();
  if (!me) return { account: "", isOwner: false, isModerator: false };

  const contract = await getContract(false);
  const owner = await contract.owner();
  const mod = await contract.moderators(me);

  return {
    account: me,
    isOwner: owner.toLowerCase() === me.toLowerCase(),
    isModerator: Boolean(mod),
  };
}

/**
 * ---- Read operations ----
 */
export async function getInformationsCount() {
  const contract = await getContract(false);
  const count = await contract.getInformationsCount();
  return Number(count);
}

export async function getInformation(index) {
  const contract = await getContract(false);
  const info = await contract.informations(index);

  return {
    index,
    contentHash: info[0],
    source: info[1],
    reliabilityScore: Number(info[2]),
    validated: info[3],
    author: info[4],
    timestamp: new Date(Number(info[5]) * 1000),
  };
}

export async function listAllInformations() {
  const count = await getInformationsCount();
  const items = [];
  for (let i = 0; i < count; i++) items.push(await getInformation(i));
  return items;
}

/**
 * ---- Hashing ----
 */
export function hashContent(text) {
  const normalized = (text || "").trim().toLowerCase().replace(/\s+/g, " ");
  return ethers.keccak256(ethers.toUtf8Bytes(normalized));
}

/**
 * ---- Write operations ----
 */
export async function submitInformationFromText({ text, source, score }) {
  const contract = await getContract(true);
  const contentHash = hashContent(text);
  const boundedScore = Math.max(0, Math.min(100, Number(score)));

  const tx = await contract.submitInformation(
    contentHash,
    source,
    boundedScore,
  );
  const receipt = await tx.wait();

  return { txHash: receipt.hash, contentHash, score: boundedScore };
}

export async function validateInformation(index) {
  const contract = await getContract(true);
  const tx = await contract.validateInformation(index);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function setModerator(moderatorAddress, enabled) {
  const contract = await getContract(true);
  const tx = await contract.setModerator(moderatorAddress, Boolean(enabled));
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * ---- Events ----
 * Renvoie une fonction unsubscribe async()
 */
export async function onContractEvent(eventName, handler) {
  const contract = await getContract(false);
  contract.on(eventName, handler);

  return async () => {
    try {
      contract.off(eventName, handler);
    } catch (_) {
      // ignore
    }
  };
}
