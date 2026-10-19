export default function SubmitBriefPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Submit Video Ad Brief</h1>
        <p className="mt-1 text-sm text-slate-500">
          Provide your script guidelines and talking points. Contact info sharing is strictly blocked by our safety engine.
        </p>
      </div>

      <form className="mt-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700">Product Name</label>
          <input
            type="text"
            placeholder="e.g. Vitamin C Glow Face Serum"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Product Link</label>
          <input
            type="url"
            placeholder="https://yourstore.com/products/serum"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Opening Hook (First 3 Seconds)</label>
          <input
            type="text"
            placeholder="e.g. 'Stop wasting money on face washes that dry out your skin!'"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Script Guidelines & Talking Points</label>
          <textarea
            rows={4}
            placeholder="Outline the core benefits, usage routine, and call-to-action. (Automated filter will block phone numbers or external links)."
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Aspect Ratio</label>
          <select className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm">
            <option>9:16 Vertical Video (Instagram Reels / TikTok / YouTube Shorts)</option>
            <option>16:9 Landscape Video</option>
            <option>1:1 Square</option>
          </select>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 text-xs text-blue-700">
          ℹ️ Your request will be dual-dispatched simultaneously to the Creator and EVOC Ops Super Admin for review.
        </div>

        <button
          type="button"
          className="w-full rounded-md bg-indigo-600 py-3 font-semibold text-white shadow hover:bg-indigo-500"
        >
          Submit Brief to EVOC & Creator
        </button>
      </form>
    </div>
  );
}
