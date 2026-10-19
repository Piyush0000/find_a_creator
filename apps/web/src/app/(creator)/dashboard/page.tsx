export default function CreatorDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Creator Hub & Earnings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage inbound video ad requests, upload private drafts, and track your EVOC Points.</p>
      </div>

      {/* Metrics Row */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">EVOC Points Balance</div>
          <div className="mt-2 text-3xl font-extrabold text-indigo-600">1,650 pts</div>
          <div className="mt-1 text-xs text-slate-500">≈ ₹1,650 redeemable via UPI</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Completed Ad Creatives</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-800">14 Videos</div>
          <div className="mt-1 text-xs text-emerald-600">100% on-time delivery</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Active Deals</div>
          <div className="mt-2 text-3xl font-extrabold text-amber-600">2 In Progress</div>
          <div className="mt-1 text-xs text-slate-500">1 sample in transit, 1 draft due</div>
        </div>
      </div>
    </div>
  );
}
