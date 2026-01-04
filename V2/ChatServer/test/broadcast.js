#!/usr/bin/env node

const axios = require('axios');
const readline = require('readline');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function getSessions() {
    try {
        const response = await axios.get(`${BASE_URL}/api/sessions`);
        return response.data.sessions || [];
    } catch (error) {
        console.error('❌ Error fetching sessions:', error.message);
        return [];
    }
}

async function sendBroadcast(message, sender, sessionId = null) {
    try {
        const payload = {
            message,
            sender
        };

        if (sessionId && sessionId !== '__ALL__') {
            payload.sessionId = sessionId;
        }

        const response = await axios.post(`${BASE_URL}/api/chat/broadcast`, payload);
        
        console.log('\n✅ Broadcast sent successfully!');
        console.log(`   Recipients: ${response.data.recipientCount} session(s)`);
        console.log(`   Timestamp: ${response.data.timestamp}`);
        
        return true;
    } catch (error) {
        console.error('\n❌ Error sending broadcast:', error.response?.data?.error || error.message);
        return false;
    }
}

async function main() {
    console.log('\n========================================');
    console.log('  Enhanced Chat - Broadcast Tool');
    console.log('========================================\n');

    // Fetch available sessions
    console.log('📡 Fetching available sessions...\n');
    const sessions = await getSessions();
    
    if (sessions.length > 0) {
        console.log('Available sessions:');
        sessions.forEach((session, index) => {
            console.log(`  [${index + 1}] ${session.sessionId} (${session.rockstarId})`);
        });
        console.log(`  [0] All sessions (broadcast)\n`);
    } else {
        console.log('⚠️  No active sessions found!\n');
    }

    // Select session
    let sessionId = null;
    let sessionInput = await question('Enter session number (0 for all, or session ID): ');
    
    if (sessionInput === '0' || sessionInput === '') {
        sessionId = '__ALL__';
        console.log('→ Broadcast to ALL sessions\n');
    } else if (!isNaN(sessionInput)) {
        const index = parseInt(sessionInput) - 1;
        if (sessions[index]) {
            sessionId = sessions[index].sessionId;
            console.log(`→ Session: ${sessionId}\n`);
        } else {
            sessionId = sessionInput;
            console.log(`→ Session ID: ${sessionId}\n`);
        }
    } else {
        sessionId = sessionInput;
        console.log(`→ Session ID: ${sessionId}\n`);
    }

    // Enter message
    const message = await question('Message: ');
    if (!message.trim()) {
        console.log('\n❌ Message cannot be empty!');
        rl.close();
        return;
    }

    // Enter sender
    const sender = await question('Sender [Admin]: ') || 'Admin';

    // Summary
    console.log('\n========================================');
    console.log('Broadcast to send:');
    console.log(`  Message: "${message}"`);
    console.log(`  Sender: ${sender}`);
    if (sessionId !== '__ALL__') {
        console.log(`  Session: ${sessionId}`);
    } else {
        console.log(`  To: ALL active sessions`);
    }
    console.log('========================================\n');

    const confirm = await question('Send? (y/n): ');
    
    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
        await sendBroadcast(message, sender, sessionId);
    } else {
        console.log('\n❌ Cancelled');
    }

    rl.close();
}

main().catch(error => {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
});
