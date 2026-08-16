export type ModerationAction = 'allow' | 'mask' | 'block' | 'flag';

/** Threshold at which a user is auto-flagged for admin review */
export const CIRCUMVENTION_FLAG_THRESHOLD = 3;

/** Threshold for warning notification */
export const CIRCUMVENTION_WARNING_THRESHOLD = 3;

/** Threshold for temporary chat restriction (24h) */
export const CIRCUMVENTION_TEMP_RESTRICT_THRESHOLD = 5;

/** Threshold for permanent restriction + admin review flag */
export const CIRCUMVENTION_PERMANENT_THRESHOLD = 10;

export type ModerationResult = {
  action: ModerationAction;
  displayText: string;
  reasons: string[];
};

const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/gi;
const PHONE_RE =
  /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/g;
const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s]+/gi;
const HANDLE_RE = /(?:@[\w.]{3,}|t\.me\/[\w_]{3,}|wa\.me\/\d{6,})/gi;
const PLATFORM_RE = /\b(telegram|whatsapp|signal|wechat|line|viber|instagram|facebook|skype)\b/gi;
const CONTACT_EXCHANGE_RE =
  /\b(contact me|call me|text me|reach me|dm me|message me|my number|my phone|my email|outside the app)\b/gi;

/** Street address patterns — catches common address formats */
const ADDRESS_RE =
  /\b\d{1,5}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct|place|pl|circle|cir|highway|hwy|parkway|pkwy|square|sq|trail|trl|pike|row|alley|aly|run|terrace|ter)\b/i;

/** PO Box pattern */
const PO_BOX_RE = /\bP\.?\s*O\.?\s*Box\s+\d+\b/i;

