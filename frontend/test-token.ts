import axios from 'axios';

async function test() {
  try {
    // 1. Login to get token
    console.log('Logging in...');
    const loginRes = await axios.post('http://localhost:3001/api/v1/auth/login', {
      email: 'owner@sabir.local',
      password: 'Admin@1234'
    });
    
    const { access_token, refresh_token } = loginRes.data.data;
    console.log('Login success');

    // 2. Test refresh
    console.log('Refreshing token...');
    const refreshRes = await axios.post('http://localhost:3001/api/v1/auth/refresh', {
      refresh_token
    });
    console.log('Refresh success', refreshRes.data.success);
    
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message);
  }
}

test();
