"use client";

import { useState } from "react";

export function ProtocolLogo({
  protocol,
  symbol,
  size = 40,
}: {
  protocol: string;
  symbol: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = `https://icons.llama.fi/${protocol}.png`;

  if (failed) {
    return (
      <div
        className="rounded-full gradient-primary flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/20"
        style={{ width: size, height: size }}
      >
        <span className="text-sm font-bold text-white">{symbol.charAt(0)}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={protocol}
      width={size}
      height={size}
      className="rounded-full shrink-0 object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

export function ProtocolLogoServer({
  protocol,
  size = 40,
}: {
  protocol: string;
  size?: number;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={`https://icons.llama.fi/${protocol}.png`}
      alt={protocol}
      width={size}
      height={size}
      className="rounded-full shrink-0 object-cover"
      style={{ width: size, height: size }}
    />
  );
}
