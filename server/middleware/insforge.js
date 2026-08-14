require('dotenv').config();
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env.local'), override: true });

let dbInstance;

function getDb() {
  if (!dbInstance) {
    const { createClient } = require('@insforge/sdk');
    const supabaseUrl = process.env.INSFORGE_URL || 'https://pk5eng7w.ap-southeast.insforge.app';
    const supabaseKey = process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.INSFORGE_ANON_KEY || 'anon_8cdce68be8188b489d5c12ad3b86adff9054b6599225e0f9dc950f611e7468a8';

    dbInstance = createClient({ baseUrl: supabaseUrl, anonKey: supabaseKey });
    console.log('[InsForge] Client initialized');
  }
  return dbInstance;
}

async function initInsForge() {
  return getDb();
}

module.exports = { initInsForge, getDb };
