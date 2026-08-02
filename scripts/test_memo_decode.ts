/**
 * Verify the devnet-path memo decoding: build a real signed transaction,
 * compile its message (same shape getTransaction returns over JSON RPC),
 * and confirm extractMemosFromCompiledMessage recovers the externalId.
 */
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import { extractMemosFromCompiledMessage, MEMO_PROGRAM_ID_V2 } from '../src/mppEngine';

const payer = Keypair.generate();
const merchant = Keypair.generate();
const externalId = 'SEOCHO-1785631000000-unittest01';

const tx = new Transaction();
const transfer = SystemProgram.transfer({
  fromPubkey: payer.publicKey,
  toPubkey: merchant.publicKey,
  lamports: 50_000_000
});
transfer.keys.push({ pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: false });
tx.add(transfer);
tx.add(
  new TransactionInstruction({
    keys: [],
    programId: new PublicKey(MEMO_PROGRAM_ID_V2),
    data: Buffer.from(externalId, 'utf-8')
  })
);
tx.feePayer = payer.publicKey;
tx.recentBlockhash = '4uQvQbGt5i2GsiSnh2Et4by7G4g5A8t1929312389128';
tx.sign(payer);

// This mirrors what connection.getTransaction(... ) returns for a legacy tx:
// message.accountKeys + message.instructions with base58-encoded data.
const msg = tx.compileMessage();
console.log('instruction count:', msg.instructions.length);
console.log('memo instruction data encoding check (base58 string):', typeof msg.instructions[1].data);

const memos = extractMemosFromCompiledMessage(msg.accountKeys as any, msg.instructions);
console.log('extracted memos:', memos);

if (memos.length === 1 && memos[0] === externalId) {
  console.log('✅ PASS: externalId memo recovered from compiled message (devnet path works)');
  process.exit(0);
} else {
  console.log('❌ FAIL: memo not recovered');
  process.exit(1);
}
