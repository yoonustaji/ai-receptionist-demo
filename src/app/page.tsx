import DemoApp from "@/components/DemoApp";

// Env values set through a pipe on Windows can carry a byte-order mark,
// which would break the link, so strip it along with surrounding spaces.
function clean(value: string | undefined): string {
  return (value ?? "").replace(/^﻿/, "").trim();
}

export default function Home() {
  return (
    <DemoApp
      builderName={clean(process.env.NEXT_PUBLIC_BUILDER_NAME)}
      builderUrl={clean(process.env.NEXT_PUBLIC_BUILDER_URL)}
    />
  );
}
