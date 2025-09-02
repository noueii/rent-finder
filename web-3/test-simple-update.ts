import { db } from './src/server/db';

async function testSimpleUpdate() {
  try {
    console.log('Testing simple database update...\n');
    
    // Check if apartment 742 exists
    const apartment = await db.apartment.findFirst({
      where: {
        externalId: '742',
        sourceSite: 'realestate.co.jp'
      }
    });
    
    if (!apartment) {
      console.log('❌ Apartment 742 not found');
      return;
    }
    
    console.log('✅ Found apartment:', apartment.id);
    console.log('Current fetchedDetails:', apartment.fetchedDetails);
    
    // Update it
    const updated = await db.apartment.update({
      where: { id: apartment.id },
      data: {
        fetchedDetails: true,
        feesJson: {
          deposit: 100000,
          keyMoney: 78000,
          agencyFee: 78000,
          insurance: 20000
        },
        feesTotal: 276000
      }
    });
    
    console.log('\n✅ Updated apartment:');
    console.log('- fetchedDetails:', updated.fetchedDetails);
    console.log('- feesTotal:', updated.feesTotal);
    console.log('- feesJson:', updated.feesJson);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

testSimpleUpdate();