export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Check your email
          </h2>
          <p className="mt-4 text-gray-600">
            A sign in link has been sent to your email address.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Click the link in the email to sign in to your account.
          </p>
        </div>
        
        <div className="rounded-md bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            If you don't see the email, check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
}