export const INTRINSIC_SCENARIOS = ['conservative', 'base', 'optimistic'];

export const DEFAULT_DCA_INTRINSIC_CONFIG = {
  enabled: true,
  simulationMode: true,
  weight: 0.35,
  minMultiplier: 0.75,
  maxMultiplier: 1.25,
  minConfidence: 0.6,
  baseScenario: 'base'
};

const FINANCIAL_UNITS = {
  ones: 1,
  thousands: 1_000,
  millions: 1_000_000,
  billions: 1_000_000_000
};

const SHARE_UNITS = {
  shares: 1,
  thousands: 1_000,
  millions: 1_000_000,
  billions: 1_000_000_000
};

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function normalizeCurrency(currency) {
  if (currency === '$') return 'USD';
  if (currency === '€' || currency === 'â‚¬') return 'EUR';
  return (currency || '').toString().trim().toUpperCase();
}

function fieldValue(field) {
  return field && isFiniteNumber(field.value) ? Number(field.value) : null;
}

function fieldConfidence(field) {
  return field && isFiniteNumber(field.confidence) ? Number(field.confidence) : null;
}

function addFieldIssue(issues, fieldName, field, expectedCurrency, unitMap, type) {
  if (!field || field.value === undefined || field.value === null || field.value === '') {
    issues.errors.push(`${fieldName}: dato faltante`);
    return;
  }
  if (!isFiniteNumber(field.value)) {
    issues.errors.push(`${fieldName}: valor no numerico`);
  }
  if (!field.source) issues.errors.push(`${fieldName}: fuente faltante`);
  if (fieldConfidence(field) === null) issues.errors.push(`${fieldName}: confianza faltante`);
  if (type === 'money' && normalizeCurrency(field.currency) !== expectedCurrency) {
    issues.errors.push(`${fieldName}: divisa incoherente`);
  }
  if (!unitMap[field.unit]) issues.errors.push(`${fieldName}: unidad incoherente`);
}

function convertField(field, unitMap) {
  return Number(field.value) * unitMap[field.unit];
}

