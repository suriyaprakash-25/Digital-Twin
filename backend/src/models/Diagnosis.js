const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

const COLLECTION_NAME = 'diagnoses';

async function createDiagnosis(diagnosisData) {
  const db = getDb();
  
  // Convert IDs to ObjectIds if they are strings
  if (diagnosisData.userId && typeof diagnosisData.userId === 'string') {
    diagnosisData.userId = new ObjectId(diagnosisData.userId);
  }
  if (diagnosisData.vehicleId && typeof diagnosisData.vehicleId === 'string') {
    diagnosisData.vehicleId = new ObjectId(diagnosisData.vehicleId);
  }

  const diagnosis = {
    ...diagnosisData,
    createdAt: new Date()
  };
  const result = await db.collection(COLLECTION_NAME).insertOne(diagnosis);
  return { ...diagnosis, _id: result.insertedId };
}

async function getDiagnosesByUser(userId) {
  const db = getDb();
  return db.collection(COLLECTION_NAME)
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
}

async function getDiagnosisById(diagnosisId) {
  const db = getDb();
  return db.collection(COLLECTION_NAME).findOne({ _id: new ObjectId(diagnosisId) });
}

module.exports = {
  createDiagnosis,
  getDiagnosesByUser,
  getDiagnosisById
};