/** Explicit contact-sharing patterns that should always block */
const EXPLICIT_SHARE_RE =
  /\b(call\s+me\s+(at|on|@)\s*[\d\s().-]{7,}|my\s+(number|phone|email|address|cell|mobile)\s+is|here('s| is)\s+my\s+(number|phone|email|address)|reach\s+me\s+at\s+[\d@]|text\s+me\s+(at|on)\s*[\d\s().-]{7,}|email\s+me\s+(at|@)\s*[\w@.-]+|shoot\s+me\s+(a\s+)?(text|message|email)\s+(at|@)|give\s+me\s+a\s+call\s+(at|on)|you\s+can\s+(call|text|reach|contact)\s+me\s+(at|on|@))\b/i;

function safeReplace(input: string, re: RegExp, reason: string, reasons: Set<string>): string {
  try {
    return input.replace(re, (matched) => {
      reasons.add(reason);
      return '*'.repeat(Math.max(3, Math.min(12, matched.length)));
    });
  } catch {
    return input;
  }
}

/**
 * Detects if the message contains an explicit contact-sharing attempt
 * that should result in an immediate block (not just a flag).
 */
export function isExplicitContactShare(text: string): boolean {
  try {
    const input = typeof text === 'string' ? text : '';
    return EXPLICIT_SHARE_RE.test(input);
  } catch {
    return false;
  }
}

/**
 * Returns a user-friendly explanation for why a message was blocked/masked.
 * Used for inline warnings in the chat UI.
 */
export function getBlockedReasonMessage(reasons: string[]): string {
  if (reasons.includes('contact_exchange_pattern') || reasons.includes('explicit_contact_share')) {
    return 'Your message was blocked because it appears to contain contact information. Please keep all communication within the app for your safety and security.';
  }
  if (reasons.includes('email_detected')) {
    return 'Email addresses are not allowed in messages. Please keep communication within the app.';
  }
  if (reasons.includes('phone_detected')) {
    return 'Phone numbers are not allowed in messages. Please keep communication within the app.';
  }
  if (reasons.includes('address_detected')) {
    return 'Street addresses are not allowed in messages. Please keep communication within the app.';
  }
  if (reasons.includes('link_detected')) {
    return 'External links are not allowed in messages. Please keep communication within the app.';
  }
  if (reasons.includes('contact_handle_detected')) {
    return 'Social media handles are not allowed in messages. Please keep communication within the app.';
  }
  if (reasons.includes('external_platform_detected')) {
    return 'References to external platforms are not allowed. Please keep communication within the app.';
  }
  return 'Your message was blocked for safety reasons. Please keep communication within the app.';
}

/**
 * Returns a suggestion for alternative phrasing.
 */
export function getSuggestion(reasons: string[]): string | undefined {
  if (reasons.includes('contact_exchange_pattern') || reasons.includes('explicit_contact_share')) {
    return 'Try: "Let\'s discuss the details here in the chat" instead of sharing contact info.';
  }
  if (reasons.includes('email_detected') || reasons.includes('phone_detected')) {
    return 'Use the in-app messaging to communicate about your project.';
  }
  return undefined;
}

/**
 * Moderates a message intended for a pre-contract chat thread.
 * Pre-contract messages are ALWAYS blocked if they contain PII (phone, email, address, social handles),
 * rather than merely masked. Business names and service details are allowed through.
 *
 * This function should be called instead of `moderateMessage` when the chat context
 * is pre-contract (i.e., no approved contract exists yet).
 */
export function moderatePreContract(text: string): ModerationResult {
  try {
    const input = typeof text === 'string' ? text : '';
    const reasons = new Set<string>();
    let masked = input;

    // Check for explicit contact sharing FIRST — always block pre-contract
    if (isExplicitContactShare(input)) {
      reasons.add('explicit_contact_share');
      masked = safeReplace(masked, EMAIL_RE, 'email_detected', reasons);
      masked = safeReplace(masked, PHONE_RE, 'phone_detected', reasons);
      masked = safeReplace(masked, LINK_RE, 'link_detected', reasons);
      masked = safeReplace(masked, HANDLE_RE, 'contact_handle_detected', reasons);
      masked = safeReplace(masked, ADDRESS_RE, 'address_detected', reasons);
      masked = safeReplace(masked, PO_BOX_RE, 'address_detected', reasons);

      return {
        action: 'block',
        displayText: masked,
        reasons: Array.from(reasons),
      };
    }

    // In pre-contract, ALL PII patterns are block-worthy (not mask)
    masked = safeReplace(masked, EMAIL_RE, 'email_detected', reasons);
    masked = safeReplace(masked, PHONE_RE, 'phone_detected', reasons);
    masked = safeReplace(masked, LINK_RE, 'link_detected', reasons);
    masked = safeReplace(masked, HANDLE_RE, 'contact_handle_detected', reasons);
    masked = safeReplace(masked, ADDRESS_RE, 'address_detected', reasons);
    masked = safeReplace(masked, PO_BOX_RE, 'address_detected', reasons);

    const lower = input.toLowerCase();
    if (PLATFORM_RE.test(lower)) reasons.add('external_platform_detected');
    if (CONTACT_EXCHANGE_RE.test(lower)) reasons.add('contact_exchange_pattern');

    if (reasons.size === 0) {
      return { action: 'allow', displayText: input, reasons: [] };
    }

    // In pre-contract phase, ANY PII detection = block (stricter than regular moderateMessage)
    return {
      action: 'block',
      displayText: masked,
      reasons: Array.from(reasons),
    };
  } catch {
    return { action: 'allow', displayText: text, reasons: [] };
  }
}

/**
 * Increments the circumventionScore on a user and applies threshold-based
 * restriction actions. Returns the new score and action taken.
 *
 * Call this when a PII-blocking moderation action occurs on a chat message
 * sent by the given user.
 *
 * Thresholds:
 *   Score ≥3 → warning notification to user + audit log
 *   Score ≥5 → temporary chat restriction (24h) + notification
 *   Score ≥10 → admin review flag + permanent restriction + notification
 */
export async function incrementCircumventionScore(
  userId: string,
  reason: string,
): Promise<{ score: number; flaggedForReview: boolean; restrictionChanged: boolean; restrictionLevel: string }> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // First run daily decay if needed
    await applyDailyDecay(prisma, userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { circumventionScore: true, chatRestrictionLevel: true },
    });

    if (!user) {
      await prisma.$disconnect();
      return { score: 0, flaggedForReview: false, restrictionChanged: false, restrictionLevel: 'none' };
    }

    const oldScore = user.circumventionScore ?? 0;
    const newScore = oldScore + 1;
    let restrictionChanged = false;

    // Determine restriction level based on score
    let newRestrictionLevel = 'none';
    if (newScore >= CIRCUMVENTION_PERMANENT_THRESHOLD) {
      newRestrictionLevel = 'permanent_restricted';
    } else if (newScore >= CIRCUMVENTION_TEMP_RESTRICT_THRESHOLD) {
      newRestrictionLevel = 'temporary_restricted';
    } else if (newScore >= CIRCUMVENTION_WARNING_THRESHOLD) {
      newRestrictionLevel = 'warning';
    }

    const updateData: Record<string, unknown> = {
      circumventionScore: newScore,
    };

    if (newRestrictionLevel !== (user.chatRestrictionLevel ?? 'none')) {
      updateData.chatRestrictionLevel = newRestrictionLevel;
      restrictionChanged = true;

      // Set expiry for temporary restriction (24h from now)
      if (newRestrictionLevel === 'temporary_restricted') {
        updateData.chatRestrictionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData as any,
    });

    const flaggedForReview = newScore >= CIRCUMVENTION_FLAG_THRESHOLD;

    // Log all threshold crossings to audit log
    if (newScore === CIRCUMVENTION_WARNING_THRESHOLD) {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'circumvention_warning',
          resourceType: 'User',
          resourceId: userId,
          metadata: { circumventionScore: newScore, lastReason: reason },
        },
      }).catch(() => {});
    }

    if (newScore === CIRCUMVENTION_TEMP_RESTRICT_THRESHOLD) {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'circumvention_temp_restrict',
          resourceType: 'User',
          resourceId: userId,
          metadata: { circumventionScore: newScore, lastReason: reason, restrictionDuration: '24h' },
        },
      }).catch(() => {});
    }

    if (newScore >= CIRCUMVENTION_PERMANENT_THRESHOLD) {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'circumvention_permanent_restrict',
          resourceType: 'User',
          resourceId: userId,
          metadata: { circumventionScore: newScore, lastReason: reason },
        },
      }).catch(() => {});
    }

    await prisma.$disconnect();
    return { score: newScore, flaggedForReview, restrictionChanged, restrictionLevel: newRestrictionLevel };
  } catch {
    try { await (await import('@prisma/client')).PrismaClient.prototype.$disconnect?.(); } catch { /* ignore */ }
    return { score: 1, flaggedForReview: false, restrictionChanged: false, restrictionLevel: 'none' };
  }
}

