export interface SpamConfig {
  /** Master switch — disable to skip all auto-detection */
  enabled: boolean;
  /** Auto-approve reviews that pass all checks (false → new reviews start as 'pending') */
  autoApprove: boolean;
  /** Min content length to auto-approve (shorter → pending) */
  minContentLength: number;
  /** Max URLs allowed before flagging as spam */
  maxUrls: number;
  /** Max reviews per author per product before flagging as spam */
  maxReviewsPerAuthor: number;
  /** Flag duplicate content as spam */
  blockDuplicate: boolean;
  /** Flag repeated characters (e.g. "aaaaaa") as spam */
  blockRepeatedChars: boolean;
  /** Custom blocked words — if any appear in content, flag as spam */
  blockedWords: string[];
}

export const DEFAULT_SPAM_CONFIG: SpamConfig = {
  enabled: true,
  autoApprove: true,
  minContentLength: 10,
  maxUrls: 2,
  maxReviewsPerAuthor: 3,
  blockDuplicate: true,
  blockRepeatedChars: true,
  blockedWords: [],
};
