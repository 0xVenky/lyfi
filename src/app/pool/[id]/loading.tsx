export default function PoolLoading() {
  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-24 mb-6" />
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-8">
        <div>
          <div className="h-7 bg-gray-100 rounded w-64 mb-2" />
          <div className="flex gap-3">
            <div className="h-5 bg-gray-100 rounded w-20" />
            <div className="h-5 bg-gray-50 rounded w-16" />
          </div>
        </div>
        <div className="h-10 bg-gray-100 rounded-lg w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="h-48 bg-white rounded-xl border border-gray-100" />
        <div className="h-48 bg-white rounded-xl border border-gray-100" />
      </div>
      <div className="h-32 bg-white rounded-xl border border-gray-100" />
    </div>
  );
}
