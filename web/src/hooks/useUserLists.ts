import { api } from '~/utils/api';

// Hook to manage apartment lists
export function useApartmentLists(apartmentIds: string[]) {
  // Get list status for all apartments
  const isEnabled = apartmentIds.length > 0;
  const { data: listStatus, refetch } = api.apartmentList.getApartmentListStatus.useQuery(
    { apartmentIds },
    { 
      enabled: isEnabled
    }
  );

  // Toggle mutations with optimistic updates
  const utils = api.useUtils();

  const toggleSaved = api.apartmentList.toggleApartmentInList.useMutation({
    onMutate: async ({ apartmentId }) => {
      // Cancel outgoing refetches
      await utils.apartmentList.getApartmentListStatus.cancel();
      
      // Snapshot previous value
      const previousStatus = utils.apartmentList.getApartmentListStatus.getData({ apartmentIds });
      
      // Optimistically update
      if (previousStatus) {
        const newStatus = { ...previousStatus };
        if (!newStatus[apartmentId]) {
          newStatus[apartmentId] = { saved: false, favorites: false, liked: false, hidden: false };
        }
        newStatus[apartmentId] = { ...newStatus[apartmentId], saved: !newStatus[apartmentId].saved };
        utils.apartmentList.getApartmentListStatus.setData({ apartmentIds }, newStatus);
      }
      
      return { previousStatus };
    },
    onError: (err, variables, context) => {
      // Revert optimistic update on error
      if (context?.previousStatus) {
        utils.apartmentList.getApartmentListStatus.setData({ apartmentIds }, context.previousStatus);
      }
    },
    onSettled: () => {
      // Refetch to ensure we have the latest data
      refetch();
    },
  });

  const toggleFavorites = api.apartmentList.toggleApartmentInList.useMutation({
    onMutate: async ({ apartmentId }) => {
      await utils.apartmentList.getApartmentListStatus.cancel();
      const previousStatus = utils.apartmentList.getApartmentListStatus.getData({ apartmentIds });
      
      if (previousStatus) {
        const newStatus = { ...previousStatus };
        if (!newStatus[apartmentId]) {
          newStatus[apartmentId] = { saved: false, favorites: false, liked: false, hidden: false };
        }
        newStatus[apartmentId] = { ...newStatus[apartmentId], favorites: !newStatus[apartmentId].favorites };
        utils.apartmentList.getApartmentListStatus.setData({ apartmentIds }, newStatus);
      }
      
      return { previousStatus };
    },
    onError: (err, variables, context) => {
      if (context?.previousStatus) {
        utils.apartmentList.getApartmentListStatus.setData({ apartmentIds }, context.previousStatus);
      }
    },
    onSettled: () => {
      refetch();
    },
  });

  const toggleLiked = api.apartmentList.toggleApartmentInList.useMutation({
    onMutate: async ({ apartmentId }) => {
      await utils.apartmentList.getApartmentListStatus.cancel();
      const previousStatus = utils.apartmentList.getApartmentListStatus.getData({ apartmentIds });
      
      if (previousStatus) {
        const newStatus = { ...previousStatus };
        if (!newStatus[apartmentId]) {
          newStatus[apartmentId] = { saved: false, favorites: false, liked: false, hidden: false };
        }
        newStatus[apartmentId] = { ...newStatus[apartmentId], liked: !newStatus[apartmentId].liked };
        utils.apartmentList.getApartmentListStatus.setData({ apartmentIds }, newStatus);
      }
      
      return { previousStatus };
    },
    onError: (err, variables, context) => {
      if (context?.previousStatus) {
        utils.apartmentList.getApartmentListStatus.setData({ apartmentIds }, context.previousStatus);
      }
    },
    onSettled: () => {
      refetch();
    },
  });

  const toggleHidden = api.apartmentList.toggleApartmentInList.useMutation({
    onMutate: async ({ apartmentId }) => {
      await utils.apartmentList.getApartmentListStatus.cancel();
      const previousStatus = utils.apartmentList.getApartmentListStatus.getData({ apartmentIds });
      
      if (previousStatus) {
        const newStatus = { ...previousStatus };
        if (!newStatus[apartmentId]) {
          newStatus[apartmentId] = { saved: false, favorites: false, liked: false, hidden: false };
        }
        newStatus[apartmentId] = { ...newStatus[apartmentId], hidden: !newStatus[apartmentId].hidden };
        utils.apartmentList.getApartmentListStatus.setData({ apartmentIds }, newStatus);
      }
      
      return { previousStatus };
    },
    onError: (err, variables, context) => {
      if (context?.previousStatus) {
        utils.apartmentList.getApartmentListStatus.setData({ apartmentIds }, context.previousStatus);
      }
    },
    onSettled: () => {
      refetch();
    },
  });

  const handleToggle = (apartmentId: string, listType: 'saved' | 'favorites' | 'liked' | 'hidden') => {
    const mutation = 
      listType === 'saved' ? toggleSaved :
      listType === 'favorites' ? toggleFavorites :
      listType === 'liked' ? toggleLiked :
      toggleHidden;

    mutation.mutate({
      apartmentId,
      listType,
    });
  };

  return {
    listStatus: listStatus || {},
    toggleSaved: (apartmentId: string) => handleToggle(apartmentId, 'saved'),
    toggleFavorites: (apartmentId: string) => handleToggle(apartmentId, 'favorites'),
    toggleLiked: (apartmentId: string) => handleToggle(apartmentId, 'liked'),
    toggleHidden: (apartmentId: string) => handleToggle(apartmentId, 'hidden'),
    isLoading: toggleSaved.isLoading || toggleFavorites.isLoading || toggleLiked.isLoading || toggleHidden.isLoading,
  };
}