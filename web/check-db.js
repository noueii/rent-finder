const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'rent-finder.db');
console.log('Checking database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  
  console.log('Connected to database');
  
  // List all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err);
    } else {
      console.log('\nTables in database:');
      tables.forEach(table => {
        console.log(`- ${table.name}`);
      });
      
      // Check if Apartment table exists
      const hasApartment = tables.some(t => t.name === 'Apartment');
      if (!hasApartment) {
        console.log('\n⚠️  Apartment table does NOT exist!');
        console.log('Run: npx prisma db push');
      }
    }
    
    db.close();
  });
});