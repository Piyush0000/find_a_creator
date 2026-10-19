export default function ModerationPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">EVOC Ops — 2-Stage Video Review Queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stage 1 Quality Gatekeeper: Review drafts before unlocking them for private merchant inspection.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              DRAFT_PENDING_EVOC (100% Private)
            </span>
            <h3 className="mt-2 font-bold text-slate-900">Vitamin C Glow Serum — Ad Video Draft</h3>
            <p className="text-xs text-slate-500">Brand: Glow Skincare | Creator: Rohit S.</p>
          </div>
          <div className="space-x-3">
            <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Request Tweak
            </button>
            <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
              Approve & Unlock for Merchant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
