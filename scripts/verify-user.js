const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();

async function verify() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    realtime: { transport: ws }
  });

  const email = 'admin@shahid.local';
  
  console.log(`Checking for user: ${email}...`);
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
  const user = authUser.users.find(u => u.email === email);

  if (!user) {
    console.error('❌ Auth user not found in Supabase Auth');
    process.exit(1);
  }
  console.log(`✅ Auth user found: ${user.id}`);

  const { data: appUser, error: appError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single();

  if (appError || !appUser) {
    console.error('❌ Application user record not found in users table');
    console.error('Error:', appError?.message);
    process.exit(1);
  }
  console.log('✅ Application user record found!');
  console.log('User Data:', appUser);
}

verify();
