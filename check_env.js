import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('--- OCR Configuration Check ---');
console.log('ENABLE_VISION_OCR:', process.env.ENABLE_VISION_OCR);
console.log('USE_VISION:', process.env.USE_VISION);
console.log('GOOGLE_CLOUD_VISION_API_KEY:', process.env.GOOGLE_CLOUD_VISION_API_KEY ? 'Set (Hidden)' : 'Not Set');
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log('USE_TEXTRACT:', process.env.USE_TEXTRACT);
console.log('-------------------------------');