function averageConfidence(fields) {
  const values = fields.map(fieldConfidence).filter(value => value !== null);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function validateIntrinsicScenario(scenario, companyCurrency) {
  const issues = { errors: [], warnings: [] };
  const expectedCurrency = normalizeCurrency(companyCurrency || scenario?.currency);

  if (!scenario) {
    issues.errors.push('escenario faltante');
    return issues;
  }

  addFieldIssue(issues, 'FCF normalizado', scenario.normalizedFcf, expectedCurrency, FINANCIAL_UNITS, 'money');
  addFieldIssue(issues, 'caja', scenario.cash, expectedCurrency, FINANCIAL_UNITS, 'money');
  addFieldIssue(issues, 'deuda', scenario.debt, expectedCurrency, FINANCIAL_UNITS, 'money');
  addFieldIssue(issues, 'acciones diluidas', scenario.dilutedShares, expectedCurrency, SHARE_UNITS, 'shares');
  addFieldIssue(issues, 'WACC', scenario.wacc, expectedCurrency, { percent: 1 }, 'ratio');
  addFieldIssue(issues, 'crecimiento terminal', scenario.terminalGrowth, expectedCurrency, { percent: 1 }, 'ratio');

  if (!Array.isArray(scenario.growthRates) || scenario.growthRates.length !== 5) {
    issues.errors.push('proyecciones de crecimiento: deben existir 5 anos');
  } else {
    scenario.growthRates.forEach((growth, index) => {
      addFieldIssue(issues, `crecimiento ano ${index + 1}`, growth, expectedCurrency, { percent: 1 }, 'ratio');
    });
  }

  const shares = fieldValue(scenario.dilutedShares);
  const wacc = fieldValue(scenario.wacc);
  const terminalGrowth = fieldValue(scenario.terminalGrowth);
  const normalizedFcf = fieldValue(scenario.normalizedFcf);

  if (shares !== null && shares <= 0) issues.errors.push('acciones diluidas: deben ser > 0');
  if (wacc !== null && terminalGrowth !== null && wacc <= terminalGrowth) {
    issues.errors.push('WACC debe ser mayor que crecimiento terminal');
  }
  if (wacc !== null && (wacc <= 0 || wacc > 0.5)) issues.errors.push('WACC extremo');
  if (terminalGrowth !== null && (terminalGrowth < -0.05 || terminalGrowth > 0.08)) {
    issues.errors.push('crecimiento terminal extremo');
  }
  if (normalizedFcf !== null && Math.abs(convertField(scenario.normalizedFcf, FINANCIAL_UNITS)) > 1_000_000_000_000) {
    issues.errors.push('FCF normalizado extremo');
  }
  if (shares !== null && convertField(scenario.dilutedShares, SHARE_UNITS) > 100_000_000_000) {
    issues.errors.push('acciones diluidas extremas');
  }
  if (Array.isArray(scenario.growthRates)) {
    scenario.growthRates.forEach((growth, index) => {
      const value = fieldValue(growth);
      if (value !== null && (value < -0.8 || value > 1)) {
        issues.errors.push(`crecimiento ano ${index + 1}: valor extremo`);
      }
    });
  }

  return issues;
}

export function calculateFiveYearDcf(scenario, companyCurrency) {
  const validation = validateIntrinsicScenario(scenario, companyCurrency);
  if (validation.errors.length) {
    return {
      available: false,
      reason: 'no disponible',
      validation,
      enterpriseValue: null,
      equityValue: null,
      valuePerShare: null
    };
  }

  const normalizedFcf = convertField(scenario.normalizedFcf, FINANCIAL_UNITS);
  const cash = convertField(scenario.cash, FINANCIAL_UNITS);
  const debt = convertField(scenario.debt, FINANCIAL_UNITS);
  const dilutedShares = convertField(scenario.dilutedShares, SHARE_UNITS);
  const wacc = Number(scenario.wacc.value);
  const terminalGrowth = Number(scenario.terminalGrowth.value);

  let fcf = normalizedFcf;
  const projectedFcfs = scenario.growthRates.map((growth, index) => {
    fcf *= 1 + Number(growth.value);
    const presentValue = fcf / ((1 + wacc) ** (index + 1));
    return { year: index + 1, fcf, presentValue, growth: Number(growth.value) };
  });

  const yearFiveFcf = projectedFcfs[4].fcf;
  const terminalValue = yearFiveFcf * (1 + terminalGrowth) / (wacc - terminalGrowth);
  const terminalPresentValue = terminalValue / ((1 + wacc) ** 5);
  const enterpriseValue = projectedFcfs.reduce((sum, item) => sum + item.presentValue, 0) + terminalPresentValue;
  const equityValue = enterpriseValue + cash - debt;
  const valuePerShare = equityValue / dilutedShares;
  const confidence = averageConfidence([
    scenario.normalizedFcf,
    scenario.cash,
    scenario.debt,
    scenario.dilutedShares,
    scenario.wacc,
    scenario.terminalGrowth,
    ...scenario.growthRates
  ]);

  return {
    available: true,
    validation,
    projectedFcfs,
    terminalValue,
    terminalPresentValue,
    enterpriseValue,
    equityValue,
    valuePerShare,
    currency: normalizeCurrency(companyCurrency || scenario.currency),
    confidence,
    updatedAt: scenario.updatedAt || null
  };
}

export function calculateIntrinsicValue(companyData) {
  if (!companyData) {
    return {
      available: false,
      reason: 'no disponible',
      scenarios: {},
      base: null,
      confidence: 0,
      updatedAt: null
    };
  }

  const scenarios = {};
  for (const scenarioName of INTRINSIC_SCENARIOS) {
    scenarios[scenarioName] = calculateFiveYearDcf(
      companyData.scenarios?.[scenarioName],
      companyData.currency
    );
  }

  const availableScenarios = Object.values(scenarios).filter(result => result.available);
  const confidence = availableScenarios.length
    ? averageConfidence(availableScenarios.map(result => ({ value: 0, confidence: result.confidence })))
    : 0;

  return {
    available: availableScenarios.length > 0,
    reason: availableScenarios.length > 0 ? null : 'no disponible',
    scenarios,
    base: scenarios.base?.available ? scenarios.base : null,
    confidence,
    updatedAt: companyData.updatedAt || availableScenarios.map(result => result.updatedAt).filter(Boolean).sort().at(-1) || null,
    currency: normalizeCurrency(companyData.currency)
  };
}

export function calculateMarginOfSafety(price, intrinsicValuePerShare) {
  const currentPrice = Number(price);
  const value = Number(intrinsicValuePerShare);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(value)) return null;
  return (value - currentPrice) / currentPrice;
}

function calculateConstantGrowthValuePerShare(scenario, companyCurrency, annualGrowth) {
  const validation = validateIntrinsicScenario(scenario, companyCurrency);
  if (validation.errors.length || !Number.isFinite(Number(annualGrowth))) return null;

  const normalizedFcf = convertField(scenario.normalizedFcf, FINANCIAL_UNITS);
  const cash = convertField(scenario.cash, FINANCIAL_UNITS);
  const debt = convertField(scenario.debt, FINANCIAL_UNITS);
  const dilutedShares = convertField(scenario.dilutedShares, SHARE_UNITS);
  const wacc = Number(scenario.wacc.value);
  const terminalGrowth = Number(scenario.terminalGrowth.value);

  let fcf = normalizedFcf;
  let enterpriseValue = 0;
  for (let year = 1; year <= 5; year++) {
    fcf *= 1 + annualGrowth;
    enterpriseValue += fcf / ((1 + wacc) ** year);
  }

  const terminalValue = fcf * (1 + terminalGrowth) / (wacc - terminalGrowth);
  enterpriseValue += terminalValue / ((1 + wacc) ** 5);
  return (enterpriseValue + cash - debt) / dilutedShares;
}

