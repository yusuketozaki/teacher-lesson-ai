"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/lesson/clipboard";

type CopyStatus = "idle" | "copying" | "copied" | "failed";

/** Copies the current plan text; falls back to a selectable textarea on failure. */
export function CopyPanel({ text }: { text: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  // Text of the last successful copy; the success message hides once edits differ.
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === "failed" && fallbackRef.current) {
      fallbackRef.current.focus();
      fallbackRef.current.select();
    }
  }, [status, attempt]);

  async function handleCopy() {
    setStatus("copying");
    const outcome = await copyText(text);
    setStatus(outcome);
    setCopiedText(outcome === "copied" ? text : null);
    setAttempt((n) => n + 1);
  }

  function selectAll() {
    fallbackRef.current?.focus();
    fallbackRef.current?.select();
  }

  return (
    <div className="copy-panel">
      <button
        type="button"
        className="primary"
        onClick={handleCopy}
        disabled={status === "copying"}
      >
        授業案をコピー
      </button>
      <p className="copy-status" role="status" aria-live="polite">
        {status === "copied" && copiedText === text && (
          <>
            <span aria-hidden="true">✓ </span>コピーしました
          </>
        )}
        {status === "failed" && (
          <>
            <span aria-hidden="true">✕ </span>
            自動コピーできませんでした。下の欄を選択して手動でコピーしてください。
          </>
        )}
      </p>
      {status === "copied" && copiedText !== text && (
        <p className="hint">
          コピー後に編集した内容は、もう一度コピーすると反映されます。
        </p>
      )}
      <p className="hint">
        コピーするのは画面上の現在の編集内容です。コピー先での保存・共有は、このアプリの管理外です。
      </p>
      {status === "failed" && (
        <div className="field">
          <label htmlFor="copy-fallback">手動コピー用のテキスト</label>
          <textarea
            id="copy-fallback"
            ref={fallbackRef}
            readOnly
            rows={12}
            value={text}
          />
          <button type="button" onClick={selectAll}>
            全選択
          </button>
        </div>
      )}
    </div>
  );
}
