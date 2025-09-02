"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Input } from "~/components/ui/input";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Icons } from "~/components/ui/icons";
import { api } from "~/trpc/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormSubmit } from "~/presentation/components/forms";
import { UserPlus } from "lucide-react";

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  name: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignUpValues = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
  });

  const registerMutation = api.auth.register.useMutation({
    onSuccess: (data) => {
      setSuccess(true);
      setError(null);
      // In production, remove this and just show a success message
      console.log("Verification code:", data.verificationCode);
      // Redirect to verification page
      router.push(`/auth/verify-email?email=${encodeURIComponent(data.email ?? "")}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const onSubmit = async (data: SignUpValues) => {
    setError(null);
    registerMutation.mutate({
      email: data.email,
      password: data.password,
      name: data.name,
    });
  };

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-md"
        title="Create an account"
        description="Enter your email and password to create your account"
        icon={UserPlus}
        footer={
          <p className="text-center text-sm text-muted-foreground w-full">
            Already have an account?{" "}
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
          <Alert>
            <AlertDescription>
              Account created successfully! Please check your email to verify your account.
            </AlertDescription>
          </Alert>
        )}
        <FormField
          label="Name (optional)"
          htmlFor="name"
        >
          <Input
            {...register("name")}
            id="name"
            type="text"
            placeholder="John Doe"
            disabled={registerMutation.isPending}
          />
        </FormField>
        <FormField
          label="Email"
          error={errors.email?.message}
          htmlFor="email"
        >
          <Input
            {...register("email")}
            id="email"
            type="email"
            placeholder="name@example.com"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={registerMutation.isPending}
          />
        </FormField>
        <FormField
          label="Password"
          error={errors.password?.message}
          description="Must be at least 8 characters with uppercase, lowercase, number, and special character"
          htmlFor="password"
        >
          <Input
            {...register("password")}
            id="password"
            type="password"
            autoComplete="new-password"
            disabled={registerMutation.isPending}
          />
        </FormField>
        <FormField
          label="Confirm Password"
          error={errors.confirmPassword?.message}
          htmlFor="confirmPassword"
        >
          <Input
            {...register("confirmPassword")}
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            disabled={registerMutation.isPending}
          />
        </FormField>
        <FormSubmit
          loading={registerMutation.isPending}
          loadingText="Creating account..."
          icon={UserPlus}
        >
          Sign Up
        </FormSubmit>
      </Form>
    </div>
  );
}