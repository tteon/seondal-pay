import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const keypairPath = path.join(__dirname, '../client-keypair.json');
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')));
  const kp = Keypair.fromSecretKey(secretKey);
  console.log('pubkey:', kp.publicKey.toBase58());
  try {
    const sig = await connection.requestAirdrop(kp.publicKey, 0.5 * LAMPORTS_PER_SOL);
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
    console.log('airdrop OK:', sig);
  } catch (e: any) {
    console.log('airdrop failed:', String(e.message || e).slice(0, 150));
  }
  console.log('balance:', (await connection.getBalance(kp.publicKey)) / 1e9, 'SOL');
}
main();
