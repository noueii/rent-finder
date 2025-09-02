"use client";

import React, { createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { ApartmentWithRelations } from '~/types';

interface ListManagementContextValue {
  // Apartment actions
  onViewApartment: (apartment: ApartmentWithRelations) => void;
  onLikeApartment: (apartment: ApartmentWithRelations) => void;
  onBookmarkApartment: (apartment: ApartmentWithRelations) => void;
  onRemoveFromList: (listId: string, apartment: ApartmentWithRelations) => void;
  onAddToList: (listId: string, apartmentId: string) => Promise<void>;
  
  // Bulk actions
  bulkAddToList: (listId: string, apartmentIds: string[]) => Promise<void>;
  bulkRemoveFromList: (listId: string, apartmentIds: string[]) => Promise<void>;
}

const ListManagementContext = createContext<ListManagementContextValue | undefined>(undefined);

export function useListManagement() {
  const context = useContext(ListManagementContext);
  if (!context) {
    throw new Error('useListManagement must be used within ListManagementProvider');
  }
  return context;
}

interface ListManagementProviderProps {
  children: ReactNode;
}

export function ListManagementProvider({ children }: ListManagementProviderProps) {
  const router = useRouter();
  const utils = api.useUtils();
  
  // Mutations
  const addToListMutation = api.list.addApartment.useMutation({
    onSuccess: () => {
      toast.success('Added to list');
      utils.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add to list');
    },
  });
  
  const removeFromListMutation = api.list.removeApartment.useMutation({
    onSuccess: () => {
      toast.success('Removed from list');
      utils.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove from list');
    },
  });
  
  const bulkAddMutation = api.list.bulkAddApartments.useMutation({
    onSuccess: () => {
      toast.success('Apartments added to list');
      utils.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add apartments');
    },
  });
  
  // TODO: bulkRemoveApartments endpoint not implemented yet
  const bulkRemoveMutation = { mutate: () => {} } as any; /* api.list.bulkRemoveApartments.useMutation({
    onSuccess: () => {
      toast.success('Apartments removed from list');
      utils.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove apartments');
    },
  }); */
  
  // TODO: toggleLike endpoint not implemented yet
  const toggleLikeMutation = { mutate: () => {} } as any; /* api.apartment.toggleLike.useMutation({
    onSuccess: () => {
      utils.apartment.invalidate();
      utils.list.invalidate();
    },
  }); */
  
  // TODO: toggleBookmark endpoint not implemented yet
  const toggleBookmarkMutation = { mutate: () => {} } as any; /* api.apartment.toggleBookmark.useMutation({
    onSuccess: () => {
      utils.apartment.invalidate();
      utils.list.invalidate();
    },
  }); */
  
  // TODO: markAsViewed endpoint not implemented yet
  const markAsViewedMutation = { mutate: () => {} } as any; /* api.apartment.markAsViewed.useMutation({
    onSuccess: () => {
      utils.apartment.invalidate();
    },
  }); */
  
  // Action handlers
  const onViewApartment = useCallback((apartment: ApartmentWithRelations) => {
    // Mark as viewed
    markAsViewedMutation.mutate({ apartmentId: apartment.id });
    
    // Navigate to apartment details
    router.push(`/apartments/${apartment.id}`);
  }, [router, markAsViewedMutation]);
  
  const onLikeApartment = useCallback((apartment: ApartmentWithRelations) => {
    toggleLikeMutation.mutate({ apartmentId: apartment.id });
  }, [toggleLikeMutation]);
  
  const onBookmarkApartment = useCallback((apartment: ApartmentWithRelations) => {
    toggleBookmarkMutation.mutate({ apartmentId: apartment.id });
  }, [toggleBookmarkMutation]);
  
  const onRemoveFromList = useCallback((listId: string, apartment: ApartmentWithRelations) => {
    removeFromListMutation.mutate({
      listId,
      apartmentId: apartment.id,
    });
  }, [removeFromListMutation]);
  
  const onAddToList = useCallback(async (listId: string, apartmentId: string) => {
    await addToListMutation.mutateAsync({
      listId,
      apartmentId,
    });
  }, [addToListMutation]);
  
  const bulkAddToList = useCallback(async (listId: string, apartmentIds: string[]) => {
    await bulkAddMutation.mutateAsync({
      listId,
      apartmentIds,
    });
  }, [bulkAddMutation]);
  
  const bulkRemoveFromList = useCallback(async (listId: string, apartmentIds: string[]) => {
    await bulkRemoveMutation.mutateAsync({
      listId,
      apartmentIds,
    });
  }, [bulkRemoveMutation]);
  
  const value: ListManagementContextValue = {
    onViewApartment,
    onLikeApartment,
    onBookmarkApartment,
    onRemoveFromList,
    onAddToList,
    bulkAddToList,
    bulkRemoveFromList,
  };
  
  return (
    <ListManagementContext.Provider value={value}>
      {children}
    </ListManagementContext.Provider>
  );
}