// components/daraja/CardsTab.tsx
"use client";
import { CursorList } from "@/components/daraja/CursorList";
import { formatDateTime } from "@/lib/format";
import type { CardRow } from "@/types/daraja";

export function CardsTab({ employerId }: { employerId: string }) {
  return (
    <CursorList<CardRow>
      path={`/employers/${employerId}/cards/`}
      rowKey={(c) => c.card_id}
      emptyMessage="No cards issued."
      columns={[
        { key: "registered", header: "Issued",
          render: (c) => formatDateTime(c.registered) },
        { key: "card_id", header: "Card",
          render: (c) => <span className="font-mono text-xs">{c.card_id}</span> },
        { key: "status", header: "Status" },
      ]}
    />
  );
}
