const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const SESSION_ID = 'lobby_1333718897';
const BOT_ID = 'ResponderBot';
const POLL_INTERVAL_MS = 1500;

const replies = [
  'Hey there!',
  'How are you doing?',
  'Test response 👋',
  'Pong!',
  'Bot is online.',
  'How is the test going?'
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect() {
  await axios.post(`${BASE_URL}/api/chat/connect`, {
    sessionId: SESSION_ID,
    rockstarId: BOT_ID
  });
  console.log(`Connected as ${BOT_ID} to ${SESSION_ID}`);
}

async function send(message) {
  await axios.post(`${BASE_URL}/api/chat/send`, {
    sessionId: SESSION_ID,
    rockstarId: BOT_ID,
    message
  });
  console.log(`Sent: ${message}`);
}

async function disconnect() {
  try {
    await axios.post(`${BASE_URL}/api/chat/disconnect`, {
      sessionId: SESSION_ID,
      rockstarId: BOT_ID
    });
  } catch (err) {
    /* ignore */
  }
}

async function run() {
  let lastSince = Date.now();
  await connect();

  while (true) {
    try {
      const res = await axios.get(`${BASE_URL}/api/chat/poll`, {
        params: {
          sessionId: SESSION_ID,
          rockstarId: BOT_ID,
          since: lastSince
        }
      });

      const messages = res.data.messages || [];
      if (messages.length > 0) {
        // Update since based on latest timestamp
        const latestTs = Math.max(...messages.map((m) => Date.parse(m.timestamp)));
        if (!Number.isNaN(latestTs)) {
          lastSince = latestTs;
        }

        for (const msg of messages) {
          if (msg.rockstarId !== BOT_ID && msg.sender !== BOT_ID && msg.sender !== 'System') {
            const reply = replies[Math.floor(Math.random() * replies.length)];
            await send(reply);
          }
        }
      }
    } catch (err) {
      console.log('Poll/send error:', err.message);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down bot...');
  await disconnect();
  process.exit(0);
});

run().catch((err) => {
  console.error('Bot error:', err);
  process.exit(1);
});
