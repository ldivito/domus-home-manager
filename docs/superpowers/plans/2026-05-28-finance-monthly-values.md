# Valores de finanzas por mes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que el valor de cada servicio recurrente del módulo de finanzas del hogar se guarde por mes (con default = valor del mes anterior y edición por mes), usando `ExpensePayment` como única fuente de verdad, para que la UI y los gráficos muestren el progreso histórico sin perder valores al editar.

**Architecture:** Enfoque A — se reutiliza `ExpensePayment` (que ya es un registro por-servicio-por-mes) agregándole `month`, `year` y `currency`. Una función pura testeable centraliza la lógica de "default del mes anterior" y la conversión a ARS. Todas las pestañas (Gastos, Pagos, Saldos, Análisis) dejan de leer el valor "vivo" del servicio y leen el valor guardado del mes.

**Tech Stack:** Next.js 15 (App Router, client components), Dexie.js (IndexedDB), next-intl, recharts, Vitest, TypeScript.

**Spec de referencia:** `docs/superpowers/specs/2026-05-28-finance-monthly-values-design.md`

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/db.ts` | Interfaz `ExpensePayment` extendida; schema v18 (índice compuesto) + migración de backfill |
| `src/lib/utils/finance/monthlyValues.ts` | **Nuevo.** Funciones puras: default del mes anterior, conversión a ARS |
| `src/lib/utils/finance/__tests__/monthlyValues.test.ts` | **Nuevo.** Tests unitarios del helper |
| `src/app/[locale]/finance/components/PaymentsTab.tsx` | Generación con default mes anterior; lectura de valor guardado; set month/year/currency |
| `src/app/[locale]/finance/components/ExpensesTab.tsx` | Consciente del mes + edición del valor del mes |
| `src/app/[locale]/finance/page.tsx` | Pasa mes/año y pagos a `ExpensesTab`; total del header desde valores guardados |
| `src/app/[locale]/finance/components/BalanceTab.tsx` | Usa monto/moneda guardados |
| `src/app/[locale]/finance/components/AnalysisTab.tsx` | Arregla moneda guardada; agrega selector de servicio + variación % |
| `messages/en/finance.json`, `messages/es/finance.json` | Claves i18n nuevas |

**Orden obligatorio:** Task 1 → Task 2 → Task 3 → (4, 5, 6, 7 en cualquier orden) → Task 8 → Task 9. Las tasks 1 y 2 definen tipos/funciones que el resto consume.

---

## Task 1: Extender `ExpensePayment` + schema v18 + migración

**Files:**
- Modify: `src/lib/db.ts` (interfaz `ExpensePayment` ~líneas 419-431; bloque de versiones ~línea 1397)

- [ ] **Step 1: Extender la interfaz `ExpensePayment`**

En `src/lib/db.ts`, reemplazar la interfaz existente (líneas 419-431) por:

```ts
export interface ExpensePayment {
  id?: string
  recurringExpenseId: string  // Reference to RecurringExpense
  amount: number              // Monthly value of the service (source of truth for the month)
  currency: 'ARS' | 'USD'     // Snapshot of the currency for this month
  month: number               // 1-12 (denormalized from dueDate)
  year: number                // e.g., 2026 (denormalized from dueDate)
  dueDate: Date               // When it was due
  paidDate?: Date             // When it was actually paid
  paidByUserId?: string       // Who paid it
  status: 'pending' | 'paid' | 'overdue'
  notes?: string
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}
```

- [ ] **Step 2: Agregar schema v18 con índice compuesto + migración**

En `src/lib/db.ts`, **inmediatamente antes** del comentario `// v17 upgrade: add default currency to existing expenses` (línea ~1397), insertar:

```ts
    // v18: per-month value for expense payments (month/year/currency + compound index)
    this.version(18).stores({
      expensePayments: 'id, recurringExpenseId, dueDate, status, paidByUserId, householdId, createdAt, [recurringExpenseId+year+month]'
    })

    this.version(18).upgrade(async (tx) => {
      const expenses = await tx.table('recurringExpenses').toArray()
      const currencyByExpense = new Map<string, 'ARS' | 'USD'>()
      for (const e of expenses) {
        currencyByExpense.set(e.id, (e.currency as 'ARS' | 'USD') ?? 'ARS')
      }

      const expensePayments = await tx.table('expensePayments').toArray()
      for (const p of expensePayments) {
        const due = new Date(p.dueDate)
        await tx.table('expensePayments').update(p.id, {
          month: due.getMonth() + 1,
          year: due.getFullYear(),
          currency: p.currency ?? currencyByExpense.get(p.recurringExpenseId) ?? 'ARS',
        })
      }
      dbLogger.debug('Database upgraded to v18 with per-month expense payment values')
    })

```

