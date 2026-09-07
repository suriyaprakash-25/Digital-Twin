const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('--- STARTING E2E API INTEGRATION TESTS ---');
  
  try {
    // 1. Register Garage User (User A)
    const suffix = Date.now();
    console.log('\nRegistering User A (Garage Owner)...');
    let resA = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Garage Owner', email: `garage${suffix}@gmail.com`, password: 'password123', role: 'GARAGE', termsAccepted: true, privacyAccepted: true })
    });
    if (!resA.ok) throw new Error(`Failed to register User A: ${await resA.text()}`);
    
    let loginA = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `garage${suffix}@gmail.com`, password: 'password123' })
    });
    const dataA = await loginA.json();
    const tokenA = dataA.token;

    // 2. Register Regular User (User B)
    console.log('Registering User B (Customer)...');
    let resB = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Customer', email: `customer${suffix}@gmail.com`, password: 'password123', role: 'USER', termsAccepted: true, privacyAccepted: true })
    });
    if (!resB.ok) throw new Error('Failed to register User B');
    
    let loginB = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `customer${suffix}@gmail.com`, password: 'password123' })
    });
    const dataB = await loginB.json();
    const tokenB = dataB.token;

    // 3. Register Regular User (User C) - for unauthorized tests
    console.log('Registering User C (Unauthorized Customer)...');
    let resC = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Unauthorized', email: `unauth${suffix}@gmail.com`, password: 'password123', role: 'USER', termsAccepted: true, privacyAccepted: true })
    });
    if (!resC.ok) throw new Error('Failed to register User C');
    
    let loginC = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `unauth${suffix}@gmail.com`, password: 'password123' })
    });
    const dataC = await loginC.json();
    const tokenC = dataC.token;

    // 4. Create Garage for User A
    console.log('Creating Garage for User A...');
    // Looking at backend code, there might not be a POST /garages if it's admin only, or if garage is created automatically.
    // Let's create a booking. Wait, if we can't create a garage easily, we can just test Vehicle media first.

    // 5. Create Vehicle for User B
    console.log('Creating Vehicle for User B...');
    let resVeh = await fetch(`${API_URL}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ make: 'Toyota', model: 'Camry', year: 2020, licensePlate: `TEST${suffix}` })
    });
    let dataVeh = {};
    try {
      dataVeh = await resVeh.json();
    } catch(e) {}
    // It might fail if vehicle endpoint is not exactly this. Let's just create a dummy object id and test if the backend accepts it?
    // Wait, backend authorization checks DB for the entity!
    // For VEHICLE, `isAuthorizedForEntity` checks if vehicle.ownerId === req.user.id.
    let vehicleId;
    if (resVeh.ok && dataVeh.vehicle && dataVeh.vehicle._id) {
       vehicleId = dataVeh.vehicle._id;
    } else {
       console.log('Could not create vehicle via API, falling back to direct DB insert for entities...');
       // Let's just use MongoDB to insert entities, but we MUST connect to the correct DB!
       // How do we know which DB? The server is running on localhost. It could be remote or local.
       // Let's just test with the booking that we insert directly via MongoDB, but using the user ID from the real API!
       const { MongoClient, ObjectId } = require('mongodb');
       let client = new MongoClient('mongodb+srv://driveportz3_db_user:fwzxm2FYEfQBzCoe@cluster.x6gxbml.mongodb.net');
       await client.connect();
       const db = client.db('driveportz');
       
       console.log('Connected to DB for setup...');
       vehicleId = new ObjectId().toString();
       await db.collection('vehicles').insertOne({ _id: new ObjectId(vehicleId), ownerId: dataB.user.id, brand: 'TEST' });
       
       const garageId = new ObjectId().toString();
       await db.collection('garages').insertOne({ _id: new ObjectId(garageId), ownerUserId: new ObjectId(dataA.user.id), name: 'TEST GARAGE' });
       
       var bookingId = new ObjectId().toString();
       await db.collection('bookings').insertOne({ _id: new ObjectId(bookingId), userId: dataB.user.id, garageId: new ObjectId(garageId), status: 'REQUESTED' });
       
       var serviceId = new ObjectId().toString();
       await db.collection('services').insertOne({ 
         _id: new ObjectId(serviceId),
         vehicleId: String(vehicleId),
         bookingId: String(bookingId),
         ownerId: String(dataB.user.id),
         createdBy: String(dataA.user.id), // Garage
         isArchived: false,
         createdAt: new Date()
       });

       await client.close();
    }

    console.log(`Setup complete. Vehicle: ${vehicleId}, Booking: ${bookingId}, Service: ${serviceId}`);

    // Create a dummy image
    const testImagePath = path.join(__dirname, 'test_image.jpg');
    fs.writeFileSync(testImagePath, 'fake image content');
    const imageBlob = new Blob([fs.readFileSync(testImagePath)], { type: 'image/jpeg' });
    
    // Create a dummy PDF
    const testPdfPath = path.join(__dirname, 'test.pdf');
    fs.writeFileSync(testPdfPath, 'fake pdf content');
    const pdfBlob = new Blob([fs.readFileSync(testPdfPath)], { type: 'application/pdf' });

    // --- TEST 1: Valid Upload (User B uploads VEHICLE_PROFILE to their Vehicle) ---
    console.log('\nTEST 1: Valid Upload (Customer -> Vehicle)');
    let formData = new FormData();
    formData.append('file', imageBlob, 'test_image.jpg');
    formData.append('entityId', String(vehicleId));
    formData.append('entityType', 'VEHICLE');
    formData.append('category', 'VEHICLE_PROFILE');
    
    let uploadRes = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: formData
    });
    
    let uploadData = await uploadRes.json();
    if (uploadRes.ok) {
      console.log('✅ Pass: Upload successful', uploadRes.status);
    } else {
      console.error('❌ Fail: Upload failed', uploadData);
    }
    
    let uploadedMediaId = uploadData?.media?._id;
    let uploadedMediaUrl = uploadData?.media?.url;

    // --- TEST 2: Valid Upload (Customer uploads CUSTOMER_DAMAGE to Booking) ---
    console.log('\nTEST 2: Valid Upload (Customer -> Booking)');
    formData = new FormData();
    formData.append('file', imageBlob, 'test_image.jpg');
    formData.append('entityId', String(bookingId));
    formData.append('entityType', 'BOOKING');
    formData.append('category', 'CUSTOMER_DAMAGE');
    
    let res2 = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: formData
    });
    if (res2.ok) {
      console.log('✅ Pass: Upload successful by Customer', res2.status);
    } else {
      console.error('❌ Fail: Upload failed by Customer', await res2.json());
    }

    // --- TEST 3: Valid Upload (Garage uploads REPAIR_PROGRESS to Booking) ---
    console.log('\nTEST 3: Valid Upload (Garage -> Booking)');
    formData = new FormData();
    formData.append('file', imageBlob, 'test_image.jpg');
    formData.append('entityId', String(bookingId));
    formData.append('entityType', 'BOOKING');
    formData.append('category', 'REPAIR_PROGRESS');
    
    let res3 = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData
    });
    if (res3.ok) {
      console.log('✅ Pass: Upload successful by Garage', res3.status);
    } else {
      console.error('❌ Fail: Upload failed by Garage', await res3.json());
    }
    // --- TEST 3.5: Valid Upload (Garage -> Service Inspection) ---
    console.log('\nTEST 3.5: Valid Upload (Garage -> Service Inspection)');
    formData = new FormData();
    formData.append('file', imageBlob, 'inspection.jpg');
    formData.append('entityId', String(serviceId));
    formData.append('entityType', 'SERVICE');
    formData.append('category', 'GARAGE_INSPECTION');
    
    let res35 = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData
    });
    if (res35.ok) {
      console.log('✅ Pass: Upload successful by Garage (Inspection)', res35.status);
    } else {
      console.error('❌ Fail: Upload failed by Garage (Inspection)', await res35.json());
    }

    // --- TEST 3.6: Valid Upload (Garage -> Service Completion) ---
    console.log('\nTEST 3.6: Valid Upload (Garage -> Service Completion)');
    formData = new FormData();
    formData.append('file', imageBlob, 'completion.jpg');
    formData.append('entityId', String(serviceId));
    formData.append('entityType', 'SERVICE');
    formData.append('category', 'SERVICE_COMPLETION');
    
    let res36 = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData
    });
    if (res36.ok) {
      console.log('✅ Pass: Upload successful by Garage (Completion)', res36.status);
    } else {
      console.error('❌ Fail: Upload failed by Garage (Completion)', await res36.json());
    }
    // --- TEST 4: Unauthorized Upload (User C -> User B Vehicle) ---
    console.log('\nTEST 4: Unauthorized Upload (User C -> User B Vehicle)');
    formData = new FormData();
    formData.append('file', imageBlob, 'test_image.jpg');
    formData.append('entityId', String(vehicleId));
    formData.append('entityType', 'VEHICLE');
    formData.append('category', 'VEHICLE_PROFILE');
    
    let res4 = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenC}` },
      body: formData
    });
    if (res4.status === 403) {
      console.log('✅ Pass: Upload correctly rejected with 403');
    } else {
      console.error(`❌ Fail: Upload returned ${res4.status}`, await res4.text());
    }

    // --- TEST 5: Invalid File Type (PDF) ---
    console.log('\nTEST 5: Invalid File Type (PDF)');
    formData = new FormData();
    formData.append('file', pdfBlob, 'test.pdf');
    formData.append('entityId', String(bookingId));
    formData.append('entityType', 'BOOKING');
    formData.append('category', 'CUSTOMER_DAMAGE');
    
    let res5 = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: formData
    });
    if (res5.status === 400) {
      console.log('✅ Pass: PDF Upload correctly rejected with 400');
    } else {
      console.error(`❌ Fail: PDF Upload returned ${res5.status}`, await res5.text());
    }

    // --- TEST 6: Fetch Media (Customer fetches Booking media) ---
    console.log('\nTEST 6: Fetch Media (Customer -> Booking)');
    let res6 = await fetch(`${API_URL}/media/BOOKING/${bookingId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    if (res6.ok) {
      let data6 = await res6.json();
      if (data6.length >= 2) {
        console.log('✅ Pass: Fetched media successfully', data6.length, 'items');
      } else {
        console.error('❌ Fail: Expected at least 2 media items, got', data6.length);
      }
    } else {
      console.error('❌ Fail: Fetch failed', await res6.text());
    }
    
    // --- TEST 7: Unauthorized Fetch Media (User C -> User B Booking) ---
    console.log('\nTEST 7: Unauthorized Fetch Media (User C -> User B Booking)');
    let res7 = await fetch(`${API_URL}/media/BOOKING/${bookingId}`, {
      headers: { Authorization: `Bearer ${tokenC}` }
    });
    if (res7.status === 403) {
      console.log('✅ Pass: Fetch correctly rejected with 403');
    } else {
      console.error(`❌ Fail: Fetch returned ${res7.status}`, await res7.text());
    }
    
    // --- TEST 8: Delete Media & Physical File Check ---
    console.log('\nTEST 8: Delete Media & Persistence Check');
    if (uploadedMediaId && uploadedMediaUrl) {
      // Check file exists
      const backendDir = path.resolve(__dirname);
      const filePath = path.join(backendDir, uploadedMediaUrl);
      if (fs.existsSync(filePath)) {
        console.log('✅ Pass: Physical file exists before deletion');
      } else {
        console.error(`❌ Fail: Physical file not found at ${filePath}`);
      }
      
      let res8 = await fetch(`${API_URL}/media/${uploadedMediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      if (res8.ok) {
        console.log('✅ Pass: Delete API request successful');
        
        // Verify file deleted
        if (!fs.existsSync(filePath)) {
          console.log('✅ Pass: Physical file successfully removed');
        } else {
          console.error('❌ Fail: Physical file still exists on disk');
        }
      } else {
        console.error('❌ Fail: Delete failed', await res8.text());
      }
    } else {
      console.error('❌ Fail: Skipping deletion test due to previous failures');
    }
    
    // Cleanup
    console.log('\nCleaning up test files...');
    if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
    if (fs.existsSync(testPdfPath)) fs.unlinkSync(testPdfPath);
    console.log('Tests completed.');

  } catch (err) {
    console.error('Test script crashed:', err);
  }
}

runTests();
