"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

export default function NewUserPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isCreatingPreferences, setIsCreatingPreferences] = useState(false);
  
  const createPreferencesMutation = api.user.createInitialPreferences.useMutation({
    onSuccess: () => {
      router.push("/");
    },
    onError: (error) => {
      console.error("Error creating preferences:", error);
    },
  });

  useEffect(() => {
    if (status === "authenticated" && !isCreatingPreferences) {
      setIsCreatingPreferences(true);
      // Create initial user preferences
      createPreferencesMutation.mutate();
    }
  }, [status, isCreatingPreferences]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome to Tokyo Apartment Finder!
          </h2>
          <p className="mt-4 text-gray-600">
            {session?.user?.name ? `Hi ${session.user.name}! ` : ""}
            We're setting up your account...
          </p>
        </div>

        {createPreferencesMutation.isPending && (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          </div>
        )}

        {createPreferencesMutation.isError && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">
              There was an error setting up your account. Please try again.
            </p>
            <button
              onClick={() => createPreferencesMutation.mutate()}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-500"
            >
              Retry
            </button>
          </div>
        )}

        <div className="rounded-md bg-blue-50 p-4">
          <h3 className="text-sm font-medium text-blue-800">What happens next?</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-blue-700">
            <li>Search for apartments by commute time</li>
            <li>Save your favorite apartments</li>
            <li>Set up search alerts</li>
            <li>Compare apartments side by side</li>
          </ul>
        </div>
      </div>
    </div>
  );
}