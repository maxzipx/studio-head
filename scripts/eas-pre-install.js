const fs = require('fs');
const path = require('path');

const expoCachePath = path.join(process.cwd(), '.expo');

try {
  fs.rmSync(expoCachePath, { recursive: true, force: true });
  fs.mkdirSync(expoCachePath, { recursive: true });
  console.log(`Normalized Expo cache directory at ${expoCachePath}`);
} catch (error) {
  console.error(`Failed to normalize Expo cache directory at ${expoCachePath}`);
  throw error;
}
