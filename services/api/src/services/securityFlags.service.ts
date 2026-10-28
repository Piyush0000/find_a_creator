import { randomUUID } from 'crypto';

// ============================================================================
// Security Flag Queue (in-memory)
// Keeps a rolling audit of blocked contact-leak attempts for the Admin Console.
// Only violation types are stored — never the blocked contact details themselves.
// Entries reset on API restart; move to a database table if persistence is needed.
// ============================================================================
export interface SecurityFlag {
  id: string;
  route: string;
  fields: string[];
  violations: string[];
  userId: string | null;
  role: string | null;
  createdAt: string;
}

const MAX_FLAGS = 200;
const flags: SecurityFlag[] = [];

export class SecurityFlagsService {
  static record(entry: Omit<SecurityFlag, 'id' | 'createdAt'>): SecurityFlag {
    const flag: SecurityFlag = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry
    };

    flags.unshift(flag); // Newest first
    if (flags.length > MAX_FLAGS) {
      flags.length = MAX_FLAGS;
    }

    return flag;
  }

  static list(limit = 100): SecurityFlag[] {
    return flags.slice(0, Math.max(1, Math.min(MAX_FLAGS, limit)));
  }

  static count(): number {
    return flags.length;
  }
}
