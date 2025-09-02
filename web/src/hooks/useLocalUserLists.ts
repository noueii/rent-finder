'use client';

import { useCallback } from 'react';
import { api } from '~/utils/api';

export interface ApartmentListItem {
  id: string;
  // Add other necessary properties
}

export interface UserLists {
  saved: ApartmentListItem[];
  favorites: ApartmentListItem[];
  liked: ApartmentListItem[];
  hidden: ApartmentListItem[];
}

// Adapter hook to maintain compatibility while using apartmentList
export function useLocalUserLists() {
  const utils = api.useUtils();
  
  // Get all lists data
  const { data: savedApartments } = api.apartmentList.getApartments.useQuery({ listType: 'saved' });
  const { data: favoritesApartments } = api.apartmentList.getApartments.useQuery({ listType: 'favorites' });
  const { data: likedApartments } = api.apartmentList.getApartments.useQuery({ listType: 'liked' });
  const { data: hiddenApartments } = api.apartmentList.getApartments.useQuery({ listType: 'hidden' });

  const lists: UserLists = {
    saved: savedApartments?.apartments || [],
    favorites: favoritesApartments?.apartments || [],
    liked: likedApartments?.apartments || [],
    hidden: hiddenApartments?.apartments || [],
  };

  // Toggle mutations
  const toggleMutation = api.apartmentList.toggleApartmentInList.useMutation({
    onSettled: () => {
      // Invalidate all list queries to refetch
      utils.apartmentList.getApartments.invalidate();
      utils.apartmentList.getApartmentListStatus.invalidate();
    },
  });

  const clearMutation = api.apartmentList.clearList.useMutation({
    onSettled: () => {
      utils.apartmentList.getApartments.invalidate();
      utils.apartmentList.getApartmentListStatus.invalidate();
    },
  });

  // Helper functions
  const toggleListItem = useCallback((listType: keyof UserLists, apartment: any) => {
    toggleMutation.mutate({
      apartmentId: apartment.id,
      listType,
    });
  }, [toggleMutation]);

  const addToList = useCallback((listType: keyof UserLists, apartment: any) => {
    const isCurrentlyInList = lists[listType].some(item => item.id === apartment.id);
    if (!isCurrentlyInList) {
      toggleListItem(listType, apartment);
    }
  }, [lists, toggleListItem]);

  const removeFromList = useCallback((listType: keyof UserLists, apartmentId: string) => {
    const isCurrentlyInList = lists[listType].some(item => item.id === apartmentId);
    if (isCurrentlyInList) {
      toggleListItem(listType, { id: apartmentId });
    }
  }, [lists, toggleListItem]);

  const isInList = useCallback((listType: keyof UserLists, apartmentId: string) => {
    return lists[listType].some(item => item.id === apartmentId);
  }, [lists]);

  const getListStatus = useCallback((apartmentId: string) => {
    return {
      saved: isInList('saved', apartmentId),
      favorites: isInList('favorites', apartmentId),
      liked: isInList('liked', apartmentId),
      hidden: isInList('hidden', apartmentId),
    };
  }, [isInList]);

  const clearList = useCallback((listType: keyof UserLists) => {
    clearMutation.mutate({ listType });
  }, [clearMutation]);

  // Clear all lists
  const clearAllLists = useCallback(() => {
    clearList('saved');
    clearList('favorites');
    clearList('liked');
    clearList('hidden');
  }, [clearList]);

  // Helper functions for specific lists
  const toggleSaved = useCallback((apartment: any) => toggleListItem('saved', apartment), [toggleListItem]);
  const toggleFavorites = useCallback((apartment: any) => toggleListItem('favorites', apartment), [toggleListItem]);
  const toggleLiked = useCallback((apartment: any) => toggleListItem('liked', apartment), [toggleListItem]);
  const toggleHidden = useCallback((apartment: any) => toggleListItem('hidden', apartment), [toggleListItem]);

  // Adapter for backward compatibility
  const toggleInList = useCallback((listType: keyof UserLists, apartment: any) => {
    toggleListItem(listType, apartment);
  }, [toggleListItem]);

  return {
    lists,
    isLoading: toggleMutation.isLoading || clearMutation.isLoading,
    addToList,
    removeFromList,
    toggleInList,
    isInList,
    getListStatus,
    clearList,
    clearAllLists,
    toggleSaved,
    toggleFavorites,
    toggleLiked,
    toggleHidden,
  };
}