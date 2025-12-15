const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function run() {
    try {
        console.log('--- 1. Register Admin ---');
        const adminEmail = `admin_${Date.now()}@test.com`;
        const adminRes = await axios.post(`${API_URL}/auth/register`, {
            email: adminEmail,
            password: 'password',
            name: 'Admin'
        });
        const adminToken = adminRes.data.access_token;
        console.log('Admin Token:', adminToken ? 'OK' : 'FAIL');

        console.log('--- 2. Create Group ---');
        const groupRes = await axios.post(`${API_URL}/groups/create`, {
            name: 'Test Group'
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        const group = groupRes.data;
        console.log('Group Created:', group.id, 'Code:', group.joinCode);

        console.log('--- 3. Register User ---');
        const userEmail = `user_${Date.now()}@test.com`;
        const userRes = await axios.post(`${API_URL}/auth/register`, {
            email: userEmail,
            password: 'password',
            name: 'User'
        });
        const userToken = userRes.data.access_token;
        console.log('User Token:', userToken ? 'OK' : 'FAIL');

        console.log('--- 4. User Joins Group ---');
        const joinRes = await axios.post(`${API_URL}/groups/join`, {
            joinCode: group.joinCode
        }, { headers: { Authorization: `Bearer ${userToken}` } });
        console.log('Join Result:', joinRes.data.message);

        console.log('--- 5. Admin Checks Pending Requests ---');
        // Test endpoint 1: GET /groups/pending?groupId=...
        try {
            const pendingRes = await axios.get(`${API_URL}/groups/pending?groupId=${group.id}`, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            console.log('GET /pending Result:', JSON.stringify(pendingRes.data, null, 2));
        } catch (err) {
            console.log('GET /pending Failed:', err.response?.status, err.response?.data);
        }

        console.log('--- 6. Admin Checks Group Members (Should filter out Pending) ---');
        const myGroupsRes = await axios.get(`${API_URL}/groups/my-groups`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const myGroup = myGroupsRes.data.find(g => g.id === group.id);
        console.log('My Group Members:', JSON.stringify(myGroup.users, null, 2));

    } catch (err) {
        console.error('FATAL ERROR:', err.message);
        if (err.response) {
            console.error('Data:', err.response.data);
        }
    }
}

run();
