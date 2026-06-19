import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, subMonths, startOfYear, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}

interface Preset {
  label: string;
  range: DateRange | undefined;
}

function getPresets(): Preset[] {
  const today = new Date();
  const lastMonth = subMonths(today, 1);
  return [
    { label: "Mes passado", range: { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) } },
    { label: "Ultimos 30 dias", range: { from: subMonths(today, 1), to: today } },
    { label: "Ultimos 3 meses", range: { from: subMonths(today, 3), to: today } },
    { label: "Ultimos 6 meses", range: { from: subMonths(today, 6), to: today } },
    { label: "Ano atual", range: { from: startOfYear(today), to: today } },
    { label: "Tudo", range: undefined },
  ];
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const presets = React.useMemo(() => getPresets(), []);

  const label = value?.from
    ? value.to
      ? `${format(value.from, "dd MMM yyyy", { locale: ptBR })} – ${format(value.to, "dd MMM yyyy", { locale: ptBR })}`
      : format(value.from, "dd MMM yyyy", { locale: ptBR })
    : "Todas as datas";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal min-w-[220px] h-9 text-sm",
            "border-[var(--voux-card-border)] text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]",
            !value && "text-[var(--voux-text-faint)]",
          )}
          style={{ backgroundColor: "var(--voux-card-from)" }}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>



      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="flex flex-col gap-1 border-r p-3">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() => {
                  onChange(preset.range);
                  setOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              selected={value}
              onSelect={(range) => {
                onChange(range);
              }}
              numberOfMonths={2}
              defaultMonth={value?.from ?? subMonths(new Date(), 1)}
              locale={ptBR}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
