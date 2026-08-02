import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { logEvent, dbOperations, dbOperationDuration } from './observability';

// Record one DB operation: counter + duration histogram (+ error log on failure)
function recordDbOp(operation: string, backend: 'postgres' | 'mock', startMs: number, result: 'ok' | 'error') {
  dbOperations.inc({ operation, backend, result });
  dbOperationDuration.observe({ operation, backend }, (Date.now() - startMs) / 1000);
  if (result === 'error') {
    logEvent('error', 'db.operation_failed', { operation, backend });
  }
}

const isProduction = process.env.NODE_ENV === 'production';
const connectionName = process.env.INSTANCE_CONNECTION_NAME; // e.g. "project:us-central1:instance"

const pgConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'app_db',
  host: connectionName ? `/cloudsql/${connectionName}` : (process.env.DB_HOST || 'localhost'),
  port: connectionName ? undefined : parseInt(process.env.DB_PORT || '5432'),
};

let pool: Pool | null = null;
let useMock = false;

// Local Mock Database path
const MOCK_DB_DIR = path.join(__dirname, '../local_gcp_mock/postgresql');
const MOCK_DB_FILE = path.join(MOCK_DB_DIR, 'products.json');

// Initialize mock DB file if it doesn't exist
function initMockDb() {
  if (!fs.existsSync(MOCK_DB_DIR)) {
    fs.mkdirSync(MOCK_DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(MOCK_DB_FILE)) {
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify([]), 'utf-8');
  }
}

export async function initDb() {
  // If no DB_HOST is configured and we are not in production, we default to Mock mode
  if (!process.env.DB_HOST && !connectionName && !isProduction) {
    console.log(`[Database] No DB_HOST or connection name configured. Enabling Mock PostgreSQL mode!`);
    useMock = true;
    initMockDb();
    return;
  }

  // Retry: the Cloud SQL Auth Proxy sidecar may need a few seconds to start
  // listening — don't fall back to mock on the first refused connection.
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      pool = new Pool(pgConfig);
      // Test the connection
      const client = await pool.connect();
      console.log(`[Database] Successfully connected to PostgreSQL.`);

      // Create the products table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          product_id VARCHAR(255) PRIMARY KEY,
          title TEXT NOT NULL,
          price NUMERIC(10, 2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          image_url TEXT,
          source_url TEXT,
          scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          raw_html_gcs_url TEXT,
          data_json_ld JSONB
        );
        ALTER TABLE products ADD COLUMN IF NOT EXISTS data_json_ld JSONB;
        CREATE INDEX IF NOT EXISTS idx_products_json_ld ON products USING gin (data_json_ld);
      `);
      client.release();
      logEvent('info', 'db.connected', { backend: 'postgres', attempt });
      return;
    } catch (err: any) {
      console.log(`[Database Warning] Connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      try { if (pool) await pool.end(); } catch { /* ignore */ }
      pool = null;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
  console.log(`[Database Warning] Failed to connect to PostgreSQL after ${maxAttempts} attempts.`);
  console.log(`👉 Falling back to Mock PostgreSQL mode! (Data will be stored in local JSON)`);
  useMock = true;
  initMockDb();
  logEvent('error', 'db.connection_failed', { attempts: maxAttempts, fallback: 'mock' });
}

// Wrapper for queries
export async function queryProducts(): Promise<any[]> {
  const start = Date.now();
  const backend = useMock ? 'mock' : 'postgres';
  try {
    if (useMock) {
      initMockDb();
      const data = fs.readFileSync(MOCK_DB_FILE, 'utf-8');
      recordDbOp('query', backend, start, 'ok');
      return JSON.parse(data);
    }

    if (!pool) throw new Error("Database pool is not initialized");
    const res = await pool.query('SELECT * FROM products ORDER BY scraped_at DESC');

    recordDbOp('query', backend, start, 'ok');
    // Map PostgreSQL columns back to camelCase to match application layer
    return res.rows.map(row => ({
      productId: row.product_id,
      title: row.title,
      price: parseFloat(row.price),
      currency: row.currency,
      imageUrl: row.image_url,
      sourceUrl: row.source_url,
      scrapedAt: row.scraped_at,
      rawHtmlGcsUrl: row.raw_html_gcs_url,
      dataJsonLd: row.data_json_ld
    }));
  } catch (err) {
    recordDbOp('query', backend, start, 'error');
    throw err;
  }
}

