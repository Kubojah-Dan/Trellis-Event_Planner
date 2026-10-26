import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, CurrencyDefinition } from '@trellis/config';

export interface BudgetItemFinancials {
  id: string;
  category: string;
  label: string;
  currency: string;
  plannedMinorUnits: number;
  estimateMinorUnits?: number;
  quotedMinorUnits?: number;
  committedMinorUnits?: number;
  paidMinorUnits?: number;
  taxMinorUnits?: number;
  feeMinorUnits?: number;
  contingencyMinorUnits?: number;
}

export interface CategorySummary {
  category: string;
  plannedMinorUnits: number;
  forecastMinorUnits: number;
  committedMinorUnits: number;
  paidMinorUnits: number;
  varianceMinorUnits: number;
}

export interface BudgetCalculationSummary {
  currency: string;
  targetBudgetMinorUnits: number;
  plannedTotalMinorUnits: number;
  estimatedTotalMinorUnits: number;
  quotedTotalMinorUnits: number;
  committedTotalMinorUnits: number;
  paidTotalMinorUnits: number;
  taxTotalMinorUnits: number;
  feeTotalMinorUnits: number;
  contingencyTotalMinorUnits: number;
  forecastTotalMinorUnits: number;
  remainingBudgetMinorUnits: number;
  varianceMinorUnits: number;
  isOverBudget: boolean;
  overBudgetAmountMinorUnits: number;
  categoryBreakdown: Record<string, CategorySummary>;
}

export function getCurrencyDefinition(currencyCode: string): CurrencyDefinition {
  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase();
  return (
    SUPPORTED_CURRENCIES[code] ?? {
      code,
      name: code,
      symbol: code,
      decimals: 2,
      minorUnitFactor: 100,
    }
  );
}

/**
 * Converts a major currency unit (e.g., $150.50) into an integer minor unit (15050 cents).
 * Safe from floating-point rounding quirks.
 */
export function toMinorUnits(amount: number | string, currencyCode: string = DEFAULT_CURRENCY): number {
  const currency = getCurrencyDefinition(currencyCode);
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 0;
  return Math.round(num * currency.minorUnitFactor);
}

/**
 * Converts integer minor units back into a float major unit.
 */
export function toMajorUnits(minorUnits: number, currencyCode: string = DEFAULT_CURRENCY): number {
  const currency = getCurrencyDefinition(currencyCode);
  if (!minorUnits || isNaN(minorUnits)) return 0;
  return minorUnits / currency.minorUnitFactor;
}

/**
 * Formats minor units for display using Intl.NumberFormat.
 */
export function formatMoney(
  minorUnits: number,
  currencyCode: string = DEFAULT_CURRENCY,
  locale: string = 'en-US'
): string {
  const currency = getCurrencyDefinition(currencyCode);
  const major = toMajorUnits(minorUnits, currencyCode);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    }).format(major);
  } catch {
    return `${currency.symbol}${major.toFixed(currency.decimals)}`;
  }
}

/**
 * Determines the authoritative forecast figure for a single budget item.
 * Precedence: Committed > Quoted > Estimated > Planned.
 * Plus additional mandatory costs: tax, fees, contingency.
 */
export function calculateItemForecast(item: BudgetItemFinancials): number {
  let baseCost = item.plannedMinorUnits || 0;

  if (item.committedMinorUnits !== undefined && item.committedMinorUnits > 0) {
    baseCost = item.committedMinorUnits;
  } else if (item.quotedMinorUnits !== undefined && item.quotedMinorUnits > 0) {
    baseCost = item.quotedMinorUnits;
  } else if (item.estimateMinorUnits !== undefined && item.estimateMinorUnits > 0) {
    baseCost = item.estimateMinorUnits;
  }

  const tax = item.taxMinorUnits ?? 0;
  const fee = item.feeMinorUnits ?? 0;
  const contingency = item.contingencyMinorUnits ?? 0;

  return baseCost + tax + fee + contingency;
}

/**
 * Pure deterministic calculation of all budget totals, subtotals, variances, and category breakdowns.
 * Guarantee: All totals reconcile to the exact minor unit integer.
 */
export function calculateBudgetSummary(
  items: BudgetItemFinancials[],
  targetBudgetMinorUnits: number = 0,
  currencyCode: string = DEFAULT_CURRENCY
): BudgetCalculationSummary {
  let plannedTotal = 0;
  let estimatedTotal = 0;
  let quotedTotal = 0;
  let committedTotal = 0;
  let paidTotal = 0;
  let taxTotal = 0;
  let feeTotal = 0;
  let contingencyTotal = 0;
  let forecastTotal = 0;

  const categoryMap: Record<string, CategorySummary> = {};

  for (const item of items) {
    const planned = item.plannedMinorUnits ?? 0;
    const estimate = item.estimateMinorUnits ?? 0;
    const quoted = item.quotedMinorUnits ?? 0;
    const committed = item.committedMinorUnits ?? 0;
    const paid = item.paidMinorUnits ?? 0;
    const tax = item.taxMinorUnits ?? 0;
    const fee = item.feeMinorUnits ?? 0;
    const contingency = item.contingencyMinorUnits ?? 0;
    const forecast = calculateItemForecast(item);

    plannedTotal += planned;
    estimatedTotal += estimate;
    quotedTotal += quoted;
    committedTotal += committed;
    paidTotal += paid;
    taxTotal += tax;
    feeTotal += fee;
    contingencyTotal += contingency;
    forecastTotal += forecast;

    const cat = item.category || 'General';
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        category: cat,
        plannedMinorUnits: 0,
        forecastMinorUnits: 0,
        committedMinorUnits: 0,
        paidMinorUnits: 0,
        varianceMinorUnits: 0,
      };
    }

    const currentCat = categoryMap[cat]!;
    currentCat.plannedMinorUnits += planned;
    currentCat.forecastMinorUnits += forecast;
    currentCat.committedMinorUnits += committed;
    currentCat.paidMinorUnits += paid;
    currentCat.varianceMinorUnits = currentCat.plannedMinorUnits - currentCat.forecastMinorUnits;
  }

  const target = targetBudgetMinorUnits > 0 ? targetBudgetMinorUnits : plannedTotal;
  const remaining = target - forecastTotal;
  const isOver = forecastTotal > target;
  const overAmount = isOver ? forecastTotal - target : 0;
  const variance = target - forecastTotal;

  return {
    currency: currencyCode,
    targetBudgetMinorUnits: target,
    plannedTotalMinorUnits: plannedTotal,
    estimatedTotalMinorUnits: estimatedTotal,
    quotedTotalMinorUnits: quotedTotal,
    committedTotalMinorUnits: committedTotal,
    paidTotalMinorUnits: paidTotal,
    taxTotalMinorUnits: taxTotal,
    feeTotalMinorUnits: feeTotal,
    contingencyTotalMinorUnits: contingencyTotal,
    forecastTotalMinorUnits: forecastTotal,
    remainingBudgetMinorUnits: remaining,
    varianceMinorUnits: variance,
    isOverBudget: isOver,
    overBudgetAmountMinorUnits: overAmount,
    categoryBreakdown: categoryMap,
  };
}
