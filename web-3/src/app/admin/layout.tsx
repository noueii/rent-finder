"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LayoutWrapper, AdminSidebar, PageLoading } from "~/components/layout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    // Check if user is admin
    const isAdmin = session?.user?.role === "ADMIN";

    if (!isAdmin) {
      router.push("/");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return <PageLoading />;
  }

  // Double check admin status
  const isAdmin = session?.user?.role === "ADMIN";

  if (!isAdmin) {
    return null;
  }

  return (
    <LayoutWrapper
      sidebar={<AdminSidebar />}
    >
      {children}
    </LayoutWrapper>
  );
}