import fs from 'fs';
import path from 'path';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

const KEY_FILE = path.join(__dirname, '../gcp-key.json');
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'solana-paysh-demo';

// Check if actual GCP credentials are ready
export function isGcpConfigured(): boolean {
  return fs.existsSync(KEY_FILE);
}

// ----------------------------------------------------
// 📁 local_gcp_mock implementations for offline sandbox
// ----------------------------------------------------
class MockDocumentReference {
  constructor(private colPath: string, private docId: string) {}
  async set(data: any) {
    const dir = path.join(__dirname, '../local_gcp_mock/firestore', this.colPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${this.docId}.json`), JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Mock Firestore] Written document: ${this.colPath}/${this.docId}.json`);
  }
}

class MockCollectionReference {
  constructor(private colPath: string) {}
  doc(docId: string) {
    return new MockDocumentReference(this.colPath, docId);
  }
}

class MockFirestore {
  collection(colPath: string) {
    return new MockCollectionReference(colPath);
  }
}

class MockFile {
  constructor(private bucketName: string, private filePath: string) {}
  async save(content: string | Buffer, options?: any) {
    const dest = path.join(__dirname, '../local_gcp_mock/storage', this.bucketName, this.filePath);
    const dir = path.dirname(dest);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dest, content);
    console.log(`[Mock Cloud Storage] Uploaded file to: ${this.bucketName}/${this.filePath}`);
  }
  publicUrl() {
    const dest = path.join(__dirname, '../local_gcp_mock/storage', this.bucketName, this.filePath);
    return `file://${dest}`;
  }
}

class MockBucket {
  constructor(private name: string) {}
  file(filePath: string) {
    return new MockFile(this.name, filePath);
  }
}

class MockStorage {
  bucket(name: string) {
    return new MockBucket(name);
  }
}

const isCloudRun = !!process.env.K_SERVICE;

// Initialize either the real Google Cloud clients or our filesystem mock
export const db: Firestore = (isCloudRun || isGcpConfigured())
  ? (isGcpConfigured() ? new Firestore({ keyFilename: KEY_FILE, projectId: PROJECT_ID }) : new Firestore())
  : (new MockFirestore() as any);

export const storage: Storage = (isCloudRun || isGcpConfigured())
  ? (isGcpConfigured() ? new Storage({ keyFilename: KEY_FILE, projectId: PROJECT_ID }) : new Storage())
  : (new MockStorage() as any);

console.log(`GCP Service Connection initialized. Mode: ${(isCloudRun || isGcpConfigured()) ? 'Live GCP Cloud' : 'Local Sandbox Mock'}`);
