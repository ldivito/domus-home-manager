# Valores de finanzas por mes (módulo `finance`)

**Fecha:** 2026-05-28
**Estado:** Diseño aprobado
**Branch:** `feature/personal-finance`
**Alcance:** Módulo de finanzas del hogar (`src/app/[locale]/finance/`), no `personal-finance`.

## Problema

En el módulo de finanzas del hogar, cada servicio recurrente (`RecurringExpense`)
tiene un único campo `amount`. Mes a mes los valores reales cambian (la luz sube,
el alquiler se actualiza), pero para reflejarlo hay que **editar la plantilla del
servicio**, lo que sobrescribe el valor y hace que se pierda el historial: todos
los meses (pasados y futuros) pasan a mostrar el nuevo valor.

### Estado actual del código (hallazgos)

- `ExpensePayment` **ya es** un registro por-servicio-por-mes con su propio
  `amount`. `PaymentsTab` auto-genera uno por servicio activo al navegar a cada
  mes (`PaymentsTab.tsx:129`), copiando `expense.amount` en ese momento.
- **Inconsistencia clave:** la UI casi nunca usa ese valor guardado.
  - `ExpensesTab.tsx:266` muestra el valor **vivo** (`expense.amount`) y no es
    consciente del mes seleccionado.
  - `PaymentsTab.tsx:362` muestra el valor vivo (`getExpenseAmountARS(expense)`),
    usando el guardado solo como fallback.
  - `BalanceTab.tsx:91-103` (`getExpenseAmountARS`) prefiere el valor vivo y solo
    cae al guardado (`p.amount`) si el servicio fue borrado.
  - `AnalysisTab.tsx:124,153` es la **excepción**: ya prefiere el valor guardado
    (`p.amount || expense?.amount`). Los gráficos ya preservan historial.
- `MonthlyIncome` (ingresos) y `MonthlyExchangeRate` (cotización) ya son por
  mes/año. Los saldos se calculan en vivo a partir de ingresos y pagos.

Conclusión: el modelo de datos ya soporta valores por mes. El trabajo real es
**hacer del valor guardado la única fuente de verdad** en toda la UI, **mejorar
el default de cada mes nuevo** (valor del mes anterior, no el vivo) y **permitir
editar el valor por mes** sin tocar la plantilla.

## Decisiones de producto (validadas con el usuario)

1. **Un solo monto por mes** por servicio (la factura = lo que se paga). No se
   distingue "esperado" de "pagado".
2. **Edición en la pestaña del mes**: se edita el valor del servicio para el mes
   seleccionado de forma inline.
3. **Gráficos requeridos**: tendencia por servicio, total de gastos por mes,
   ingresos vs gastos (con saldo neto), variación % mensual.
4. **Enfoque A**: reusar `ExpensePayment` como fuente de verdad por mes (sin
   tabla nueva).
5. **Frecuencia fuera de alcance**: se mantiene la generación mensual para todo
   servicio activo, aunque su frecuencia sea bimestral/trimestral/anual.

## Diseño

### 1. Modelo de datos — `src/lib/db.ts`

Extender la interfaz `ExpensePayment` (no se crea tabla nueva):

```ts
export interface ExpensePayment {
  id?: string
  recurringExpenseId: string
  amount: number              // Valor del servicio en ESTE mes (fuente de verdad)
  currency: 'ARS' | 'USD'     // NUEVO: snapshot de la moneda en ese mes
  month: number               // NUEVO: 1-12 (desnormalizado de dueDate)
  year: number                // NUEVO: ej. 2026 (desnormalizado de dueDate)
  dueDate: Date
  paidDate?: Date
  paidByUserId?: string
  status: 'pending' | 'paid' | 'overdue'
  notes?: string
  householdId?: string
  createdAt: Date
  updatedAt?: Date
}
```

- `RecurringExpense.amount` pasa a ser solo la **semilla por defecto**: se usa
  únicamente la primera vez que un servicio aparece (cuando no hay registro de
  ningún mes anterior).
- Nueva versión de schema (la siguiente disponible en `DomusDatabase`) con índice
  compuesto `[recurringExpenseId+year+month]` sobre `expensePayments` (además de
  los índices ya existentes).
- **Migración** (upgrade de versión): para cada `ExpensePayment` existente,
  derivar `month`/`year` desde `dueDate` y `currency` desde la moneda actual del
  `RecurringExpense` referenciado (fallback `'ARS'` si el servicio ya no existe).

> Nota de patrón: seguir el estilo de las versiones de schema existentes en
> `db.ts` (números de versión incrementales con `.upgrade(...)`), sin renumerar
> versiones previas.

### 2. Helper aislado y testeable — `src/lib/finance/monthlyValues.ts`

Módulo nuevo que concentra la lógica de "valor por mes", desacoplado de React y
de Dexie para poder testearlo con la infra existente (`src/__tests__/finance/`).

Funciones (nombres orientativos):

- `getPreviousValue(expenseId, month, year, payments): { amount, currency } | null`
  Busca el registro **más reciente anterior** a `(month, year)` para ese servicio
  (ordenando por `year` y luego `month`). Maneja meses salteados — no asume
  mes-1.
- `resolveDefaultForMonth(expense, month, year, payments): { amount, currency }`
  Devuelve el default para crear el registro del mes: si hay valor anterior, lo
  usa; si no, usa la semilla del servicio (`expense.amount` / `expense.currency`).
- `getMonthlyAmountARS(payment, rate): number`
  Selector único: convierte el monto **guardado** del pago a ARS usando la
  cotización del mes y la `currency` guardada (nunca lee el valor vivo del
  servicio).

