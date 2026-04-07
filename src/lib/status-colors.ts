import { CircleDot, CheckCircle2, Package, Truck, XCircle } from "lucide-react"

// Order statuses
export type OrderStatus = "novo" | "confirmado" | "em_preparo" | "saiu_entrega" | "entregue" | "cancelado"

export const ORDER_STATUS: Record<OrderStatus, { label: string; class: string; icon: typeof CircleDot }> = {
  novo:         { label: "Novo",       class: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-800", icon: CircleDot },
  confirmado:   { label: "Confirmado", class: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-800",         icon: CheckCircle2 },
  em_preparo:   { label: "Em preparo", class: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800",   icon: Package },
  saiu_entrega: { label: "A caminho",  class: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800",      icon: Truck },
  entregue:     { label: "Entregue",   class: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800", icon: CheckCircle2 },
  cancelado:    { label: "Cancelado",  class: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800",         icon: XCircle },
}

// Campaign statuses
export const CAMPAIGN_STATUS: Record<string, string> = {
  rascunho: "bg-secondary text-muted-foreground",
  agendada: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  enviando: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  enviada:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  cancelada: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
}

// Campaign types
export const CAMPAIGN_TYPE: Record<string, string> = {
  promocao: "bg-primary/10 text-primary",
  cupom:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  aviso:    "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
}
