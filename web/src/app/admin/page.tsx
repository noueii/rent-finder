import { ApartmentDataUploader } from '~/components/admin/ApartmentDataUploader';
import { StationImporter } from '~/components/admin/StationImporter';
import { DangerZone } from '~/components/admin/DangerZone';
import { requireAdmin } from '~/lib/session';

export default async function AdminPage() {
  const session = await requireAdmin();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        <div className="space-y-8">
          {/* Station Import Section */}
          <section>
            <StationImporter />
          </section>

          {/* Data Upload Section */}
          <section>
            <ApartmentDataUploader />
          </section>
          
          {/* Quick Actions */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="flex gap-4 flex-wrap">
              <a
                href="/admin/map-stations"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Map Unmapped Stations One by One
              </a>
              <a
                href="/admin/lines"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Browse Stations by Line
              </a>
            </div>
          </section>
          
          {/* Danger Zone */}
          <section>
            <DangerZone />
          </section>
        </div>
      </div>
    </div>
  );
}