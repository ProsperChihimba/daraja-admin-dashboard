"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock, EmptyState } from "@/components/common/PageStates";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status_badge";
import type { SearchResponse, SearchResult, SearchResultType } from "@/types/admin";

const GROUP_ORDER: SearchResultType[] = [
  "organization",
  "borrower",
  "loan",
  "repayment",
  "payment",
];

const GROUP_LABELS: Record<SearchResultType, string> = {
  organization: "Organizations",
  borrower: "Borrowers",
  loan: "Loans",
  repayment: "Repayments",
  payment: "Payments",
};

function resultHref(r: SearchResult): string | null {
  switch (r.type) {
    case "organization":
      return `/organizations/${r.id}`;
    case "borrower":
      return `/borrowers/${r.id}`;
    case "loan":
      return `/loans/${r.id}`;
    case "repayment":
      return r.loan_id ? `/loans/${r.loan_id}` : null;
    case "payment":
      return "/subscriptions";
    default:
      return null;
  }
}

function SearchResultRow({ result }: { result: SearchResult }) {
  const href = resultHref(result);
  const content = (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate font-medium text-text">{result.title}</div>
        {result.subtitle ? (
          <div className="truncate text-xs text-text-muted">{result.subtitle}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-text-muted">{result.org}</span>
        <StatusBadge variant="neutral">{GROUP_LABELS[result.type]}</StatusBadge>
      </div>
    </div>
  );

  if (!href) {
    return <div>{content}</div>;
  }
  return (
    <Link href={href} className="block transition-colors hover:bg-secondary">
      {content}
    </Link>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";
  const [input, setInput] = React.useState(q);

  React.useEffect(() => {
    setInput(q);
  }, [q]);

  const enabled = q.trim().length >= 2;

  const { data, loading, error, refetch } = useAdminResource<SearchResponse>(
    "/admin/search/",
    { q },
    { enabled },
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const grouped = React.useMemo(() => {
    const map = new Map<SearchResultType, SearchResult[]>();
    for (const r of data?.results ?? []) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    return map;
  }, [data]);

  return (
    <>
      <PageHeader
        title="Search"
        subtitle={q ? `Results for “${q}”` : undefined}
      />

      <form onSubmit={handleSubmit} className="mb-6 max-w-md">
        <Input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search customers, loans, MFIs, transactions…"
        />
      </form>

      {!enabled ? (
        <EmptyState message="Type at least 2 characters to search." />
      ) : loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data || data.results.length === 0 ? (
        <EmptyState message={`No matches for “${q}”.`} />
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.filter((type) => (grouped.get(type)?.length ?? 0) > 0).map((type) => (
            <Card key={type}>
              <CardHeader>
                <CardTitle>{GROUP_LABELS[type]}</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border-soft px-0">
                {grouped.get(type)!.map((r) => (
                  <SearchResultRow key={`${r.type}-${r.id}`} result={r} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <React.Suspense fallback={<LoadingBlock />}>
      <SearchPageInner />
    </React.Suspense>
  );
}
