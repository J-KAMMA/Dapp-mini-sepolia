// app.js — CSP対応のESM版
import { BrowserProvider, Contract, formatEther, formatUnits, parseUnits } from 'https://esm.sh/ethers@6.13.2';

const CONTRACT = "0xa814146ccE08EC174eC7A5ad05e8C350376f5A92";
const CHAIN_ID = 11155111; // Sepolia
const ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function getVotes(address) view returns (uint256)",
  "function delegates(address) view returns (address)",
  "function delegate(address)",
  "function quoteBuy(uint256) view returns (uint256 grossETH, uint256 feeETH)",
  "function quoteSell(uint256) view returns (uint256 grossETH, uint256 feeETH)",
  "function buy(uint256 amount, uint256 maxCostETH) payable",
  "function sell(uint256 amount, uint256 minPayoutETH)",
  "function owner() view returns (address)"
];

const $ = (id) => document.getElementById(id);
const log = (m, cls) => {
  const el = $("log");
  const line = document.createElement("div");
  if(cls) line.className = cls;
  line.textContent = (new Date()).toLocaleTimeString()+"  "+m;
  el.prepend(line);
};

let provider, signer, wgt, acct, decimals = 18;

async function ensureNetwork() {
  try {
    const netHex = await provider.send('eth_chainId', []);
    const current = parseInt(netHex, 16);
    const warn = $("netwarn");
    if (current !== CHAIN_ID) {
      warn.style.display = '';
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xAA36A7' }] });
        warn.style.display = 'none';
        return true;
      } catch (e) {
        if (e && (e.code === 4902 || (typeof e.message === 'string' && e.message.includes('Unrecognized chain')))){
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xAA36A7',
                chainName: 'Sepolia',
                nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io']
              }]
            });
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xAA36A7' }] });
            warn.style.display = 'none';
            return true;
          } catch (e2) { console.error(e2); return false; }
        }
        console.error(e); return false;
      }
    } else { warn.style.display = 'none'; return true; }
  } catch (e) { console.error(e); return false; }
}

async function connect() {
  if (!window.ethereum) { alert('MetaMask をインストールしてください'); return; }
  provider = new BrowserProvider(window.ethereum);
  try {
    await provider.send('eth_requestAccounts', []);
  } catch {
    alert('接続が拒否されました。もう一度押して許可してください。');
    return;
  }
  const ok = await ensureNetwork(); if (!ok) { log('Sepoliaに切替できませんでした', 'warn'); return; }

  signer = await provider.getSigner();
  acct = await signer.getAddress();
  wgt = new Contract(CONTRACT, ABI, signer);
  try { decimals = await wgt.decimals(); } catch {}

  $("who").textContent = acct;
  $("btnRefresh").disabled = false;
  ["btnQuoteBuy","btnBuy","btnQuoteSell","btnSell","btnDelegate"].forEach(id=>$(id).disabled=false);

  if (window.ethereum && window.ethereum.on){
    window.ethereum.on('accountsChanged', () => location.reload());
    window.ethereum.on('chainChanged', () => location.reload());
  }
  await refresh();
}

async function refresh() {
  if (!provider) return;
  const ethBal = await provider.getBalance(acct);
  const w = await wgt.balanceOf(acct);
  const v = await wgt.getVotes(acct);
  const ts = await wgt.totalSupply();
  const res = await provider.getBalance(CONTRACT);
  $("eth").textContent = formatEther(ethBal);
  $("wgt").textContent = formatUnits(w, decimals);
  $("votes").textContent = formatUnits(v, decimals);
  $("supply").textContent = formatUnits(ts, decimals);
  $("reserve").textContent = formatEther(res);
}

async function quoteBuy() {
  const amt = $("buyAmt").value.trim() || "0";
  const n = parseUnits(amt, decimals);
  const [gross, fee] = await wgt.quoteBuy(n);
  const total = gross + fee;
  $("buyQuote").value = formatEther(total) + ` ETH (fee ${formatEther(fee)} ETH)`;
  return { n, gross, fee, total };
}
async function doBuy() {
  const { n, total } = await quoteBuy();
  const max = total * 101n / 100n; // +1%スリッページ
  const tx = await wgt.buy(n, max, { value: total });
  log(`buy 送信: ${tx.hash}`);
  const rc = await tx.wait(); log(`buy 成功: block ${rc.blockNumber}`, 'ok');
  await refresh();
}

async function quoteSell() {
  const amt = $("sellAmt").value.trim() || "0";
  const n = parseUnits(amt, decimals);
  const [gross, fee] = await wgt.quoteSell(n);
  const net = gross - fee;
  $("sellQuote").value = formatEther(net) + ` ETH (fee ${formatEther(fee)} ETH)`;
  return { n, gross, fee, net };
}
async function doSell() {
  const { n, net } = await quoteSell();
  const min = net * 99n / 100n; // -1% スリッページ
  const tx = await wgt.sell(n, min);
  log(`sell 送信: ${tx.hash}`);
  const rc = await tx.wait(); log(`sell 成功: block ${rc.blockNumber}`, 'ok');
  await refresh();
}

async function doDelegate() {
  const tx = await wgt.delegate(acct);
  log(`delegate 送信: ${tx.hash}`);
  const rc = await tx.wait(); log(`delegate 成功: block ${rc.blockNumber}`, 'ok');
  await refresh();
}

document.addEventListener('DOMContentLoaded', () => {
  $("btnConnect").onclick = connect;
  $("btnRefresh").onclick = refresh;
  $("btnQuoteBuy").onclick = quoteBuy;
  $("btnBuy").onclick    = doBuy;
  $("btnQuoteSell").onclick = quoteSell;
  $("btnSell").onclick   = doSell;
  $("btnDelegate").onclick = doDelegate;
});
