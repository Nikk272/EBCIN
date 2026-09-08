const fs = require('fs');

const SUPABASE_URL = 'https://exhkwujwxqnicjyuughl.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing.");
  console.log("Please run this script using: ");
  console.log("  $env:SUPABASE_SERVICE_ROLE_KEY='your_service_role_key'; node import_registered_students.js");
  process.exit(1);
}

// Function to parse CSV respecting quotes for fields that contain commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function seedData() {
  console.log('Reading details.csv...');
  const csvData = fs.readFileSync('details.csv', 'utf8');
  const lines = csvData.split('\n').filter(line => line.trim() !== '');

  // Skip header (center,enquiry_id,name,mobile,email)
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length >= 5) {
      records.push({
        center: parts[0],
        enquiry_id: parts[1],
        name: parts[2],
        mobile: parts[3] || null,
        email: parts[4] || null
      });
    }
  }

  console.log(`Found ${records.length} records. Uploading to Supabase...`);

  let successCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (let i = 0; i < records.length; i++) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/registered_students`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(records[i])
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes('duplicate key value')) {
          duplicateCount++;
        } else {
          console.error(`Error inserting record ${i + 1}:`, errorText);
          errorCount++;
        }
      } else {
        successCount++;
        // Print progress every 100 records
        if (successCount % 100 === 0) {
          console.log(`Inserted ${successCount} records...`);
        }
      }
    } catch (e) {
      console.error(`Network error on record ${i + 1}:`, e);
      errorCount++;
    }
  }

  console.log('--- Seeding Complete ---');
  console.log(`Successfully inserted: ${successCount}`);
  console.log(`Skipped duplicates: ${duplicateCount}`);
  console.log(`Errors: ${errorCount}`);
}

seedData();
