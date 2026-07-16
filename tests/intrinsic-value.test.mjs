import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDcaIntrinsicAdjustment,
  calculateFiveYearDcf,
  calculateIntrinsicValue,
  calculateMarginOfSafety,
  calculatePeterLynchSignal,
  calculateReverseDcfRequiredGrowth
} from '../intrinsic-value.js';

function metric(value, overrides = {}) {
  return {
    value,
    unit: overrides.unit || 'millions',
    currency: overrides.currency || 'USD',
    source: overrides.source || 'fixture',
    confidence: overrides.confidence ?? 0.8
  };
}

function ratio(value, overrides = {}) {
  return {
    value,
    unit: 'percent',
    source: overrides.source || 'fixture',
    confidence: overrides.confidence ?? 0.8
  };
}

function scenario(overrides = {}) {
  return {
    updatedAt: '2026-07-16',
    normalizedFcf: metric(100),
    cash: metric(20),
    debt: metric(10),
    dilutedShares: metric(10, { unit: 'millions' }),
    wacc: ratio(0.1),
    terminalGrowth: ratio(0.03),
    growthRates: [0.05, 0.05, 0.04, 0.04, 0.03].map(value => ratio(value)),
    ...overrides
  };
}

test('calcula DCF a cinco anos con valor empresarial, equity y valor por accion', () => {
  const result = calculateFiveYearDcf(scenario(), 'USD');

  assert.equal(result.available, true);
  assert.equal(result.projectedFcfs.length, 5);
  assert.ok(result.enterpriseValue > 0);
  assert.equal(result.equityValue, result.enterpriseValue + 20_000_000 - 10_000_000);
  assert.equal(result.valuePerShare, result.equityValue / 10_000_000);
});

test('rechaza WACC menor o igual que crecimiento terminal', () => {
  const result = calculateFiveYearDcf(scenario({
    wacc: ratio(0.03),
    terminalGrowth: ratio(0.03)
  }), 'USD');

  assert.equal(result.available, false);
  assert.match(result.validation.errors.join(' | '), /WACC debe ser mayor/);
});

test('rechaza acciones diluidas no positivas', () => {
  const result = calculateFiveYearDcf(scenario({
    dilutedShares: metric(0, { unit: 'millions' })
  }), 'USD');

  assert.equal(result.available, false);
  assert.match(result.validation.errors.join(' | '), /acciones diluidas/);
});

test('rechaza divisas incoherentes y datos faltantes', () => {
  const result = calculateFiveYearDcf(scenario({
    cash: metric(20, { currency: 'EUR' }),
    debt: { value: 10, unit: 'millions', currency: 'USD', confidence: 0.8 }
  }), 'USD');

  assert.equal(result.available, false);
  assert.match(result.validation.errors.join(' | '), /divisa incoherente/);
  assert.match(result.validation.errors.join(' | '), /fuente faltante/);
});

test('rechaza valores extremos', () => {
  const result = calculateFiveYearDcf(scenario({
    wacc: ratio(0.7)
  }), 'USD');

  assert.equal(result.available, false);
  assert.match(result.validation.errors.join(' | '), /WACC extremo/);
});

test('calcula margen de seguridad frente al escenario base', () => {
  assert.equal(calculateMarginOfSafety(80, 100), 0.25);
  assert.equal(calculateMarginOfSafety(0, 100), null);
});

test('el ajuste DCA usa el valor intrinseco como multiplicador secundario en modo simulacion', () => {
  const intrinsicResult = calculateIntrinsicValue({
    currency: 'USD',
    scenarios: {
      conservative: scenario(),
      base: scenario(),
      optimistic: scenario()
    }
  });
  const adjustment = calculateDcaIntrinsicAdjustment(200, intrinsicResult.base.valuePerShare * 0.8, intrinsicResult, {
    simulationMode: true,
    weight: 0.4,
    minMultiplier: 0.8,
    maxMultiplier: 1.2,
    minConfidence: 0.6
  });

  assert.equal(adjustment.originalAmount, 200);
  assert.equal(adjustment.adjustedAmount, 200);
  assert.ok(adjustment.simulatedAdjustedAmount > 200);
  assert.equal(adjustment.applied, false);
});

test('excluye del ajuste DCA los calculos con confianza baja', () => {
  const lowConfidence = calculateIntrinsicValue({
    currency: 'USD',
    scenarios: {
      conservative: scenario({ normalizedFcf: metric(100, { confidence: 0.2 }) }),
      base: scenario({ normalizedFcf: metric(100, { confidence: 0.2 }) }),
      optimistic: scenario({ normalizedFcf: metric(100, { confidence: 0.2 }) })
    }
  });
  const adjustment = calculateDcaIntrinsicAdjustment(200, 80, lowConfidence, {
    minConfidence: 0.9
  });

  assert.equal(adjustment.adjustedAmount, 200);
  assert.equal(adjustment.applied, false);
  assert.match(adjustment.explanation, /confianza baja/);
});

test('limita el multiplicador DCA por el gap al peso objetivo', () => {
  const intrinsicResult = calculateIntrinsicValue({
    currency: 'USD',
    scenarios: {
      conservative: scenario(),
      base: scenario(),
      optimistic: scenario()
    }
  });
  const adjustment = calculateDcaIntrinsicAdjustment(200, intrinsicResult.base.valuePerShare * 0.5, intrinsicResult, {
    simulationMode: false,
    weight: 1,
    minMultiplier: 0.75,
    maxMultiplier: 1.5,
    minConfidence: 0.6,
    maxAmount: 220
  });

  assert.equal(adjustment.adjustedAmount, 220);
  assert.match(adjustment.explanation, /peso objetivo/);
});

test('calcula el crecimiento requerido por reverse DCF', () => {
  const baseScenario = scenario();
  const valueAtFivePercent = calculateFiveYearDcf(baseScenario, 'USD').valuePerShare;
  const reverse = calculateReverseDcfRequiredGrowth(valueAtFivePercent, baseScenario, 'USD');

  assert.equal(reverse.available, true);
  assert.ok(Math.abs(reverse.requiredGrowth - 0.044) < 0.02);
});

test('calcula senal Peter Lynch como indice PEG', () => {
  const result = calculatePeterLynchSignal({
    pe: 20,
    growthRate: 0.15,
    dividendYield: 0.01
  });

  assert.equal(result.available, true);
  assert.equal(result.ratio, 1.25);
  assert.equal(result.label, 'Razonable');
});
