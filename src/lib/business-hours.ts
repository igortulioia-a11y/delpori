export type BusinessHours = {
  horario_ativo: boolean | null;
  horario_inicio: string | null;
  horario_fim: string | null;
};

function timeToMinutes(hhmmss: string | null): number | null {
  if (!hhmmss) return null;
  const parts = hhmmss.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function nowInBRMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find(p => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find(p => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export function isBusinessOpen(settings: BusinessHours | null | undefined): boolean {
  if (!settings || settings.horario_ativo === false) return true;
  const start = timeToMinutes(settings.horario_inicio);
  const end = timeToMinutes(settings.horario_fim);
  if (start == null || end == null) return true;
  const now = nowInBRMinutes();
  if (start === end) return true;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

export function formatHours(settings: BusinessHours | null | undefined): string | null {
  if (!settings || settings.horario_ativo === false) return null;
  const start = settings.horario_inicio?.slice(0, 5);
  const end = settings.horario_fim?.slice(0, 5);
  if (!start || !end) return null;
  return `${start} às ${end}`;
}