> Nota: las versiones se declaran en orden descendente en este archivo y Dexie hereda las tablas no redeclaradas (v17 ya declara solo `.upgrade()`), por eso v18 solo redeclara `expensePayments`.

- [ ] **Step 3: Verificar compilación de tipos**

Run: `npm run typecheck`
Expected: PASS (sin errores). Pueden aparecer errores en otros archivos que setean `ExpensePayment` sin `currency`/`month`/`year` — se resuelven en sus tasks. Si typecheck falla **solo** por esos call-sites (`PaymentsTab`, etc.), está esperado; verificá que no haya errores dentro de `db.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(finance): add month/year/currency to ExpensePayment (schema v18)"
```

---

## Task 2: Helper `monthlyValues` (TDD)

**Files:**
- Create: `src/lib/utils/finance/monthlyValues.ts`
- Test: `src/lib/utils/finance/__tests__/monthlyValues.test.ts`

- [ ] **Step 1: Escribir los tests primero**

Crear `src/lib/utils/finance/__tests__/monthlyValues.test.ts`:

```ts
import type { ExpensePayment, RecurringExpense } from '@/lib/db'
import {
  getPreviousValue,
  resolveDefaultForMonth,
  getMonthlyAmountARS,
} from '../monthlyValues'

function pay(o: Partial<ExpensePayment>): ExpensePayment {
  return {
    id: o.id ?? 'p',
    recurringExpenseId: o.recurringExpenseId ?? 'e1',
    amount: o.amount ?? 0,
    currency: o.currency ?? 'ARS',
    month: o.month ?? 1,
    year: o.year ?? 2026,
    dueDate: o.dueDate ?? new Date(2026, 0, 1),
    status: o.status ?? 'pending',
    createdAt: o.createdAt ?? new Date(),
  } as ExpensePayment
}

function expense(o: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: o.id ?? 'e1',
    name: o.name ?? 'Luz',
    amount: o.amount ?? 1000,
    currency: o.currency ?? 'ARS',
    category: o.category ?? 'c1',
    frequency: o.frequency ?? 'monthly',
    dueDay: o.dueDay ?? 10,
    isActive: o.isActive ?? true,
    createdAt: o.createdAt ?? new Date(),
  } as RecurringExpense
}

describe('getPreviousValue', () => {
  it('returns the immediately previous month value', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e1', month: 2, year: 2026, amount: 1500 }),
    ]
    expect(getPreviousValue('e1', 3, 2026, payments)).toEqual({ amount: 1500, currency: 'ARS' })
  })

  it('skips gaps and returns the most recent prior record', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e1', month: 1, year: 2026, amount: 1000 }),
      pay({ id: 'b', recurringExpenseId: 'e1', month: 4, year: 2026, amount: 2000 }),
    ]
    // Looking for month 7: most recent prior is month 4
    expect(getPreviousValue('e1', 7, 2026, payments)).toEqual({ amount: 2000, currency: 'ARS' })
  })

  it('crosses year boundaries', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e1', month: 12, year: 2025, amount: 900 }),
    ]
    expect(getPreviousValue('e1', 1, 2026, payments)).toEqual({ amount: 900, currency: 'ARS' })
  })

  it('ignores other expenses and same/future months', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e2', month: 2, year: 2026, amount: 5000 }),
      pay({ id: 'b', recurringExpenseId: 'e1', month: 3, year: 2026, amount: 5000 }),
    ]
    expect(getPreviousValue('e1', 3, 2026, payments)).toBeNull()
  })

  it('returns null when there is no history', () => {
    expect(getPreviousValue('e1', 3, 2026, [])).toBeNull()
  })

  it('preserves the stored currency', () => {
    const payments = [
      pay({ id: 'a', recurringExpenseId: 'e1', month: 2, year: 2026, amount: 50, currency: 'USD' }),
    ]
    expect(getPreviousValue('e1', 3, 2026, payments)).toEqual({ amount: 50, currency: 'USD' })
  })
})

describe('resolveDefaultForMonth', () => {
  it('uses the previous month value when it exists', () => {
    const payments = [pay({ recurringExpenseId: 'e1', month: 2, year: 2026, amount: 1500 })]
    expect(resolveDefaultForMonth(expense({ id: 'e1', amount: 1000 }), 3, 2026, payments))
      .toEqual({ amount: 1500, currency: 'ARS' })
  })

  it('falls back to the expense seed when there is no history', () => {
    expect(resolveDefaultForMonth(expense({ id: 'e1', amount: 1000, currency: 'ARS' }), 3, 2026, []))
      .toEqual({ amount: 1000, currency: 'ARS' })
  })

  it('uses the expense currency in the seed fallback', () => {
    expect(resolveDefaultForMonth(expense({ id: 'e1', amount: 80, currency: 'USD' }), 3, 2026, []))
      .toEqual({ amount: 80, currency: 'USD' })
  })
})

describe('getMonthlyAmountARS', () => {
  it('returns the amount as-is for ARS', () => {
    expect(getMonthlyAmountARS({ amount: 1500, currency: 'ARS' }, 1000)).toBe(1500)
  })

  it('converts USD using the rate', () => {
    expect(getMonthlyAmountARS({ amount: 50, currency: 'USD' }, 1000)).toBe(50000)
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm run test -- src/lib/utils/finance/__tests__/monthlyValues.test.ts`
Expected: FAIL — el módulo `../monthlyValues` no existe todavía.