La generación de registros de pago (`ensureMonthlyRecord`) puede vivir en este
módulo (recibiendo dependencias) o quedar en `PaymentsTab` usando estos helpers;
la lógica de default debe centralizarse en `resolveDefaultForMonth`.

### 3. UI — consistencia (fuente de verdad = valor guardado)

**`src/app/[locale]/finance/page.tsx`**
- Pasar `selectedMonth` / `selectedYear` y los pagos del mes a `ExpensesTab`.
- Los totales del header (`totalMonthlyExpenses`) deben calcularse desde los
  registros del mes seleccionado (vía `getMonthlyAmountARS`), no desde
  `activeExpenses` con valor vivo.

**`ExpensesTab.tsx`** (cambio principal de UX)
- Volverse consciente del mes seleccionado.
- Por cada servicio activo, mostrar su valor **del mes** leído del registro
  `ExpensePayment` correspondiente (creándolo con el default si no existe).
- Agregar **edición inline** del monto del mes (ícono lápiz) que actualiza
  **solo** el `ExpensePayment` de `(servicio, selectedMonth, selectedYear)`.
- El diálogo de crear/editar servicio sigue gestionando nombre, descripción,
  categoría, frecuencia y día de vencimiento; su campo de monto representa la
  **semilla por defecto** (texto/label ajustado para dejarlo claro).
- El total mensual mostrado se calcula desde los valores guardados del mes.

**`PaymentsTab.tsx`**
- La auto-generación usa `resolveDefaultForMonth` (default = mes anterior) en
  lugar de copiar `expense.amount` vivo.
- El monto mostrado en cada pago y el precargado al "marcar pagado" leen el valor
  **guardado** del registro. Marcar pagado sigue escribiendo `amount` en el mismo
  registro (consistente con "un solo monto").
- Al generar/asegurar un registro se setean también `month`, `year` y `currency`.

**`BalanceTab.tsx`**
- `getExpenseAmountARS` deja de preferir el valor vivo del servicio: usa el
  `amount` y `currency` **guardados** del pago (vía `getMonthlyAmountARS`). El
  servicio solo se consulta para nombre/etiqueta, no para el monto.

### 4. Análisis — `AnalysisTab.tsx`

Ya lee montos guardados; ajustar para usar también la `currency` guardada del
pago (hoy lee `expense.currency` vivo, latente bug histórico) y cubrir los 4
gráficos:

1. **Tendencia por servicio** — selector de servicio + línea de su valor mes a
   mes (últimos 12 meses) desde los registros guardados.
2. **Total de gastos por mes** — ya existe; mantener.
3. **Ingresos vs gastos** — combinar la serie de ingresos por mes (ya existe) con
   la de gastos por mes en una vista comparativa, incluyendo saldo neto.
4. **Variación % mensual** — variación porcentual de cada servicio (o del total)
   respecto del mes anterior.

### 5. Ingresos y saldos

- **Ingresos**: ya por mes (`MonthlyIncome`). Sin cambios.
- **Saldos**: derivados; quedan correctos automáticamente una vez que
  `BalanceTab` usa montos guardados.

### 6. i18n

- Agregar claves nuevas en `messages/en/finance.json` y `messages/es/finance.json`
  (label de "valor del mes", edición inline, semilla por defecto, títulos de los
  gráficos nuevos). Mantener paridad EN/ES.

## Diseño para aislamiento

- `monthlyValues.ts` no depende de React ni Dexie: recibe arrays/objetos y
  devuelve valores → testeable de forma unitaria.
- Cada pestaña consume el mismo selector `getMonthlyAmountARS`, eliminando la
  divergencia "valor vivo vs guardado".
- La migración de schema queda contenida en `db.ts` siguiendo el patrón existente.

## Testing

- Tests unitarios de `monthlyValues.ts` en `src/__tests__/finance/`:
  - `getPreviousValue`: mes-1 directo, mes salteado, sin historial, primer mes.
  - `resolveDefaultForMonth`: usa mes anterior cuando existe; usa semilla cuando
    no; respeta `currency`.
  - `getMonthlyAmountARS`: ARS directo, USD con conversión por cotización del mes.
- Verificación manual: editar el valor de un mes no altera meses anteriores;
  un mes nuevo arranca con el valor del mes previo y permite cambiarlo; los
  gráficos reflejan el progreso.

## Fuera de alcance

- Respetar la frecuencia (bimestral/trimestral/anual) en la generación de
  registros — se mantiene mensual para todo servicio activo.
- Distinción "esperado vs pagado" — descartada (un solo monto por mes).
- Módulo `personal-finance` — no se toca.

## Archivos afectados (resumen)

| Archivo | Cambio |
|---|---|
| `src/lib/db.ts` | Extender `ExpensePayment`; nueva versión de schema + índice + migración |
| `src/lib/finance/monthlyValues.ts` | **Nuevo** helper de lógica por mes |
| `src/app/[locale]/finance/page.tsx` | Pasar mes/año a `ExpensesTab`; total desde valores guardados |
| `src/app/[locale]/finance/components/ExpensesTab.tsx` | Consciente del mes + edición inline del valor del mes |
| `src/app/[locale]/finance/components/PaymentsTab.tsx` | Default = mes anterior; leer valor guardado; setear month/year/currency |
| `src/app/[locale]/finance/components/BalanceTab.tsx` | Usar monto/moneda guardados, no el valor vivo |
| `src/app/[locale]/finance/components/AnalysisTab.tsx` | Usar `currency` guardada; 4 gráficos requeridos |
| `messages/{en,es}/finance.json` | Claves i18n nuevas |
| `src/__tests__/finance/` | Tests de `monthlyValues` |
