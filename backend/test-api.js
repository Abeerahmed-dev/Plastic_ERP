const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign({ userId: '192ca897-09e0-492e-bf42-b9b6a11cd188', role: 'ADMIN' }, 'dev_secret_change_in_production_min16chars', { expiresIn: '1h' });

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/customers',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log('CUSTOMERS:', data); });
});
req.on('error', (e) => { console.error(`Error: ${e.message}`); });
req.end();

const options2 = { ...options, path: '/api/v1/suppliers' };
const req2 = http.request(options2, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log('SUPPLIERS:', data); });
});
req2.on('error', (e) => { console.error(`Error: ${e.message}`); });
req2.end();
