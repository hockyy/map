import { WorldMapGame } from "./components/WorldMapGame";

export default function Home() {
  return (
    <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-zinc-50 text-foreground dark:bg-zinc-950">
      <WorldMapGame />
    </div>
  );
}
