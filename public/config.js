// ResQNet — runtime config
// Loaded before any dist/*.js scripts via <script> tag in HTML pages.

const CONFIG = {
  // Express AI/triage server URL. Update for production deployment.
  BACKEND_URL: window.location.origin,

  // InsForge project (PostgreSQL + Auth)
  INSFORGE_URL: 'https://pk5eng7w.ap-southeast.insforge.app',
  INSFORGE_ANON_KEY: 'anon_8cdce68be8188b489d5c12ad3b86adff9054b6599225e0f9dc950f611e7468a8',
}
