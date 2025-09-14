const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const app = express();

// --- SETUP ---
app.use(cors());
app.use(express.json());

// --- FIREBASE ADMIN SETUP ---
// This checks if the key exists before trying to initialize Firebase
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

// --- In-memory "database" ---
let transaction = {
  id: "txn_123",
  status: "idle",
};

// --- API ENDPOINTS ---

// Add a simple "root" route to confirm the server is up
app.get('/', (req, res) => {
    res.send('Hello from the PlaySafe Backend! The server is running meow.');
});

app.post("/initiate-payment", (req, res) => {
    const { cardNumber } = req.body;
    const MAGIC_CARD_NUMBER = "1234-5678-9012-3456";
    const PARENT_DEVICE_TOKEN = process.env.PARENT_DEVICE_TOKEN;

    if (cardNumber.replace(/-/g, '') === MAGIC_CARD_NUMBER.replace(/-/g, '')) {
        console.log("Protected card detected! Sending push notification...");
        transaction.status = "pending";

        if (!PARENT_DEVICE_TOKEN || PARENT_DEVICE_TOKEN === 'placeholder') {
            console.error("Parent device token is not set correctly!");
            return res.status(500).json({ message: "Server is not configured with a valid device token." });
        }

        const message = {
          notification: {
            title: "PlaySafe Approval Required",
            body: "A payment from your card needs your approval.",
          },
          token: PARENT_DEVICE_TOKEN,
        };

        admin.messaging().send(message)
          .then(response => {
            console.log("Successfully sent message:", response);
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

app.post("/update-status", (req, res) => {
    const { newStatus } = req.body; // 'approved' or 'declined'
    transaction.status = newStatus;
    console.log(`Transaction status updated to: ${newStatus}`);
    res.json({ message: "Status updated successfully." });
});

app.get("/get-status", (req, res) => {
    res.json({ status: transaction.status });
});

// Listen for requests
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is live and listening on port ${PORT}`);
});
