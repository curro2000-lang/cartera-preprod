const INTERNAL_ASSUMPTION_SOURCE = 'Supuesto explicito interno pendiente de revision';

function money(value, currency, source, confidence = 0.85) {
  return { value, unit: 'millions', currency, source, confidence };
}

function shares(value, source, confidence = 0.85) {
  return { value, unit: 'millions', source, confidence };
}

function ratio(value, source = INTERNAL_ASSUMPTION_SOURCE, confidence = 0.6) {
  return { value, unit: 'percent', source, confidence };
}

function growthRates(values) {
  return values.map(value => ratio(value));
}

function makeScenario({ currency, source, fcf, cash, debt, dilutedShares, wacc, terminalGrowth, growth, normalizationNote }) {
  return {
    normalizedFcf: money(fcf, currency, source),
    cash: money(cash, currency, source),
    debt: money(debt, currency, source),
    dilutedShares: shares(dilutedShares, source),
    wacc: ratio(wacc),
    terminalGrowth: ratio(terminalGrowth),
    growthRates: growthRates(growth),
    normalizationNote
  };
}

function makeCompany({ ticker, currency, updatedAt, source, reportedFcf, cash, debt, dilutedShares, scenarios }) {
  return {
    ticker,
    currency,
    statementUpdatedAt: updatedAt,
    modelUpdatedAt: '2026-07-16',
    updatedAt,
    scenarios: {
      conservative: makeScenario({
        currency,
        source,
        fcf: scenarios.conservative.fcf,
        cash,
        debt,
        dilutedShares,
        ...scenarios.conservative
      }),
      base: makeScenario({
        currency,
        source,
        fcf: scenarios.base.fcf,
        cash,
        debt,
        dilutedShares,
        ...scenarios.base
      }),
      optimistic: makeScenario({
        currency,
        source,
        fcf: scenarios.optimistic.fcf,
        cash,
        debt,
        dilutedShares,
        ...scenarios.optimistic
      })
    },
    reportedFcf
  };
}

