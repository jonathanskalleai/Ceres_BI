import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertMetasConsultorMensal } from "@/services/equipeDesempenhoService";
import type { EquipeDesempenhoLinha, MetaConsultorMensal } from "@/types/equipeDesempenho";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MetasEquipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ano: number;
  consultores: string[];
  rows: EquipeDesempenhoLinha[];
}

function moneyInput(value: number | null | undefined): string {
  return value == null || value === 0 ? "" : String(value);
}

export function MetasEquipeDialog({
  open,
  onOpenChange,
  ano,
  consultores,
  rows,
}: MetasEquipeDialogProps) {
  const queryClient = useQueryClient();
  const [consultor, setConsultor] = useState("");
  const [metas, setMetas] = useState<string[]>(Array(12).fill(""));
  const [metaAnual, setMetaAnual] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rowsDoConsultor = useMemo(
    () => rows.filter((row) => row.consultor === consultor),
    [consultor, rows],
  );

  useEffect(() => {
    if (!open) return;
    setConsultor((current) => (consultores.includes(current) ? current : consultores[0] ?? ""));
    setError(null);
  }, [consultores, open]);

  useEffect(() => {
    if (!consultor) return;
    const next = Array.from({ length: 12 }, (_, monthIndex) => {
      const competencia = `${ano}-${String(monthIndex + 1).padStart(2, "0")}-01`;
      return moneyInput(rowsDoConsultor.find((row) => row.competencia === competencia)?.meta);
    });
    setMetas(next);
    setMetaAnual("");
  }, [ano, consultor, rowsDoConsultor]);

  const distribuirMetaAnual = () => {
    const annual = Number(metaAnual);
    if (!Number.isFinite(annual) || annual < 0) return;
    const monthValue = (annual / 12).toFixed(2);
    setMetas(Array(12).fill(monthValue));
  };

  const salvar = async () => {
    if (!consultor) return;
    setSaving(true);
    setError(null);

    try {
      const payload: MetaConsultorMensal[] = metas.map((value, monthIndex) => ({
        consultor,
        competencia: `${ano}-${String(monthIndex + 1).padStart(2, "0")}-01`,
        meta: Number(value) || 0,
      }));
      await upsertMetasConsultorMensal(payload);
      await queryClient.invalidateQueries({ queryKey: ["rpc", "equipe-desempenho-mensal"] });
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar as metas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[var(--surface-raised)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "var(--voux-text-heading)" }}>
            <Target className="h-5 w-5 text-[var(--voux-accent)]" />
            Metas da equipe · {ano}
          </DialogTitle>
          <DialogDescription>
            Defina uma meta por mês para cada consultor. A meta anual é apenas uma forma rápida de preencher os doze meses e pode ser ajustada depois.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="meta-consultor">Consultor</Label>
            <Select value={consultor} onValueChange={setConsultor}>
              <SelectTrigger id="meta-consultor"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {consultores.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta-anual">Meta anual (R$)</Label>
            <Input
              id="meta-anual"
              type="number"
              min="0"
              step="0.01"
              value={metaAnual}
              onChange={(event) => setMetaAnual(event.target.value)}
              placeholder="Ex.: 1200000"
            />
          </div>
          <Button type="button" variant="outline" onClick={distribuirMetaAnual}>
            Distribuir em 12 meses
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {MONTHS.map((month, monthIndex) => (
            <div key={month} className="space-y-1.5">
              <Label htmlFor={`meta-${monthIndex}`}>{month}</Label>
              <Input
                id={`meta-${monthIndex}`}
                type="number"
                min="0"
                step="0.01"
                value={metas[monthIndex]}
                onChange={(event) => {
                  const next = [...metas];
                  next[monthIndex] = event.target.value;
                  setMetas(next);
                }}
                placeholder="R$ 0,00"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={!consultor || saving}>
            <Save className="h-4 w-4" />
            {saving ? "Salvando…" : "Salvar metas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
