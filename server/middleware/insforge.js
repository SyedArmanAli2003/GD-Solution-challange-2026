require('dotenv').config();
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env.local'), override: true });

let dbInstance;

function getDb() {
  if (!dbInstance) {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || 'https://ckjiukvxqqvjmpxhpclb.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNraml1a3Z4cXF2am1weGhwY2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjYxMTgsImV4cCI6MjA5ODEwMjExOH0.VWi7wlZdGKVF0q-9bF3bStOh6w-dW1eK9l-PqzBJmjI';

    dbInstance = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    console.log('[Supabase] Client initialized');
  }
  return dbInstance;
}

async function initInsForge() {
  return getDb();
}

module.exports = { initInsForge, getDb };
