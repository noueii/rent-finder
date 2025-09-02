import { ApartmentListPage } from '~/components/ApartmentListPage';

export default function HiddenListPage() {
  return (
    <ApartmentListPage
      listType="hidden"
      title="Hidden Apartments"
      emptyIcon={
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M9.878 9.878l-.086-.086m5.364 5.364l1.414 1.414M14.242 14.242l-.086-.086m-4.242-4.242L8.464 8.464m1.414-1.414L8.464 8.464m1.414-1.414l-.086.086" />
        </svg>
      }
      emptyMessage="Hide apartments you don't want to see in search results."
    />
  );
}