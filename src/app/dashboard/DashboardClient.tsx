"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Ticket = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  owner_id: string | null;
  created_at: string | null;
  due_date: string | null; // YYYY-MM-DD
};

export default function DashboardClient() {
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>("");


  async function loadTickets() {
    setMsg(null);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setMsg(error.message);
    setTickets((data as Ticket[]) ?? []);
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
      setUserId(data.user?.id ?? "");
      await loadTickets();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTicket() {
    setMsg(null);
    if (!title.trim()) return;

    const payload: any = {
  title,
  status: "Open",
  priority: "Medium",
  owner_id: userId,
};

if (dueDate) {
  payload.due_date = dueDate;
}

const { error } = await supabase
  .from("tickets")
  .insert([payload]);

  if (error) {
  console.error(error.message);
  return;
}

    setTitle("");
    setDueDate("");
    await loadTickets();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

function endOfLocalDay(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function isOverdue(t: Ticket) {
  if (!t.due_date) return false;
  if ((t.status ?? "").toLowerCase() === "closed") return false;
  return endOfLocalDay(t.due_date).getTime() < Date.now();
}


  return (
    <main style={{ padding: 40, maxWidth: 800 }}>
      <h1>Dashboard</h1>
      <p>Signed in as: {email}</p>
      <p style={{ marginTop: 8 }}>
  <a href="/feature-requests">AI Feature Builder</a>
</p>


      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
  <input
    placeholder="New ticket title…"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    style={{ flex: 1 }}
  />

  <input
    type="date"
    value={dueDate}
    onChange={(e) => setDueDate(e.target.value)}
  />

  <button onClick={createTicket}>Create</button>
  <button onClick={logout}>Logout</button>
</div>


      {msg && <p style={{ color: "crimson" }}>{msg}</p>}

      <h2 style={{ marginTop: 24 }}>My Tickets</h2>
      {tickets.length === 0 ? (
        <p style={{ opacity: 0.8 }}>No tickets yet.</p>
      ) : (
        <ul style={{ marginTop: 8 }}>
          {tickets.map((t) => (
           <li key={t.id}>
 <strong>{t.title}</strong>{" "}
{isOverdue(t) && (
  <span
    style={{
      marginLeft: 8,
      padding: "2px 8px",
      borderRadius: 999,
      background: "#3f0a0a",
      border: "1px solid #7f1d1d",
      color: "#fecaca",
      fontSize: 12,
      fontWeight: 700,
    }}
  >
    Overdue
  </span>
)}


  <div>
    {t.status} • {t.priority}
  </div>

  {t.due_date && (
    <div style={{ opacity: 0.8 }}>
      Due: {t.due_date}
    </div>
  )}
</li>

          ))}
        </ul>
      )}
    </main>
  );
}
