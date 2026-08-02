import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import {
  parseWwwAuthenticate,
  decodeChargeRequest,
  buildPaymentCredential,
  MEMO_PROGRAM_ID_V2
} from './mppEngine';

const SERVER_URL = process.env.SERVER_URL || 'https://solana-paysh-app-1064390008895.us-central1.run.app/api/scrape';
const MOCK_RPC_URL = process.env.MOCK_RPC_URL || 'https://solana-paysh-app-1064390008895.us-central1.run.app/api/mock-rpc/send-transaction';
const RPC_URL = 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

// Path to store client keypair so it persists and retains its devnet SOL
const KEYPAIR_PATH = path.join(__dirname, '../client-keypair.json');

// Load or generate Client Keypair
let clientKeypair: Keypair;
if (fs.existsSync(KEYPAIR_PATH)) {
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8')));
  clientKeypair = Keypair.fromSecretKey(secretKey);
} else {
  clientKeypair = Keypair.generate();
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(clientKeypair.secretKey)), 'utf-8');
}

const clientPublicKey = clientKeypair.publicKey;
console.log(`==================================================`);
console.log(`Client Agent (Agent A) Public Key: ${clientPublicKey.toBase58()}`);
console.log(`==================================================`);

// Flag to track if we should fallback to local mock server verification
let isMockMode = false;

// List of target product opportunities to evaluate
const TARGET_OPPORTUNITIES = [
  { url: 'https://www.aliexpress.com/item/1005006240212345.html', maxProductPriceUsd: 50.00 }, // Product 1
  { url: 'https://www.aliexpress.com/item/1005007321459876.html', maxProductPriceUsd: 35.00 }, // Product 2
  { url: 'https://www.aliexpress.com/item/1005008543210123.html', maxProductPriceUsd: 80.00 }  // Product 3
];

// Maximum allowed Solana fee per scrape operation (Safety limit for Tier 3 data)
const MAX_SOLANA_FEE_LIMIT = 0.06; 

async function checkAndPrepareFunds() {
  try {
    const balance = await connection.getBalance(clientPublicKey);
    const balanceInSol = balance / 1e9;
    console.log(`[Agent A] Current Client Wallet Balance: ${balanceInSol} SOL`);

    if (balanceInSol < 0.06) {
      console.log(`[Agent A] Balance is low. Requesting airdrop of 1.0 SOL from Devnet...`);
      try {
        const airdropSig = await connection.requestAirdrop(clientPublicKey, 1.0 * 1e9);
        console.log(`[Agent A] Airdrop transaction sent. Signature: ${airdropSig}`);
        console.log(`[Agent A] Waiting for confirmation...`);
        
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
          signature: airdropSig,
          ...latestBlockhash
        }, 'confirmed');
        
        const newBalance = await connection.getBalance(clientPublicKey);
        console.log(`[Agent A] Airdrop confirmed! New balance: ${newBalance / 1e9} SOL`);
      } catch (err) {
        console.log(`⚠️ Devnet airdrop failed (possibly due to faucet rate limits).`);
        console.log(`👉 Falling back to Mock Sandbox Mode! (Transactions will be simulated locally)`);
        isMockMode = true;
      }
    }
  } catch (err) {
    console.log(`⚠️ Failed to connect to Solana Devnet or check balance.`);
    console.log(`👉 Falling back to Mock Sandbox Mode!`);
    isMockMode = true;
  }
}

