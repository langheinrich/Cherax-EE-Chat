const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Session-ID aus Command-Line oder Default
const TARGET_SESSION = process.argv[2] || 'lobby_123456';

console.log(`\n🎯 Target Session: ${TARGET_SESSION}\n`);

// Test-Daten - Alle in derselben Session
const testClients = [
    { sessionId: TARGET_SESSION, rockstarId: 'TestBot1', name: 'TestBot1' },
    { sessionId: TARGET_SESSION, rockstarId: 'TestBot2', name: 'TestBot2' },
    { sessionId: TARGET_SESSION, rockstarId: 'TestBot3', name: 'TestBot3' },
    { sessionId: TARGET_SESSION, rockstarId: 'TestBot4', name: 'TestBot4' },
];

// Hilfsfunktion für Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Session-Nachrichten leeren, damit alte Bot-Nachrichten nicht wieder auftauchen
async function clearSessionMessages(sessionId) {
    try {
        await axios.delete(`${BASE_URL}/api/chat/clear`, {
            params: { sessionId }
        });
        console.log(`✅ [CLEAR] Messages cleared for session ${sessionId}`);
    } catch (error) {
        console.log(`❌ [CLEAR] Could not clear messages for ${sessionId}: ${error.message}`);
    }
}

// Prüft, ob für eine Session noch Nachrichten existieren (Debug/Test)
async function verifySessionCleared(sessionId) {
    try {
        const response = await axios.get(`${BASE_URL}/api/chat/messages`, {
            params: { limit: 50 }
        });
        const remaining = (response.data.messages || []).filter(m => m.sessionId === sessionId);
        if (remaining.length === 0) {
            console.log(`✅ [VERIFY] Session ${sessionId} has no remaining messages`);
        } else {
            console.log(`❌ [VERIFY] Session ${sessionId} still has ${remaining.length} messages`);
        }
    } catch (error) {
        console.log(`❌ [VERIFY] Could not verify messages for ${sessionId}: ${error.message}`);
    }
}

// Test 1: Client Connect
async function testConnect(client) {
    try {
        const response = await axios.post(`${BASE_URL}/api/chat/connect`, {
            sessionId: client.sessionId,
            rockstarId: client.rockstarId
        });
        
        if (response.data.success) {
            console.log(`✅ [CONNECT] ${client.name} connected to ${client.sessionId}`);
            return true;
        } else {
            console.log(`❌ [CONNECT] ${client.name} failed`);
            return false;
        }
    } catch (error) {
        console.log(`❌ [CONNECT] ${client.name} error: ${error.message}`);
        return false;
    }
}

// Test 2: Send Message
async function testSendMessage(client, message) {
    try {
        const response = await axios.post(`${BASE_URL}/api/chat/send`, {
            sessionId: client.sessionId,
            rockstarId: client.rockstarId,
            message: message
        });
        
        if (response.data.success) {
            console.log(`✅ [SEND] ${client.name}: "${message}"`);
            return true;
        } else {
            console.log(`❌ [SEND] ${client.name} failed`);
            return false;
        }
    } catch (error) {
        console.log(`❌ [SEND] ${client.name} error: ${error.message}`);
        return false;
    }
}

// Test 3: Poll Messages
async function testPollMessages(client) {
    try {
        const response = await axios.get(`${BASE_URL}/api/chat/poll`, {
            params: {
                sessionId: client.sessionId,
                rockstarId: client.rockstarId
            }
        });
        
        if (response.data.success) {
            const count = response.data.messages.length;
            const activeClients = response.data.activeClients || 0;
            console.log(`✅ [POLL] ${client.name}: ${count} messages, ${activeClients} active clients`);
            
            // Zeige die letzten 3 Nachrichten
            if (count > 0) {
                const recentMessages = response.data.messages.slice(-3);
                recentMessages.forEach(msg => {
                    console.log(`   📬 [${msg.sender}]: ${msg.message}`);
                });
            }
            
            return response.data;
        } else {
            console.log(`❌ [POLL] ${client.name} failed`);
            return null;
        }
    } catch (error) {
        console.log(`❌ [POLL] ${client.name} error: ${error.message}`);
        return null;
    }
}

