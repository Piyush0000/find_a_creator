/**
 * Anti-Disintermediation / Anti-Leak Regex Patterns
 * Intercepts phone numbers, email IDs, social handles, and circumvention keywords.
 */
export const ANTI_LEAK_PATTERNS = {
  EMAIL: /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/gi,
  PHONE_INDIA: /(\+?91[\-\s]?)?[6789]\d{9}\b/g,
  PHONE_GENERIC: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  SOCIAL_HANDLE: /(@[a-zA-Z0-9_.]+|instagram\.com\/[a-zA-Z0-9_.]+|t\.me\/[a-zA-Z0-9_]+|wa\.me\/\d+)/gi,
  CIRCUMVENTION_KEYWORDS: /(call me|whatsapp me|dm on ig|dm me|pay outside|gpay direct|phonepe direct|cash on side)/gi
};

export function sanitizeText(text: string): { sanitized: string; hasViolations: boolean; violations: string[] } {
  let sanitized = text;
  const violations: string[] = [];

  for (const [rule, regex] of Object.entries(ANTI_LEAK_PATTERNS)) {
    if (regex.test(sanitized)) {
      violations.push(rule);
      sanitized = sanitized.replace(regex, '[REDACTED_CONTACT_INFO]');
    }
  }

  return {
    sanitized,
    hasViolations: violations.length > 0,
    violations
  };
}
