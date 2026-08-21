"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import api from "@/lib/axiosInstance";
import { useAdminResource } from "@/lib/useAdminResource";
import { useAppSelector } from "@/store/hooks";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IssueStatusBadge, IssuePriorityBadge } from "@/components/support/badges";
import { formatDateTime } from "@/lib/format";
import type { IssueCategory, SupportIssueDetail } from "@/types/admin";

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  loan: "Loan",
  payment: "Payment",
  account: "Account",
  data: "Data",
  technical: "Technical",
  other: "Other",
};

function errorMessage(err: unknown): string {
  const detail =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      : undefined;
  return detail ?? "Action failed";
}

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const currentUser = useAppSelector((s) => s.auth.user);
  const { data: issue, loading, error, refetch } = useAdminResource<SupportIssueDetail>(
    `/admin/issues/${id}/`,
  );

  const [resolution, setResolution] = React.useState("");
  const [savingResolution, setSavingResolution] = React.useState(false);
  const [noteBody, setNoteBody] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);
  const [updatingField, setUpdatingField] = React.useState<"status" | "priority" | "assignee" | null>(
    null,
  );

  React.useEffect(() => {
    setResolution(issue?.resolution ?? "");
  }, [issue?.resolution]);

  const patchIssue = async (payload: Record<string, unknown>) => {
    await api.patch(`/admin/issues/${id}/`, payload);
    await refetch();
  };

  const handleStatusChange = async (value: string) => {
    setUpdatingField("status");
    try {
      await patchIssue({ status: value });
      toast.success("Status updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUpdatingField(null);
    }
  };

  const handlePriorityChange = async (value: string) => {
    setUpdatingField("priority");
    try {
      await patchIssue({ priority: value });
      toast.success("Priority updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUpdatingField(null);
    }
  };

  const handleAssign = async (assignee: string | null) => {
    setUpdatingField("assignee");
    try {
      await patchIssue({ assignee });
      toast.success(assignee ? "Assigned to you" : "Unassigned");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUpdatingField(null);
    }
  };

  const handleSaveResolution = async () => {
    setSavingResolution(true);
    try {
      await patchIssue({ resolution });
      toast.success("Resolution saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingResolution(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/admin/issues/${id}/notes/`, { body: noteBody.trim() });
      setNoteBody("");
      await refetch();
      toast.success("Note added");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  if (loading || !issue) {
    return (
      <>
        <PageHeader title="Issue" />
        {error ? <ErrorState message={error} onRetry={refetch} /> : <LoadingBlock />}
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Issue" />
        <ErrorState message={error} onRetry={refetch} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${issue.reference} — ${issue.title}`}
        subtitle={issue.organization_name ?? "Unlinked"}
        actions={
          <div className="flex items-center gap-2">
            <IssuePriorityBadge priority={issue.priority} />
            <IssueStatusBadge status={issue.status} />
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-status">Status</Label>
                <Select
                  value={issue.status}
                  onValueChange={(v) => v && void handleStatusChange(v)}
                  disabled={updatingField === "status"}
                >
                  <SelectTrigger id="issue-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-priority-select">Priority</Label>
                <Select
                  value={issue.priority}
                  onValueChange={(v) => v && void handlePriorityChange(v)}
                  disabled={updatingField === "priority"}
                >
                  <SelectTrigger id="issue-priority-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Assignee</Label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text">{issue.assignee_name ?? "Unassigned"}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updatingField === "assignee" || issue.assignee === currentUser?.id}
                  onClick={() => currentUser && void handleAssign(currentUser.id)}
                >
                  Assign to me
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updatingField === "assignee" || !issue.assignee}
                  onClick={() => void handleAssign(null)}
                >
                  Unassign
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-resolution">Resolution</Label>
              <Textarea
                id="issue-resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describe how this issue was resolved"
              />
              <div>
                <Button
                  size="sm"
                  disabled={savingResolution}
                  onClick={() => void handleSaveResolution()}
                >
                  {savingResolution ? "Saving…" : "Save resolution"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div>
              <div className="text-xs text-text-muted">Description</div>
              <div className="whitespace-pre-wrap text-text">{issue.description || "—"}</div>
            </div>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-xs text-text-muted">Category</div>
                <div className="text-text">{CATEGORY_LABELS[issue.category] ?? issue.category}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Reporter</div>
                <div className="text-text">{issue.reporter_name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Reporter phone</div>
                <div className="text-text">{issue.reporter_phone ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Subject type</div>
                <div className="text-text">{issue.subject_type ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Subject ID</div>
                <div className="text-text">{issue.subject_id ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Created</div>
                <div className="text-text">{formatDateTime(issue.created_at)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Updated</div>
                <div className="text-text">{formatDateTime(issue.updated_at)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Resolved</div>
                <div className="text-text">{formatDateTime(issue.resolved_at)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {issue.notes.length === 0 ? (
              <p className="text-sm text-text-muted">No notes yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {issue.notes.map((note) => (
                  <div key={note.id} className="rounded-card border border-border-soft bg-page-cream p-3">
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>{note.author_phone || note.author}</span>
                      <span>{formatDateTime(note.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-text">{note.body}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-note">Add note</Label>
              <Textarea
                id="issue-note"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write an internal note…"
              />
              <div>
                <Button
                  size="sm"
                  disabled={savingNote || !noteBody.trim()}
                  onClick={() => void handleAddNote()}
                >
                  {savingNote ? "Adding…" : "Add note"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
