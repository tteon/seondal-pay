const { Storage } = require('@google-cloud/storage');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'gcp-key.json');
const PROJECT_ID = 'solana-503111';
const BUCKET_NAME = `scraped-data-bucket-${PROJECT_ID}`;

const storage = new Storage({ keyFilename: KEY_FILE, projectId: PROJECT_ID });

async function create() {
  try {
    console.log(`Checking if bucket ${BUCKET_NAME} exists...`);
    const [exists] = await storage.bucket(BUCKET_NAME).exists();
    if (!exists) {
      console.log(`Creating bucket ${BUCKET_NAME}...`);
      await storage.createBucket(BUCKET_NAME, {
        location: 'US-CENTRAL1',
      });
      console.log(`Bucket ${BUCKET_NAME} created successfully!`);
    } else {
      console.log(`Bucket ${BUCKET_NAME} already exists!`);
    }
  } catch (err) {
    console.error('Error creating bucket:', err);
  }
}

create();
