export enum UserRole {
  MERCHANT = 'MERCHANT',
  CREATOR = 'CREATOR',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum SubscriptionPlan {
  FREE_TRIAL = 'FREE_TRIAL',
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  ENTERPRISE = 'ENTERPRISE'
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PAST_DUE = 'PAST_DUE'
}

export enum CollabStatus {
  BRIEF_SUBMITTED = 'BRIEF_SUBMITTED',             // Dispatched to Creator & Admin
  EVOC_APPROVED = 'EVOC_APPROVED',                 // EVOC Ops cleared the brief
  CREATOR_ACCEPTED = 'CREATOR_ACCEPTED',           // Creator agreed to terms
  DRAFT_PENDING_EVOC = 'DRAFT_PENDING_EVOC',       // 100% PRIVATE: Visible only to EVOC Ops
  DRAFT_REVISION_REQUESTED = 'DRAFT_REVISION_REQUESTED', // EVOC rejected — Creator must fix & re-upload
  DRAFT_PENDING_MERCHANT = 'DRAFT_PENDING_MERCHANT', // STILL PRIVATE: Unlocked for Merchant review
  ASSET_DELIVERED = 'ASSET_DELIVERED',             // Merchant approved, received ad asset
  CAMPAIGN_ACTIVE = 'CAMPAIGN_ACTIVE',             // Ad running with UTM tracking
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED'
}

export enum PointsTransactionType {
  PURCHASE_COMMISSION = 'PURCHASE_COMMISSION',
  MILESTONE_BONUS = 'MILESTONE_BONUS',
  STORE_REDEMPTION = 'STORE_REDEMPTION'
}

export enum PointsStatus {
  LOCKED = 'LOCKED',     // Held during 14-day return/cancellation window
  SETTLED = 'SETTLED',   // Ready for store redemption
  CANCELLED = 'CANCELLED' // Customer returned/refunded order
}
