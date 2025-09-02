"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { AlertTriangle, Send } from "lucide-react";
import { cn } from "~/lib/utils";
import { reportIssueSchema, type ReportIssueFormData } from "~/lib/validation/forms";
import { useForm } from "react-hook-form";
import { Form, FormField, FormSubmit } from "~/presentation/components/forms";

interface ReportIssueFormProps {
  apartmentId?: string;
  apartmentTitle?: string;
  onSubmit: (data: ReportIssueFormData) => void;
  loading?: boolean;
  className?: string;
}

const ISSUE_TYPE_OPTIONS = [
  { value: "incorrect_info", label: "Incorrect Information", description: "Price, size, or details are wrong" },
  { value: "unavailable", label: "No Longer Available", description: "This apartment is already rented" },
  { value: "duplicate", label: "Duplicate Listing", description: "This is the same as another listing" },
  { value: "inappropriate", label: "Inappropriate Content", description: "Contains offensive or misleading content" },
  { value: "technical", label: "Technical Issue", description: "Problems with images or page display" },
  { value: "other", label: "Other Issue", description: "Something else is wrong" },
];

export function ReportIssueForm({
  apartmentId,
  apartmentTitle,
  onSubmit,
  loading,
  className,
}: ReportIssueFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReportIssueFormData>({
    resolver: zodResolver(reportIssueSchema),
    defaultValues: {
      apartmentId,
      issueType: "incorrect_info",
    },
  });

  const selectedIssueType = watch("issueType");

  return (
    <Form
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      title="Report an Issue"
      description={
        apartmentTitle 
          ? `Help us improve by reporting issues with "${apartmentTitle}"`
          : "Help us improve by reporting issues you've found"
      }
      icon={AlertTriangle}
    >
      {/* Issue Type */}
      <FormField
        label="What kind of issue is this?"
        error={errors.issueType?.message}
        htmlFor="issue-type"
      >
        <Select
          value={selectedIssueType}
          onValueChange={(value) => setValue("issueType", value as any)}
        >
          <SelectTrigger id="issue-type" className={cn(errors.issueType && "border-destructive")}>
            <SelectValue placeholder="Select issue type" />
          </SelectTrigger>
          <SelectContent>
            {ISSUE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {option.description}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {/* Issue Title */}
      <FormField
        label="Issue Summary"
        error={errors.title?.message}
        htmlFor="title"
      >
        <Input
          id="title"
          placeholder="Brief description of the issue"
          {...register("title")}
          className={cn(errors.title && "border-destructive")}
        />
      </FormField>

      {/* Issue Description */}
      <FormField
        label="Detailed Description"
        error={errors.description?.message}
        htmlFor="description"
      >
        <textarea
          id="description"
          rows={5}
          placeholder="Please provide as much detail as possible..."
          {...register("description")}
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            errors.description && "border-destructive"
          )}
        />
      </FormField>

      {/* Contact Email */}
      <FormField
        label="Contact Email (Optional)"
        error={errors.contactEmail?.message}
        description="We'll only use this if we need more information about the issue"
        htmlFor="email"
      >
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          {...register("contactEmail")}
          className={cn(errors.contactEmail && "border-destructive")}
        />
      </FormField>

      {/* Submit Button */}
      <FormSubmit
        loading={loading}
        loadingText="Submitting..."
        icon={Send}
      >
        Submit Report
      </FormSubmit>

      <p className="text-sm text-muted-foreground text-center">
        Thank you for helping us maintain accurate listings
      </p>
    </Form>
  );
}