export const intrinsicValueByTicker = {
  'MSF.DE': makeCompany({
    ticker: 'MSF.DE',
    currency: 'USD',
    updatedAt: '2025-07-30',
    source: 'Microsoft FY2025 Form 10-K SEC XBRL para caja, deuda y acciones. FCF normalizado interno: FCF FY2025 reportado 71,611m ajustado por capex extraordinario de IA',
    reportedFcf: 71611,
    cash: 30242,
    debt: 43151,
    dilutedShares: 7465,
    scenarios: {
      conservative: { fcf: 78000, wacc: 0.095, terminalGrowth: 0.02, growth: [0.03, 0.03, 0.025, 0.025, 0.02], normalizationNote: 'FCF normalizado ligeramente sobre reportado por capex IA no recurrente en su totalidad.' },
      base: { fcf: 90000, wacc: 0.085, terminalGrowth: 0.025, growth: [0.06, 0.055, 0.05, 0.045, 0.04], normalizationNote: 'FCF normalizado asume que parte del capex IA es inversion de crecimiento, no mantenimiento.' },
      optimistic: { fcf: 105000, wacc: 0.08, terminalGrowth: 0.03, growth: [0.09, 0.08, 0.07, 0.06, 0.05], normalizationNote: 'FCF normalizado alto; depende de retorno claro de capex IA.' }
    }
  }),

  'ABEA.DE': makeCompany({
    ticker: 'ABEA.DE',
    currency: 'USD',
    updatedAt: '2026-02-05',
    source: 'Alphabet FY2025 Form 10-K SEC XBRL para caja, deuda y acciones. FCF normalizado interno: FCF FY2025 reportado 73,266m ajustado por capex extraordinario de IA',
    reportedFcf: 73266,
    cash: 30708,
    debt: 48543,
    dilutedShares: 12230,
    scenarios: {
      conservative: { fcf: 82000, wacc: 0.095, terminalGrowth: 0.02, growth: [0.02, 0.02, 0.02, 0.02, 0.02], normalizationNote: 'FCF normalizado conservador sobre reportado por capex IA elevado.' },
      base: { fcf: 95000, wacc: 0.085, terminalGrowth: 0.025, growth: [0.05, 0.05, 0.045, 0.04, 0.035], normalizationNote: 'FCF normalizado asume capex de crecimiento parcialmente recuperable.' },
      optimistic: { fcf: 112000, wacc: 0.08, terminalGrowth: 0.03, growth: [0.08, 0.075, 0.065, 0.055, 0.045], normalizationNote: 'FCF normalizado alto; requiere monetizacion fuerte de IA y cloud.' }
    }
  }),

  'AMZ.DE': makeCompany({
    ticker: 'AMZ.DE',
    currency: 'USD',
    updatedAt: '2026-02-06',
    source: 'Amazon FY2025 Form 10-K SEC XBRL para caja, deuda y acciones. FCF reportado 7,695m = operating cash flow 139,514m - productive assets/capex 131,819m; FCF normalizado interno por capex extraordinario de AWS/IA/logistica',
    reportedFcf: 7695,
    cash: 86810,
    debt: 68836,
    dilutedShares: 10827,
    scenarios: {
      conservative: { fcf: 30000, wacc: 0.105, terminalGrowth: 0.02, growth: [0.05, 0.05, 0.045, 0.04, 0.035], normalizationNote: 'FCF normalizado prudente; reconoce capex de crecimiento pero no lo elimina completamente.' },
      base: { fcf: 45000, wacc: 0.095, terminalGrowth: 0.025, growth: [0.08, 0.075, 0.065, 0.055, 0.045], normalizationNote: 'FCF normalizado asume que una parte relevante del capex AWS/IA/logistica es inversion de crecimiento.' },
      optimistic: { fcf: 65000, wacc: 0.085, terminalGrowth: 0.03, growth: [0.12, 0.105, 0.09, 0.075, 0.06], normalizationNote: 'FCF normalizado alto; depende de monetizacion fuerte de AWS/IA y eficiencia operativa.' }
    }
  }),

  'RMS.PA': makeCompany({
    ticker: 'RMS.PA',
    currency: 'EUR',
    updatedAt: '2026-03-19',
    source: 'Hermes 2025 key figures / Universal Registration Document: adjusted free cash flow 3,880m; restated net cash position 12,773m used as net cash proxy; shares outstanding 105.569m',
    reportedFcf: 3880,
    cash: 12773,
    debt: 0,
    dilutedShares: 105.569,
    scenarios: {
      conservative: { fcf: 3600, wacc: 0.085, terminalGrowth: 0.02, growth: [0.025, 0.025, 0.025, 0.025, 0.02], normalizationNote: 'FCF normalizado por debajo del ajustado para reflejar ciclo de lujo mas moderado.' },
      base: { fcf: 3900, wacc: 0.075, terminalGrowth: 0.025, growth: [0.045, 0.045, 0.04, 0.035, 0.03], normalizationNote: 'FCF cercano al ajustado reportado; asume resiliencia de marca y crecimiento gradual.' },
      optimistic: { fcf: 4300, wacc: 0.07, terminalGrowth: 0.03, growth: [0.065, 0.06, 0.055, 0.045, 0.04], normalizationNote: 'FCF normalizado alto; requiere recuperacion sostenida del lujo y pricing power.' }
    }
  }),

  'ADYEN.AS': makeCompany({
    ticker: 'ADYEN.AS',
    currency: 'EUR',
    updatedAt: '2026-03-05',
    source: 'Adyen FY2025 Annual Report/iXBRL: FCF = operating cash flow 1,030.4m - PPE capex 123.7m; own cash proxy = cash 10,797.4m - merchant/financial institution payables 6,371.8m; lease liabilities 183.3m; diluted shares derived from net income 1,062.5m / diluted EPS 33.61',
    reportedFcf: 906.8,
    cash: 4425.6,
    debt: 183.3,
    dilutedShares: 31.613,
    scenarios: {
      conservative: { fcf: 850, wacc: 0.105, terminalGrowth: 0.02, growth: [0.08, 0.075, 0.065, 0.055, 0.045], normalizationNote: 'FCF conservador; excluye lectura agresiva de caja por fondos de merchants.' },
      base: { fcf: 1000, wacc: 0.095, terminalGrowth: 0.025, growth: [0.13, 0.12, 0.105, 0.09, 0.075], normalizationNote: 'FCF normalizado asume escalabilidad de plataforma y crecimiento rentable.' },
      optimistic: { fcf: 1200, wacc: 0.085, terminalGrowth: 0.03, growth: [0.18, 0.16, 0.135, 0.11, 0.09], normalizationNote: 'FCF normalizado alto; exige crecimiento fuerte de volumen y apalancamiento operativo.' }
    }
  }),

  'ASML.AS': makeCompany({
    ticker: 'ASML.AS',
    currency: 'EUR',
    updatedAt: '2026-02-25',
    source: 'ASML FY2025 Form 20-F SEC XBRL para caja, deuda y acciones. FCF normalizado interno: FCF FY2025 reportado 11,084.9m ajustado por ciclo de pedidos semiconductores',
    reportedFcf: 11084.9,
    cash: 12916,
    debt: 4390.9,
    dilutedShares: 388.9,
    scenarios: {
      conservative: { fcf: 11500, wacc: 0.105, terminalGrowth: 0.02, growth: [0.01, 0.02, 0.03, 0.035, 0.035], normalizationNote: 'FCF cercano a reportado; ciclo de semis tratado con prudencia.' },
      base: { fcf: 13500, wacc: 0.095, terminalGrowth: 0.025, growth: [0.04, 0.055, 0.065, 0.06, 0.05], normalizationNote: 'FCF normalizado por fortaleza de backlog y ciclo AI, no por extrapolacion plena.' },
      optimistic: { fcf: 16000, wacc: 0.085, terminalGrowth: 0.03, growth: [0.08, 0.09, 0.085, 0.075, 0.06], normalizationNote: 'FCF normalizado alto; exige ciclo semis favorable y demanda EUV sostenida.' }
    }
  }),

  NKE: makeCompany({
    ticker: 'NKE',
    currency: 'USD',
    updatedAt: '2026-07-15',
    source: 'Nike FY2026 Form 10-K SEC XBRL para caja, deuda y acciones. FCF normalizado interno: FCF FY2026 reportado 2,184m ajustado por reestructuracion',
    reportedFcf: 2184,
    cash: 7563,
    debt: 7942,
    dilutedShares: 1481,
    scenarios: {
      conservative: { fcf: 2400, wacc: 0.105, terminalGrowth: 0.015, growth: [-0.03, 0, 0.015, 0.02, 0.02], normalizationNote: 'FCF apenas normalizado por reestructuracion todavia incierta.' },
      base: { fcf: 3200, wacc: 0.095, terminalGrowth: 0.02, growth: [0, 0.025, 0.035, 0.04, 0.035], normalizationNote: 'FCF normalizado asume recuperacion parcial de margen y working capital.' },
      optimistic: { fcf: 4200, wacc: 0.085, terminalGrowth: 0.025, growth: [0.03, 0.05, 0.055, 0.05, 0.045], normalizationNote: 'FCF normalizado alto; depende de giro operativo claro.' }
    }
  }),

  MCD: makeCompany({
    ticker: 'MCD',
    currency: 'USD',
    updatedAt: '2026-02-24',
    source: 'McDonalds FY2025 Form 10-K SEC XBRL para caja, deuda y acciones. FCF normalizado interno: FCF FY2025 reportado 7,186m ajustado por capex de crecimiento',
    reportedFcf: 7186,
    cash: 774,
    debt: 40698,
    dilutedShares: 716.4,
    scenarios: {
      conservative: { fcf: 7200, wacc: 0.085, terminalGrowth: 0.015, growth: [0.015, 0.015, 0.02, 0.02, 0.02], normalizationNote: 'FCF practicamente reportado por estabilidad del modelo.' },
      base: { fcf: 7800, wacc: 0.075, terminalGrowth: 0.02, growth: [0.035, 0.035, 0.035, 0.03, 0.03], normalizationNote: 'FCF normalizado moderado por capex de crecimiento y franquicias.' },
      optimistic: { fcf: 8500, wacc: 0.07, terminalGrowth: 0.025, growth: [0.05, 0.05, 0.045, 0.04, 0.035], normalizationNote: 'FCF normalizado alto pero acotado por deuda elevada.' }
    }
  }),

  NOC: makeCompany({
    ticker: 'NOC',
    currency: 'USD',
    updatedAt: '2026-01-27',
    source: 'Northrop Grumman FY2025 Form 10-K SEC XBRL: FCF = operating cash flow 4,757m - capex 1,450m; cash, debt and diluted shares from same filing',
    reportedFcf: 3307,
    cash: 4403,
    debt: 15696,
    dilutedShares: 143.8,
    scenarios: {
      conservative: { fcf: 3200, wacc: 0.085, terminalGrowth: 0.015, growth: [0.015, 0.02, 0.02, 0.02, 0.02], normalizationNote: 'FCF cercano a reportado; escenario defensivo por contratos largos y deuda relevante.' },
      base: { fcf: 3500, wacc: 0.075, terminalGrowth: 0.02, growth: [0.035, 0.035, 0.035, 0.03, 0.03], normalizationNote: 'FCF normalizado moderado por visibilidad de defensa y backlog.' },
      optimistic: { fcf: 4000, wacc: 0.07, terminalGrowth: 0.025, growth: [0.05, 0.05, 0.045, 0.04, 0.035], normalizationNote: 'FCF normalizado alto; exige expansion de margen y ejecucion solida en programas clave.' }
    }
  }),

  TSM: makeCompany({
    ticker: 'TSM',
    currency: 'USD',
    updatedAt: '2026-04-17',
    source: 'TSMC FY2025 Form 20-F / Annual Report: FCF = operating cash flow US$72,521m - capex approx. US$40,560m; cash plus current marketable securities US$97,820m; long-term debt US$32,929m; 25,932.5m common shares converted to ADS-equivalent shares using 1 ADS = 5 common shares',
    reportedFcf: 31960,
    cash: 97820,
    debt: 32929,
    dilutedShares: 5186.505,
    scenarios: {
      conservative: { fcf: 30000, wacc: 0.105, terminalGrowth: 0.02, growth: [0.06, 0.055, 0.05, 0.045, 0.04], normalizationNote: 'FCF conservador por capex elevado y ciclo de semiconductores.' },
      base: { fcf: 36000, wacc: 0.095, terminalGrowth: 0.025, growth: [0.12, 0.105, 0.09, 0.075, 0.06], normalizationNote: 'FCF normalizado asume demanda AI/HPC robusta y disciplina de retorno sobre capex.' },
      optimistic: { fcf: 43000, wacc: 0.085, terminalGrowth: 0.03, growth: [0.18, 0.16, 0.135, 0.11, 0.085], normalizationNote: 'FCF normalizado alto; requiere ciclo AI muy favorable y margen sostenido.' }
    }
  }),

  'ITX.MC': makeCompany({
    ticker: 'ITX.MC',
    currency: 'EUR',
    updatedAt: '2026-03-11',
    source: 'Inditex Annual Report 2025: free cash flow 4,686m; net financial cash 10,958m used as net cash proxy; share capital represented by 3,116.652m shares',
    reportedFcf: 4686,
    cash: 10958,
    debt: 0,
    dilutedShares: 3116.652,
    scenarios: {
      conservative: { fcf: 4300, wacc: 0.085, terminalGrowth: 0.015, growth: [0.015, 0.02, 0.02, 0.02, 0.02], normalizationNote: 'FCF conservador por ciclo retail y divisa.' },
      base: { fcf: 4700, wacc: 0.075, terminalGrowth: 0.02, growth: [0.035, 0.035, 0.035, 0.03, 0.03], normalizationNote: 'FCF cercano al reportado; asume continuidad del modelo operativo y caja neta.' },
      optimistic: { fcf: 5200, wacc: 0.07, terminalGrowth: 0.025, growth: [0.055, 0.05, 0.045, 0.04, 0.035], normalizationNote: 'FCF normalizado alto; exige crecimiento internacional y margen estable.' }
    }
  }),

  'MTX.DE': makeCompany({
    ticker: 'MTX.DE',
    currency: 'EUR',
    updatedAt: '2026-02-24',
    source: 'MTU Aero Engines FY2025 key figures / Annual Report: free cash flow 378m; cash 1,256m; net financial debt 1,136m converted to gross debt proxy 2,392m; diluted shares approximated from net income 1,028m / EPS 18.90',
    reportedFcf: 378,
    cash: 1256,
    debt: 2392,
    dilutedShares: 54.392,
    scenarios: {
      conservative: { fcf: 360, wacc: 0.095, terminalGrowth: 0.015, growth: [0.025, 0.025, 0.025, 0.025, 0.02], normalizationNote: 'FCF conservador por riesgo GTF y ciclo aeroespacial.' },
      base: { fcf: 430, wacc: 0.085, terminalGrowth: 0.02, growth: [0.06, 0.055, 0.05, 0.045, 0.04], normalizationNote: 'FCF normalizado asume mejora de cash conversion y demanda de mantenimiento.' },
      optimistic: { fcf: 520, wacc: 0.08, terminalGrowth: 0.025, growth: [0.085, 0.075, 0.065, 0.055, 0.045], normalizationNote: 'FCF normalizado alto; requiere ejecucion fuerte y menor presion de programas problemáticos.' }
    }
  })
};
