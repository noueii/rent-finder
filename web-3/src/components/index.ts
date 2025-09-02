// Re-export all components for clean imports
// These components will be shared across the application

// Layout components
export * from './layout';

// Core components
export { ApartmentCard } from './apartment-card';
export { ApartmentList } from './apartment-list';
export { SortedApartmentList } from './sorted-apartment-list';
export { ApartmentScore } from './apartment-score';
export { TargetedApartmentScore } from './targeted-apartment-score';
export { ApartmentFilters } from './apartment-filters';
export { SearchForm } from './search-form';
export { StationSearch } from './station-search';
export { CommutePath } from './commute-path';
export { RouteDisplay } from './route-display';
export { ListToggleButton } from './list-toggle-button';
export { ListToggleGroup } from './list-toggle-group';
export { SwipeCard } from './swipe-card';
export { MatchScoreBadge } from './match-score-badge';

// Form components
export * from './forms';

// Map components
export * from './map';

// UI components from shadcn/ui will be imported directly from their paths
// Example: import { Button } from '~/components/ui/button';

// Admin components
export * from './admin/scraper-logs';
export * from './admin/scraper-control-panel';
export { ScraperTestPanel } from './admin/scraper-test-panel';

// Dialog components
export { UpdateApartmentDetailsDialog } from './update-apartment-details-dialog';
export { AddToListDialog } from './add-to-list-dialog';
export { AssignStationDropdown } from './assign-station-dropdown';
export { BulkAssignStationDialog } from './bulk-assign-station-dialog';

// Filter components
export * from './filters';