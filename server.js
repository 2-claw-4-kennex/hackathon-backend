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
    const PARENT_DEVICE_TOKEN = process.env.PARENT_DEVICE_TOKEN;

    if (cardNumber.replace(/-/g, '') === MAGIC_CARD_NUMBER.replace(/-/g, '')) {
        console.log("Protected card detected! Setting status to pending in Redis.");
        await redisClient.set('transaction_status', 'pending');

        if (!PARENT_DEVICE_TOKEN || PARENT_DEVICE_TOKEN === 'placeholder') {
            console.error("Parent device token is not set correctly!");
            return res.status(500).json({ message: "Server is not configured with a valid device token." });
        }

        // This is the message payload we send to Firebase
        const message = {
            notification: {
                title: "Approval Required",
                body: "A payment from your card needs your approval.",
            },
            token: PARENT_DEVICE_TOKEN,

            // --- HIGH PRIORITY CONFIGURATION ---

            // For Android devices:
            android: {
                priority: 'high', // This tells FCM to wake the device and deliver immediately.
            },

            // For iOS (Apple) devices:
            apns: {
                headers: {
                    'apns-push-type': 'alert', // Required for modern iOS versions.
                    'apns-priority': '10',     // A value of '10' is for immediate, high-priority delivery.
                },
            },
        };

        // Re-enabling the real send logic for your full build
        admin.messaging().send(message)
          .then(response => {
            console.log("Successfully sent HIGH PRIORITY message:", response);
            res.json({ message: "Approval request sent to parent." });
          })
          .catch(error => {
            console.log("Error sending message:", error);
            res.status(500).json({ message: "Failed to send notification." });
          });

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
