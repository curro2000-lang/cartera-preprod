export const UNIDAD_BASE = 200;

export const API_SHEET_URL = "https://script.google.com/macros/s/AKfycbyHgwnLEPaClzySrV3-7PNJVi5xlcVpksuzeJneUSBLDniMCXrD8ePIWlJmHT49uvmr/exec";

export const WATCHLIST = [
  { ticker: "CB", nombre: "Chubb", condicion: "RSI ~30", moneda: "$" },
  { ticker: "NEE", nombre: "NextEra Energy", condicion: "Entrada $75-80", moneda: "$" },
  { ticker: "SU", nombre: "Suncor Energy", condicion: "RSI < 35", moneda: "$" },
  { ticker: "BRYN.DE", nombre: "Berkshire", condicion: "RSI < 35", moneda: "€" },
  { ticker: "BKNG", nombre: "Booking", condicion: "RSI ~30", moneda: "$" },
  { ticker: "IONQ", nombre: "IONQ", condicion: "RSI ~30", moneda: "$" },
  { ticker: "XOM", nombre: "Exxon Mobil", condicion: "RSI < 35", moneda: "$" },
  { ticker: "TTE", nombre: "TotalEnergies", condicion: "RSI < 35", moneda: "$" },
  { ticker: "MSTR", nombre: "Microstrategy", condicion: "RSI ~30", moneda: "$" },
  { ticker: "MU", nombre: "Micron", condicion: "RSI ~30", moneda: "$" },
  { ticker: "NU", nombre: "Nu Holdings", condicion: "RSI ~30", moneda: "$" }
];

export function formatEUR(value) {
  return `€${(Number(value) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function nativeCurrencyToEUR(value, moneda, usdEurRate) {
  const numeric = Number(value) || 0;
  return moneda === '$' ? numeric * usdEurRate : numeric;
}

export function largestExposure(exposures) {
  return Object.entries(exposures).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
}

export function evaluateReviewBlockers(pos, context = {}) {
  const blockers = [];
  const warnings = [];
  const estadoCongelada = (pos.congelada || '').toString().trim().toUpperCase();
  const sector = (pos.sector || '').toString().toLowerCase();
  const pesoActual = Number(context.pesoActual) || 0;
  const pesoSugerido = Number(pos.pesoSugerido) || 0;
  const sectorWeight = Number(context.sectorWeight) || 0;
  const rsiD = Number(pos.rsiD) || 0;
  const rsiW = Number(pos.rsiW) || 0;

  if (estadoCongelada === 'SÍ' || estadoCongelada === 'SI') {
    blockers.push('Posición congelada');
  }
  if (pesoSugerido > 0 && pesoActual > pesoSugerido + 1.5) {
    blockers.push('Sobrepeso vs objetivo');
  }
  if (sectorWeight >= 45 && ['tecnologia', 'semiconductores', 'fintech', 'software'].includes(sector.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
    warnings.push('Sector growth/tech agregado elevado');
  }
  if (rsiD > 70 || rsiW > 70) {
    warnings.push('RSI sobrecomprado');
  }
  if (!pos.per || Number(pos.per) <= 0) {
    warnings.push('Valoración incompleta');
  }

  return {
    blocked: blockers.length > 0,
    blockers,
    warnings,
    label: blockers.length ? 'BLOQUEADA' : (warnings.length ? 'REVISAR CON CAUTELA' : 'APTA PARA REVISIÓN')
  };
}
