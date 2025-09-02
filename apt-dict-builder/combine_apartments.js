#!/usr/bin/env node

/**
 * Apartment Dictionary Builder
 * Combines apartment data from multiple sources into a unified format
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SOURCES = {
    REALESTATE: {
        name: 'realestate.co.jp',
        jsonPattern: /apartments.*\.json$/,
        searchPaths: [
            './real-estate',
            '../station_id_converter/scraped_apartments',
            '../station_id_converter'
        ]
    },
    YOLO: {
        name: 'yolo-home.com',
        jsonPattern: /yolo_apartments.*\.json$/,
        searchPaths: [
            './yolo-home',
            '../yolo-home/scraped_apartments',
            '../yolo-home'
        ]
    }
};

// Unified apartment schema
function createUnifiedApartment() {
    return {
        // Unique identifier
        id: null,
        source: null,
        sourceId: null,
        url: null,
        
        // Building information
        building: {
            name: '',
            nameJa: '',
            type: 'Apartment',
            yearBuilt: null,
            totalFloors: null,
            totalUnits: null,
            structure: '',
            features: []
        },
        
        // Unit details
        unit: {
            title: '',
            roomNumber: '',
            floor: null,
            layout: '',
            layoutType: '',
            bedrooms: 0,
            hasLivingRoom: false,
            hasDiningKitchen: false,
            hasKitchen: false,
            hasServiceRoom: false
        },
        
        // Size and measurements
        size: {
            totalArea: 0,
            unit: 'm²',
            balconyArea: 0,
            hasBalcony: false
        },
        
        // Location
        location: {
            address: '',
            area: '',
            ward: '',
            wardJa: '',
            city: 'Tokyo',
            prefecture: 'Tokyo',
            postalCode: '',
            coordinates: {
                latitude: null,
                longitude: null
            }
        },
        
        // Pricing (all in JPY)
        pricing: {
            monthlyRent: 0,
            deposit: 0,
            keyMoney: 0,
            guaranteeFee: 0,
            managementFee: 0,
            commonServiceFee: 0,
            parkingFee: 0,
            initialCost: 0,
            totalMonthlyCost: 0
        },
        
        // Transportation
        stations: [],
        
        // Features and amenities
        features: [],
        amenities: [],
        
        // Media
        images: {
            main: [],
            floorPlan: '',
            all: []
        },
        
        // Availability
        availability: {
            status: 'available',
            availableFrom: null,
            moveInDate: null,
            lastUpdated: null
        },
        
        // Agency/Management
        agency: {
            name: '',
            contact: '',
            phone: '',
            email: ''
        },
        
        // Metadata
        metadata: {
            scrapedAt: null,
            lastModified: null,
            dataVersion: '1.0'
        }
    };
}

// Convert realestate.co.jp format to unified format
function convertRealestateApartment(apt, source) {
    const unified = createUnifiedApartment();
    
    // Basic info
    unified.id = `realestate_${apt.id}`;
    unified.source = source;
    unified.sourceId = apt.id;
    unified.url = apt.url;
    
    // Building
    if (apt.buildingName) {
        unified.building.name = apt.buildingName;
    }
    if (apt.yearBuilt) {
        unified.building.yearBuilt = apt.yearBuilt;
    }
    if (apt.floors) {
        unified.building.totalFloors = apt.floors;
    }
    if (apt.buildingType) {
        unified.building.type = apt.buildingType;
    }
    
    // Unit details
    unified.unit.title = apt.title || '';
    unified.unit.floor = parseInt(apt.floor) || null;
    unified.unit.layout = apt.layout || '';
    unified.unit.layoutType = apt.layoutType || '';
    unified.unit.bedrooms = apt.bedrooms || 0;
    unified.unit.hasLivingRoom = apt.hasLivingRoom || false;
    unified.unit.hasDiningKitchen = apt.hasDiningKitchen || false;
    unified.unit.hasKitchen = apt.hasKitchen || false;
    
    // Size
    unified.size.totalArea = parseFloat(apt.size) || 0;
    unified.size.hasBalcony = apt.balcony || false;
    
    // Location
    if (apt.location) {
        unified.location.address = apt.location.fullAddress || apt.location.address || '';
        unified.location.area = apt.location.area || '';
        unified.location.ward = apt.location.ward || '';
        unified.location.wardJa = apt.location.wardJa || '';
        unified.location.city = apt.location.city || 'Tokyo';
    }
    
    // Pricing
    if (apt.pricing) {
        unified.pricing.monthlyRent = apt.pricing.rent || apt.pricing.monthlyRent || 0;
        unified.pricing.deposit = apt.pricing.deposit || 0;
        unified.pricing.keyMoney = apt.pricing.keyMoney || 0;
        unified.pricing.managementFee = apt.pricing.managementFee || 0;
        unified.pricing.totalMonthlyCost = unified.pricing.monthlyRent + unified.pricing.managementFee;
    }
    
    // Stations
    if (apt.station) {
        // Single station format from realestate.co.jp
        unified.stations = [{
            name: apt.station.stationName || '',
            line: apt.station.trainLines?.join(', ') || '',
            walkingMinutes: apt.station.walkingMinutes || 0,
            distance: null
        }];
    } else if (apt.stations && Array.isArray(apt.stations)) {
        unified.stations = apt.stations.map(st => ({
            name: st.name || '',
            line: st.line || '',
            walkingMinutes: st.walkingMinutes || st.walkTime || 0,
            distance: st.distance || null
        }));
    } else if (apt.nearestStations) {
        unified.stations = apt.nearestStations;
    }
    
    // Features
    unified.features = apt.features || [];
    unified.amenities = apt.amenities || [];
    
    // Images
    if (apt.images) {
        if (Array.isArray(apt.images)) {
            unified.images.all = apt.images;
            unified.images.main = apt.images.slice(0, 5);
        }
        if (apt.floorPlanImage) {
            unified.images.floorPlan = apt.floorPlanImage;
        }
    }
    
    // Agency
    if (apt.agencyName) {
        unified.agency.name = apt.agencyName;
        unified.agency.contact = apt.agencyContact || '';
    }
    
    // Metadata
    unified.metadata.scrapedAt = apt.scrapedAt || new Date().toISOString();
    unified.metadata.lastModified = new Date().toISOString();
    
    return unified;
}

// Convert yolo-home.com format to unified format
function convertYoloApartment(apt, source) {
    const unified = createUnifiedApartment();
    
    // Basic info
    unified.id = `yolo_${apt.id}`;
    unified.source = source;
    unified.sourceId = apt.id;
    unified.url = apt.url;
    
    // Building
    if (apt.building) {
        unified.building = { ...apt.building };
    }
    
    // Unit details
    unified.unit.title = apt.title || '';
    unified.unit.roomNumber = apt.roomNumber || '';
    unified.unit.floor = parseInt(apt.floor) || null;
    unified.unit.layout = apt.layout || '';
    unified.unit.layoutType = apt.layoutType || '';
    unified.unit.bedrooms = apt.bedrooms || 0;
    unified.unit.hasLivingRoom = apt.hasLivingRoom || false;
    unified.unit.hasDiningKitchen = apt.hasDiningKitchen || false;
    unified.unit.hasKitchen = apt.hasKitchen || false;
    
    // Size
    unified.size.totalArea = parseFloat(apt.size) || 0;
    unified.size.hasBalcony = apt.balcony || false;
    
    // Location
    if (apt.location) {
        unified.location = { ...apt.location };
    }
    
    // Pricing
    if (apt.pricing) {
        unified.pricing = { ...apt.pricing };
        unified.pricing.totalMonthlyCost = apt.pricing.monthlyRent + apt.pricing.managementFee;
    }
    
    // Stations
    if (apt.nearestStations && Array.isArray(apt.nearestStations)) {
        unified.stations = apt.nearestStations.map(st => ({
            name: st.name || '',
            line: st.line || '',
            walkingMinutes: st.walkingMinutes || 0,
            distance: null
        }));
    } else {
        unified.stations = [];
    }
    
    // Features
    unified.features = apt.features || [];
    unified.amenities = apt.amenities || [];
    
    // Images
    if (apt.images) {
        unified.images.all = apt.images;
        unified.images.main = apt.images.slice(0, 5);
    }
    if (apt.floorPlanImage) {
        unified.images.floorPlan = apt.floorPlanImage;
    }
    
    // Agency
    unified.agency.name = apt.agencyName || '';
    unified.agency.contact = apt.agencyContact || '';
    
    // Availability
    if (apt.availableFrom) {
        unified.availability.availableFrom = apt.availableFrom;
    }
    if (apt.moveInDate) {
        unified.availability.moveInDate = apt.moveInDate;
    }
    
    // Metadata
    unified.metadata.scrapedAt = apt.scrapedAt || new Date().toISOString();
    unified.metadata.lastModified = new Date().toISOString();
    
    return unified;
}

// Find JSON files
function findJsonFiles(searchPaths, pattern) {
    const files = [];
    
    for (const searchPath of searchPaths) {
        const fullPath = path.join(__dirname, searchPath);
        
        if (!fs.existsSync(fullPath)) {
            continue;
        }
        
        try {
            const dirFiles = fs.readdirSync(fullPath);
            const matchingFiles = dirFiles.filter(file => pattern.test(file));
            
            matchingFiles.forEach(file => {
                files.push(path.join(fullPath, file));
            });
        } catch (error) {
            console.error(`Error reading directory ${fullPath}:`, error.message);
        }
    }
    
    return files;
}

// Main function
async function buildApartmentDictionary() {
    console.log('🏗️  Apartment Dictionary Builder');
    console.log('================================\n');
    
    const allApartments = [];
    const stats = {
        totalFiles: 0,
        totalApartments: 0,
        bySource: {},
        duplicates: 0
    };
    
    // Process each source
    for (const [key, config] of Object.entries(SOURCES)) {
        console.log(`\n📂 Processing ${config.name}...`);
        
        const jsonFiles = findJsonFiles(config.searchPaths, config.jsonPattern);
        console.log(`   Found ${jsonFiles.length} JSON files`);
        
        stats.bySource[config.name] = {
            files: jsonFiles.length,
            apartments: 0
        };
        
        for (const file of jsonFiles) {
            console.log(`   📄 ${path.basename(file)}`);
            
            try {
                const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                const apartments = data.apartments || [];
                
                console.log(`      Found ${apartments.length} apartments`);
                
                for (const apt of apartments) {
                    let unified;
                    
                    if (key === 'REALESTATE') {
                        unified = convertRealestateApartment(apt, config.name);
                    } else if (key === 'YOLO') {
                        unified = convertYoloApartment(apt, config.name);
                    }
                    
                    if (unified) {
                        allApartments.push(unified);
                        stats.bySource[config.name].apartments++;
                    }
                }
                
                stats.totalFiles++;
                
            } catch (error) {
                console.error(`      ❌ Error processing file: ${error.message}`);
            }
        }
    }
    
    stats.totalApartments = allApartments.length;
    
    // Remove duplicates based on URL
    const uniqueApartments = [];
    const seenUrls = new Set();
    
    for (const apt of allApartments) {
        if (!seenUrls.has(apt.url)) {
            seenUrls.add(apt.url);
            uniqueApartments.push(apt);
        } else {
            stats.duplicates++;
        }
    }
    
    // Create output
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const output = {
        metadata: {
            createdAt: new Date().toISOString(),
            totalApartments: uniqueApartments.length,
            sources: Object.keys(stats.bySource),
            stats: stats,
            dataVersion: '1.0'
        },
        apartments: uniqueApartments
    };
    
    // Save unified dictionary
    const outputFile = path.join(__dirname, `unified_apartments_${timestamp}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    
    // Create summary
    const summary = createSummary(output);
    const summaryFile = path.join(__dirname, `unified_summary_${timestamp}.txt`);
    fs.writeFileSync(summaryFile, summary);
    
    // Try to add station IDs
    await addStationIdsToOutput(outputFile);
    
    console.log('\n✅ Dictionary Building Complete!');
    console.log('================================');
    console.log(`Total apartments: ${uniqueApartments.length}`);
    console.log(`Duplicates removed: ${stats.duplicates}`);
    console.log(`\nOutput: ${outputFile}`);
    console.log(`Summary: ${summaryFile}`);
    
    return output;
}

// Create summary
function createSummary(data) {
    const apts = data.apartments;
    
    // Price statistics
    const prices = apts.map(a => a.pricing.monthlyRent).filter(p => p > 0);
    const priceStats = prices.length > 0 ? {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: prices.reduce((sum, p) => sum + p, 0) / prices.length
    } : { min: 0, max: 0, avg: 0 };
    
    // Size statistics
    const sizes = apts.map(a => a.size.totalArea).filter(s => s > 0);
    const sizeStats = sizes.length > 0 ? {
        min: Math.min(...sizes),
        max: Math.max(...sizes),
        avg: sizes.reduce((sum, s) => sum + s, 0) / sizes.length
    } : { min: 0, max: 0, avg: 0 };
    
    // Distributions
    const sourceCounts = {};
    const layoutCounts = {};
    const wardCounts = {};
    const buildingCounts = {};
    
    apts.forEach(apt => {
        // Source
        sourceCounts[apt.source] = (sourceCounts[apt.source] || 0) + 1;
        
        // Layout
        if (apt.unit.layout) {
            layoutCounts[apt.unit.layout] = (layoutCounts[apt.unit.layout] || 0) + 1;
        }
        
        // Ward
        if (apt.location.ward) {
            wardCounts[apt.location.ward] = (wardCounts[apt.location.ward] || 0) + 1;
        }
        
        // Building
        if (apt.building.name) {
            buildingCounts[apt.building.name] = (buildingCounts[apt.building.name] || 0) + 1;
        }
    });
    
    return `Unified Apartment Dictionary Summary
====================================

Generated: ${new Date(data.metadata.createdAt).toLocaleString()}
Total Apartments: ${data.metadata.totalApartments}
Data Sources: ${data.metadata.sources.join(', ')}

Statistics
----------
${Object.entries(data.metadata.stats.bySource)
    .map(([source, stats]) => `${source}: ${stats.apartments} apartments from ${stats.files} files`)
    .join('\n')}
Duplicates removed: ${data.metadata.stats.duplicates}

Price Analysis
--------------
Monthly Rent Range: ¥${priceStats.min.toLocaleString()} - ¥${priceStats.max.toLocaleString()}
Average Monthly Rent: ¥${Math.round(priceStats.avg).toLocaleString()}

Size Analysis
-------------
Size Range: ${sizeStats.min.toFixed(1)}m² - ${sizeStats.max.toFixed(1)}m²
Average Size: ${sizeStats.avg.toFixed(1)}m²

Source Distribution
-------------------
${Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => `${source}: ${count} apartments (${(count/apts.length*100).toFixed(1)}%)`)
    .join('\n')}

Layout Distribution
-------------------
${Object.entries(layoutCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([layout, count]) => `${layout}: ${count} apartments (${(count/apts.length*100).toFixed(1)}%)`)
    .join('\n')}

Ward Distribution (Top 10)
--------------------------
${Object.entries(wardCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ward, count]) => `${ward}: ${count} apartments`)
    .join('\n')}

Popular Buildings (Top 10)
--------------------------
${Object.entries(buildingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([building, count]) => `${building}: ${count} apartments`)
    .join('\n')}`;
}

// CLI
if (require.main === module) {
    buildApartmentDictionary().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

// Add station IDs if add_station_ids.js exists
async function addStationIdsToOutput(outputFile) {
    try {
        const addStationIds = require('./add_station_ids');
        console.log('\n🚉 Adding station IDs...');
        
        // Load transit graph
        const graphPath = path.join(__dirname, '../lines/tokyo_transit_graph_complete.json');
        const transitData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
        const stations = transitData.stations;
        
        // Load apartment data
        const apartmentData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        
        // Add station IDs
        const stats = addStationIds.addStationIds(apartmentData, stations);
        
        // Update metadata
        apartmentData.metadata.stationMatching = {
            processedAt: new Date().toISOString(),
            totalStations: stats.totalStations,
            matched: stats.matched,
            unmatched: stats.unmatched,
            matchRate: ((stats.matched / stats.totalStations) * 100).toFixed(2) + '%',
            unmatchedStations: Array.from(stats.unmatchedStations).sort(),
            unmatchedDetails: stats.unmatchedDetails
        };
        
        // Save updated data (overwrite original)
        fs.writeFileSync(outputFile, JSON.stringify(apartmentData, null, 2));
        
        console.log(`✅ Matched ${stats.matched}/${stats.totalStations} stations (${apartmentData.metadata.stationMatching.matchRate})`);
        
        // Create unmatched report if needed
        if (stats.unmatched > 0) {
            const unmatchedFile = outputFile.replace('.json', '_unmatched_stations.txt');
            const report = addStationIds.createUnmatchedReport(stats, stations);
            fs.writeFileSync(unmatchedFile, report);
            console.log(`📝 Unmatched stations report: ${path.basename(unmatchedFile)}`);
        }
        
        return true;
    } catch (error) {
        console.log('⚠️  Station ID addition not available or failed:', error.message);
        return false;
    }
}

module.exports = { buildApartmentDictionary, createUnifiedApartment };