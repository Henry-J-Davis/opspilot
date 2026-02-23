"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { TicketForm } from "@/components/TicketForm";

interface Ticket {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  due_date?: string | null;
}

export default function EditTicketPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params?.ticketId;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    setLoading(true);
    fetch(`/api/tickets/${ticketId}`)
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to load ticket");
        }
        return res.json();
      })
      .then((data: Ticket) => {
        setTicket(data);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [ticketId]);

  async function handleSubmit(data: {
    title: string;
    description?: string;
    completed?: boolean;
    due_date?: string | null;
  }) {
    if (!ticketId) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to update ticket");
      }
      router.push(`/tickets/${ticketId}`);
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

  if (loading) return <p>Loading...</p>;
  if (error) return <p role="alert" style={{ color: "red" }}>{error}</p>;
  if (!ticket) return <p>Ticket not found</p>;

  return (
    <main>
      <h1>Edit Ticket</h1>
      <TicketForm initialData={ticket} onSubmit={handleSubmit} submitting={submitting} />
    </main>
  );
}