"use client";

import * as React from "react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export type DateRangePreset =
  | "hoje"
  | "ontem"
  | "7d"
  | "30d"
  | "mes-atual"
  | "mes-passado"
  | "custom";

export interface DateRangeValue {
  from: Date;
  to: Date;
  preset: DateRangePreset;
}

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes-atual", label: "Este mês" },
  { key: "mes-passado", label: "Mês passado" },
  { key: "custom", label: "Personalizado" },
];

export function getRangeFromPreset(preset: DateRangePreset, now = new Date()): { from: Date; to: Date } {
  const today = startOfDay(now);
  const endToday = endOfDay(now);
  switch (preset) {
    case "hoje":
      return { from: today, to: endToday };
    case "ontem": {
      const yesterday = subDays(today, 1);
      return { from: yesterday, to: endOfDay(yesterday) };
    }
    case "7d":
      return { from: subDays(today, 6), to: endToday };
    case "30d":
      return { from: subDays(today, 29), to: endToday };
    case "mes-atual":
      return { from: startOfMonth(now), to: endToday };
    case "mes-passado": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "custom":
    default:
      return { from: subDays(today, 6), to: endToday };
  }
}

function formatRange(value: DateRangeValue): string {
  if (value.preset !== "custom") {
    const preset = PRESETS.find(p => p.key === value.preset);
    if (preset) return preset.label;
  }
  if (isSameDay(value.from, value.to)) {
    return format(value.from, "dd 'de' MMM yyyy", { locale: ptBR });
  }
  const sameYear = value.from.getFullYear() === value.to.getFullYear();
  if (sameYear) {
    return `${format(value.from, "dd MMM", { locale: ptBR })} – ${format(value.to, "dd MMM yyyy", { locale: ptBR })}`;
  }
  return `${format(value.from, "dd MMM yy", { locale: ptBR })} – ${format(value.to, "dd MMM yy", { locale: ptBR })}`;
}

interface Props {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  className?: string;
}

// Hook simples pra detectar viewport mobile (< 640px = sm breakpoint do Tailwind)
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export function DateRangePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>({
    from: value.from,
    to: value.to,
  });

  // Sync tempRange quando value muda de fora (ex: troca de preset)
  React.useEffect(() => {
    setTempRange({ from: value.from, to: value.to });
  }, [value.from, value.to]);

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === "custom") {
      onChange({ ...value, preset: "custom" });
      return;
    }
    const range = getRangeFromPreset(preset);
    onChange({ ...range, preset });
    setOpen(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setTempRange(range);
    if (range?.from && range?.to) {
      onChange({ from: startOfDay(range.from), to: endOfDay(range.to), preset: "custom" });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTempRange({ from: value.from, to: value.to });
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 rounded-full h-9 px-3 sm:px-4 text-sm font-medium max-w-full",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{formatRange(value)}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 max-w-[calc(100vw-1rem)] sm:max-w-none"
        align="end"
        sideOffset={8}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Presets — mobile: scroll horizontal; desktop: coluna lateral */}
          <div className="border-b sm:border-b-0 sm:border-r p-2 flex flex-row sm:flex-col gap-1 sm:min-w-[160px] overflow-x-auto sm:overflow-visible shrink-0 scrollbar-thin">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => handlePresetClick(p.key)}
                className={cn(
                  "text-left text-sm px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0",
                  value.preset === p.key
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-accent text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar — mobile: 1 mês; desktop: 2 meses */}
          <div className="min-w-0 overflow-x-auto">
            <Calendar
              mode="range"
              defaultMonth={value.from}
              selected={tempRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={isMobile ? 1 : 2}
            />
            <div className="px-3 pb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                {tempRange?.from && tempRange?.to
                  ? `${format(tempRange.from, "dd/MM/yyyy")} → ${format(tempRange.to, "dd/MM/yyyy")}`
                  : tempRange?.from
                    ? `${format(tempRange.from, "dd/MM/yyyy")} → ...`
                    : "Selecione um intervalo"}
              </span>
              <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
