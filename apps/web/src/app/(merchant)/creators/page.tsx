export default function CreatorsDirectoryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">UGC Video Ad Creators</h2>
        <p className="mt-2 text-sm text-slate-500">
          Filter vetted creators by category, content style, and past ad performance. Creator identities are masked for platform security.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-wrap gap-4">
        <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
          <option>All Categories</option>
          <option>Skincare & Beauty</option>
          <option>Men's Grooming</option>
          <option>Fitness & Nutrition</option>
          <option>Tech & Gadgets</option>
        </select>

        <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
          <option>All Content Styles</option>
          <option>Unboxing & First Impression</option>
          <option>Problem + Solution Hook</option>
          <option>Routine Breakdown</option>
          <option>Aesthetic Demonstration</option>
        </select>
      </div>

      {/* Creator Grid (Sample Masked Data) */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="aspect-[16/9] bg-slate-800 flex items-center justify-center text-white text-sm">
            ▶️ Sample Ad Preview (Face Wash Reel)
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                Grooming
              </span>
              <span className="text-xs text-slate-400">Mumbai</span>
            </div>
            <h3 className="mt-2 font-bold text-slate-900">Rohit S. — Men's Grooming</h3>
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">
              Creates crisp, high-converting vertical ad reels for skincare and grooming D2C brands.
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-600">⭐ 4.9 (18 Ad Deals)</span>
              <a
                href="/brief?creator=rohit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Request Video Ad
              </a>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="aspect-[16/9] bg-slate-800 flex items-center justify-center text-white text-sm">
            ▶️ Sample Ad Preview (Hydration Serum)
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                Beauty
              </span>
              <span className="text-xs text-slate-400">Bangalore</span>
            </div>
            <h3 className="mt-2 font-bold text-slate-900">Kavita R. — Skincare & Organic</h3>
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">
              Specializes in high-energy aesthetic reels with authentic product reviews and hooks.
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-600">⭐ 5.0 (24 Ad Deals)</span>
              <a
                href="/brief?creator=kavita"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Request Video Ad
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
