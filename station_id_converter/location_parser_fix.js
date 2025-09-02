// Test location parsing fix

function parseLocationFixed(locationText) {
    const location = {
        area: '',
        ward: '',
        wardJa: '',
        city: 'Tokyo',
        fullAddress: locationText
    };
    
    const TOKYO_WARDS = {
        'Shibuya-ku': '渋谷区',
        'Shinjuku-ku': '新宿区',
        'Minato-ku': '港区',
        'Setagaya-ku': '世田谷区',
        'Toshima-ku': '豊島区',
        'Hachioji-shi': '八王子市',
        'Akishima-shi': '昭島市',
        'Katsushika-ku': '葛飾区',
        'Sumida-ku': '墨田区',
        'Chuo-ku': '中央区',
        'Meguro-ku': '目黒区',
        'Nerima-ku': '練馬区',
        'Koto-ku': '江東区',
        'Ota-ku': '大田区'
    };
    
    // Clean up location text - remove 'in ' prefix
    let cleaned = locationText.replace(/^in\s+/, '').trim();
    
    // First, check if ward is directly in the text
    for (const [wardEn, wardJa] of Object.entries(TOKYO_WARDS)) {
        if (cleaned.includes(wardEn)) {
            location.ward = wardEn;
            location.wardJa = wardJa;
            
            // Extract area by removing ward and city
            location.area = cleaned
                .replace(wardEn, '')
                .replace(/,?\s*Tokyo\s*$/, '')
                .replace(/[,\s]+$/, '')
                .trim();
            
            break;
        }
    }
    
    // If no ward found yet, try splitting by common patterns
    if (!location.ward) {
        // Try patterns like "Area, Ward" or just get the first part as area
        const parts = cleaned.split(/[,\n]/).map(p => p.trim()).filter(p => p);
        
        if (parts.length > 0) {
            location.area = parts[0];
            
            if (parts.length > 1) {
                // Check if second part is a ward
                for (const [wardEn, wardJa] of Object.entries(TOKYO_WARDS)) {
                    if (parts[1].includes(wardEn.replace('-ku', '')) || parts[1] === wardEn) {
                        location.ward = wardEn;
                        location.wardJa = wardJa;
                        break;
                    }
                }
            }
        }
    }
    
    return location;
}

// Test cases
const testCases = [
    'in HirooShibuya-ku, Tokyo',
    'in Hiroo\nShibuya-ku, Tokyo',
    'in Kyodo\nSetagaya-ku, Tokyo',
    'in GochichoAkishima-shi, Tokyo',
    'in Kamata, Ota-ku, Tokyo',
    'in Zoshigaya\nToshima-ku, Tokyo'
];

console.log('Location Parsing Tests:\n');
testCases.forEach(test => {
    const result = parseLocationFixed(test);
    console.log(`Input: "${test}"`);
    console.log(`Result:`, result);
    console.log('---');
});