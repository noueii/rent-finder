"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Search } from "lucide-react";
import { Card } from "~/components/ui/card";

export function BasicSearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Redirect to search page with basic query
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="search" className="text-sm font-medium">
            Search by area, station, or keyword
          </label>
          <div className="flex gap-2">
            <Input
              id="search"
              type="text"
              placeholder="e.g., Shibuya, 2LDK, under 100,000 yen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="lg">
              <Search className="mr-2 h-5 w-5" />
              Search
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href="/api/auth/signin" className="text-primary hover:underline">
            Sign in
          </Link>
          {" "}to unlock our advanced commute-based search feature
        </p>
      </form>
    </Card>
  );
}