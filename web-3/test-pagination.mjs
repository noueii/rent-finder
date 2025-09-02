import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testRealEstatePagination() {
  console.log('\n=== Testing RealEstate.co.jp Pagination ===\n');
  
  const baseUrl = 'https://realestate.co.jp/en/rent?prefecture=JP-13&city=13000&max_rent=300000&search=Search&page=1';
  
  try {
    const response = await fetch(baseUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Count apartments on first page
    const apartmentsOnPage = $('.property-listing').length;
    console.log(`Apartments on first page: ${apartmentsOnPage}`);
    
    // Check for next page button
    const nextLink = $('.paginator .pagination-next a').attr('href');
    const isNextInvisible = $('.paginator .pagination-next').hasClass('invisible');
    
    console.log(`\nNext page link: ${nextLink || 'Not found'}`);
    console.log(`Next button invisible: ${isNextInvisible}`);
    
    if (nextLink && !isNextInvisible) {
      console.log('\n✅ Pagination available - next page link found!');
      
      // Test fetching second page
      const nextUrl = new URL(nextLink, 'https://realestate.co.jp').toString();
      console.log(`\nFetching second page: ${nextUrl}`);
      
      const response2 = await fetch(nextUrl);
      const html2 = await response2.text();
      const $2 = cheerio.load(html2);
      
      const apartmentsOnPage2 = $2('.property-listing').length;
      console.log(`Apartments on second page: ${apartmentsOnPage2}`);
      
      // Check for pagination info
      const paginatorText = $2('.paginator').text();
      console.log(`\nPaginator text: ${paginatorText.trim()}`);
    } else {
      console.log('\n⚠️  No next page available');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testWagayaPagination() {
  console.log('\n\n=== Testing Wagaya Japan Pagination ===\n');
  
  const baseUrl = 'https://wagaya-japan.com/en/rent/tokyo/list/?upperprice=300000&heibeimin=25&page=1';
  
  try {
    const response = await fetch(baseUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Count apartments on first page
    const apartmentsOnPage = $('.pro-search-item').length;
    console.log(`Apartments on first page: ${apartmentsOnPage}`);
    
    // Check for next page button
    const nextButton = $('.pagination .page-item.next');
    const isNextDisabled = nextButton.hasClass('disabled');
    const nextLink = nextButton.find('a').attr('href');
    
    console.log(`\nNext button disabled: ${isNextDisabled}`);
    console.log(`Next page link: ${nextLink || 'Not found'}`);
    
    if (!isNextDisabled && nextLink !== '#') {
      console.log('\n✅ Pagination available - next page button found!');
    } else {
      console.log('\n⚠️  No next page available');
    }
    
    // Check pagination structure
    console.log('\nPagination HTML:');
    console.log($('.pagination').html());
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testYoloPagination() {
  console.log('\n\n=== Testing YOLO Japan Pagination ===\n');
  
  const baseUrl = 'https://home.yolo-japan.com/en/tokyo/list?priceTo=300&areaFrom=25&perPage=50&page=1';
  
  try {
    const response = await fetch(baseUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Count apartments on first page
    const apartmentsOnPage = $('.property-wrapper .property-item').length;
    console.log(`Apartments on first page: ${apartmentsOnPage}`);
    
    // Check for next page button
    const nextButton = $('.pagination .btn-next');
    const isNextDisabled = nextButton.attr('disabled') === 'disabled';
    
    console.log(`\nNext button disabled: ${isNextDisabled}`);
    
    if (!isNextDisabled) {
      console.log('\n✅ Pagination available - next page button enabled!');
    } else {
      console.log('\n⚠️  No next page available or button is disabled');
    }
    
    // Check pagination structure
    console.log('\nPagination HTML:');
    console.log($('.pagination').html());
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run all tests
(async () => {
  await testRealEstatePagination();
  await testWagayaPagination();
  await testYoloPagination();
})();