// Test 4: Disconnect
async function testDisconnect(client) {
    try {
        const response = await axios.post(`${BASE_URL}/api/chat/disconnect`, {
            sessionId: client.sessionId,
            rockstarId: client.rockstarId
        });
        
        if (response.data.success) {
            console.log(`✅ [DISCONNECT] ${client.name} disconnected`);
            return true;
        } else {
            console.log(`❌ [DISCONNECT] ${client.name} failed`);
            return false;
        }
    } catch (error) {
        // Falls die Session bereits entfernt wurde (z.B. beim ersten Disconnect), 404 ignorieren
        if (error.response && error.response.status === 404) {
            console.log(`ℹ️ [DISCONNECT] ${client.name}: session already gone (404)`);
            return true;
        }
        console.log(`❌ [DISCONNECT] ${client.name} error: ${error.message}`);
        return false;
    }
}

// Test 5: Health Check
async function testHealth() {
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        console.log(`✅ [HEALTH] Server is running`);
        console.log(`   Active Sessions: ${response.data.activeSessions}`);
        console.log(`   Total Messages: ${response.data.totalMessages}`);
        console.log(`   Uptime: ${Math.floor(response.data.uptime)}s`);
        return true;
    } catch (error) {
        console.log(`❌ [HEALTH] Server is down: ${error.message}`);
        return false;
    }
}

// Haupt-Test-Suite
async function runTests() {
    console.log('\n=================================================');
    console.log('🧪 ENHANCED CHAT - JOIN ACTIVE SESSION');
    console.log(`🎯 Session: ${TARGET_SESSION}`);
    console.log('=================================================\n');
    
    // Test 1: Health Check
    console.log('📋 TEST 1: Health Check');
    console.log('-------------------------------------------------');
    await testHealth();
    await sleep(500);

    // Alte Nachrichten aus vorherigen Läufen entfernen
    await clearSessionMessages(TARGET_SESSION);
    await sleep(300);
    
    // Test 2: Connect alle Test-Bots zur aktiven Session
    console.log('\n📋 TEST 2: Join Test Bots to Session');
    console.log('-------------------------------------------------');
    for (const client of testClients) {
        await testConnect(client);
        await sleep(200);
    }
    await sleep(1000);
    
    // Test 3: Begrüßungs-Nachrichten
    console.log('\n📋 TEST 3: Send Welcome Messages');
    console.log('-------------------------------------------------');
    await testSendMessage(testClients[0], 'Hello! I am a test bot!');
    await sleep(500);
    await testSendMessage(testClients[1], 'Hey everyone from TestBot2!');
    await sleep(500);
    await testSendMessage(testClients[2], 'Testing the chat system...');
    await sleep(500);
    await testSendMessage(testClients[3], 'All test bots connected!');
    await sleep(1000);
    
    // Test 4: Poll Messages
    console.log('\n📋 TEST 4: Poll Messages');
    console.log('-------------------------------------------------');
    const pollResult = await testPollMessages(testClients[0]);
    await sleep(1000);
    
    // Test 5: Interaktive Chat-Simulation
    console.log('\n📋 TEST 5: Simulating Chat Activity');
    console.log('-------------------------------------------------');
    const messages = [
        { bot: 0, msg: 'How is everyone doing?' },
        { bot: 1, msg: 'Great! Just testing the chat!' },
        { bot: 2, msg: 'Working perfectly!' },
        { bot: 3, msg: 'The session system is cool!' },
        { bot: 0, msg: 'Yeah, lobby switching works too!' }
    ];
    
    for (const { bot, msg } of messages) {
        await testSendMessage(testClients[bot], msg);
        await sleep(800);
    }
    
    await sleep(1000);
    
    // Test 6: Final Poll
    console.log('\n📋 TEST 6: Final Poll');
    console.log('-------------------------------------------------');
    await testPollMessages(testClients[0]);
    
    console.log('\n=================================================');
    console.log('✅ TEST BOTS ACTIVE IN SESSION');
    console.log(`   You should see messages from ${testClients.length} bots in your game!`);
    console.log('   Bots will disconnect automatically...');
    console.log('=================================================\n');
    
    // Bots verbunden lassen, dann automatisch trennen
    await sleep(1000);
    console.log('⌛ Disconnecting test bots...');
    for (const client of testClients) {
        await testDisconnect(client);
        await sleep(200);
    }
    console.log('✅ All test bots disconnected.');

    // Etwas warten, damit Clients die Disconnect-Nachrichten noch abholen können
    await sleep(5000);

    // Sessionverlauf nach dem Testrun löschen, damit keine Bot-Nachrichten mehr auftauchen
    await clearSessionMessages(TARGET_SESSION);

    // Verifizieren, dass wirklich keine Nachrichten mehr in der Session liegen
    await verifySessionCleared(TARGET_SESSION);
}

// Script starten
if (require.main === module) {
    runTests().catch(error => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = { testConnect, testSendMessage, testPollMessages, testDisconnect, testHealth };
