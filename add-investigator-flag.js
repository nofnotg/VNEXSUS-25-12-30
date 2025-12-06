const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Check if ENABLE_INVESTIGATOR_VIEW exists
    if (!envContent.includes('ENABLE_INVESTIGATOR_VIEW=')) {
        console.log('Adding ENABLE_INVESTIGATOR_VIEW to .env...');
        // Add with default value false
        const newFlag = '\n# Master Plan Phase 2: Investigator View\nENABLE_INVESTIGATOR_VIEW=false\n';
        fs.appendFileSync(envPath, newFlag);
        console.log('Successfully added ENABLE_INVESTIGATOR_VIEW=false');
    } else {
        console.log('ENABLE_INVESTIGATOR_VIEW already exists in .env');
    }

} catch (error) {
    console.error('Error updating .env file:', error);
    process.exit(1);
}
