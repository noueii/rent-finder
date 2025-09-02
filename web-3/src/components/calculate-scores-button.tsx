"use client";

import { Button } from "~/components/ui/button";
import { Calculator, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface CalculateScoresButtonProps {
  listId: string;
  onComplete?: () => void;
}

export function CalculateScoresButton({ listId, onComplete }: CalculateScoresButtonProps) {
  const calculateScores = api.score.calculateListScores.useMutation({
    onSuccess: () => {
      toast.success("Scores calculated for entire list!");
      onComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to calculate scores");
    },
  });

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => calculateScores.mutate({ listId })}
      disabled={calculateScores.isPending}
      className="ml-2"
      title="Calculate scores for all apartments in this list"
    >
      {calculateScores.isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Calculating All...
        </>
      ) : (
        <>
          <Calculator className="mr-2 h-4 w-4" />
          Calculate All
        </>
      )}
    </Button>
  );
}