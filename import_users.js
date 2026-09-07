const fs = require('fs');

const SUPABASE_URL = 'https://exhkwujwxqnicjyuughl.supabase.co';
// We'll read the service role key from the environment variable
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing.");
  console.log("Please run this script using: ");
  console.log("  $env:SUPABASE_SERVICE_ROLE_KEY='your_service_role_key'; node import_users.js");
  process.exit(1);
}

const csvData = fs.readFileSync('users.csv', 'utf8');
const lines = csvData.trim().split('\n');

// The first line is the header
const headers = lines[0].split('\t').map(h => h.trim());

async function createUsers() {
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split('\t').map(p => p.trim());
    const email = parts[0];
    const username = parts[1];
    const password = parts[2];
    const role = parts[3];

    console.log(`Creating user: ${email}...`);

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password,
          email_confirm: true, // Auto-confirm email so they don't have to verify
          user_metadata: {
            username: username,
            role: role.toLowerCase()
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error(`Failed to create ${email}:`, errData);
      } else {
        console.log(`Successfully created ${email}!`);
      }
    } catch (e) {
      console.error(`Error creating ${email}:`, e);
    }
  }
  console.log("Done.");
}

createUsers();
