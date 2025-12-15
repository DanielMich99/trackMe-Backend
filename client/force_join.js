const axios = require('axios');

const API_URL = 'http://localhost:3000';
const JOIN_CODE = 'WDSTDN'; // From screenshot

async function run() {
    try {
        console.log(`--- Creating Bot User to join group ${JOIN_CODE} ---`);
        const email = `bot_${Date.now()}@test.com`;
        const password = 'password123';

        // 1. Register
        console.log(`Registering ${email}...`);
        await axios.post(`${API_URL}/auth/register`, {
            email, password, name: 'Bot User'
        });

        // 2. Login
        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email, password
        });
        const token = loginRes.data.access_token;
        console.log('Got Token.');

        // 3. Join
        console.log(`Joining group ${JOIN_CODE}...`);
        const joinRes = await axios.post(`${API_URL}/groups/join`, {
            joinCode: JOIN_CODE
        }, { headers: { Authorization: `Bearer ${token}` } });

        console.log('SUCCESS! Join Result:', joinRes.data.message);
        console.log('Group Name:', joinRes.data.group.name);
        console.log('Group ID:', joinRes.data.group.id);

    } catch (err) {
        console.error('FAILED:', err.message);
        if (err.response) {
            console.error('Data:', err.response.data);
        }
    }
}

run();
