import {
  ARC_CHAIN_HEX, ARC_CHAIN_ID, ARC_EXPLORER_URL, ARC_RPC_URL, USDC_ADDRESS, USDC_DECIMALS,
} from './live-policy.mjs';

const VIEM_URL = 'https://esm.sh/viem@2.21.54';
const erc20Abi = [{
  type: 'function', name: 'balanceOf', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }],
}];

const short = (value) => `${value.slice(0, 6)}…${value.slice(-4)}`;

export async function initLiveDemo({ ui }) {
  const writeButtons = [ui.create, ui.delegate, ui.approve, ui.execute, ui.revoke];
  writeButtons.forEach((button) => {
    button.disabled = true;
    button.title = 'Mainnet writes are disabled; this audit surface is read-only.';
  });
  ui.cap.textContent = 'writes disabled';

  const setUnavailable = (message) => {
    ui.message.textContent = message;
    ui.message.className = 'live-message error';
    ui.message.setAttribute('role', 'alert');
  };
  const setMessage = (message, type = '') => {
    ui.message.textContent = message;
    ui.message.className = `live-message ${type}`;
    ui.message.setAttribute('role', type === 'error' ? 'alert' : 'status');
  };
  ui.connect.onclick = () => setUnavailable(window.ethereum
    ? 'Wallet client is still loading. Reload the page and try again.'
    : 'No injected EVM wallet found. Install MetaMask or Rabby, then reload this page.');

  let viem;
  try {
    viem = await import(VIEM_URL);
  } catch (error) {
    setUnavailable(`Read-only wallet client failed to load: ${error.message}`);
    return;
  }

  const { createPublicClient, http, formatUnits, defineChain } = viem;
  const arc = defineChain({
    id: Number(ARC_CHAIN_ID),
    name: 'Arc Mainnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [ARC_RPC_URL] } },
    blockExplorers: { default: { name: 'Arc Explorer', url: ARC_EXPLORER_URL } },
  });
  const publicClient = createPublicClient({ chain: arc, transport: http(ARC_RPC_URL) });
  let provider;
  let account;

  const refresh = async () => {
    if (!account) return;
    const chainId = await provider.request({ method: 'eth_chainId' });
    ui.chain.textContent = BigInt(chainId) === ARC_CHAIN_ID ? 'Arc Mainnet · 5042' : `Wrong network · ${BigInt(chainId)}`;
    ui.address.textContent = short(account);
    if (BigInt(chainId) !== ARC_CHAIN_ID) {
      ui.balance.textContent = 'Switch to Arc Mainnet to read balance';
      return;
    }
    try {
      const balance = await publicClient.readContract({
        address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account],
      });
      ui.balance.textContent = `${formatUnits(balance, USDC_DECIMALS)} USDC`;
    } catch {
      ui.balance.textContent = 'Balance unavailable';
    }
  };

  const connect = async () => {
    if (!window.ethereum) throw new Error('No injected EVM wallet found. Install MetaMask or Rabby.');
    provider = window.ethereum;
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    account = accounts[0];
    await refresh();
    if (BigInt(await provider.request({ method: 'eth_chainId' })) !== ARC_CHAIN_ID) ui.switchButton.hidden = false;
    ui.connect.textContent = short(account);
    setMessage('Wallet connected in read-only mode. No transaction actions are available.', 'ok');
  };

  const switchNetwork = async () => {
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN_HEX }] });
    } catch (error) {
      if (error.code !== 4902) throw error;
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: ARC_CHAIN_HEX, chainName: 'Arc Mainnet',
          nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
          rpcUrls: [ARC_RPC_URL], blockExplorerUrls: [ARC_EXPLORER_URL],
        }],
      });
    }
    await refresh();
    ui.switchButton.hidden = true;
    setMessage('Arc Mainnet selected. This surface remains read-only.', 'ok');
  };

  ui.connect.onclick = () => connect().catch((error) => setMessage(error.shortMessage || error.message, 'error'));
  ui.switchButton.onclick = () => switchNetwork().catch((error) => setMessage(error.message, 'error'));
  if (window.ethereum) window.ethereum.on?.('accountsChanged', (accounts) => {
    account = accounts[0];
    refresh().catch(() => {});
  });
  if (window.ethereum) window.ethereum.on?.('chainChanged', () => refresh().catch(() => {}));
}
