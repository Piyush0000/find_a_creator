import { Request, Response, NextFunction } from 'express';
import { sanitizeText, detectLinkLeaks } from '@evoc/types';
import { SecurityFlagsService } from '../services/securityFlags.service.js';

/**
 * Middleware that scans request payloads (briefs, notes, messages) for PII / contact leaks.
 * `linkFields` hold URLs: they are checked with link-specific rules and never rewritten.
 */
export function antiLeakScan(fieldsToScan: string[], linkFields: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    const violationsFound: string[] = [];
    const flaggedFields: string[] = [];

    for (const field of linkFields) {
      const value = req.body[field];
      if (typeof value === 'string') {
        const violations = detectLinkLeaks(value);
        if (violations.length > 0) {
          violationsFound.push(...violations);
          flaggedFields.push(field);
        }
      }
    }

    for (const field of fieldsToScan) {
      const value = req.body[field];
      if (typeof value === 'string') {
        const { sanitized, hasViolations, violations } = sanitizeText(value);
        if (hasViolations) {
          violationsFound.push(...violations);
          flaggedFields.push(field);
        }
        req.body[field] = sanitized;
      }
    }

    if (violationsFound.length > 0) {
      // Log blocked attempt to the Security Flag Queue (violation types only, no PII)
      SecurityFlagsService.record({
        route: `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`,
        fields: flaggedFields,
        violations: Array.from(new Set(violationsFound)),
        userId: req.user?.userId ?? null,
        role: req.user?.role ?? null
      });

      return res.status(400).json({
        error: 'Security Policy Violation: Sharing personal contact information (phone, email, social handles) is strictly prohibited on EVOC Labs.',
        detectedViolations: Array.from(new Set(violationsFound))
      });
    }

    next();
  };
}
