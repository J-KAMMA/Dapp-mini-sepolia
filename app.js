// app.js
import { BrowserProvider } from 'https://esm.sh/ethers@6.13.2';

const $ = id => document.getElementById(id);
const log = (...a) => { console.log(...a); $('log').textContent += a.join(' ') + '\n'; };

document.addEventListener('DOMContentLoaded', () => {
  $('btnConnect').onclick = async () => {
    try {
      if (!window.ethereum) { alert('MetaMaskを入れてください'); return; }
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      log('✅ ウォレット接続OK');
    } catch (e) {
      log('❌ 接続エラー:', e.message || e);
    }
  };
});