/**
 * Applies daily score decay: reduces circumventionScore by 1 per day
 * without violations. Only decays if score > 0 and last decay was >24h ago.
 *
 * @internal — called by incrementCircumventionScore before incrementing
 */
async function applyDailyDecay(prisma: any, userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { circumventionScore: true, circumventionScoreDecayedAt: true },
    });

    if (!user || (user.circumventionScore ?? 0) <= 0) return;

    const now = new Date();
    const lastDecay = user.circumventionScoreDecayedAt;
    const decayAmount = 1;

    // Only decay if it's been >24h since last decay
    if (!lastDecay || (now.getTime() - new Date(lastDecay).getTime()) >= 24 * 60 * 60 * 1000) {
      const newScore = Math.max(0, (user.circumventionScore ?? 0) - decayAmount);

      // If score drops below thresholds, lift restrictions
      const updates: Record<string, unknown> = {
        circumventionScore: newScore,
        circumventionScoreDecayedAt: now,
      };

      if (newScore < CIRCUMVENTION_TEMP_RESTRICT_THRESHOLD && user.circumventionScore >= CIRCUMVENTION_TEMP_RESTRICT_THRESHOLD) {
        updates.chatRestrictionLevel = newScore >= CIRCUMVENTION_WARNING_THRESHOLD ? 'warning' : 'none';
        updates.chatRestrictionExpiresAt = null;
      }
      if (newScore < CIRCUMVENTION_WARNING_THRESHOLD) {
        updates.chatRestrictionLevel = 'none';
        updates.chatRestrictionExpiresAt = null;
      }

      await prisma.user.update({
        where: { id: userId },
        data: updates,
      });
    }
  } catch {
    // Non-fatal — decay will retry next time
  }
}

export function moderateMessage(text: string): ModerationResult {
  try {
    const input = typeof text === 'string' ? text : '';
    const reasons = new Set<string>();
    let masked = input;

    // Check for explicit contact sharing FIRST — this takes priority
    if (isExplicitContactShare(input)) {
      reasons.add('explicit_contact_share');
      // Still mask the PII in displayText
      masked = safeReplace(masked, EMAIL_RE, 'email_detected', reasons);
      masked = safeReplace(masked, PHONE_RE, 'phone_detected', reasons);
      masked = safeReplace(masked, LINK_RE, 'link_detected', reasons);
      masked = safeReplace(masked, HANDLE_RE, 'contact_handle_detected', reasons);
      masked = safeReplace(masked, ADDRESS_RE, 'address_detected', reasons);
      masked = safeReplace(masked, PO_BOX_RE, 'address_detected', reasons);

      return {
        action: 'block',
        displayText: masked,
        reasons: Array.from(reasons),
      };
    }

    masked = safeReplace(masked, EMAIL_RE, 'email_detected', reasons);
    masked = safeReplace(masked, PHONE_RE, 'phone_detected', reasons);
    masked = safeReplace(masked, LINK_RE, 'link_detected', reasons);
    masked = safeReplace(masked, HANDLE_RE, 'contact_handle_detected', reasons);
    masked = safeReplace(masked, ADDRESS_RE, 'address_detected', reasons);
    masked = safeReplace(masked, PO_BOX_RE, 'address_detected', reasons);

    const lower = input.toLowerCase();
    if (PLATFORM_RE.test(lower)) reasons.add('external_platform_detected');
    if (CONTACT_EXCHANGE_RE.test(lower)) reasons.add('contact_exchange_pattern');

    if (reasons.size === 0) {
      return { action: 'allow', displayText: input, reasons: [] };
    }

    if (reasons.has('contact_exchange_pattern')) {
      return {
        action: 'flag',
        displayText: masked,
        reasons: Array.from(reasons),
      };
    }

    return {
      action: 'mask',
      displayText: masked,
      reasons: Array.from(reasons),
    };
  } catch {
    return { action: 'allow', displayText: text, reasons: [] };
  }
}
