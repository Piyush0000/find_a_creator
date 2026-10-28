/**
 * Anti-Disintermediation / Anti-Leak Regex Patterns
 * Intercepts phone numbers, email IDs, social handles, and circumvention keywords.
 */
export const ANTI_LEAK_PATTERNS: Record<string, RegExp> = {
  EMAIL: /([a-zA-Z0-9_.+-]+(\s*@\s*|\s*\[at\]\s*|\s*\(at\)\s*)[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/gi,
  // Matches any 10-digit Indian phone (starting with 6,7,8,9) with or without +91 and arbitrary spaces, hyphens, or dots between digits:
  PHONE_INDIA: /(\+?91[\-\s.]?)?[6789]([\-\s.]*\d){9}\b/gi,
  PHONE_GENERIC: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/gi,
  SOCIAL_HANDLE: /(@[a-zA-Z0-9_.]+|instagram\.com\/[a-zA-Z0-9_.]+|t\.me\/[a-zA-Z0-9_]+|telegram\.me\/[a-zA-Z0-9_]+|wa\.me\/\d+)/gi,
  CIRCUMVENTION_KEYWORDS: /(call me|whatsapp me|dm on ig|dm me|pay outside|gpay direct|phonepe direct|cash on side|contact me directly|reach out directly|pay directly|message me on|offline payment)/gi
};

/**
 * Rules applied to URL fields (e.g. product store links).
 * Phone rules are skipped because store URLs routinely contain long numeric product/variant IDs;
 * phone leaks via links (wa.me/<number>) are still caught by SOCIAL_HANDLE.
 */
export const LINK_LEAK_RULES = ['EMAIL', 'SOCIAL_HANDLE'] as const;

export function detectLinkLeaks(url: string): string[] {
  const violations: string[] = [];

  for (const rule of LINK_LEAK_RULES) {
    const regex = ANTI_LEAK_PATTERNS[rule];
    regex.lastIndex = 0;
    if (regex.test(url)) {
      violations.push(rule);
    }
    regex.lastIndex = 0;
  }

  return violations;
}

export function sanitizeText(text: string): { sanitized: string; hasViolations: boolean; violations: string[] } {
  let sanitized = text;
  const violations: string[] = [];

  for (const [rule, regex] of Object.entries(ANTI_LEAK_PATTERNS)) {
    // Reset lastIndex before testing to ensure stateful /g regex doesn't miss matches
    regex.lastIndex = 0;

    if (regex.test(sanitized)) {
      violations.push(rule);
      regex.lastIndex = 0;
      sanitized = sanitized.replace(regex, '[REDACTED_CONTACT_INFO]');
    }
  }

  return {
    sanitized,
    hasViolations: violations.length > 0,
    violations
  };
}
