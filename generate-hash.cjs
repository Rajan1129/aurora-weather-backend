const bcrypt = require('bcryptjs');

async function generateHash() {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash('admin123', salt);
  console.log('Hash:', hash);
}

generateHash();