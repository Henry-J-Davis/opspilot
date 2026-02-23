"use client";

import React, { useState } from "react";
import { z } from "zod";

export interface TicketFormProps {
  initialData?: {
    title: string;
    description?: string;
    completed?: boolean;
    due_date?: string | null;
  };
  onSubmit: (data: {
    title: string;
    description?: string;
    completed?: boolean;
    due_date?: string | null;
  }) => void;
  submitting?: boolean;
}

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  due_date: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((val) => {
      if (val === "" || val === null) return null;
      return val;
    }),
});

export function TicketForm({ initialData, onSubmit, submitting }: TicketFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [completed, setCompleted] = useState(initialData?.completed ?? false);
  const [dueDate, setDueDate] = useState<string>(
    initialData?.due_date
      ? new Date(initialData.due_date).toISOString().slice(0, 16)
      : ""
  );
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    try {
      const parsed = schema.parse({
        title,
        description,
        completed,
        due_date: dueDate === "" ? null : new Date(dueDate).toISOString(),
      });
      onSubmit(parsed);
    } catch (err) {
      if (err instanceof z.ZodError) {
  const fieldErrors: Record<string, string> = {};

  err.issues.forEach((issue) => {
    const key = issue.path?.[0];
    if (typeof key === "string" || typeof key === "number") {
      fieldErrors[String(key)] = issue.message;
    }
  });

  setErrors(fieldErrors);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="title" style={{ display: "block", fontWeight: "600" }}>
          Title *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
          required
          style={{ width: "100%", padding: "0.5rem" }}
        />
        {errors.title && (
          <p id="title-error" style={{ color: "red", margin: 0 }}>
            {errors.title}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="description"
          style={{ display: "block", fontWeight: "600" }}
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
          rows={4}
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="due_date"
          style={{ display: "block", fontWeight: "600", marginBottom: "0.25rem" }}
        >
          Due Date
        </label>
        <input
          id="due_date"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={submitting}
          aria-invalid={!!errors.due_date}
          aria-describedby={errors.due_date ? "due_date-error" : undefined}
          placeholder="Optional"
          style={{ width: "100%", padding: "0.5rem" }}
        />
        {errors.due_date && (
          <p id="due_date-error" style={{ color: "red", margin: 0 }}>
            {errors.due_date}
          </p>
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="completed" style={{ fontWeight: "600" }}>
          <input
            id="completed"
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
            disabled={submitting}
            style={{ marginRight: "0.5rem" }}
          />
          Completed
        </label>
      </div>

      <button type="submit" disabled={submitting} style={{ padding: "0.5rem 1rem" }}>
        {submitting ? "Saving..." : "Save"}
      </button>
    </form>
  );
}