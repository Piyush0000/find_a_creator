import { Request, Response, NextFunction } from 'express';
import { sanitizeText } from '@evoc/types';

/**
 * Middleware that scans request payloads (briefs, notes, messages) for PII / contact leaks.
 */
export function antiLeakScan(fieldsToScan: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const violationsFound: string[] = [];

    for (const field of fieldsToScan) {
      const value = req.body[field];
      if (typeof value === 'string') {
        const { sanitized, hasViolations, violations } = sanitizeText(value);
        if (hasViolations) {
          violationsFound.push(...violations);
        }
        req.body[field] = sanitized;
      }
    }

    if (violationsFound.length > 0) {
      return res.status(400).json({
        error: 'Security Policy Violation: Sharing personal contact information (phone, email, social handles) is strictly prohibited on EVOC Labs.',
        detectedViolations: Array.from(new Set(violationsFound))
      });
    }

    next();
  };
}
