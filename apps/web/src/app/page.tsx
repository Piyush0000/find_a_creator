import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl">
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
          EVOC Labs Platform
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Find a Creator — UGC Ad Marketplace
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Connect D2C brands with vetted UGC video ad creators. Zero direct cash transfer, masked contact privacy, 2-stage review gate, and UTM-driven EVOC Points.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/creators"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-500 hover:shadow-md transition text-left"
          >
            <div className="font-bold text-indigo-600">Merchant Portal →</div>
            <div className="mt-2 text-sm text-slate-500">
              Browse UGC creators, sample video ads, and submit structured script briefs.
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-500 hover:shadow-md transition text-left"
          >
            <div className="font-bold text-emerald-600">Creator Portal →</div>
            <div className="mt-2 text-sm text-slate-500">
              View inbound briefs, upload private drafts, and track EVOC Points earnings.
            </div>
          </Link>

          <Link
            href="/moderation"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-500 hover:shadow-md transition text-left"
          >
            <div className="font-bold text-amber-600">Super Admin (EVOC Ops) →</div>
            <div className="mt-2 text-sm text-slate-500">
              Moderate incoming briefs, manage 2-stage draft reviews, and monitor webhooks.
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
