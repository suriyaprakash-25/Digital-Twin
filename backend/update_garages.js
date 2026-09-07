const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://driveportz3_db_user:fwzxm2FYEfQBzCoe@cluster.x6gxbml.mongodb.net';
const dbName = 'driveportz';

async function updateGarages() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 30000 });
  try {
    await client.connect();
    console.log('Connected.');
    const db = client.db(dbName);
    
    // Log before update
    const car24x = await db.collection('garages').findOne({ name: 'car24x' });
    console.log('car24x before:', car24x ? car24x.availabilityMode : 'not found');

    const result = await db.collection('garages').updateMany(
      { name: { $in: ['siva s', 'car24x'] } },
      { $set: { availabilityMode: 'AUTO' } }
    );
    console.log('Modified count:', result.modifiedCount);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
    console.log('Connection closed.');
  }
}

updateGarages();
