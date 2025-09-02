"use client";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { useState } from "react";

export default function TestLogsPage() {
  const [result, setResult] = useState<string>("");
  const [shouldFetch, setShouldFetch] = useState(false);
  
  const { data, error, refetch, isFetching } = api.admin.testConsoleLog.useQuery(undefined, {
    enabled: shouldFetch,
  });

  // Handle the result when data or error changes
  if (data && shouldFetch) {
    setResult(`Success: ${data.message} at ${data.timestamp}`);
    setShouldFetch(false);
  } else if (error && shouldFetch) {
    setResult(`Error: ${error.message}`);
    setShouldFetch(false);
  }

  const handleTest = () => {
    console.log("Client-side console test");
    setShouldFetch(true);
    refetch();
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="mb-6 text-3xl font-bold">Console Log Test</h1>
      
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Test Console Output</h2>
        <p className="mb-4 text-muted-foreground">
          Click the button below to test if console logging is working on the server.
          Check your terminal for output.
        </p>
        
        <Button onClick={handleTest} disabled={isFetching}>
          {isFetching ? "Testing..." : "Test Console Logs"}
        </Button>
        
        {result && (
          <div className="mt-4 rounded bg-muted p-3">
            <pre>{result}</pre>
          </div>
        )}
        
        <div className="mt-6 space-y-2 text-sm">
          <p><strong>What this tests:</strong></p>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>console.log, console.warn, console.error</li>
            <li>process.stdout.write and process.stderr.write</li>
            <li>Whether logging is being suppressed by Sentry or Pino</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}