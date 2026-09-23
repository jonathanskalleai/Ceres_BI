/**
 * Runtime contract shared by BI fetchers and widgets.
 *
 * TypeScript types describe what we expect from an RPC; this module describes
 * what we actually received at runtime.  Keeping the two concerns separate is
 * intentional: a malformed JSON payload must become an explicit error, never
 * a plausible-looking zero or an empty chart.
 */

export type BiRuntimeStatus = "ok" | "partial" | "error";

export interface BiIssue {
  code: string;
  message: string;
  path?: string;
  severity?: "warning" | "error";
}

export interface BiEnvelope<T> {
  status: BiRuntimeStatus;
  data?: T;
  issues?: BiIssue[];
  meta?: Record<string, unknown>;
}

export type BiContractErrorCode =
  | "BI_CONTRACT_INVALID"
  | "BI_CONTRACT_MISSING"
  | "BI_CONTRACT_NUMBER"
  | "BI_CONTRACT_COORDINATE"
  | "BI_REQUEST_ABORTED";

export class BiContractError extends Error {
  readonly code: BiContractErrorCode;
  readonly issues: BiIssue[];

  constructor(message: string, issues: BiIssue[] = [], code: BiContractErrorCode = "BI_CONTRACT_INVALID") {
    super(message);
    this.name = "BiContractError";
    this.code = code;
    this.issues = issues;
  }
}

export function issue(
  code: string,
  message: string,
  path?: string,
  severity: "warning" | "error" = "error",
): BiIssue {
  return { code, message, ...(path ? { path } : {}), severity };
}
