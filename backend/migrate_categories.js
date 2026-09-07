const { MongoClient } = require('mongodb');

async function migrate() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobility-digital-twin';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('mobility-digital-twin');
    const media = db.collection('media');

    // Mappings
    const changes = [
      { old: 'AVATAR', new: 'VEHICLE_PROFILE' },
      { old: 'INSPECTION', new: 'GARAGE_INSPECTION' },
      { old: 'PROGRESS', new: 'REPAIR_PROGRESS' },
      { old: 'COMPLETED', new: 'SERVICE_COMPLETION' }
    ];

    let totalUpdated = 0;
    for (const change of changes) {
      const result = await media.updateMany(
        { category: change.old },
        { $set: { category: change.new } }
      );
      totalUpdated += result.modifiedCount;
      console.log(`Updated ${result.modifiedCount} documents from ${change.old} to ${change.new}`);
    }

    console.log(`Migration complete. Total updated: ${totalUpdated}`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.close();
  }
}

migrate();
