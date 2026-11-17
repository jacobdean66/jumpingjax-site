"use client";

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

type AgentFeedback = {
  rating: "up" | "down";
  explanation: string;
};

interface SupervisorFeedbackProps {
  id: string;
  initial?: AgentFeedback | null;
}

export function SupervisorFeedback({ id, initial }: SupervisorFeedbackProps) {
  const [savedFeedback, setSavedFeedback] = useState<AgentFeedback | null>(initial || null);
  const [draftExplanation, setDraftExplanation] = useState(initial?.explanation ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const rating = savedFeedback?.rating;

  async function save(nextRating: AgentFeedback["rating"], explanation = "") {
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/agents/feedback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: id, rating: nextRating, explanation }),
      });
      if (!response.ok) throw new Error("Feedback could not be saved.");
      const { feedback } = await response.json() as { feedback: AgentFeedback };
      setSavedFeedback(feedback);
      setDraftExplanation(feedback.explanation);
    } catch {
      setError("Feedback could not be saved. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-3 max-w-md border-t border-slate-200 pt-3" aria-busy={isSaving}>
      <div className="flex gap-2 mb-3">
        <button
          aria-label={rating === "up" ? "Thumbs up selected" : "Thumbs up"}
          aria-pressed={rating === "up"}
          onClick={() => { if (rating !== "up") void save("up"); }}
          disabled={isSaving}
          className={`p-2 rounded-full ${rating === "up" ? 'bg-green-500 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
          type="button"
        >
          <ThumbsUp size={18} aria-hidden="true" />
        </button>
        <button
          aria-label={rating === "down" ? "Thumbs down selected" : "Thumbs down"}
          aria-pressed={rating === "down"}
          onClick={() => { if (rating !== "down") void save("down"); }}
          disabled={isSaving}
          className={`p-2 rounded-full ${rating === "down" ? 'bg-red-500 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
          type="button"
        >
          <ThumbsDown size={18} aria-hidden="true" />
        </button>
      </div>
      
      {rating === "down" && (
        <div className="mt-3">
          <textarea
            value={draftExplanation}
            onChange={event => setDraftExplanation(event.target.value)}
            maxLength={500}
            aria-label="What could be better? (optional)"
            placeholder="What could be better? (optional)"
            className="w-full p-2 border border-slate-300 rounded-md text-sm resize-none"
            rows={3}
            disabled={isSaving}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={() => void save("down", draftExplanation)}
              disabled={isSaving || draftExplanation === (savedFeedback?.explanation || "")}
              className="px-3 py-1 bg-slate-700 text-white text-sm rounded-md hover:bg-slate-600 disabled:opacity-50"
              type="button"
            >
              Save explanation
            </button>
          </div>
        </div>
      )}
      
      {error && (
        <div role="alert" className="mt-2 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

export type { AgentFeedback };
