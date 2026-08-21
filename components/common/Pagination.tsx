"use client";
import { Button } from "@/components/ui/button";

export interface PaginationProps {
  page: number;
  count: number;
  pageSize: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, count, pageSize, onPage }: PaginationProps) {
  if (count === 0) return null;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p className="text-sm text-text-muted">
        Page {page} of {totalPages} · {count} total
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
