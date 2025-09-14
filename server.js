const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const app = express();

// --- SETUP ---
app.use(cors());
app.use(express.json());

// --- FIREBASE ADMIN SETUP ---
// Render uses Environment Variables, which is more secure.
// We will paste our Firebase key directly into Render's dashboard.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
console.log("Firebase Admin initialized successfully!");


// --- In-memory "database" ---
let transaction = {
  id: "txn_123",
  status: "idle",
};

// --- THE "MAGIC" DATA ---
// We get this from an Environment Variable as well.
let PARENT_DEVICE_TOKEN = process.env.PARENT_DEVICE_TOKEN;

// --- API ENDPOINTS (These are exactly the same as before) ---
app.post("/initiate-payment", (req, res) => {
    // ... same code as before
});
app.post("/update-status", (req, res) => {
    // ... same code as before
});
app.get("/get-status", (req, res) => {
    // ... same code as before
});

// ... (Copy and paste the full endpoint logic from the previous answer)
// Ensure you have all three endpoints: /initiate-payment, /update-status, /get-status

// Listen for requests
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});