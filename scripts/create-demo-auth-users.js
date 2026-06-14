const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();

async function setup() {
  // To avoid the "WebSocket not found" error in Node 20, we specify the transport.
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: {
      autoConfirm: true
    }
  });

  const demoUsers = [
    { email: 'admin@shahid.local', password: 'AdminPassword123!', name: 'System Administrator', role: 'super_admin' },
    { email: 'ahmed@demo.shahid.local', password: 'AhmedPassword123!', name: 'Ahmed Manager', role: 'project_manager' }
  ];

  const tenantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  for (const u of demoUsers) {
    console.log(`Creating auth user: ${u.email}...`);
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name }
      });

      if (error) {
        console.error(`Error creating auth user ${u.email}:`, error.message);
        continue;
      }

      console.log(`Linking to app user record for ${u.email}...`);
      const { error: dbError } = await supabase
        .from('users')
        .upsert({
          auth_id: data.user.id,
          email: u.email,
          name: u.name,
          role: u.role,
          tenant_id: tenantId,
        }, { onConflict: 'tenant_id, email' });

      if (dbError) {
        console.error(`Error creating app user ${u.email}:`, dbError.message);
      } else {
        console.log(`Successfully set up ${u.email}`);
      }
    } catch (e) {
      console.error(`Unexpected error for ${u.email}:`, e.message);
    }
  }
}

setup();
