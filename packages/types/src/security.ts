/**
 * Anti-Disintermediation / Anti-Leak Regex Patterns
 * Intercepts phone numbers, email IDs, social handles, and circumvention keywords.
 */
export const ANTI_LEAK_PATTERNS: Record<string, RegExp> = {
  EMAIL: /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/gi,
  PHONE_INDIA: /(\+?91[\-\s]?)?[6789](\d{9}|\d{4}[\-\s]\d{5}|\d{5}[\-\s]\d{5})\b/gi,
  PHONE_GENERIC: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/gi,
  SOCIAL_HANDLE: /(@[a-zA-Z0-9_.]+|instagram\.com\/[a-zA-Z0-9_.]+|t\.me\/[a-zA-Z0-9_]+|wa\.me\/\d+)/gi,
  CIRCUMVENTION_KEYWORDS: /(call me|whatsapp me|dm on ig|dm me|pay outside|gpay direct|phonepe direct|cash on side|contact me directly)/gi
};

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
