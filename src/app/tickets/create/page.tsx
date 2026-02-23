"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { TicketForm } from "@/components/TicketForm";

export default function CreateTicketPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: {
    title: string;
    description?: string;
    completed?: boolean;
    due_date?: string | null;
  }) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to create ticket");
      }
      router.push("/tickets");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Create Ticket</h1>
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
      <TicketForm onSubmit={handleSubmit} submitting={submitting} />
    </main>
  );
}