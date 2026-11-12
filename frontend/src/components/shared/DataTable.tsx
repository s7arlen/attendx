import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  label: string
  render?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchPlaceholder?: string
  onSearch?: (value: string) => void
  searchValue?: string
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  actions?: (item: T) => React.ReactNode
  emptyMessage?: string
  loading?: boolean
  caption?: string // accessible table caption
}

export default function DataTable<T extends { _id?: string; id?: string }>({
  data, columns, searchPlaceholder, onSearch, searchValue = '',
  page = 1, totalPages = 1, onPageChange, actions,
  emptyMessage = 'No data found', loading, caption,
}: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      {onSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={searchPlaceholder || 'Search...'}
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10"
            aria-label={searchPlaceholder || 'Search'}
          />
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" role="table" aria-label={caption || 'Data table'}>
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr className="border-b bg-muted/30">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      'text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3',
                      col.className
                    )}
                  >
                    {col.label}
                  </th>
                ))}
                {actions && (
                  <th
                    scope="col"
                    className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3"
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b animate-pulse" aria-hidden="true">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded-full w-3/4" />
                      </td>
                    ))}
                    {actions && <td className="px-4 py-3"><div className="h-4 bg-muted rounded-full w-12 ml-auto" /></td>}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="px-4 py-12 text-center text-muted-foreground text-sm"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {data.map((item, index) => (
                    <motion.tr
                      key={item._id || item.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="border-b last:border-0 hover:bg-accent/30 transition-colors"
                    >
                      {columns.map((col) => (
                        <td key={col.key} className={cn('px-4 py-3 text-sm', col.className)}>
                          {col.render ? col.render(item) : (item as Record<string, React.ReactNode>)[col.key] ?? '-'}
                        </td>
                      ))}
                      {actions && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {actions(item)}
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