export async function searchProductsByJsonLd(filters: { moqMax?: number, weightMax?: number }): Promise<any[]> {
  const allProducts = await queryProducts();
  return allProducts.filter(p => {
    if (!p.dataJsonLd) return true;
    const jsonLd = p.dataJsonLd;
    
    // Check MOQ filter
    if (filters.moqMax !== undefined && jsonLd.offers?.moq?.value !== undefined) {
      if (Number(jsonLd.offers.moq.value) > filters.moqMax) return false;
    }
    
    // Check Weight filter inside additionalProperty
    if (filters.weightMax !== undefined && Array.isArray(jsonLd.additionalProperty)) {
      const weightProp = jsonLd.additionalProperty.find((prop: any) => prop.name === 'Shipping Weight');
      if (weightProp && Number(weightProp.value) > filters.weightMax) return false;
    }
    
    return true;
  });
}

export async function upsertProduct(product: any) {
  const start = Date.now();
  const backend = useMock ? 'mock' : 'postgres';
  try {
    if (useMock) {
      initMockDb();
      const data = fs.readFileSync(MOCK_DB_FILE, 'utf-8');
      const products: any[] = JSON.parse(data);

      // Remove if exists
      const filtered = products.filter(p => p.productId !== product.productId);

      // Convert camelCase keys to match DB columns
      const dbProduct = {
        productId: product.productId,
        title: product.title,
        price: product.price,
        currency: product.currency || 'USD',
        imageUrl: product.imageUrl,
        sourceUrl: product.sourceUrl,
        scrapedAt: product.scrapedAt || new Date().toISOString(),
        rawHtmlGcsUrl: product.rawHtmlGcsUrl,
        dataJsonLd: product.dataJsonLd
      };

      filtered.push(dbProduct);
      fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
      console.log(`[Mock PostgreSQL] Upserted product with JSON-LD: ${product.productId}`);
      recordDbOp('upsert', backend, start, 'ok');
      logEvent('info', 'db.product_upserted', { backend, productId: product.productId });
      return;
    }

    if (!pool) throw new Error("Database pool is not initialized");
    await pool.query(
      `INSERT INTO products (product_id, title, price, currency, image_url, source_url, scraped_at, raw_html_gcs_url, data_json_ld)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (product_id)
       DO UPDATE SET
         title = EXCLUDED.title,
         price = EXCLUDED.price,
         currency = EXCLUDED.currency,
         image_url = EXCLUDED.image_url,
         source_url = EXCLUDED.source_url,
         scraped_at = EXCLUDED.scraped_at,
         raw_html_gcs_url = EXCLUDED.raw_html_gcs_url,
         data_json_ld = EXCLUDED.data_json_ld`,
      [
        product.productId,
        product.title,
        product.price,
        product.currency || 'USD',
        product.imageUrl,
        product.sourceUrl,
        product.scrapedAt || new Date(),
        product.rawHtmlGcsUrl,
        product.dataJsonLd ? JSON.stringify(product.dataJsonLd) : null
      ]
    );
    console.log(`[Database] Upserted product: ${product.productId} into PostgreSQL with JSON-LD`);
    recordDbOp('upsert', backend, start, 'ok');
    logEvent('info', 'db.product_upserted', { backend, productId: product.productId });
  } catch (err) {
    recordDbOp('upsert', backend, start, 'error');
    throw err;
  }
}
