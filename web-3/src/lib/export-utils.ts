import * as XLSX from 'xlsx';
import type { RouterOutputs } from '~/trpc/react';
import { getApartmentMapsUrl } from '~/lib/maps';

type Apartment = RouterOutputs['list']['getApartments']['apartments'][0];

interface ExportData {
  'Title': string;
  'Property URL': string;
  'Price (¥/month)': number;
  '2-Year Total (¥)': number;
  'Total Initial Fees (¥)': number | null;
  'Size (m²)': number;
  'Location Score': number | null;
  'Design Score': number | null;
  'Space Score': number | null;
  'Google Maps URL': string;
}

// Helper to safely extract fee from feesJson
function extractFee(feesJson: any, key: string): number | null {
  if (!feesJson || typeof feesJson !== 'object') return null;
  const value = feesJson[key];
  return typeof value === 'number' ? value : null;
}

function calculate2YearCosts(apartment: any): { total: number; avgMonthly: number } {
  const monthlyRent = apartment.price || 0;
  
  // Extract fees from feesJson if available
  const fees = apartment.feesJson || {};
  const deposit = extractFee(fees, 'deposit') ?? apartment.deposit ?? (monthlyRent * 2); // Default 2 months
  const keyMoney = extractFee(fees, 'keyMoney') ?? apartment.keyMoney ?? 0;
  const agencyFee = extractFee(fees, 'agencyFee') ?? apartment.agencyFee ?? monthlyRent; // Default 1 month
  const guarantorFee = extractFee(fees, 'guarantorFee') ?? 0;
  const insurance = extractFee(fees, 'insurance') ?? 0;
  const managementFee = extractFee(fees, 'managementFee') ?? apartment.managementFee ?? 0;
  const commonAreaFee = extractFee(fees, 'commonAreaFee') ?? apartment.commonAreaFee ?? 0;
  const otherFees = extractFee(fees, 'other') ?? 0;
  
  // Initial costs
  const initialCosts = deposit + keyMoney + agencyFee + guarantorFee + insurance + otherFees;
  
  // Monthly costs including fees
  const totalMonthly = monthlyRent + managementFee + commonAreaFee;
  
  // 24 months of rent + initial costs
  const total = initialCosts + (totalMonthly * 24);
  const avgMonthly = Math.round(total / 24);
  
  return { total, avgMonthly };
}

export function exportApartmentsToExcel(
  apartments: Apartment[], 
  listName: string,
  targetStationName?: string,
  listItems?: any[] // Optional list items containing scores
) {
  // Transform apartment data into Excel-friendly format
  const data: ExportData[] = apartments.map((apartment: any, index) => {
    const { total, avgMonthly } = calculate2YearCosts(apartment);
    const route = apartment.routes?.[0];
    
    // Calculate Google Maps URL
    const googleMapsUrl = getApartmentMapsUrl(
      apartment,
      route?.toStation, // Use the station from the route if available
      10 // Default departure hour
    );
    
    // Find the corresponding list item for scores
    const listItem = listItems?.find(item => item.apartmentId === apartment.id);
    
    // Get scores - they should be numbers 0-5 or null
    // Using ?? instead of || to preserve 0 values (which mean "TBD/not scored")
    const locationScore = listItem?.locationScore ?? null;
    const designScore = listItem?.designScore ?? null;
    const spaceScore = listItem?.spaceScore ?? null;
    
    return {
      'Title': apartment.title || 'No title',
      'Property URL': apartment.sourceUrl || '',
      'Price (¥/month)': apartment.price || 0,
      '2-Year Total (¥)': total,
      'Total Initial Fees (¥)': apartment.feesTotal ?? null,
      'Size (m²)': apartment.size || 0,
      'Location Score': locationScore,
      'Design Score': designScore,
      'Space Score': spaceScore,
      'Google Maps URL': googleMapsUrl,
    };
  });
  
  // Create workbook and worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 40 }, // Title
    { wch: 50 }, // Property URL
    { wch: 15 }, // Price (¥/month)
    { wch: 15 }, // 2-Year Total
    { wch: 18 }, // Total Initial Fees
    { wch: 10 }, // Size (m²)
    { wch: 15 }, // Location Score
    { wch: 13 }, // Design Score
    { wch: 13 }, // Space Score
    { wch: 50 }, // Google Maps URL
  ];
  ws['!cols'] = colWidths;
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Apartments');
  
  // Add metadata sheet with summary statistics
  const metadata: any = {
    'List Name': listName,
    'Export Date': new Date().toLocaleString(),
    'Total Apartments': apartments.length,
    'Average Price': Math.round(apartments.reduce((sum, apt) => sum + (apt.price || 0), 0) / apartments.length),
    'Average Size': Math.round(apartments.reduce((sum, apt) => sum + (apt.size || 0), 0) / apartments.length),
    'Average 2-Year Total': Math.round(data.reduce((sum, row) => sum + row['2-Year Total (¥)'], 0) / data.length),
  };
  
  if (targetStationName) {
    metadata['Target Station'] = targetStationName;
  }
  
  const metadataWs = XLSX.utils.json_to_sheet([metadata], { header: Object.keys(metadata) });
  metadataWs['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, metadataWs, 'Summary');
  
  // Generate filename
  const date = new Date().toISOString().split('T')[0];
  const filename = `${listName.replace(/[^a-z0-9]/gi, '_')}_${date}.xlsx`;
  
  // Write file and trigger download
  XLSX.writeFile(wb, filename);
}

export function exportToCSV(apartments: Apartment[], listName: string, targetStationName?: string, listItems?: any[]) {
  // Transform apartment data (same as Excel)
  const data: ExportData[] = apartments.map((apartment: any) => {
    const { total, avgMonthly } = calculate2YearCosts(apartment);
    const route = apartment.routes?.[0];
    
    // Calculate Google Maps URL
    const googleMapsUrl = getApartmentMapsUrl(
      apartment,
      route?.toStation, // Use the station from the route if available
      10 // Default departure hour
    );
    
    // Find the corresponding list item for scores
    const listItem = listItems?.find(item => item.apartmentId === apartment.id);
    
    // Get scores - they should be numbers 0-5 or null
    // Using ?? instead of || to preserve 0 values (which mean "TBD/not scored")
    const locationScore = listItem?.locationScore ?? null;
    const designScore = listItem?.designScore ?? null;
    const spaceScore = listItem?.spaceScore ?? null;
    
    return {
      'Title': apartment.title || 'No title',
      'Property URL': apartment.sourceUrl || '',
      'Price (¥/month)': apartment.price || 0,
      '2-Year Total (¥)': total,
      'Total Initial Fees (¥)': apartment.feesTotal ?? null,
      'Size (m²)': apartment.size || 0,
      'Location Score': locationScore,
      'Design Score': designScore,
      'Space Score': spaceScore,
      'Google Maps URL': googleMapsUrl,
    };
  });
  
  // Create worksheet from data
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Convert to CSV
  const csv = XLSX.utils.sheet_to_csv(ws);
  
  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `${listName.replace(/[^a-z0-9]/gi, '_')}_${date}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}