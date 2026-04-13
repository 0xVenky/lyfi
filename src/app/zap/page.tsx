import { ZapBox } from "@/components/ZapBox";

export default function ZapPage() {
  return (
    <div className="flex-1 flex flex-col items-center px-4 pt-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Zap In</h1>
        <p className="text-sm text-gray-400 mt-1">
          Deposit any token from any chain into any vault — one click.
        </p>
      </div>
      <ZapBox />
    </div>
  );
}
