const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();

async function createAdmin() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    realtime: {
      transport: ws
    }
  });

  const email = 'admin@shahid.local';
  const password = 'AdminPassword123!';
  const name = 'System Administrator';
  const tenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  try {
    console.log(`Creating auth user: ${email}...`);
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;
    console.log(`Auth user created: ${authUser.user.id}`);

    console.log(`Creating application user record...`);
    const { error: dbError } = await supabase
      .from('users')
      .insert({
        auth_id: authUser.user.id,
        tenant_id: tenantId,
        email: email,
        name: name,
        role: 'super_admin',
        is_active: true
      });

    if (dbError) throw dbError;
    console.log('Super Admin user created successfully!');
    console.log('\n--- Login Credentials ---');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('---------------------------');

  } catch (err) {
    console.error('Error creating admin:', err.message);
    process.exit(1);
  }
}

createAdmin();
