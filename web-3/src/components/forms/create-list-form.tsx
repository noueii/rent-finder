"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { SelectItem } from "~/components/ui/select";
import { FolderPlus, Globe, Lock } from "lucide-react";
import { cn } from "~/lib/utils";
import { createListSchema, type CreateListFormData } from "~/lib/validation/forms";
import { ListType } from "@prisma/client";
import { useForm } from "react-hook-form";
import { Form, FormField, FormSubmit, FormInput, FormSelect } from "~/presentation/components/forms";

interface CreateListFormProps {
  onSubmit: (data: CreateListFormData) => void;
  defaultValues?: Partial<CreateListFormData>;
  loading?: boolean;
  className?: string;
  mode?: "create" | "edit";
  hideTypeSelector?: boolean;
}

const LIST_TYPE_OPTIONS: { value: ListType; label: string; description: string }[] = [
  {
    value: ListType.BOOKMARKED,
    label: "Bookmarked",
    description: "Save apartments for later viewing"
  },
  {
    value: ListType.LIKED,
    label: "Liked",
    description: "Apartments you're interested in"
  },
  {
    value: ListType.FAVORITED,
    label: "Favorites",
    description: "Your top apartment choices"
  },
  {
    value: ListType.HIDDEN,
    label: "Hidden",
    description: "Apartments you want to hide from searches"
  },
  {
    value: ListType.SEARCH_RESULT,
    label: "Search Result",
    description: "Save search results as a list"
  },
];

export function CreateListForm({
  onSubmit,
  defaultValues,
  loading,
  className,
  mode = "create",
  hideTypeSelector = false,
}: CreateListFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateListFormData>({
    resolver: zodResolver(createListSchema) as any,
    defaultValues: {
      type: ListType.BOOKMARKED,
      isPublic: false,
      ...defaultValues,
    },
  });

  const isPublic = watch("isPublic");
  const selectedType = watch("type");

  return (
    <Form
      onSubmit={handleSubmit(onSubmit)}
      className={className}
      title={mode === "create" ? "Create New List" : "Edit List"}
      description={
        mode === "create" 
          ? "Organize apartments into custom lists"
          : "Update your list details"
      }
      icon={FolderPlus}
    >
      {/* List Name */}
      <FormInput
        label="List Name"
        error={errors.name?.message}
        placeholder="e.g., Shibuya Area Apartments"
        {...register("name")}
      />

      {/* List Type */}
      {!hideTypeSelector && (
        <FormSelect
          label="List Type"
          error={errors.type?.message}
          value={selectedType}
          onValueChange={(value) => setValue("type", value as ListType)}
          placeholder="Select a list type"
        >
          {LIST_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </SelectItem>
          ))}
        </FormSelect>
      )}

      {/* Privacy Settings */}
      <FormField
        label="Privacy Settings"
        description={
          isPublic 
            ? "Anyone can view this list and its apartments"
            : "Only you can view this list"
        }
      >
        <div className="flex gap-4">
          <Button
            type="button"
            variant={!isPublic ? "default" : "outline"}
            size="sm"
            onClick={() => setValue("isPublic", false)}
            className="flex-1"
          >
            <Lock className="mr-2 h-4 w-4" />
            Private
          </Button>
          <Button
            type="button"
            variant={isPublic ? "default" : "outline"}
            size="sm"
            onClick={() => setValue("isPublic", true)}
            className="flex-1"
          >
            <Globe className="mr-2 h-4 w-4" />
            Public
          </Button>
        </div>
      </FormField>

      {/* Submit Button */}
      <FormSubmit
        loading={loading}
        loadingText={mode === "create" ? "Creating..." : "Updating..."}
        icon={FolderPlus}
      >
        {mode === "create" ? "Create List" : "Update List"}
      </FormSubmit>
    </Form>
  );
}