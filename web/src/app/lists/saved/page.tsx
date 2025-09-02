import { ApartmentListPage } from '~/components/ApartmentListPage';

export default function SavedListPage() {
  return (
    <ApartmentListPage
      listType="saved"
      title="Saved Apartments"
      emptyIcon={
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      }
      emptyMessage="Save apartments to review later and compare your options."
    />
  );
}