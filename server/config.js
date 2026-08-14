require('dotenv').config();
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local'), override: true });

module.exports = {
  port: process.env.PORT || 8080,
  insforgeUrl: process.env.INSFORGE_URL || 'https://pk5eng7w.ap-southeast.insforge.app',
  insforgeAnonKey: process.env.INSFORGE_ANON_KEY || '',
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
};
