-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MERCHANT', 'CREATOR', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE_TRIAL', 'STARTER', 'GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "CollabStatus" AS ENUM ('BRIEF_SUBMITTED', 'EVOC_APPROVED', 'CREATOR_ACCEPTED', 'SAMPLE_DISPATCHED', 'DRAFT_PENDING_EVOC', 'DRAFT_PENDING_MERCHANT', 'ASSET_DELIVERED', 'CAMPAIGN_ACTIVE', 'COMPLETED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PointsTransactionType" AS ENUM ('PURCHASE_COMMISSION', 'MILESTONE_BONUS', 'PAYOUT_REDEEMED');

-- CreateEnum
CREATE TYPE "PointsStatus" AS ENUM ('LOCKED', 'SETTLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "brandName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'STARTER',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayAlias" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "city" TEXT,
    "contentStyles" TEXT[],
    "bioSummary" TEXT,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "upiIdEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_portfolio_items" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_reviews" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_requests" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "productName" TEXT NOT NULL,
    "productLink" TEXT NOT NULL,
    "productPrice" DECIMAL(10,2) NOT NULL,
    "scriptGuidelines" TEXT NOT NULL,
    "videoHooks" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "deliverableType" TEXT NOT NULL DEFAULT '1 UGC Video Ad (30-60s)',
    "commissionPointsPerSale" INTEGER NOT NULL DEFAULT 100,
    "status" "CollabStatus" NOT NULL DEFAULT 'BRIEF_SUBMITTED',
    "draftVideoUrl" TEXT,
    "evocReviewNotes" TEXT,
    "merchantReviewNotes" TEXT,
    "approvedVideoUrl" TEXT,
    "utmTrackingSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evoc_points_ledger" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "pointsDelta" INTEGER NOT NULL,
    "transactionType" "PointsTransactionType" NOT NULL,
    "status" "PointsStatus" NOT NULL DEFAULT 'LOCKED',
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evoc_points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_attributions" (
    "id" UUID NOT NULL,
    "collabId" UUID NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderTotal" DECIMAL(10,2) NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_profiles_userId_key" ON "merchant_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_userId_key" ON "creator_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_requests_utmTrackingSlug_key" ON "collaboration_requests"("utmTrackingSlug");

-- CreateIndex
CREATE UNIQUE INDEX "order_attributions_orderId_key" ON "order_attributions"("orderId");

-- AddForeignKey
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_portfolio_items" ADD CONSTRAINT "creator_portfolio_items_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_reviews" ADD CONSTRAINT "creator_reviews_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_reviews" ADD CONSTRAINT "creator_reviews_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evoc_points_ledger" ADD CONSTRAINT "evoc_points_ledger_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_attributions" ADD CONSTRAINT "order_attributions_collabId_fkey" FOREIGN KEY ("collabId") REFERENCES "collaboration_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
