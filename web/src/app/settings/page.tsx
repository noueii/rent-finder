'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StationSearch } from '~/components/StationSearch';
import { RangeSlider } from '~/components/RangeSlider';
import { useUserSettings } from '~/hooks/useUserSettings';
import { useSearchFilters } from '~/hooks/useSearchFilters';

export default function SettingsPage() {
  const router = useRouter();
  const { settings, isLoading, updateSettings, resetToDefaults, updateCommuteSettings, updateWorkLocation } = useUserSettings();
  const { clearFilters } = useSearchFilters();
  
  // Local state for form inputs
  const [selectedStation, setSelectedStation] = useState<string | undefined>(settings.defaultCommuteStation);
  const [selectedStationName, setSelectedStationName] = useState<string>(settings.defaultCommuteStationName || '');
  const [commuteTime, setCommuteTime] = useState(settings.defaultCommuteTime || 30);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    settings.defaultPriceRange?.min || 50000,
    settings.defaultPriceRange?.max || 200000
  ]);
  const [sizeRange, setSizeRange] = useState<[number, number]>([
    settings.defaultSizeRange?.min || 20,
    settings.defaultSizeRange?.max || 80
  ]);
  const [selectedLayouts, setSelectedLayouts] = useState<string[]>(settings.defaultLayouts || []);
  const [maxBuildingAge, setMaxBuildingAge] = useState<number | undefined>(settings.defaultMaxBuildingAge);
  const [maxWalkingMinutes, setMaxWalkingMinutes] = useState<number | undefined>(settings.defaultMaxWalkingMinutes);
  const [defaultView, setDefaultView] = useState<'list' | 'map'>(settings.defaultView || 'list');
  const [defaultSortBy, setDefaultSortBy] = useState(settings.defaultSortBy || 'price_asc');
  
  // Work location state
  const [workLocationName, setWorkLocationName] = useState(settings.workLocation?.name || '');
  const [workLocationAddress, setWorkLocationAddress] = useState(settings.workLocation?.address || '');
  
  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(settings.emailNotifications || false);
  const [newListingAlerts, setNewListingAlerts] = useState(settings.newListingAlerts || false);
  const [priceDropAlerts, setPriceDropAlerts] = useState(settings.priceDropAlerts || false);

  // Update local state when settings load
  useEffect(() => {
    if (!isLoading) {
      setSelectedStation(settings.defaultCommuteStation);
      setSelectedStationName(settings.defaultCommuteStationName || '');
      setCommuteTime(settings.defaultCommuteTime || 30);
      setPriceRange([
        settings.defaultPriceRange?.min || 50000,
        settings.defaultPriceRange?.max || 200000
      ]);
      setSizeRange([
        settings.defaultSizeRange?.min || 20,
        settings.defaultSizeRange?.max || 80
      ]);
      setSelectedLayouts(settings.defaultLayouts || []);
      setMaxBuildingAge(settings.defaultMaxBuildingAge);
      setMaxWalkingMinutes(settings.defaultMaxWalkingMinutes);
      setDefaultView(settings.defaultView || 'list');
      setDefaultSortBy(settings.defaultSortBy || 'price_asc');
      setWorkLocationName(settings.workLocation?.name || '');
      setWorkLocationAddress(settings.workLocation?.address || '');
      setEmailNotifications(settings.emailNotifications || false);
      setNewListingAlerts(settings.newListingAlerts || false);
      setPriceDropAlerts(settings.priceDropAlerts || false);
    }
  }, [settings, isLoading]);

  const handleSaveSettings = () => {
    // Update commute settings
    if (selectedStation && selectedStationName) {
      updateCommuteSettings(selectedStation, selectedStationName, commuteTime);
    }

    // Update work location
    updateWorkLocation(workLocationName, workLocationAddress);

    // Update all other settings
    updateSettings({
      defaultPriceRange: { min: priceRange[0], max: priceRange[1] },
      defaultSizeRange: { min: sizeRange[0], max: sizeRange[1] },
      defaultLayouts: selectedLayouts,
      defaultMaxBuildingAge: maxBuildingAge,
      defaultMaxWalkingMinutes: maxWalkingMinutes,
      defaultView: defaultView,
      defaultSortBy: defaultSortBy,
      emailNotifications: emailNotifications,
      newListingAlerts: newListingAlerts,
      priceDropAlerts: priceDropAlerts,
    });

    // Show success message
    alert('Settings saved successfully!');
  };

  const handleResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This will also clear your saved search filters.')) {
      resetToDefaults();
      clearFilters();
      alert('Settings reset to defaults!');
    }
  };

  const handleLayoutToggle = (layout: string) => {
    setSelectedLayouts(prev => 
      prev.includes(layout) 
        ? prev.filter(l => l !== layout)
        : [...prev, layout]
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900">User Settings</h1>
          <p className="text-gray-600 mt-2">Configure your default search preferences and commute settings.</p>
        </div>

        <div className="space-y-8">
          {/* Commute Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Default Commute Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Work/School Station
                </label>
                <StationSearch
                  id={selectedStation || ''}
                  onSelect={(stationId, stationName) => {
                    setSelectedStation(stationId);
                    setSelectedStationName(stationName || '');
                  }}
                  placeholder="Search for your work or school station"
                />
                {selectedStationName && (
                  <p className="text-sm text-gray-600 mt-1">Selected: {selectedStationName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Maximum Commute Time
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={commuteTime}
                    onChange={(e) => setCommuteTime(Number(e.target.value))}
                    min="5"
                    max="120"
                    placeholder="30"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500 font-medium">minutes</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter any value between 5 and 120 minutes
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs text-gray-400">Quick options:</span>
                  {[15, 30, 45, 60, 90].map(time => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setCommuteTime(time)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {time}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Search Defaults */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Default Search Filters</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Default Monthly Rent Range (¥)
                </label>
                <RangeSlider
                  min={30000}
                  max={500000}
                  step={10000}
                  value={priceRange}
                  onChange={setPriceRange}
                  formatValue={(v) => `¥${v.toLocaleString()}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Default Size Range (m²)
                </label>
                <RangeSlider
                  min={10}
                  max={150}
                  step={5}
                  value={sizeRange}
                  onChange={setSizeRange}
                  formatValue={(v) => `${v}m²`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Layouts
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3LDK', '4LDK+'].map(layout => (
                    <label key={layout} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedLayouts.includes(layout)}
                        onChange={() => handleLayoutToggle(layout)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm">{layout}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Building Age
                  </label>
                  <select
                    value={maxBuildingAge || ''}
                    onChange={(e) => setMaxBuildingAge(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any</option>
                    <option value="5">Within 5 years</option>
                    <option value="10">Within 10 years</option>
                    <option value="20">Within 20 years</option>
                    <option value="30">Within 30 years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Walking Distance
                  </label>
                  <select
                    value={maxWalkingMinutes || ''}
                    onChange={(e) => setMaxWalkingMinutes(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any</option>
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* UI Preferences */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">UI Preferences</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default View
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="list"
                      checked={defaultView === 'list'}
                      onChange={(e) => setDefaultView(e.target.value as 'list' | 'map')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm">List View</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="map"
                      checked={defaultView === 'map'}
                      onChange={(e) => setDefaultView(e.target.value as 'list' | 'map')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm">Map View</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Sort Order
                </label>
                <select
                  value={defaultSortBy}
                  onChange={(e) => setDefaultSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="commute_asc">Commute Time: Shortest</option>
                  <option value="commute_desc">Commute Time: Longest</option>
                  <option value="size_asc">Size: Small to Large</option>
                  <option value="size_desc">Size: Large to Small</option>
                  <option value="building_age_asc">Building Age: Newest</option>
                  <option value="building_age_desc">Building Age: Oldest</option>
                </select>
              </div>
            </div>
          </div>

          {/* Work Location */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Work Location (for Transit Directions)</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location Name
                </label>
                <input
                  type="text"
                  value={workLocationName}
                  onChange={(e) => setWorkLocationName(e.target.value)}
                  placeholder="e.g., Colorkrew Office"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Address
                </label>
                <textarea
                  value={workLocationAddress}
                  onChange={(e) => setWorkLocationAddress(e.target.value)}
                  placeholder="Full address for Google Maps directions"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notifications (Future Feature) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Preferences</h2>
            <p className="text-sm text-gray-500 mb-4">These features will be available in a future update.</p>
            
            <div className="space-y-4 opacity-50">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  disabled
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Email notifications</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newListingAlerts}
                  onChange={(e) => setNewListingAlerts(e.target.checked)}
                  disabled
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">New listing alerts</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={priceDropAlerts}
                  onChange={(e) => setPriceDropAlerts(e.target.checked)}
                  disabled
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Price drop alerts</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleSaveSettings}
              className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save Settings
            </button>
            
            <button
              onClick={handleResetSettings}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}