// «Кинетика»: скелетон — страница мерцает силуэтом, пока грузятся данные.
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="skeleton h-11 w-11 !rounded-2xl" />
        <div className="space-y-2">
          <div className="skeleton h-6 w-56" />
          <div className="skeleton h-3.5 w-80" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="skeleton h-28 lg:col-span-2 lg:row-span-2 lg:h-full" />
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton h-44" />
        <div className="skeleton h-44" />
      </div>
    </div>
  );
}