async function evaluateAndScrape(opportunity: { url: string, maxProductPriceUsd: number }, tier: number = 3) {
  console.log(`\n--------------------------------------------------`);
  console.log(`[Agent A] Evaluating opportunity (Tier ${tier}): ${opportunity.url}`);
  console.log(`--------------------------------------------------`);
  
  try {
    // 1. Send initial POST request with requestedTier
    console.log(`[Agent A] Initiating request to Seller Central for Tier ${tier} data...`);
    const response = await axios.post(SERVER_URL, { url: opportunity.url, requestedTier: tier }, {
      validateStatus: (status) => status === 200 || status === 402
    });

    if (response.status === 200) {
      console.log(`[Agent A] Data was already purchased and cached:`, response.data.data.title);
      return;
    }

    if (response.status === 402) {
      console.log(`[Agent A] [HTTP 402 Payment Required] Tier ${tier} Challenge received.`);
      const { recipient, amount, reference, message } = response.data;
      console.log(`  - Recipient Merchant: ${recipient}`);
      console.log(`  - Fee Requested: ${amount} SOL`);
      console.log(`  - Reference Key: ${reference}`);

      // MPP (draft-solana-charge-00): parse the standard challenge header
      const wwwAuth = (response.headers['www-authenticate'] as string) || '';
      const mppParams = parseWwwAuthenticate(wwwAuth);
      let externalId: string | undefined;
      if (mppParams) {
        const chargeRequest = decodeChargeRequest(mppParams.request);
        externalId = chargeRequest.externalId;
        console.log(`  - MPP Challenge: id=${mppParams.id}, expires=${mppParams.expires}`);
        console.log(`  - MPP externalId (on-chain Memo binding): ${externalId}`);
      }

      // A2A Decision Point 1: Safety fee budget check
      if (amount > MAX_SOLANA_FEE_LIMIT) {
        console.log(`[Agent A] ❌ Transaction Aborted: Requested fee (${amount} SOL) exceeds safety limit (${MAX_SOLANA_FEE_LIMIT} SOL).`);
        return;
      }
      console.log(`[Agent A] ✓ Fee criteria matches (Amount: ${amount} SOL <= Limit: ${MAX_SOLANA_FEE_LIMIT} SOL).`);

      // 2. Prepare transaction
      console.log(`[Agent A] Constructing Solana Transfer transaction...`);
      const recipientPubKey = new PublicKey(recipient);
      const referencePubKey = new PublicKey(reference);

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: clientPublicKey,
        toPubkey: recipientPubKey,
        lamports: Math.round(amount * 1e9)
      });

      // Crucial: Add the reference public key as a non-signer, non-writable account.
      transferInstruction.keys.push({
        pubkey: referencePubKey,
        isSigner: false,
        isWritable: false
      });

      // Get blockhash
      let blockhash = '4uQvQbGt5i2GsiSnh2Et4by7G4g5A8t1929312389128'; // Mock blockhash fallback
      let lastValidBlockHeight = 100000;
      
      if (!isMockMode) {
        try {
          const latestBlockhash = await connection.getLatestBlockhash();
          blockhash = latestBlockhash.blockhash;
          lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
        } catch (err) {
          console.log(`Failed to fetch live blockhash, switching to mock mode.`);
          isMockMode = true;
        }
      }

      const transaction = new Transaction();
      transaction.add(transferInstruction);

      // MPP: embed the challenge externalId as an on-chain Memo instruction
      if (externalId) {
        transaction.add(new TransactionInstruction({
          keys: [],
          programId: new PublicKey(MEMO_PROGRAM_ID_V2),
          data: Buffer.from(externalId, 'utf-8')
        }));
        console.log(`[Agent A] Attached Memo instruction with externalId.`);
      }

      transaction.feePayer = clientPublicKey;
      transaction.recentBlockhash = blockhash;

      // Sign the transaction
      transaction.sign(clientKeypair);
      console.log(`[Agent A] Transaction signed autonomously.`);

      let signatureStr = '';

      if (isMockMode) {
        // --- Mock Mode Flow ---
        console.log(`[Agent A] [Mock Mode] Submitting transaction to mock RPC...`);
        const rawTransaction = transaction.serialize();
        const transactionB64 = Buffer.from(rawTransaction).toString('base64');
        
        const mockRpcResponse = await axios.post(MOCK_RPC_URL, { transactionB64 });
        signatureStr = mockRpcResponse.data.signature;
        console.log(`[Agent A] [Mock Mode] Registered mock signature: ${signatureStr}`);
      } else {
        // --- Live Devnet Flow ---
        const rawTransaction = transaction.serialize();
        console.log(`[Agent A] Submitting transaction to Solana Devnet...`);
        const signature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });
        signatureStr = signature;
        console.log(`[Agent A] Transaction submitted. Signature: ${signatureStr}`);

        console.log(`[Agent A] Waiting for confirmations...`);
        await connection.confirmTransaction({
          signature: signatureStr,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        console.log(`[Agent A] Confirmed on-chain!`);
      }

      // 3. Re-submit request with payment signature headers
      console.log(`[Agent A] Re-submitting request with signature headers to unlock Tier ${tier} data...`);
      const retryHeaders: Record<string, string> = {
        'x-payment-signature': signatureStr,
        'x-payment-reference': reference
      };

      // MPP: attach the standard Authorization: Payment credential (push mode)
      if (mppParams) {
        retryHeaders['Authorization'] = buildPaymentCredential(
          mppParams,
          clientPublicKey.toBase58(),
          signatureStr
        );
        console.log(`[Agent A] Attached MPP Authorization credential (payload type=signature).`);
      }

      const retryResponse = await axios.post(SERVER_URL, { url: opportunity.url, requestedTier: tier }, {
        headers: retryHeaders,
        validateStatus: (status) => true
      });

      const paymentReceipt = retryResponse.headers['payment-receipt'];
      if (paymentReceipt) {
        console.log(`[Agent A] Payment-Receipt received: ${paymentReceipt}`);
      }

      if (retryResponse.status === 200) {
        const product = retryResponse.data.data;
        console.log(`\n🎉 [Agent A] SUCCESS! Tier ${tier} Scraped Data Unlocked!`);
        console.log(`[Agent A] Analyzing Product details...`);
        console.log(`  - Title: ${product.title}`);
        console.log(`  - Price: $${product.price} USD`);
        console.log(`  - Source Page: ${product.sourceUrl}`);
        
        if (product.dataJsonLd) {
          console.log(`\n📐 [JSON-LD Ontology Properties Unlocked]`);
          console.log(`  - Brand:`, product.dataJsonLd.brand?.name);
          console.log(`  - MOQ:`, product.dataJsonLd.offers?.moq?.value, 'units');
          
          if (product.dataJsonLd.additionalProperty) {
            console.log(`  - Additional Properties:`);
            product.dataJsonLd.additionalProperty.forEach((prop: any) => {
              console.log(`     * ${prop.name}: ${prop.value} ${prop.unitCode || ''}`);
            });
          }
          
          if (product.dataJsonLd.viabilitySummary) {
            console.log(`  - Viability Summary:`, product.dataJsonLd.viabilitySummary);
          }
        }

        // A2A Decision Point 2: Post-purchase product price criteria check
        if (product.price <= opportunity.maxProductPriceUsd) {
          console.log(`\n[Agent A] ✓ Deal Accepted! Product price ($${product.price}) matches criteria (<= Max Budget $${opportunity.maxProductPriceUsd}).`);
          console.log(`[Agent A] Inventory status: REGISTERED IN AGENT CATALOG`);
        } else {
          console.log(`\n[Agent A] ⚠️ Deal Warned: Product price ($${product.price}) exceeds client budget limit of $${opportunity.maxProductPriceUsd}.`);
          console.log(`[Agent A] Inventory status: FLAGGED FOR REVIEW`);
        }
      } else {
        console.log(`\n❌ [Agent A] Verification failed on server side.`);
        console.log(`Status code: ${retryResponse.status}`);
        console.log(`Response:`, retryResponse.data);
      }
    }
  } catch (error: any) {
    console.error(`[Agent A] Error executing item evaluation:`, error.message);
  }
}

async function runAgent() {
  await checkAndPrepareFunds();

  // Evaluate the first opportunity immediately
  let index = 0;
  await evaluateAndScrape(TARGET_OPPORTUNITIES[index]);

  // Set up scheduler to evaluate remaining opportunities every 15 seconds
  const interval = setInterval(async () => {
    index++;
    if (index >= TARGET_OPPORTUNITIES.length) {
      console.log(`\n[Agent A] Finished evaluating all opportunities. Shutting down client scheduler.`);
      clearInterval(interval);
      return;
    }
    await evaluateAndScrape(TARGET_OPPORTUNITIES[index]);
  }, 15000);
}

runAgent().catch(console.error);
