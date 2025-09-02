"use client";

import { useCallback } from 'react';
import { useListManagement } from '~/contexts/ListManagementContext';
import { useRouter } from 'next/navigation';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import type { ApartmentWithRelations } from '~/types';

export function useListActions(listId?: string) {
  const { 
    onViewApartment: baseViewApartment, 
    onLikeApartment,
    onBookmarkApartment,
    onRemoveFromList: baseRemoveFromList,
    onAddToList,
    bulkAddToList,
    bulkRemoveFromList,
  } = useListManagement();
  
  const router = useRouter();
  const utils = api.useUtils();
  
  // Override view action for specific contexts
  const onViewApartment = useCallback((apartment: ApartmentWithRelations) => {
    // Call base view action
    baseViewApartment(apartment);
    
    // Additional logic for specific contexts can be added here
  }, [baseViewApartment]);
  
  // Override remove action if listId is provided
  const onRemoveFromList = useCallback((apartment: ApartmentWithRelations) => {
    if (listId) {
      baseRemoveFromList(listId, apartment);
    } else {
      toast.error('No list ID provided');
    }
  }, [listId, baseRemoveFromList]);
  
  // Create list action
  const createListMutation = api.list.create.useMutation({
    onSuccess: (list) => {
      toast.success('List created');
      router.push(`/lists/${list.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create list');
    },
  });
  
  const createList = useCallback(async (data: {
    name: string;
    description?: string;
    type: "SEARCH_RESULT" | "BOOKMARKED" | "LIKED" | "FAVORITED" | "HIDDEN" | "CUSTOM";
    isPublic?: boolean;
  }) => {
    return await createListMutation.mutateAsync(data);
  }, [createListMutation]);
  
  // Delete list action
  const deleteListMutation = api.list.delete.useMutation({
    onSuccess: () => {
      toast.success('List deleted');
      router.push('/lists');
      utils.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete list');
    },
  });
  
  const deleteList = useCallback(async (listId: string) => {
    return await deleteListMutation.mutateAsync({ id: listId });
  }, [deleteListMutation]);
  
  // Export list action
  const exportList = useCallback((listId: string, format: 'csv' | 'json' = 'csv') => {
    // This would typically call an API endpoint to generate the export
    const url = `/api/lists/${listId}/export?format=${format}`;
    window.open(url, '_blank');
  }, []);
  
  return {
    // Individual apartment actions
    onViewApartment,
    onLikeApartment,
    onBookmarkApartment,
    onRemoveFromList,
    onAddToList: listId ? (apartmentId: string) => onAddToList(listId, apartmentId) : undefined,
    
    // Bulk actions
    bulkAddToList: listId ? (apartmentIds: string[]) => bulkAddToList(listId, apartmentIds) : undefined,
    bulkRemoveFromList: listId ? (apartmentIds: string[]) => bulkRemoveFromList(listId, apartmentIds) : undefined,
    
    // List management
    createList,
    deleteList,
    exportList,
    
    // Loading states
    isCreatingList: createListMutation.isPending,
    isDeletingList: deleteListMutation.isPending,
  };
}