export function calculateReverseDcfRequiredGrowth(price, scenario, companyCurrency, options = {}) {
  const targetPrice = Number(price);
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    return { available: false, requiredGrowth: null, reason: 'precio no disponible' };
  }

  const minGrowth = options.minGrowth ?? -0.5;
  const maxGrowth = options.maxGrowth ?? 1;
  let low = minGrowth;
  let high = maxGrowth;
  const lowValue = calculateConstantGrowthValuePerShare(scenario, companyCurrency, low);
  const highValue = calculateConstantGrowthValuePerShare(scenario, companyCurrency, high);

  if (lowValue === null || highValue === null) {
    return { available: false, requiredGrowth: null, reason: 'DCF no disponible' };
  }
  if (targetPrice < lowValue) {
    return { available: true, requiredGrowth: low, bounded: true, reason: 'precio por debajo del rango' };
  }
  if (targetPrice > highValue) {
    return { available: true, requiredGrowth: high, bounded: true, reason: 'precio por encima del rango' };
  }

  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    const midValue = calculateConstantGrowthValuePerShare(scenario, companyCurrency, mid);
    if (midValue === null) break;
    if (midValue < targetPrice) low = mid;
    else high = mid;
  }

  return {
    available: true,
    requiredGrowth: (low + high) / 2,
    bounded: false,
    reason: null
  };
}

export function calculatePeterLynchSignal({ pe, growthRate, dividendYield = 0 }) {
  const currentPe = Number(pe);
  const growth = Number(growthRate);
  const dividend = Number(dividendYield) || 0;
  const growthPercent = (growth + dividend) * 100;
  if (!Number.isFinite(currentPe) || currentPe <= 0 || !Number.isFinite(growthPercent) || growthPercent <= 0) {
    return { available: false, ratio: null, label: 'no disponible', reason: 'datos insuficientes' };
  }

  const ratio = currentPe / growthPercent;
  let label = 'Muy exigente';
  if (ratio < 1) label = 'Atractiva';
  else if (ratio < 1.5) label = 'Razonable';
  else if (ratio < 2) label = 'Exigente';

  return {
    available: true,
    ratio,
    label,
    growthRate: growth,
    dividendYield: dividend
  };
}

export function calculateDcaIntrinsicAdjustment(originalAmount, currentPrice, intrinsicResult, config = {}) {
  const resolvedConfig = { ...DEFAULT_DCA_INTRINSIC_CONFIG, ...config };
  const amount = Number(originalAmount) || 0;
  const maxAmount = Number.isFinite(Number(resolvedConfig.maxAmount)) ? Number(resolvedConfig.maxAmount) : null;
  const baseScenario = intrinsicResult?.scenarios?.[resolvedConfig.baseScenario];
  const baseValue = baseScenario?.valuePerShare;
  const marginOfSafety = calculateMarginOfSafety(currentPrice, baseValue);

  const excludedReasons = [];
  if (!resolvedConfig.enabled) excludedReasons.push('factor desactivado');
  if (amount <= 0) excludedReasons.push('sin compra base');
  if (!baseScenario?.available || marginOfSafety === null) excludedReasons.push('valor intrinseco no disponible');
  if ((intrinsicResult?.confidence || 0) < resolvedConfig.minConfidence) excludedReasons.push('confianza baja');

  if (excludedReasons.length) {
    return {
      originalAmount: amount,
      adjustedAmount: amount,
      multiplier: 1,
      marginOfSafety,
      applied: false,
      simulationMode: resolvedConfig.simulationMode,
      explanation: `Valor intrinseco excluido: ${excludedReasons.join(', ')}.`
    };
  }

  const rawMultiplier = 1 + marginOfSafety * resolvedConfig.weight;
  const multiplier = Math.min(resolvedConfig.maxMultiplier, Math.max(resolvedConfig.minMultiplier, rawMultiplier));
  const uncappedAdjustedAmount = amount * multiplier;
  const cappedAdjustedAmount = maxAmount === null ? uncappedAdjustedAmount : Math.min(uncappedAdjustedAmount, maxAmount);
  const adjustedAmount = resolvedConfig.simulationMode ? amount : cappedAdjustedAmount;
  const cappedByRisk = cappedAdjustedAmount < uncappedAdjustedAmount;

  return {
    originalAmount: amount,
    adjustedAmount,
    simulatedAdjustedAmount: cappedAdjustedAmount,
    multiplier,
    marginOfSafety,
    applied: !resolvedConfig.simulationMode,
    simulationMode: resolvedConfig.simulationMode,
    explanation: resolvedConfig.simulationMode
      ? `Simulacion: margen base ${(marginOfSafety * 100).toFixed(1)}%, multiplicador x${multiplier.toFixed(2)}${cappedByRisk ? ', limitado por peso objetivo' : ''}.`
      : `Aplicado: margen base ${(marginOfSafety * 100).toFixed(1)}%, multiplicador x${multiplier.toFixed(2)}${cappedByRisk ? ', limitado por peso objetivo' : ''}.`
  };
}
