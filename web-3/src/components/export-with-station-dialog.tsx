'use client';

import { useState } from 'react';
import { Download, Loader2, MapPin, Train } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { StationSearch } from '~/components/station-search';
import { exportApartmentsToExcel, exportToCSV } from '~/lib/export-utils';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import type { RouterOutputs } from '~/trpc/react';
import type { ApartmentSearchFilters } from '~/types/apartment';

type Apartment = RouterOutputs['list']['getApartments']['apartments'][0];
type Station = {
  id: string;
  name: string;
  nameEn?: string | null;
  latitude: number;
  longitude: number;
};

interface ExportWithStationDialogProps {
  // For paginated lists where we need to fetch all
  listId: string;
  filters?: ApartmentSearchFilters;
  sortField?: 'price' | 'size' | 'addedAt' | 'commuteTime' | 'score';
  sortOrder?: 'asc' | 'desc';
  totalCount?: number;
  // Common props
  listName: string;
  currentTargetStation?: { id: string; name: string };
  isLoading?: boolean;
  trigger?: React.ReactNode;
}

export function ExportWithStationDialog({
  listId,
  filters,
  sortField,
  sortOrder,
  totalCount,
  listName,
  currentTargetStation,
  isLoading = false,
  trigger,
}: ExportWithStationDialogProps) {
  const [open, setOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [targetOption, setTargetOption] = useState<'current' | 'custom' | 'none'>(
    currentTargetStation ? 'current' : 'none'
  );
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Query to fetch all apartments for export (without routes)
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

  // Query to fetch all apartments with routes calculated
  const exportWithRoutesQuery = api.list.getAllApartmentsWithRoutes.useMutation({
    onError: (error) => {
      console.error('Export failed:', error);
      toast.error('Failed to calculate routes: ' + error.message);
    }
  });


  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Handle export without commute times
      if (targetOption === 'none') {
        toast.info('Fetching all apartments for export...');
        
        // Use refetch to get the data
        const result = await exportQuery.refetch();
        
        if (!result.data || !result.data.apartments || result.data.apartments.length === 0) {
          toast.error('No apartments to export');
          return;
        }
        
        // Export based on format with listItems if available
        const listItems = (result.data as any).listItems || undefined;
        if (exportFormat === 'excel') {
          exportApartmentsToExcel(result.data.apartments, listName, undefined, listItems);
        } else {
          exportToCSV(result.data.apartments, listName, undefined, listItems);
        }
        
        toast.success(`Exported ${result.data.apartments.length} apartments`);
        setOpen(false);
        return;
      }
      
      // Handle export with commute times
      if (targetOption === 'custom' && !selectedStation) {
        toast.error('Please select a target station');
        setIsExporting(false);
        return;
      }
      
      const targetStationId = targetOption === 'current' 
        ? currentTargetStation?.id 
        : selectedStation?.id;
        
      const targetStationName = targetOption === 'current' 
        ? currentTargetStation?.name 
        : selectedStation?.name;

      if (!targetStationId || !targetStationName) {
        toast.error('No target station selected');
        setIsExporting(false);
        return;
      }

      // Fetch apartments with routes calculated to the selected station
      toast.info('Calculating commute times...');
      
      const result = await exportWithRoutesQuery.mutateAsync({
        listId,
        targetStationId,
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
      });

      if (!result.apartments || result.apartments.length === 0) {
        toast.error('No apartments to export');
        return;
      }

      toast.success(`Calculated routes for ${result.apartments.length} apartments`);
      
      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Export based on format with listItems if available
      const listItems = (result as any).listItems || undefined;
      if (exportFormat === 'excel') {
        exportApartmentsToExcel(result.apartments, listName, targetStationName, listItems);
      } else {
        exportToCSV(result.apartments, listName, targetStationName, listItems);
      }
      
      toast.success(`Exported ${result.apartments.length} apartments with commute times to ${targetStationName}`);
      setOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export apartments');
    } finally {
      setIsExporting(false);
    }
  };

  const count = totalCount || 0;
  
  // Determine if we can export
  const canExport = targetOption === 'none' || 
    (targetOption === 'current' && currentTargetStation?.id) ||
    (targetOption === 'custom' && selectedStation?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="outline" 
            size="sm" 
            disabled={isLoading || count === 0}
            type="button"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Apartments</DialogTitle>
          <DialogDescription>
            Choose export format and target station for commute calculations
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Export Format */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as 'excel' | 'csv')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex items-center gap-2 font-normal cursor-pointer">
                  Excel (.xlsx) - Recommended for Google Sheets
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 font-normal cursor-pointer">
                  CSV (.csv) - Universal format
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Target Station Selection */}
          <div className="space-y-3">
            <Label>Commute Time Calculation</Label>
            <RadioGroup value={targetOption} onValueChange={(v) => setTargetOption(v as 'current' | 'custom' | 'none')}>
              {currentTargetStation && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="current" id="current" />
                  <Label htmlFor="current" className="flex items-center gap-2 font-normal cursor-pointer">
                    <Train className="h-4 w-4" />
                    Current target: {currentTargetStation.name}
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="flex items-center gap-2 font-normal cursor-pointer">
                  <MapPin className="h-4 w-4" />
                  Select a different station
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none" className="flex items-center gap-2 font-normal cursor-pointer">
                  <Download className="h-4 w-4" />
                  Export without commute times
                </Label>
              </div>
            </RadioGroup>
            
            {targetOption === 'custom' && (
              <div className="mt-3 space-y-2">
                <StationSearch
                  value={selectedStation?.id}
                  onSelect={(station) => {
                    console.log('Station selected:', station);
                    setSelectedStation(station);
                  }}
                  placeholder="Search for a station..."
                />
                {selectedStation && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedStation.name} ({selectedStation.id})
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {count} apartments will be exported
            {targetOption !== 'none' && ' with commute times calculated'}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isExporting || exportWithRoutesQuery.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={
              isExporting || 
              exportWithRoutesQuery.isPending || 
              !canExport
            }
          >
            {(isExporting || exportWithRoutesQuery.isPending) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {exportWithRoutesQuery.isPending ? 'Calculating routes...' : 'Exporting...'}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}