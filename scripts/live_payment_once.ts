/**
 * live_payment_once.ts — One real MPP payment against the LIVE GKE service.
 * Uses the server's Mock RPC path (no devnet funds needed) so the full
 * server-side flow (verify → scrape → Cloud SQL upsert → comparator →
 * Discord alert) executes for real.
 */
import axios from 'axios';
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { parseWwwAuthenticate, decodeChargeRequest, buildPaymentCredential, MEMO_PROGRAM_ID_V2, base64urlDecode } from '../src/mppEngine';

const BASE = process.env.BASE_URL || 'http://34.46.201.195';
const payer = Keypair.generate();

async function main() {
  console.log(`1) POST ${BASE}/api/scrape (no payment) → expect 402 + WWW-Authenticate`);
  const ch = await axios.post(`${BASE}/api/scrape`, {
    url: 'https://www.aliexpress.com/item/1005008543210123.html', requestedTier: 3,
  }, { validateStatus: () => true });
  console.log('   status:', ch.status);
  const params = parseWwwAuthenticate(ch.headers['www-authenticate'] || '');
  if (!params) throw new Error('no MPP challenge');
  const cr = decodeChargeRequest(params.request);
  console.log('   externalId:', cr.externalId, '| amount:', cr.amount, 'lamports | expires:', params.expires);

  console.log('2) Build tx (transfer + reference key + Memo externalId) → register via server Mock RPC');
  const tx = new Transaction();
  const transfer = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(ch.data.recipient),
    lamports: Math.round(ch.data.amount * 1e9),
  });
  transfer.keys.push({ pubkey: new PublicKey(ch.data.reference), isSigner: false, isWritable: false });
  tx.add(transfer);
  tx.add(new TransactionInstruction({ keys: [], programId: new PublicKey(MEMO_PROGRAM_ID_V2), data: Buffer.from(cr.externalId, 'utf-8') }));
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = '4uQvQbGt5i2GsiSnh2Et4by7G4g5A8t1929312389128';
  tx.sign(payer);
  const reg = await axios.post(`${BASE}/api/mock-rpc/send-transaction`, {
    transactionB64: Buffer.from(tx.serialize()).toString('base64'),
  });
  const sig = reg.data.signature;
  console.log('   signature:', sig.slice(0, 24) + '…');

  console.log('3) Retry with Authorization: Payment credential');
  const res = await axios.post(`${BASE}/api/scrape`, {
    url: 'https://www.aliexpress.com/item/1005008543210123.html', requestedTier: 3,
  }, {
    headers: { Authorization: buildPaymentCredential(params, payer.publicKey.toBase58(), sig) },
    validateStatus: () => true,
  });
  console.log('   status:', res.status);
  const receipt = res.headers['payment-receipt'];
  if (receipt) {
    const dec = JSON.parse(base64urlDecode(receipt).toString('utf-8'));
    console.log('   Payment-Receipt:', JSON.stringify(dec));
  }
  if (res.status === 200) {
    console.log('   ✅ product:', res.data.data.title.slice(0, 60));
    console.log('   protocol:', res.data.payment.protocol, '| mode:', res.data.payment.mode);
    console.log('   → check Discord #seondal-alerts for the high-ROI embed, and /api/products for the Cloud SQL row');
  } else {
    console.log('   ❌', JSON.stringify(res.data).slice(0, 300));
    process.exit(1);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
