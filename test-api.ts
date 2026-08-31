import axios from 'axios';

async function test() {
  try {
    // 1. Login to get token
    console.log('Logging in...');
    const loginRes = await axios.post('http://localhost:3001/api/v1/auth/login', {
      email: 'owner@sabirplastic.local',
      password: 'Owner@123'
    });
    
    const { access_token } = loginRes.data.data;
    console.log('Login success');

    // 2. Fetch customers
    console.log('Fetching customers...');
    const res = await axios.get('http://localhost:3001/api/v1/customers', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    console.log('Customers fetch success', res.data);
    
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message);
  }
}

test();
