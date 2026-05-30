import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, User, Sparkles, Loader2, Search, CheckSquare } from "lucide-react";
import { DadosComerciais } from "@/types/comercial";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateConsultoresReport } from "@/lib/generateConsultoresReport";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DadosComerciais;
}

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${(v / 1e3).toFixed(0)}K`;

export const ConsultorReportSheet = ({ open, onOpenChange, data }: Props) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);

  const allConsultores = useMemo(
    () => [...data.vendedores].sort((a, b) => a.nome.localeCompare(b.nome)),
    [data.vendedores]
  );

  const filtered = useMemo(
    () =>
      search
        ? allConsultores.filter((v) => v.nome.toLowerCase().includes(search.toLowerCase()))
        : allConsultores,
    [allConsultores, search]
  );

  const allSelected = selected.size === allConsultores.length && allConsultores.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allConsultores.map((v) => v.nome)));
    }
  };

  const toggle = (nome: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  };

  const handleGenerate = async () => {
    const isAll = selected.size === 0 || selected.size === allConsultores.length;
    const consultores = isAll ? undefined : Array.from(selected);
    const label = isAll
      ? "todos os consultores"
      : consultores!.length === 1
        ? consultores![0].split(" ").slice(-1)[0]
        : `${consultores!.length} consultores`;

    setGenerating(true);
    toast({ title: "Gerando relatório...", description: `Analisando dados de ${label} nos últimos 30 dias com IA. Aguarde...` });

    try {
      if (consultores && consultores.length > 1) {
        // Generate individual reports sequentially for multiple selected
        for (const consultor of consultores) {
          const { data: reportData, error } = await supabase.functions.invoke("consultores-report", {
            body: { consultor },
          });
          if (error) throw error;
          if (reportData?.error) throw new Error(reportData.error);
          generateConsultoresReport(reportData);
        }
      } else {
        const body = consultores?.length === 1 ? { consultor: consultores[0] } : {};
        const { data: reportData, error } = await supabase.functions.invoke("consultores-report", { body });
        if (error) throw error;
        if (reportData?.error) throw new Error(reportData.error);
        generateConsultoresReport(reportData);
      }
      toast({ title: "Relatório(s) gerado(s)!", description: "O download do PDF foi iniciado." });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Report error:", err);
      toast({ title: "Erro ao gerar relatório", description: err.message || "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const generateLabel = () => {
    if (selected.size === 0 || allSelected) return "Gerar Relatório — Todos";
    if (selected.size === 1) return `Gerar Relatório — ${Array.from(selected)[0].split(" ").slice(-1)[0]}`;
    return `Gerar Relatório — ${selected.size} selecionados`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights de IA — Relatório
          </SheetTitle>
          <SheetDescription>
            Selecione consultores para gerar relatórios individuais ou da equipe completa.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-4 mt-4 min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar consultor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Select all / count */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <CheckSquare className="h-4 w-4" />
              {allSelected ? "Desmarcar todos" : "Selecionar todos"}
            </button>
            <Badge variant="secondary" className="text-xs">
              {selected.size} de {allConsultores.length}
            </Badge>
          </div>

          {/* Quick action: all team */}
          <Button
            variant="outline"
            onClick={() => { setSelected(new Set()); handleGenerate(); }}
            disabled={generating}
            className="w-full justify-start gap-2 border-primary/20 hover:bg-primary/5"
          >
            <Users className="h-4 w-4 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">Relatório Completo da Equipe</p>
              <p className="text-xs text-muted-foreground">Análise de todos os consultores</p>
            </div>
          </Button>

          {/* Consultores list */}
          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-1 pb-4">
              {filtered.map((v) => (
                <button
                  key={v.nome}
                  onClick={() => toggle(v.nome)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selected.has(v.nome)
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <Checkbox
                    checked={selected.has(v.nome)}
                    onCheckedChange={() => toggle(v.nome)}
                    className="pointer-events-none"
                  />
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.totalAcoes} ações · {formatCurrency(v.pipeline)}
                    </p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum consultor encontrado</p>
              )}
            </div>
          </ScrollArea>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? "Gerando..." : generateLabel()}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
