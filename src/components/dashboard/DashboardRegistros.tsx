import { useState, useMemo } from "react";
import { DadosComerciais, Registro } from "@/types/comercial";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Edit2, Check, X } from "lucide-react";
import { Filters } from "@/types/comercial";
import { filterRegistros } from "@/lib/filterUtils";

interface Props {
  data: DadosComerciais;
  filters: Filters;
}

const formatCurrency = (v: number) => v > 0 ? `R$ ${(v / 1e3).toFixed(0)}K` : "-";

export const DashboardRegistros = ({ data, filters }: Props) => {
  const [search, setSearch] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [records, setRecords] = useState<Registro[]>(data.registrosRecentes);
  const [editValues, setEditValues] = useState<Partial<Registro>>({});

  const filtered = useMemo(() => {
    let result = filterRegistros(records, filters);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        r.cliente.toLowerCase().includes(s) || r.vendedor.toLowerCase().includes(s) ||
        r.cidade.toLowerCase().includes(s) || (r.obs || "").toLowerCase().includes(s)
      );
    }
    return result;
  }, [records, filters, search]);

  const startEdit = (idx: number) => { setEditingIdx(idx); setEditValues({ ...filtered[idx] }); };
  const saveEdit = () => {
    if (editingIdx === null) return;
    const original = filtered[editingIdx];
    const globalIdx = records.findIndex((r) => r === original);
    if (globalIdx >= 0) { const updated = [...records]; updated[globalIdx] = { ...updated[globalIdx], ...editValues }; setRecords(updated); }
    setEditingIdx(null); setEditValues({});
  };
  const cancelEdit = () => { setEditingIdx(null); setEditValues({}); };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Registros</h2>
          <p className="text-sm text-muted-foreground">Últimos 500 registros — editável ({filtered.length} filtrados)</p>
          <p className="text-xs text-muted-foreground">Dados de ações comerciais do CRM (campo Atividade Executada)</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, vendedor..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[calc(100vh-200px)]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs w-8"></TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Cidade</TableHead>
                  <TableHead className="text-xs">Consultor</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Ação</TableHead>
                  <TableHead className="text-xs">Valor</TableHead>
                  <TableHead className="text-xs">Etapa</TableHead>
                  <TableHead className="text-xs max-w-[200px]">Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((r, i) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="p-1">
                      {editingIdx === i ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={saveEdit}><Check className="h-3 w-3 text-success" /></Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={cancelEdit}><X className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEdit(i)}><Edit2 className="h-3 w-3 text-muted-foreground" /></Button>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.dtConclusao}</TableCell>
                    <TableCell className="text-xs">
                      {editingIdx === i ? (
                        <Input className="h-6 text-xs" value={editValues.cliente || ""} onChange={(e) => setEditValues({ ...editValues, cliente: e.target.value })} />
                      ) : (
                        <span className="truncate block max-w-[150px]">{r.cliente}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.cidade}</TableCell>
                    <TableCell className="text-xs">{r.vendedor.split(" ").slice(-1)[0]}</TableCell>
                    <TableCell className="text-xs">{r.tipoContato}</TableCell>
                    <TableCell className="text-xs">{r.tipoAcao}</TableCell>
                    <TableCell className="text-xs">{formatCurrency(r.negocioValor)}</TableCell>
                    <TableCell className="text-xs">{r.negocioEtapa || "-"}</TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      {editingIdx === i ? (
                        <Input className="h-6 text-xs" value={editValues.obs || ""} onChange={(e) => setEditValues({ ...editValues, obs: e.target.value })} />
                      ) : (
                        <span className="truncate block">{r.obs || "-"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground text-center">
        Mostrando {Math.min(100, filtered.length)} de {filtered.length} registros filtrados
      </p>
    </div>
  );
};
