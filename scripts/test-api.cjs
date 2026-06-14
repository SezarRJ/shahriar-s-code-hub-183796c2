const axios = require('axios');
require('dotenv').config();

async function test() {
  const url = process.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
  console.log(`Testing API at: ${url}`);

  try {
    const res = await axios.get(`${url}/projects`);
    console.log('Projects response status:', res.status);
    console.log('Projects data:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error:', err.message);
    }
  }
}
test();
