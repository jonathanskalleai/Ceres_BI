import { Construction } from "lucide-react";

export default function ToolsPerformance() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/50 bg-card px-10 py-12 shadow-sm">
        <Construction className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Em desenvolvimento</h2>
        <p className="text-sm text-muted-foreground">Esta funcionalidade estara disponivel em breve.</p>
      </div>
    </div>
  );
}
