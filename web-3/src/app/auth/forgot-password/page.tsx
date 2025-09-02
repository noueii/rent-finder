"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Icons } from "~/components/ui/icons";
import { api } from "~/trpc/react";
import { Form, FormInput, FormSubmit, useForm } from "~/presentation/components/forms";
import { Mail } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetCode, setResetCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    schema: forgotPasswordSchema,
  });

  const resetMutation = api.auth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      setSuccess(true);
      setError(null);
      // In production, remove this
      if (data.resetCode) {
        setResetCode(data.resetCode);
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    setError(null);
    setSuccess(false);
    resetMutation.mutate({
      email: data.email,
    });
  };

  const email = watch("email");

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-md"
        title="Reset password"
        description="Enter your email address and we'll send you a reset code"
        icon={Mail}
        footer={
          <p className="text-center text-sm text-muted-foreground w-full">
            Remember your password?{" "}
            <Link href="/auth/signin" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        }
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <>
            <Alert>
              <AlertDescription>
                If an account exists with that email, we&apos;ve sent a password reset code.
              </AlertDescription>
            </Alert>
            {resetCode && (
              <Alert>
                <AlertDescription>
                  Development only - Reset code: <strong>{resetCode}</strong>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
        <FormInput
          label="Email"
          error={errors.email?.message}
          type="email"
          placeholder="name@example.com"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect="off"
          disabled={resetMutation.isPending || success}
          {...register("email")}
        />
        <FormSubmit
          loading={resetMutation.isPending}
          loadingText="Sending..."
          icon={Mail}
          disabled={success}
        >
          Send Reset Code
        </FormSubmit>
        {success && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => window.location.href = `/auth/reset-password?email=${encodeURIComponent(email || "")}`}
          >
            Enter Reset Code
          </Button>
        )}
      </Form>
    </div>
  );
}