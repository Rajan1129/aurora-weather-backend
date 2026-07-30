// client/scripts/switch-env.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '..', 'src', 'config.js');

const args = process.argv.slice(2);
const mode = args[0] || 'dev';

let configContent;

if (mode === 'prod' || mode === 'production') {
  configContent = `// client/src/config.js
// ==================== ENVIRONMENT CONFIGURATION ====================

// 🔄 CHANGE THIS TO SWITCH BETWEEN LOCAL AND PRODUCTION
const IS_PRODUCTION = true; // ✅ Production Mode

// ==================== URL CONFIGURATION ====================
const URLS = {
  production: {
    api: 'https://your-render-app.onrender.com', // Your Render backend URL
    frontend: 'https://your-vercel-app.vercel.app', // Your Vercel frontend URL
  },
  development: {
    api: 'http://localhost:5000',
    frontend: 'http://localhost:3000',
  }
};

const currentEnv = IS_PRODUCTION ? 'production' : 'development';

export const API_URL = URLS[currentEnv].api;
export const FRONTEND_URL = URLS[currentEnv].frontend;
export const IS_PRODUCTION_MODE = IS_PRODUCTION;

export const config = {
  apiUrl: API_URL,
  frontendUrl: FRONTEND_URL,
  isProduction: IS_PRODUCTION_MODE,
  env: currentEnv,
};

export default config;`;
  console.log('✅ Switched to PRODUCTION mode');
} else {
  configContent = `// client/src/config.js
// ==================== ENVIRONMENT CONFIGURATION ====================

// 🔄 CHANGE THIS TO SWITCH BETWEEN LOCAL AND PRODUCTION
const IS_PRODUCTION = false; // 🛠️ Development Mode

// ==================== URL CONFIGURATION ====================
const URLS = {
  production: {
    api: 'https://your-render-app.onrender.com', // Your Render backend URL
    frontend: 'https://your-vercel-app.vercel.app', // Your Vercel frontend URL
  },
  development: {
    api: 'http://localhost:5000',
    frontend: 'http://localhost:3000',
  }
};

const currentEnv = IS_PRODUCTION ? 'production' : 'development';

export const API_URL = URLS[currentEnv].api;
export const FRONTEND_URL = URLS[currentEnv].frontend;
export const IS_PRODUCTION_MODE = IS_PRODUCTION;

export const config = {
  apiUrl: API_URL,
  frontendUrl: FRONTEND_URL,
  isProduction: IS_PRODUCTION_MODE,
  env: currentEnv,
};

export default config;`;
  console.log('✅ Switched to DEVELOPMENT mode');
}

fs.writeFileSync(configPath, configContent);
console.log(`📝 Updated: ${configPath}`);
console.log(`🌐 API URL: ${configContent.match(/api: '(.*?)'/)[1]}`);