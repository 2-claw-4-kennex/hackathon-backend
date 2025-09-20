const express = require("express");
const cors = require("cors");
const redis = require("redis");

const app = express();

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

// --- API ENDPOINTS ---

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
            return res.status(500).json({ message: "Server is not configured with a valid device token." });
        }

        // --- NEW: SEND NOTIFICATION VIA EXPO'S PUSH API ---
        try {
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                },
                body: JSON.stringify({
                    to: PARENT_DEVICE_TOKEN,
                    sound: 'default',
                    title: 'Approval Required',
                    body: 'A payment from your card needs your approval.',
                    priority: 'high' // Set high priority for Expo's servers too
                }),
            });
            console.log("Successfully sent notification request to Expo's server.");
        } catch (error) {
            console.error("Error sending notification via Expo:", error);
        }
        
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
