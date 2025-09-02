'use client';

import { useApartmentFilters } from '~/hooks/use-apartment-filters';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import { Checkbox } from '~/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'mansion', label: 'Mansion' },
  { value: 'house', label: 'House' },
  { value: 'share-house', label: 'Share House' },
];

const FEATURES = [
  { value: 'pet-friendly', label: 'Pet Friendly' },
  { value: 'parking', label: 'Parking' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'auto-lock', label: 'Auto Lock' },
  { value: 'elevator', label: 'Elevator' },
  { value: 'floor-heating', label: 'Floor Heating' },
];

export function FilterSidebar() {
  const {
    filters,
    setPriceRange,
    togglePropertyType,
    toggleFeature,
    setAreaRange,
    setMaxCommuteTime,
    setSorting,
    clearFilters,
  } = useApartmentFilters();

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Filters</CardTitle>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price Range */}
        <div className="space-y-2">
          <Label>Price Range (¥)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.priceMin || ''}
              onChange={(e) => setPriceRange(e.target.value ? Number(e.target.value) : undefined, filters.priceMax)}
            />
            <span className="self-center">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.priceMax || ''}
              onChange={(e) => setPriceRange(filters.priceMin, e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>

        <Separator />

        {/* Commute Time */}
        <div className="space-y-2">
          <Label>Max Commute Time (minutes)</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[filters.maxCommuteMinutes || 30]}
              onValueChange={([value]) => setMaxCommuteTime(value)}
              min={10}
              max={90}
              step={5}
              className="flex-1"
            />
            <span className="w-12 text-sm font-medium">{filters.maxCommuteMinutes || 30}m</span>
          </div>
        </div>

        <Separator />

        {/* Area Range */}
        <div className="space-y-2">
          <Label>Area (m²)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.sizeMin || ''}
              onChange={(e) => setAreaRange(e.target.value ? Number(e.target.value) : undefined, filters.sizeMax)}
            />
            <span className="self-center">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.sizeMax || ''}
              onChange={(e) => setAreaRange(filters.sizeMin, e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>

        <Separator />

        {/* Property Types */}
        <div className="space-y-2">
          <Label>Property Type</Label>
          <div className="space-y-2">
            {PROPERTY_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={type.value}
                  checked={filters.layout?.includes(type.value) || false}
                  onCheckedChange={() => togglePropertyType(type.value)}
                />
                <Label
                  htmlFor={type.value}
                  className="text-sm font-normal cursor-pointer"
                >
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Features */}
        <div className="space-y-2">
          <Label>Features</Label>
          <div className="space-y-2">
            {FEATURES.map((feature) => (
              <div key={feature.value} className="flex items-center space-x-2">
                <Checkbox
                  id={feature.value}
                  checked={filters.amenities?.includes(feature.value) || false}
                  onCheckedChange={() => toggleFeature(feature.value)}
                />
                <Label
                  htmlFor={feature.value}
                  className="text-sm font-normal cursor-pointer"
                >
                  {feature.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Sorting */}
        <div className="space-y-2">
          <Label>Sort By</Label>
          <Select
            value={`${filters.sortBy || 'createdAt'}-${filters.sortOrder || 'desc'}`}
            onValueChange={(value) => {
              const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
              setSorting(sortBy, sortOrder);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="size-asc">Area: Small to Large</SelectItem>
              <SelectItem value="size-desc">Area: Large to Small</SelectItem>
              <SelectItem value="commuteTime-asc">Commute: Shortest First</SelectItem>
              <SelectItem value="commuteTime-desc">Commute: Longest First</SelectItem>
              <SelectItem value="createdAt-desc">Newest First</SelectItem>
              <SelectItem value="createdAt-asc">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}