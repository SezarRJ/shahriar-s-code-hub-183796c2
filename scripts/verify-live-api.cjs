const axios = require('axios');

async function verifyApi() {
  const BASE_URL = 'https://shahid-api-gateway.onrender.com/api/v1';
  console.log(`Testing connectivity to: ${BASE_URL}\n`);

  try {
    console.log('Checking /health endpoint...');
    const healthRes = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check: OK', healthRes.data);

    // Since auth is currently bypassed for demo in the gateway, we can test projects
    console.log('\nChecking /projects endpoint...');
    const projectsRes = await axios.get(`${BASE_URL}/projects`);
    console.log('✅ Projects fetch: OK');
    console.log(`Found ${projectsRes.data.data?.data?.length || 0} projects.`);
    
    if (projectsRes.data.data?.data?.length > 0) {
      console.log('Sample Project:', projectsRes.data.data.data[0].name);
    }

    console.log('\nChecking /dashboard/summary endpoint...');
    const summaryRes = await axios.get(`${BASE_URL}/dashboard/summary`);
    console.log('✅ Dashboard summary: OK', summaryRes.data.data);

    console.log('\n🚀 ALL CHECKS PASSED: The frontend can now fetch real data from the live backend.');
  } catch (error) {
    console.error('\n❌ API Verification Failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(`Message: ${error.message}`);
    }
    process.exit(1);
  }
}

verifyApi();
