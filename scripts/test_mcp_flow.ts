/**
 * test_mcp_flow.ts — E2E for the MCP server: initialize → tools/list →
 * free tool → payment challenge → pay (mock RPC) → paid tool.
 */
import axios from 'axios';
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { MEMO_PROGRAM_ID_V2 } from '../src/mppEngine';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const payer = Keypair.generate();
let failures = 0;
const check = (name: string, ok: boolean, extra?: any) => {
  console.log(`${ok ? '✅' : '❌'} ${name}`, ok ? '' : JSON.stringify(extra).slice(0, 250));
  if (!ok) failures++;
};
const rpc = (method: string, params: any = {}) =>
  axios.post(`${BASE}/mcp`, { jsonrpc: '2.0', id: Math.floor(Math.random() * 1e6), method, params });

async function main() {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18' });
  check('initialize returns serverInfo', init.data.result?.serverInfo?.name === 'seondal-pay', init.data);

  const list = await rpc('tools/list');
  const names = (list.data.result?.tools || []).map((t: any) => t.name);
  check('tools/list has 8 tools', names.length === 8, names);
  check('paid tool present', names.includes('get_sourcing_analysis'), names);

  const pie = await rpc('tools/call', { name: 'get_market_pie', arguments: { group: '롬퍼' } });
  check('free tool get_market_pie works', !!pie.data.result?.content, pie.data);

  const ch = await rpc('tools/call', { name: 'get_payment_challenge', arguments: { tier: 3 } });
  const chData = JSON.parse(ch.data.result.content[0].text);
  check('challenge has externalId + amount', !!chData.externalId && chData.amountSol === 0.05, chData);

  // Pay it via mock RPC (transfer + memo externalId)
  const tx = new Transaction();
  const transfer = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(chData.recipient),
    lamports: Math.round(chData.amountSol * 1e9),
  });
  tx.add(transfer);
  tx.add(new TransactionInstruction({ keys: [], programId: new PublicKey(MEMO_PROGRAM_ID_V2), data: Buffer.from(chData.externalId, 'utf-8') }));
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = '4uQvQbGt5i2GsiSnh2Et4by7G4g5A8t1929312389128';
  tx.sign(payer);
  const reg = await axios.post(`${BASE}/api/mock-rpc/send-transaction`, { transactionB64: Buffer.from(tx.serialize()).toString('base64') });
  const sig = reg.data.signature;
  console.log('  paid signature:', sig.slice(0, 20) + '…');

  const paid = await rpc('tools/call', { name: 'get_sourcing_analysis', arguments: { query: '롬퍼', paymentSignature: sig } });
  const paidText = paid.data.result?.content?.[0]?.text || '';
  check('paid tool unlocked after payment', paidText.includes('steps') && !paid.data.result?.isError, paid.data.result);

  const replay = await rpc('tools/call', { name: 'get_sourcing_analysis', arguments: { query: '롬퍼', paymentSignature: sig } });
  check('replay rejected', replay.data.result?.isError === true, replay.data.result);

  console.log(failures === 0 ? '\n🎉 MCP FLOW PASSED' : `\n⚠️ ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