- [ ] **Step 3: Implementar el helper**

Crear `src/lib/utils/finance/monthlyValues.ts`:

```ts
// Per-month value resolution for recurring expenses (household finance module).
// Pure functions — no React, no Dexie. The monthly value of a service lives in
// the ExpensePayment record for that (expense, month, year).

import type { ExpensePayment, RecurringExpense } from '@/lib/db'

export interface MonthlyValueSeed {
  amount: number
  currency: 'ARS' | 'USD'
}

/**
 * Most recent payment strictly before (month, year) for a given expense.
 * Handles skipped months and year boundaries. Returns null when no prior record exists.
 */
export function getPreviousValue(
  expenseId: string,
  month: number,
  year: number,
  payments: ExpensePayment[]
): MonthlyValueSeed | null {
  const prior = payments
    .filter(p => p.recurringExpenseId === expenseId)
    .filter(p => p.year < year || (p.year === year && p.month < month))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month))

  const latest = prior[0]
  if (!latest) return null
  return { amount: latest.amount, currency: latest.currency ?? 'ARS' }
}

/**
 * Default amount + currency for a month's record: the previous month's value if
 * any, otherwise the expense's seed amount/currency.
 */
export function resolveDefaultForMonth(
  expense: RecurringExpense,
  month: number,
  year: number,
  payments: ExpensePayment[]
): MonthlyValueSeed {
  const previous = getPreviousValue(expense.id!, month, year, payments)
  if (previous) return previous
  return { amount: expense.amount, currency: expense.currency ?? 'ARS' }
}

/**
 * Stored monthly amount converted to ARS using the month's exchange rate and the
 * stored currency. Never reads the live expense amount.
 */
export function getMonthlyAmountARS(
  payment: Pick<ExpensePayment, 'amount' | 'currency'>,
  rate: number
): number {
  const currency = payment.currency ?? 'ARS'
  return currency === 'USD' ? payment.amount * rate : payment.amount
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm run test -- src/lib/utils/finance/__tests__/monthlyValues.test.ts`
Expected: PASS (todos los `describe`/`it`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/finance/monthlyValues.ts src/lib/utils/finance/__tests__/monthlyValues.test.ts
git commit -m "feat(finance): add monthlyValues helper for per-month expense values"
```

---

## Task 3: `PaymentsTab` — generación con default del mes anterior + lectura del valor guardado

**Files:**
- Modify: `src/app/[locale]/finance/components/PaymentsTab.tsx`

- [ ] **Step 1: Importar los helpers**

En la línea de import de utils (línea 6), reemplazar:

```ts
import { generateId, formatARS } from '@/lib/utils'
```

por:

```ts
import { generateId, formatARS } from '@/lib/utils'
import { resolveDefaultForMonth, getMonthlyAmountARS } from '@/lib/utils/finance/monthlyValues'
```

- [ ] **Step 2: Eliminar el helper que lee el valor vivo**

Borrar la función `getExpenseAmountARS` (líneas 84-91):

```ts
  // Get expense amount in ARS
  const getExpenseAmountARS = (expense: RecurringExpense | undefined): number => {
    if (!expense) return 0
    if (expense.currency === 'USD') {
      return expense.amount * rate
    }
    return expense.amount
  }
```

- [ ] **Step 3: Generar el pago del mes con el default del mes anterior**

En el `useEffect` de auto-generación, reemplazar el bloque `await db.expensePayments.add({...})` (líneas 129-136) por:

```ts
            const seed = resolveDefaultForMonth(expense, currentMonth, currentYear, payments)
            await db.expensePayments.add({
              id: generateId('pay'),
              recurringExpenseId: expense.id!,
              amount: seed.amount,
              currency: seed.currency,
              month: currentMonth,
              year: currentYear,
              dueDate,
              status,
              createdAt: new Date()
            })
```

- [ ] **Step 4: Precargar el monto a pagar desde el valor guardado**

En `handleMarkPaid` (líneas 191-199), reemplazar:

```ts
  const handleMarkPaid = (payment: ExpensePayment) => {
    const expense = expenses.find(e => e.id === payment.recurringExpenseId)
    const amountARS = expense ? getExpenseAmountARS(expense) : payment.amount
    setSelectedPayment(payment)
    setActualAmount(amountARS.toString())
    setPaidByUserId('')
    setNotes('')
    setShowMarkPaidDialog(true)
  }
```

por:

```ts
  const handleMarkPaid = (payment: ExpensePayment) => {
    setSelectedPayment(payment)
    setActualAmount(payment.amount.toString())
    setPaidByUserId('')
    setNotes('')
    setShowMarkPaidDialog(true)
  }
```

- [ ] **Step 5: Mostrar el monto guardado en la lista**

En el `.map` de pagos, reemplazar (línea 362):

```ts
                const expense = getExpense(payment.recurringExpenseId)
                const amountARS = expense ? getExpenseAmountARS(expense) : payment.amount
```

por:

```ts
                const expense = getExpense(payment.recurringExpenseId)
                const amountARS = getMonthlyAmountARS(payment, rate)
```

> El badge `expense?.currency === 'USD'` (línea ~383) puede quedar como está: solo muestra una etiqueta informativa con el monto del servicio. El cálculo principal ya usa el valor guardado.

- [ ] **Step 6: Verificar typecheck y lint**

Run: `npm run typecheck`
Expected: PASS (sin errores en `PaymentsTab.tsx`).

Run: `npm run lint`
Expected: sin nuevos errores (puede haber warnings preexistentes). Si `RecurringExpense` queda importado sin uso, dejarlo solo si se usa en otro lado; si no, quitarlo del import.

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/finance/components/PaymentsTab.tsx
git commit -m "feat(finance): PaymentsTab uses previous-month default and stored monthly value"
```

---

## Task 4: `ExpensesTab` — consciente del mes + edición del valor del mes

**Files:**
- Modify: `src/app/[locale]/finance/components/ExpensesTab.tsx`

- [ ] **Step 1: Ampliar imports y props**

En los imports (líneas 5-6), reemplazar:

```ts
import { db, RecurringExpense, ExpenseCategory, MonthlyExchangeRate, deleteWithSync } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
```

por:

```ts
import { db, RecurringExpense, ExpenseCategory, ExpensePayment, MonthlyExchangeRate, deleteWithSync } from '@/lib/db'
import { generateId, formatARS } from '@/lib/utils'
import { resolveDefaultForMonth, getMonthlyAmountARS, MonthlyValueSeed } from '@/lib/utils/finance/monthlyValues'
```

Reemplazar la interfaz de props (líneas 19-24):

```ts
interface ExpensesTabProps {
  expenses: RecurringExpense[]
  categories: ExpenseCategory[]
  exchangeRate?: MonthlyExchangeRate
  hideAmounts?: boolean
}
```

por:

```ts
interface ExpensesTabProps {
  expenses: RecurringExpense[]
  categories: ExpenseCategory[]
  payments: ExpensePayment[]
  selectedMonth: number
  selectedYear: number
  exchangeRate?: MonthlyExchangeRate
  hideAmounts?: boolean
}
```

Y la firma del componente (línea 39):

```ts
export function ExpensesTab({ expenses, categories, exchangeRate, hideAmounts: _hideAmounts }: ExpensesTabProps) {
```

por:

```ts
export function ExpensesTab({ expenses, categories, payments, selectedMonth, selectedYear, exchangeRate, hideAmounts: _hideAmounts }: ExpensesTabProps) {
```

- [ ] **Step 2: Reemplazar el cálculo de monto vivo por el valor del mes**

Reemplazar el helper `getAmountInARS` (líneas 62-68):

```ts
  // Calculate expense in ARS
  const getAmountInARS = (expense: RecurringExpense): number => {
    if (expense.currency === 'USD') {
      return expense.amount * rate
    }
    return expense.amount
  }
```

por:

```ts
  // Find the stored payment record for an expense in the selected month
  const getMonthPayment = (expenseId: string): ExpensePayment | undefined =>
    payments.find(
      p => p.recurringExpenseId === expenseId && p.month === selectedMonth && p.year === selectedYear
    )

  // Resolve the monthly value (stored record if present, otherwise the default)
  const getMonthlyValue = (expense: RecurringExpense): MonthlyValueSeed => {
    const existing = getMonthPayment(expense.id!)
    if (existing) return { amount: existing.amount, currency: existing.currency ?? 'ARS' }
    return resolveDefaultForMonth(expense, selectedMonth, selectedYear, payments)
  }

  // Monthly value converted to ARS
  const getAmountInARS = (expense: RecurringExpense): number =>
    getMonthlyAmountARS(getMonthlyValue(expense), rate)
```

- [ ] **Step 3: Estado y handlers para editar el valor del mes**

Agregar, junto a los demás `useState` del componente (después de la línea 49, `const [isSubmitting, ...]`):

```ts
  const [editingMonthExpense, setEditingMonthExpense] = useState<RecurringExpense | null>(null)
  const [monthAmount, setMonthAmount] = useState('')
```

Agregar estos handlers junto a los otros handlers (por ejemplo, después de `handleDelete`, antes de `getCategoryName`):

```ts
  const openMonthEditor = (expense: RecurringExpense) => {
    const { amount } = getMonthlyValue(expense)
    setEditingMonthExpense(expense)
    setMonthAmount(amount.toString())
  }

  const saveMonthlyValue = async () => {
    if (!editingMonthExpense) return
    const value = parseFloat(monthAmount)
    if (isNaN(value) || value < 0) {
      toast.error(tMessages('error'))
      return
    }
    try {
      const existing = getMonthPayment(editingMonthExpense.id!)
      if (existing) {
        await db.expensePayments.update(existing.id!, {
          amount: value,
          updatedAt: new Date()
        })
      } else {
        const { currency } = getMonthlyValue(editingMonthExpense)
        const dueDate = new Date(selectedYear, selectedMonth - 1, editingMonthExpense.dueDay)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        await db.expensePayments.add({
          id: generateId('pay'),
          recurringExpenseId: editingMonthExpense.id!,
          amount: value,
          currency,
          month: selectedMonth,
          year: selectedYear,
          dueDate,
          status: dueDate < today ? 'overdue' : 'pending',
          createdAt: new Date()
        })
      }
      toast.success(tMessages('monthlyValueSaved'))
      setEditingMonthExpense(null)
    } catch (error) {
      logger.error('Error saving monthly value:', error)
      toast.error(tMessages('error'))
    }
  }
```

- [ ] **Step 4: Botón para editar el valor del mes en cada servicio activo**

En la fila de un gasto **activo**, dentro del bloque de acciones (después del `<Switch ... onCheckedChange={() => handleToggleActive(expense)} />`, líneas ~317-320), agregar un botón con ícono de calendario/lápiz. Reemplazar el botón de editar servicio existente para distinguir ambos: justo antes del `<Button ... onClick={() => handleOpenDialog(expense)}>` insertar:

```tsx
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 sm:h-9 sm:w-9"
                                  onClick={() => openMonthEditor(expense)}
                                  title={t('editMonthlyValue')}
                                >
                                  <CalendarClock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
```

Agregar `CalendarClock` al import de `lucide-react` (línea 15): cambiar
`import { Plus, Receipt, Trash2, Edit, Home, Zap, Wifi, Shield, FileText, Tv, Wrench, MoreHorizontal } from 'lucide-react'`
por
`import { Plus, Receipt, Trash2, Edit, Home, Zap, Wifi, Shield, FileText, Tv, Wrench, MoreHorizontal, CalendarClock } from 'lucide-react'`

- [ ] **Step 5: Diálogo para editar el valor del mes**

Antes del cierre del fragment (`</>`, justo antes de la línea final del JSX, después del `</Dialog>` del formulario de servicio), agregar:

```tsx
      {/* Edit Monthly Value Dialog */}
      <Dialog open={!!editingMonthExpense} onOpenChange={(open) => { if (!open) setEditingMonthExpense(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('editMonthlyValue')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('editMonthlyValueDescription')}</p>
            <div className="space-y-2">
              <Label htmlFor="monthAmount">{t('dialog.amount')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  {editingMonthExpense ? getMonthlyValue(editingMonthExpense).currency : '$'}
                </span>
                <Input
                  id="monthAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthAmount}
                  onChange={(e) => setMonthAmount(e.target.value)}
                  className="h-12 pl-14"
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setEditingMonthExpense(null)} className="h-12">
              {t('dialog.cancel')}
            </Button>
            <Button type="button" onClick={saveMonthlyValue} className="h-12">
              {t('dialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 6: Aclarar que el monto del servicio es la "semilla por defecto"**

En el formulario de crear/editar servicio, debajo del `<Label htmlFor="amount">{t('dialog.amount')}</Label>` (línea 475), agregar un hint:

```tsx
                <p className="text-xs text-muted-foreground">{t('dialog.amountSeedHint')}</p>
```

- [ ] **Step 7: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS para `ExpensesTab.tsx` (aparecerá un error en `page.tsx` por las nuevas props requeridas — se resuelve en Task 5).

- [ ] **Step 8: Commit**

```bash
git add src/app/[locale]/finance/components/ExpensesTab.tsx
git commit -m "feat(finance): ExpensesTab shows and edits per-month value"
```

---

## Task 5: `page.tsx` — pasar mes/pagos a `ExpensesTab` y total desde valores guardados

**Files:**
- Modify: `src/app/[locale]/finance/page.tsx`

- [ ] **Step 1: Importar los helpers**

Después del import `import { formatARS } from '@/lib/utils'` (línea 16), agregar:

```ts
import { resolveDefaultForMonth, getMonthlyAmountARS } from '@/lib/utils/finance/monthlyValues'
```

- [ ] **Step 2: Calcular el total mensual desde los valores guardados**

Reemplazar el cálculo de `totalMonthlyExpenses` (líneas 119-124):

```ts
  const totalMonthlyExpenses = activeExpenses.reduce((sum, exp) => {
    if (exp.currency === 'USD') {
      return sum + (exp.amount * exchangeRate)
    }
    return sum + exp.amount
  }, 0)
```

por:

```ts
  const totalMonthlyExpenses = activeExpenses.reduce((sum, exp) => {
    const stored = payments.find(
      p => p.recurringExpenseId === exp.id && p.month === selectedMonth && p.year === selectedYear
    )
    const seed = stored
      ? { amount: stored.amount, currency: stored.currency ?? 'ARS' as const }
      : resolveDefaultForMonth(exp, selectedMonth, selectedYear, payments)
    return sum + getMonthlyAmountARS(seed, exchangeRate)
  }, 0)
```

- [ ] **Step 3: Pasar las props nuevas a `ExpensesTab`**

Reemplazar el bloque `<ExpensesTab ... />` (líneas 320-327):

```tsx
            <ExpensesTab
              expenses={recurringExpenses}
              categories={expenseCategories}
              exchangeRate={selectedExchangeRate}
              hideAmounts={hideAmounts}
            />
```

por:

```tsx
            <ExpensesTab
              expenses={recurringExpenses}
              categories={expenseCategories}
              payments={payments}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              exchangeRate={selectedExchangeRate}
              hideAmounts={hideAmounts}
            />
```

- [ ] **Step 4: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS (sin errores en `page.tsx` ni `ExpensesTab.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/finance/page.tsx
git commit -m "feat(finance): wire per-month values into finance page header and ExpensesTab"
```

---

## Task 6: `BalanceTab` — usar monto y moneda guardados

**Files:**
- Modify: `src/app/[locale]/finance/components/BalanceTab.tsx`

- [ ] **Step 1: Importar el helper**

Después de `import { formatARS, generateId } from '@/lib/utils'` (línea 7), agregar:

```ts
import { getMonthlyAmountARS } from '@/lib/utils/finance/monthlyValues'
```

- [ ] **Step 2: Reemplazar el helper que lee el valor vivo**

Borrar `getExpenseAmountARS` (líneas 90-98):

```ts
  // Get expense amount in ARS
  const getExpenseAmountARS = (expenseId: string, fallbackAmount: number): number => {
    const expense = expenses.find(e => e.id === expenseId)
    if (!expense) return fallbackAmount
    if (expense.currency === 'USD') {
      return expense.amount * rate
    }
    return expense.amount
  }
```

- [ ] **Step 3: Usar el valor guardado en los cálculos**

Reemplazar el cálculo de `totalExpensesPaidARS` (líneas 101-103):

```ts
  const totalExpensesPaidARS = paidPayments.reduce((sum, p) => {
    return sum + getExpenseAmountARS(p.recurringExpenseId, p.amount)
  }, 0)
```

por:

```ts
  const totalExpensesPaidARS = paidPayments.reduce((sum, p) => {
    return sum + getMonthlyAmountARS(p, rate)
  }, 0)
```

Reemplazar el cálculo de `totalPaid` por usuario (líneas 120-122):

```ts
    const totalPaid = paidPayments
      .filter(p => p.paidByUserId === user.id)
      .reduce((sum, p) => sum + getExpenseAmountARS(p.recurringExpenseId, p.amount), 0)
```

por:

```ts
    const totalPaid = paidPayments
      .filter(p => p.paidByUserId === user.id)
      .reduce((sum, p) => sum + getMonthlyAmountARS(p, rate), 0)
```

- [ ] **Step 4: Verificar typecheck y lint**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: sin nuevos errores. Si `RecurringExpense`/`expenses` quedan sin uso real, dejarlos (la prop `expenses` se sigue recibiendo); solo eliminar imports si el linter marca error, no warning.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/finance/components/BalanceTab.tsx
git commit -m "feat(finance): BalanceTab uses stored per-month amount and currency"
```

---

## Task 7: `AnalysisTab` — moneda guardada + selector de servicio + variación %

**Files:**
- Modify: `src/app/[locale]/finance/components/AnalysisTab.tsx`

- [ ] **Step 1: Importar `useState`, el helper y el `Select`**

Reemplazar el import de React (línea 3):

```ts
import { useMemo, useCallback } from 'react'
```

por:

```ts
import { useMemo, useCallback, useState } from 'react'
```

Después de `import { formatARS } from '@/lib/utils'` (línea 7), agregar:

```ts
import { getMonthlyAmountARS } from '@/lib/utils/finance/monthlyValues'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
```

- [ ] **Step 2: Arreglar la moneda guardada en las series existentes**

En `expensesPerMonthData`, reemplazar el `reduce` (líneas 122-127):

```ts
      const total = monthPayments.reduce((sum, p) => {
        const expense = allExpenses.find(e => e.id === p.recurringExpenseId)
        const amount = p.amount || expense?.amount || 0
        const currency = expense?.currency || 'ARS'
        return sum + (currency === 'USD' ? amount * rate : amount)
      }, 0)
```

por:

```ts
      const total = monthPayments.reduce((sum, p) => {
        return sum + getMonthlyAmountARS(p, rate)
      }, 0)
```

En `expenseProgressionData`, reemplazar (líneas 153-155):

```ts
        const amount = payment?.amount || expense.amount
        const value = expense.currency === 'USD' ? amount * rate : amount
        dataPoint[expense.name] = value
```

por:

```ts
        const currency = payment?.currency ?? expense.currency ?? 'ARS'
        const amount = payment?.amount ?? expense.amount
        const value = currency === 'USD' ? amount * rate : amount
        dataPoint[expense.name] = value
```

En `incomeVsExpensesData`, reemplazar el `reduce` de expenses (líneas 202-207):

```ts
      const expenses = monthPayments.reduce((sum, p) => {
        const expense = allExpenses.find(e => e.id === p.recurringExpenseId)
        const amount = p.amount || expense?.amount || 0
        const currency = expense?.currency || 'ARS'
        return sum + (currency === 'USD' ? amount * rate : amount)
      }, 0)
```

por:

```ts
      const expenses = monthPayments.reduce((sum, p) => {
        return sum + getMonthlyAmountARS(p, rate)
      }, 0)
```

- [ ] **Step 3: Estado del selector y series por servicio**

Después de `const t = useTranslations('finance.analysis')` (línea 73), agregar:

```ts
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>('')
  const activeExpenses = useMemo(() => allExpenses.filter(e => e.isActive), [allExpenses])
  const effectiveExpenseId = selectedExpenseId || activeExpenses[0]?.id || ''
```

Agregar estas dos memos justo después del memo `exchangeRateTrendData` (después de la línea 290):

```ts
  // Selected service: stored monthly value across the last 12 months (billed value, paid or not)
  const serviceTrendData = useMemo(() => {
    return last12Months.map(({ month, year, label }) => {
      const rate = getExchangeRate(month, year)
      const payment = allPayments.find(
        p => p.recurringExpenseId === effectiveExpenseId && p.month === month && p.year === year
      )
      const value = payment ? getMonthlyAmountARS(payment, rate) : 0
      return { name: label, value }
    })
  }, [allPayments, effectiveExpenseId, last12Months, getExchangeRate])

  // Selected service: month-over-month percentage variation
  const serviceVariationData = useMemo(() => {
    return serviceTrendData.map((d, i) => {
      if (i === 0) return { name: d.name, variation: 0 }
      const prev = serviceTrendData[i - 1].value
      const variation = prev > 0 ? ((d.value - prev) / prev) * 100 : 0
      return { name: d.name, variation: Math.round(variation * 10) / 10 }
    })
  }, [serviceTrendData])
```

- [ ] **Step 4: Render del selector + dos gráficos nuevos**

Insertar este bloque **después de** la "Row 2" (después del `</div>` que cierra la grilla de progresiones, línea ~425, antes del comentario `{/* Row 3: ... */}`):

```tsx
      {/* Row 2.5: Per-service trend (selectable) and monthly % variation */}
      <Card>
        <CardHeader className="pb-2 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              {t('charts.serviceTrend')}
            </CardTitle>
            <Select value={effectiveExpenseId} onValueChange={setSelectedExpenseId}>
              <SelectTrigger className="h-9 w-full sm:w-[220px]">
                <SelectValue placeholder={t('charts.selectService')} />
              </SelectTrigger>
              <SelectContent>
                {activeExpenses.map(exp => (
                  <SelectItem key={exp.id} value={exp.id!}>{exp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <LineChart data={serviceTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={35} />
                <Tooltip formatter={formatTooltipValue} />
                <Line type="monotone" dataKey="value" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 2 }} name={t('charts.serviceTrend')} />
              </LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={220} className="sm:!h-[280px]">
              <BarChart data={serviceVariationData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} width={40} />
                <Tooltip formatter={(value) => [`${value}%`, t('charts.variation')]} />
                <Bar dataKey="variation" radius={[4, 4, 0, 0]} name={t('charts.variation')}>
                  {serviceVariationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.variation >= 0 ? CHART_COLORS.expense : CHART_COLORS.income} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

```

> Nota: en variación, subas (positivo) van en rojo (gasto que sube) y bajas en verde, coherente con el resto del módulo.

- [ ] **Step 5: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS. Las claves i18n nuevas (`charts.serviceTrend`, `charts.selectService`, `charts.variation`) se agregan en Task 8; no rompen typecheck (next-intl no valida en tiempo de compilación).

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/finance/components/AnalysisTab.tsx
git commit -m "feat(finance): AnalysisTab stored-currency fix + per-service trend and % variation"
```

---

## Task 8: Traducciones i18n (EN/ES)

**Files:**
- Modify: `messages/en/finance.json`
- Modify: `messages/es/finance.json`

- [ ] **Step 1: Localizar las secciones a modificar**

Run: `grep -n '"addExpense"\|"serviceProgression"\|"expenseUpdated"' messages/en/finance.json messages/es/finance.json`
Expected: muestra las líneas dentro de los objetos `expenses`, `analysis.charts` y `messages`. Usar esas ubicaciones como ancla.

- [ ] **Step 2: Agregar claves en `messages/en/finance.json`**

Dentro del objeto `expenses` (junto a `"addExpense"`, en el nivel de claves de ese objeto y dentro de `dialog`), agregar:

```jsonc
// en "expenses": { ... }  (nivel raíz del objeto expenses)
"editMonthlyValue": "Edit month value",
"editMonthlyValueDescription": "This value applies only to the selected month. Other months are not affected.",
```

```jsonc
// en "expenses": { "dialog": { ... } }
"amountSeedHint": "Initial value, used as the base for future months.",
```

Dentro de `analysis.charts`, agregar:

```jsonc
"serviceTrend": "Service trend",
"selectService": "Select service",
"variation": "Change",
```

Dentro de `messages`, agregar:

```jsonc
"monthlyValueSaved": "Monthly value updated",
```

- [ ] **Step 3: Agregar las mismas claves en `messages/es/finance.json`**

```jsonc
// en "expenses": { ... }
"editMonthlyValue": "Editar valor del mes",
"editMonthlyValueDescription": "Este valor aplica solo al mes seleccionado. No afecta a otros meses.",
```

```jsonc
// en "expenses": { "dialog": { ... } }
"amountSeedHint": "Valor inicial, se usa como base para los meses siguientes.",
```

```jsonc
// en "analysis": { "charts": { ... } }
"serviceTrend": "Tendencia por servicio",
"selectService": "Seleccionar servicio",
"variation": "Variación",
```

```jsonc
// en "messages": { ... }
"monthlyValueSaved": "Valor del mes actualizado",
```

- [ ] **Step 4: Validar JSON**

Run: `node -e "require('./messages/en/finance.json'); require('./messages/es/finance.json'); console.log('JSON OK')"`
Expected: `JSON OK` (sin errores de parseo — comas correctas).

- [ ] **Step 5: Commit**

```bash
git add messages/en/finance.json messages/es/finance.json
git commit -m "i18n(finance): add keys for monthly value editing and analysis charts"
```

---

## Task 9: Verificación final

**Files:** ninguno (verificación).

- [ ] **Step 1: Typecheck completo**

Run: `npm run typecheck`
Expected: PASS sin errores.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin nuevos errores introducidos por estos cambios.

- [ ] **Step 3: Tests**

Run: `npm run test`
Expected: PASS, incluyendo `monthlyValues.test.ts`.

- [ ] **Step 4: Build de producción**

Run: `npm run build`
Expected: build exitoso (TypeScript bloquea el build, así que confirma que no hay errores de tipo).

- [ ] **Step 5: Verificación manual (dev server)**

Run: `npm run dev` y en el navegador (`localhost:3000`), módulo `finance`:
1. Crear/usar un servicio. En la pestaña **Gastos**, editar el valor del mes actual con el botón de calendario → confirmar que cambia solo ese mes.
2. Navegar al mes siguiente → confirmar que el valor por defecto es el del mes anterior y que se puede cambiar.
3. Volver al mes anterior → confirmar que su valor **no** cambió.
4. Marcar un pago en **Pagos** → confirmar que el monto precargado es el del mes.
5. En **Saldos**, confirmar que los totales usan los montos del mes.
6. En **Análisis**, elegir un servicio en el selector → ver su tendencia y la variación % mes a mes.

Expected: cada paso se comporta como se describe; los valores históricos se preservan.

- [ ] **Step 6: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "test(finance): verify per-month value flow end-to-end"
```

---

## Notas y fuera de alcance

- **Frecuencia** (bimestral/trimestral/anual): se mantiene la generación mensual para todo servicio activo. No se aborda en este plan.
- **Esperado vs pagado**: descartado por decisión de producto (un solo monto por mes).
- **Migración**: al abrir la app por primera vez tras el deploy, Dexie corre el upgrade v18 y rellena `month`/`year`/`currency` en los pagos existentes. La carga histórica de valores previos solo existe para meses que ya tenían un `ExpensePayment` generado.
- **Módulo `personal-finance`**: no se toca.
