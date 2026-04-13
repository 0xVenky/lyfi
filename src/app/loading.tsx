export default function Loading() {
  return (
    <div className="flex-1 flex flex-col animate-pulse">
      {/* Header skeleton */}
      <div className="px-4 sm:px-6 py-5 border-b border-gray-100">
        <div className="flex gap-8">
          <div>
            <div className="h-2.5 bg-gray-100 rounded w-16 mb-2" />
            <div className="h-6 bg-gray-100 rounded w-20" />
          </div>
          <div>
            <div className="h-2.5 bg-gray-100 rounded w-16 mb-2" />
            <div className="h-6 bg-gray-100 rounded w-24" />
          </div>
          <div>
            <div className="h-2.5 bg-gray-100 rounded w-16 mb-2" />
            <div className="h-6 bg-gray-100 rounded w-12" />
          </div>
        </div>
      </div>
      {/* Row skeletons */}
      <div className="px-4 sm:px-6 py-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-white to-gray-50 border border-gray-100"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-gray-100 rounded w-32 mb-2" />
              <div className="h-3 bg-gray-50 rounded w-20" />
            </div>
            <div className="h-5 bg-gray-100 rounded w-14" />
            <div className="h-4 bg-gray-50 rounded w-16 hidden md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
