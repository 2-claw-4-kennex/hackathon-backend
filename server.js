const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const redis = require("redis");

const app = express(); // This was the missing line

// --- SETUP ---
app.use(cors());
app.use(express.json());

// --- REDIS CLIENT SETUP ---
let redisClient;
(async () => {
    if (process.env.REDIS_URL) {
        redisClient = redis.createClient({
            url: process.env.REDIS_URL
        });
        redisClient.on("error", (error) => console.error(`Redis Error: ${error}`));
        await redisClient.connect();
        console.log("Connected to Redis successfully!");
    } else {
        console.warn("REDIS_URL not found. State will not be persistent.");
    }
})();

// --- FIREBASE ADMIN SETUP ---
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized successfully!");
    } catch (e) {
        console.error("Error initializing Firebase Admin:", e);
    }
} else {
    console.warn("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found. Push notifications will not work.");
}


// --- API ENDPOINTS (Now using Redis) ---

app.get('/', (req, res) => {
    res.send('Hello from the PlaySafe Backend! The server is running.');
});

app.post("/initiate-payment", async (req, res) => {
    const { cardNumber } = req.body;
    const MAGIC_CARD_NUMBER = "1234-5678-9012-3456";

    if (cardNumber.replace(/-/g, '') === MAGIC_CARD_NUMBER.replace(/-/g, '')) {
        console.log("Protected card detected! Setting status to pending in Redis.");
        await redisClient.set('transaction_status', 'pending');

        console.log("Simulating a successful notification dispatch to Firebase.");
        res.json({ message: "Approval request sent to parent." });

    } else {
        res.status(400).json({ message: "This card is not protected by PlaySafe." });
    }
});

app.post("/update-status", async (req, res) => {
    const { newStatus } = req.body;
    await redisClient.set('transaction_status', newStatus);
    console.log(`Transaction status updated to: ${newStatus}`);
    res.json({ message: "Status updated successfully." });
});

app.get("/get-status", async (req, res) => {
    const status = await redisClient.get('transaction_status');
    res.json({ status: status || 'idle' });
});

// Listen for requests
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is live and listening on port ${PORT}`);
});
