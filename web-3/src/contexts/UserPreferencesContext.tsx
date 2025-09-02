"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

interface ClientSideFilters {
  showBookmarked?: boolean;
  showLiked?: boolean;
  hideViewed?: boolean;
  showHidden?: boolean;
  showFavorited?: boolean;
}

interface UserPreferencesContextValue {
  // Client-side filters
  clientSideFilters: ClientSideFilters;
  updateClientSideFilters: (updates: Partial<ClientSideFilters>) => void;
  resetClientSideFilters: () => void;
  
  // List view preferences
  showLiked: boolean;
  setShowLiked: (show: boolean) => void;
  showBookmarked: boolean;
  setShowBookmarked: (show: boolean) => void;
  showHidden: boolean;
  setShowHidden: (show: boolean) => void;
  showFavorited: boolean;
  setShowFavorited: (show: boolean) => void;
  hideViewed: boolean;
  setHideViewed: (hide: boolean) => void;
  
  // View preferences
  viewMode: 'list' | 'grid' | 'map';
  setViewMode: (mode: 'list' | 'grid' | 'map') => void;
  
  // Sort preferences
  sortBy: 'price' | 'size' | 'createdAt' | 'commuteTime' | 'score';
  setSortBy: (field: 'price' | 'size' | 'createdAt' | 'commuteTime' | 'score') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(undefined);

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  }
  return context;
}

interface UserPreferencesProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'user-preferences';

export function UserPreferencesProvider({ children }: UserPreferencesProviderProps) {
  // Client-side filters
  const [clientSideFilters, setClientSideFilters] = useState<ClientSideFilters>({});
  
  // List view preferences
  const [showLiked, setShowLiked] = useState(true);
  const [showBookmarked, setShowBookmarked] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [showFavorited, setShowFavorited] = useState(true);
  const [hideViewed, setHideViewed] = useState(false);
  
  // View preferences
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');
  
  // Sort preferences
  const [sortBy, setSortBy] = useState<'price' | 'size' | 'createdAt' | 'commuteTime' | 'score'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const preferences = JSON.parse(stored);
        if (preferences.clientSideFilters) {
          setClientSideFilters(preferences.clientSideFilters);
          setHideViewed(preferences.clientSideFilters.hideViewed || false);
        }
        if (preferences.showLiked !== undefined) setShowLiked(preferences.showLiked);
        if (preferences.showBookmarked !== undefined) setShowBookmarked(preferences.showBookmarked);
        if (preferences.showHidden !== undefined) setShowHidden(preferences.showHidden);
        if (preferences.showFavorited !== undefined) setShowFavorited(preferences.showFavorited);
        if (preferences.viewMode) setViewMode(preferences.viewMode);
        if (preferences.sortBy) setSortBy(preferences.sortBy);
        if (preferences.sortOrder) setSortOrder(preferences.sortOrder);
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error);
    }
  }, []);
  
  // Save preferences to localStorage whenever they change
  useEffect(() => {
    const preferences = {
      clientSideFilters: { ...clientSideFilters, hideViewed },
      showLiked,
      showBookmarked,
      showHidden,
      showFavorited,
      viewMode,
      sortBy,
      sortOrder,
    };
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  }, [clientSideFilters, showLiked, showBookmarked, showHidden, showFavorited, hideViewed, viewMode, sortBy, sortOrder]);
  
  const updateClientSideFilters = useCallback((updates: Partial<ClientSideFilters>) => {
    setClientSideFilters(prev => ({ ...prev, ...updates }));
    if (updates.hideViewed !== undefined) {
      setHideViewed(updates.hideViewed);
    }
  }, []);
  
  const resetClientSideFilters = useCallback(() => {
    setClientSideFilters({});
    setHideViewed(false);
  }, []);
  
  const value: UserPreferencesContextValue = {
    clientSideFilters,
    updateClientSideFilters,
    resetClientSideFilters,
    showLiked,
    setShowLiked,
    showBookmarked,
    setShowBookmarked,
    showHidden,
    setShowHidden,
    showFavorited,
    setShowFavorited,
    hideViewed,
    setHideViewed,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
  };
  
  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}