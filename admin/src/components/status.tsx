import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { OrderStatus, ReservationStatus } from '@/lib/types'

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; className: string; dot: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200', dot: 'bg-amber-500' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200', dot: 'bg-emerald-500' },
  seated: { label: 'Seated', className: 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200', dot: 'bg-sky-500' },
  completed: { label: 'Completed', className: 'bg-stone-200 text-stone-800 dark:bg-stone-500/20 dark:text-stone-200', dot: 'bg-stone-400' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-100 text-rose-900 line-through dark:bg-rose-500/20 dark:text-rose-200', dot: 'bg-rose-400' },
  no_show: { label: 'No-show', className: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200', dot: 'bg-rose-600' },
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'New', className: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200' },
  ready: { label: 'Ready', className: 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200' },
  completed: { label: 'Collected', className: 'bg-stone-200 text-stone-800 dark:bg-stone-500/20 dark:text-stone-200' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200' },
}

export function ReservationBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  const s = RESERVATION_STATUS[status]
  return <Badge variant="secondary" className={cn('border-0 font-medium', s.className, className)}>{s.label}</Badge>
}

export function OrderBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return <Badge variant="secondary" className={cn('border-0 font-medium', s.className)}>{s.label}</Badge>
}

export const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', staff: 'Staff' } as const
