import DemoApp from "@/components/DemoApp";

export default function Home() {
  return (
    <DemoApp
      builderName={process.env.NEXT_PUBLIC_BUILDER_NAME || ""}
      builderUrl={process.env.NEXT_PUBLIC_BUILDER_URL || ""}
    />
  );
}
