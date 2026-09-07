const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://driveportz3_db_user:fwzxm2FYEfQBzCoe@cluster.x6gxbml.mongodb.net';
const dbName = 'driveportz';

async function setupTTL() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 30000 });
  try {
    await client.connect();
    console.log('Connected.');
    const db = client.db(dbName);
    
    const result = await db.collection('notifications').createIndex(
      { createdAt: 1 }, 
      { expireAfterSeconds: 345600 }
    );
    console.log('TTL Index created successfully:', result);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
    console.log('Connection closed.');
  }
}

setupTTL();
