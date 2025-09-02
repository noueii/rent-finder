'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Button } from '~/components/ui/button';
import { exportApartmentsToExcel, exportToCSV } from '~/lib/export-utils';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import type { RouterOutputs } from '~/trpc/react';
import type { ApartmentSearchFilters } from '~/types/apartment';

type Apartment = RouterOutputs['list']['getApartments']['apartments'][0];

interface ExportDropdownProps {
  // For simple export when we already have all apartments
  apartments?: Apartment[];
  // For paginated lists where we need to fetch all
  listId?: string;
  filters?: ApartmentSearchFilters;
  sortField?: 'price' | 'size' | 'addedAt' | 'commuteTime' | 'score';
  sortOrder?: 'asc' | 'desc';
  totalCount?: number;
  // Common props
  listName: string;
  targetStationName?: string;
  isLoading?: boolean;
  onExport?: () => void;
}

export function ExportDropdown({
  apartments: providedApartments,
  listId,
  filters,
  sortField,
  sortOrder,
  totalCount,
  listName,
  targetStationName,
  isLoading = false,
  onExport,
}: ExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false);
  
  // Query to fetch all apartments for export (only runs when triggered)
  const exportQuery = api.list.getAllApartmentsForExport.useQuery(
    {
      listId: listId!,
      filters: filters ? {
        priceMin: filters.priceMin,
        priceMax: filters.priceMax,
        twoYearAvgMin: filters.twoYearAvgMin,
        twoYearAvgMax: filters.twoYearAvgMax,
        sizeMin: filters.sizeMin,
        sizeMax: filters.sizeMax,
        layout: filters.layout,
        buildingAge: filters.buildingAge,
        maxCommuteMinutes: filters.maxCommuteMinutes,
        excludeWards: filters.excludeWards,
      } : undefined,
      sort: sortField ? { field: sortField, order: sortOrder || 'desc' } : undefined,
    },
    {
      enabled: false, // Only fetch when explicitly triggered
    }
  );

  const handleExport = async (format: 'excel' | 'csv') => {
    setIsExporting(true);
    
    try {
      let apartmentsToExport: Apartment[];
      let exportListName = listName;
      let exportTargetStation = targetStationName;
      let listItems: any[] | undefined;
      
      // If we need to fetch all apartments (paginated list)
      if (listId && !providedApartments) {
        toast.info('Fetching all apartments for export...');
        const result = await exportQuery.refetch();
        
        if (!result.data) {
          throw new Error('Failed to fetch apartments');
        }
        
        apartmentsToExport = result.data.apartments;
        exportListName = result.data.listName || listName;
        exportTargetStation = result.data.targetStationName || targetStationName;
        listItems = (result.data as any)?.listItems || undefined;
        
        toast.success(`Fetched ${apartmentsToExport.length} apartments`);
      } else if (providedApartments) {
        // Use provided apartments
        apartmentsToExport = providedApartments;
      } else {
        throw new Error('No apartments to export');
      }
      
      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Export based on format with listItems if available
      if (format === 'excel') {
        exportApartmentsToExcel(apartmentsToExport, exportListName, exportTargetStation, listItems);
      } else {
        exportToCSV(apartmentsToExport, exportListName, exportTargetStation, listItems);
      }
      
      toast.success(`Exported ${apartmentsToExport.length} apartments to ${format.toUpperCase()}`);
      onExport?.();
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export apartments');
    } finally {
      setIsExporting(false);
    }
  };

  const count = totalCount || providedApartments?.length || 0;
  const isDisabled = isLoading || isExporting || exportQuery.isFetching || count === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isDisabled}
        >
          {(isExporting || exportQuery.isFetching) ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => handleExport('excel')} 
          disabled={isExporting || exportQuery.isFetching}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport('csv')} 
          disabled={isExporting || exportQuery.isFetching}
        >
          <FileText className="mr-2 h-4 w-4" />
          <span>CSV (.csv)</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {count} apartments will be exported
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}