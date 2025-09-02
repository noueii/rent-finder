const fs = require('fs');
const path = require('path');

console.log('Current directory:', __dirname);
console.log('Files in current directory:', fs.readdirSync(__dirname));

// Check real-estate folder
const realEstatePath = path.join(__dirname, 'real-estate');
if (fs.existsSync(realEstatePath)) {
    console.log('\nreal-estate files:', fs.readdirSync(realEstatePath));
}

// Check yolo-home folder  
const yoloPath = path.join(__dirname, 'yolo-home');
if (fs.existsSync(yoloPath)) {
    console.log('\nyolo-home files:', fs.readdirSync(yoloPath));
}

// Try to load one file
try {
    const testFile = path.join(realEstatePath, 'apartments_2025-07-15T12-09-02-364Z.json');
    const data = JSON.parse(fs.readFileSync(testFile, 'utf8'));
    console.log('\nTest file loaded successfully');
    console.log('Number of apartments:', data.apartments?.length);
} catch (error) {
    console.error('Error loading test file:', error.message);
}