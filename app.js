import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    UNIDAD_BASE,
    API_SHEET_URL,
    WATCHLIST,
    formatEUR,
    nativeCurrencyToEUR,
    largestExposure,
    evaluateReviewBlockers
} from "./strategy.js";

let API_KEY = localStorage.getItem('GEMINI_KEY') || '';
let genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

document.getElementById('configure-ai-btn')?.addEventListener('click', () => {
    const key = prompt('Introduce tu API Key de Gemini para activar informes IA en este navegador. Déjalo vacío para desactivar.');
    if (key && key.trim()) {
        API_KEY = key.trim();
        localStorage.setItem('GEMINI_KEY', API_KEY);
        genAI = new GoogleGenerativeAI(API_KEY);
        alert('IA activada en este navegador.');
    } else {
        API_KEY = '';
        genAI = null;
        localStorage.removeItem('GEMINI_KEY');
        alert('IA desactivada en este navegador.');
    }
});

// Recuperar máximos históricos guardados
let persistence = JSON.parse(localStorage.getItem('CARTERA_MAXIMOS')) || {};
const marketCache = new Map();
let usdEurRateCache = null;

async function fetchYahooChart(ticker, interval = '1d', range = '6mo') {
    const cacheKey = `${ticker}|${interval}|${range}`;
    if (marketCache.has(cacheKey)) return marketCache.get(cacheKey);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
    const attempts = [
        async () => {
            const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
            if (!res.ok) throw new Error(`corsproxy ${res.status}`);
            return res.json();
        },
        async () => {
            const res = await fetch(`https://r.jina.ai/http://r.jina.ai/http://${url}`);
            if (!res.ok) throw new Error(`jina ${res.status}`);
            const text = await res.text();
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) throw new Error('jina response without JSON payload');
            return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
        }
    ];

    let lastError;
    for (const attempt of attempts) {
        try {
            const data = await attempt();
            if (!data?.chart?.result?.[0]) throw new Error('Yahoo response without chart result');
            marketCache.set(cacheKey, data);
            return data;
        } catch (error) {
            lastError = error;
        }
    }

    throw new Error(`Yahoo fetch failed ${ticker}: ${lastError?.message || 'unknown error'}`);
}

async function getUsdEurRate() {
    if (usdEurRateCache) return usdEurRateCache;
    try {
        const data = await fetchYahooChart('EURUSD=X', '1d', '5d');
        const eurUsd = data.chart.result[0].meta.regularMarketPrice;
        usdEurRateCache = eurUsd ? 1 / eurUsd : 0.92;
    } catch (e) {
        console.warn('No se pudo obtener EURUSD=X; usando fallback FX.', e);
        usdEurRateCache = 0.92;
    }
    return usdEurRateCache;
}

window.solicitarExplicacionIA = async function(ticker, d, intentos = 0) {
    // 1. Buscamos el contenedor global único que has puesto fuera de la tabla
    const el = document.getElementById("contenedor-informe-global");
    if (!el) return;

    // Hacemos visible el contenedor por si estaba oculto al cargar la página
    el.style.display = "block";
    if (!genAI) {
        el.innerHTML = `<p class="ia-report-p">IA no configurada. El dashboard funciona igualmente; pulsa <strong>IA opcional</strong> si quieres activar informes generados en este navegador.</p>`;
        el.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    el.innerHTML = `<p class="ia-report-p">Generando informe estratégico extendido para <strong>${ticker}</strong> con Gemini...</p>`;

    // Hacemos un scroll suave automático hacia el contenedor para que el usuario vea que está cargando
    el.scrollIntoView({ behavior: 'smooth' });

    try {
        // Usamos el modelo oficial existente
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        // Captura la fecha real de tu ordenador/navegador
        const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric' };
        const fechaHoy = new Date().toLocaleDateString('es-ES', opcionesFecha);
        let promptFinal = "";

        if (d.esCartera) {
            promptFinal = `Actúa como un gestor de patrimonio y analista técnico senior experto en la estrategia "Buy the Dip". Realiza un informe detallado, extenso y profundamente razonado para ${ticker}.
        
        DATOS TÉCNICOS Y PATRIMONIALES:
        - Fecha de hoy (Obligatoria para el informe): ${fechaHoy}
        - Precio Actual: ${d.actual}
        - PER Actual (Ratio de Valoración): ${d.per}
        - Soporte Técnico (Mínimo 6M): ${d.min6M}
        - Precio de Entrada (Media): ${d.entrada}
        - Resistencia (Máximo): ${d.max}
        - RSI Diario: ${d.rsiD} | RSI Semanal: ${d.rsiW}
        - Retroceso desde Máximo: ${d.dip}%
        - Fase Estratégica: ${d.fase}
        - Es Cartera: ${d.esCartera} 
        - Peso Actual: ${d.pesoActual}%
        - Peso Objetivo (Ideal): ${d.pesoSugerido}%
        - Peso Proyectado POST-COMPRA (Dato JS): ${d.pesoPost}%
        - Margen de Tolerancia Admitido: 1%
        - Rol Estratégico: ${d.rol}
        - Aportación Base Propuesta: ${d.sugerencia}€
        - Valor Total Cartera Global: ${d.totalCartera}€

        INSTRUCCIONES DE FORMATO OBLIGATORIAS:
        - Si incluyes una fecha en el encabezado o cuerpo del informe, utiliza única y exclusivamente la fecha provista en los datos: ${fechaHoy}. Está prohibido usar el año 2023 o cualquier otra fecha pasada.
        - Usa siempre la coma (,) para los decimales y el punto (.) para los miles en las cifras monetarias finales.
        - Estructura el informe usando estrictamente los títulos numerados "1. EVALUACIÓN...", "2. MOMENTUM...", "3. ASIGNACIÓN..." y "4. CONCLUSIÓN...". No alteres esta nomenclatura.

        INSTRUCCIONES DE ANÁLISIS EXTENDIDO (Desarrolla cada sección en párrafos separados y profundos):
        
        1. EVALUACIÓN DE SOPORTE Y CONTEXTO TÉCNICO: 
           - Compara detalladamente el Precio Actual con el Soporte Técnico (${d.min6M}) para dictaminar si es una "ZONA DE SUELO" robusta o hay riesgo de capitulación.
           - Cruza la situación con tu Precio de Entrada medio (${d.entrada}) y evalúa la magnitud del ajuste en base al retroceso del ${d.dip}% desde su Máximo (${d.max}).
           - CRÍTICO: Utiliza el PER Actual (${d.per}) para evaluar si la caída del precio representa un abaratamiento real de las acciones o si es una trampa de valor (si el PER es inusualmente alto para su sector).
        
        2. MOMENTUM Y REGLA TEMPORAL (RSI):
           - Realiza un análisis cruzado del RSI Diario con el RSI Semanal. Determina si la estructura alcista estructural de fondo (Semanal) sigue saludable y justifica absorber la volatilidad reflejada en el gráfico diario.
        
        3. ASIGNACIÓN, ROL E IMPORTE A REVISAR (FILTRO DE RIESGO POST-APORTE):
           Contextualiza la posición con su Rol "${d.rol}" frente al entorno macro de tipos. Evalúa el impacto de un posible aporte comparando el Peso Objetivo (${d.pesoSugerido}%) con el Peso Actual (${d.pesoActual}%) y el Peso Proyectado post-aporte (${d.pesoPost}%). Emite una recomendación watch-only aplicando estrictamente esta escala de reglas exclusivas:
           
           - REGLA 4.1 (Sobreponderación previa): Si (Peso Actual - Peso Objetivo) > 1% -> SEÑAL: MANTENER EN OBSERVACIÓN. Argumenta que el riesgo de concentración patrimonial es excesivo y no recomienda aportar capital nuevo.
           
           - REGLA 4.2 (Margen de Tolerancia Actual): Si (Peso Actual - Peso Objetivo) está entre 0.1% y 1% -> SEÑAL: APORTE REDUCIDO A REVISAR. Recomienda mitigar el riesgo valorando solo la mitad de la aportación (${d.sugerencia / 2}€) para aprovechar el soporte sin desviar el peso ideal.
           
           - REGLA 4.3 (Exceso Proyectado / Pasarse de frenada): Si Peso Actual <= Peso Objetivo, pero el Peso Proyectado (${d.pesoPost}%) supera al Objetivo en más de un 1% -> SEÑAL: APORTE AJUSTADO A REVISAR. Advierte explícitamente que la aportación completa descuadrará la cartera debido a su tamaño actual (${d.totalCartera}€). Sugiere reducir el capital a la mitad (${d.sugerencia / 2}€) o a un importe inferior exacto para optimizar el encaje.
           
           - REGLA 4.4 (Aporte candidato óptimo): Si Peso Actual <= Peso Objetivo y el Peso Proyectado (${d.pesoPost}%) se mantiene dentro de los márgenes tolerados -> SEÑAL: CANDIDATO A REVISAR. Valida que los ${d.sugerencia}€ completos encajan con el peso, justificando si la Fase Estratégica (${d.fase}) ofrece un timing razonable para promediar.
        
        4. CONCLUSIÓN WATCH-ONLY:
           - Concluye con un veredicto de revisión, no como orden operativa. Especifica la acción sugerida y el importe máximo a considerar, dejando claro que requiere validación humana antes de operar.
        
        Redacta un informe ejecutivo formal, puramente técnico y de extensión libre. Desarrolla tus argumentos al máximo sin limitaciones de líneas.`;
        } else {
            promptFinal = `Analiza la oportunidad en WATCHLIST para ${ticker}.
            - Precio Actual: ${d.actual}
            - Soporte 6M: ${d.min6M}
            - RSI Diario: ${d.rsiD} | RSI Semanal: ${d.rsiW}
            - Peso Objetivo: ${d.pesoSugerido}%
            - Sugerencia: ${d.sugerencia}€
            
            TAREA: Ignora pesos de cartera. Analiza puramente el MARKET TIMING. 
            ¿Está el precio cerca del suelo de 6 meses (${d.min6M})? 
            ¿El RSI indica que el cuchillo ha dejado de caer? 
            Recomienda si merece entrar en revisión para abrir posición con hasta ${d.sugerencia}€, sin formularlo como orden de compra.
            
            Respuesta técnica y de extensión libre. Desarrolla tus argumentos al máximo sin limitaciones de líneas.`;
        }

        const result = await model.generateContent(promptFinal);
        let textoIA = result.response.text();

        // Formateamos el Markdown de la IA a HTML limpio
        textoIA = textoIA
            .replace(/\n\n/g, '</p><p class="ia-report-p">') 
            .replace(/\n/g, '<br>')                          
            .replace(/\*\*(.*?)\*\"/g, '<strong>$1</strong>') 
            .replace(/(\d\.\s[^<:\n]+:)/g, '<div class="ia-report-header">$1</div>'); 

        // Inyectamos el resultado final con un título que indica qué ticker se está analizando
        el.innerHTML = `
            <h2 style="margin-top:0; color: #00ff88; font-size: 1.3rem; border-bottom: 1px solid #333; padding-bottom: 10px;">
                Informe Watch-only: ${ticker}
            </h2>
            <p class="ia-report-p">${textoIA}</p>
        `;

    } catch (e) {
        console.error(e);
        if (e.message && e.message.includes('503') && intentos < 2) {
            setTimeout(() => solicitarExplicacionIA(ticker, d, intentos+1), 2000);
        } else {
            el.innerHTML = "<p class='ia-report-p' style='color: #ff5555;'>Error al conectar con el analista. Inténtalo de nuevo.</p>";
        }
    }
};

function calculateRSI(prices) {
    if (prices.length < 15) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i < 15; i++) {
        let diff = prices[i] - prices[i-1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgG = gains / 14, avgL = losses / 14;
    for (let i = 15; i < prices.length; i++) {
        let diff = prices[i] - prices[i-1];
        avgG = (avgG * 13 + (diff > 0 ? diff : 0)) / 14;
        avgL = (avgL * 13 + (diff < 0 ? -diff : 0)) / 14;
    }
    return 100 - (100 / (1 + avgG / (avgL || 1)));
}

async function fetchData(ticker, fallback = null) {

    try {

        const data = await fetchYahooChart(ticker, '1d', '6mo');

        const quotes = data.chart.result[0].indicators.quote[0].close.filter(p => p != null);

        const price = data.chart.result[0].meta.regularMarketPrice;

        const weekly = quotes.filter((_, i) => i % 5 === 0);

        return {
            price,
            quotes,
            min6M: Math.min(...quotes),
            max6M: Math.max(...quotes),
            rsiD: calculateRSI(quotes),
            rsiW: calculateRSI(weekly),
            source: 'live'
        };

    } catch (error) {
        console.warn(`No se pudo obtener Yahoo para ${ticker}; usando fallback de Sheet si existe.`, error);
        if (!fallback) return null;

        const entrada = parseFloat(fallback.entrada) || 0;
        const maximo = parseFloat(fallback.maximoAlcanzado) || entrada || 0;
        const price = maximo || entrada;
        const min6M = Math.min(entrada || price, maximo || price, price || 0);
        const max6M = Math.max(entrada || price, maximo || price, price || 0);

        return {
            price,
            quotes: [price],
            min6M,
            max6M,
            rsiD: 50,
            rsiW: 50,
            source: 'sheet-fallback'
        };
    }

} 

function updateRiskCards(posiciones, sectorExposure, currencyExposure, usdEurRate) {
    const [topSector, topSectorWeight] = largestExposure(sectorExposure);
    const [topCurrency, topCurrencyWeight] = largestExposure(currencyExposure);
    const top3Weight = posiciones
        .map(pos => (pos.valorActualCalculado || 0))
        .sort((a, b) => b - a)
        .slice(0, 3)
        .reduce((sum, value) => sum + value, 0);
    const total = posiciones.reduce((sum, pos) => sum + (pos.valorActualCalculado || 0), 0);
    const top3Pct = total > 0 ? (top3Weight / total * 100) : 0;

    document.getElementById('top-sector').innerText = `${topSectorWeight.toFixed(0)}%`;
    document.getElementById('top-sector-note').innerText = topSector;
    document.getElementById('top-currency').innerText = `${topCurrencyWeight.toFixed(0)}%`;
    document.getElementById('fx-rate-note').innerText = `${topCurrency} · USD/EUR ${usdEurRate.toFixed(3)}`;
    document.getElementById('top3-weight').innerText = `${top3Pct.toFixed(0)}%`;
}



    async function loadWatchlist() {
    const body = document.getElementById('watchlist-body');
    if (!body) return;
    
    body.innerHTML = '<tr><td colspan="6">Consultando vigilancia...</td></tr>';
    let rows = '';

    for (const item of WATCHLIST) {
    const data = await fetchData(item.ticker);
    if (!data) continue;

    const max6M = data.max6M;
    const dip6M = ((data.price - max6M) / max6M * 100); // Valor numérico para la lógica
    const safeId = item.ticker.replace(/[^a-zA-Z0-9]/g, '-');

    // LÓGICA VISUAL DE COLORES
    let dipColor = 'var(--muted)';
    let dipText = 'Estable';

    if (dip6M <= -20) {
        dipColor = 'var(--green)'; // Color Oportunidad
        dipText = 'OPORTUNIDAD (DIP >20%)';
    } else if (dip6M <= -10) {
        dipColor = 'var(--amber)'; // Color Aviso
        dipText = 'AVISO (CORRECCIÓN >10%)';
    }
    const min6M = data.min6M;
    const min6M_val = isNaN(min6M) ? 0 : min6M.toFixed(2); // Seguridad: si no es número, pone 0
    const esCartera = false;
    console.log(min6M_val)
    rows += `
        <tr class="clickable" onclick="window.solicitarExplicacionIA('${item.ticker}', {
                actual: ${data.price}, 
                min6M: ${min6M_val},
                max: ${max6M.toFixed(2)}, 
                pesoSugerido: 0, 
                rol: 'Watchlist',
                dip: ${dip6M.toFixed(1)}, 
                rsiD: ${data.rsiD.toFixed(0)},
                rsiW: ${data.rsiW.toFixed(0)},
                fase: 'Watchlist', 
                esCartera: false,
                sugerencia: 200
            })">
            <td><b class="ticker">${item.ticker}</b><br><small>${item.nombre}</small></td>
            <td class="right"><b>${data.price.toFixed(2)}${item.moneda}</b></td>
            <td class="right">${data.rsiD.toFixed(0)} | ${data.rsiW.toFixed(0)}</td>
            <td>${item.condicion}</td>
            <td style="color:${dipColor}; font-weight:bold">
                ${dip6M.toFixed(1)}% <br>
                <small style="font-size:9px">${dipText}</small>
            </td>
            
        </tr>`;
}
    body.innerHTML = rows;
}

async function loadDashboard() {
    const btn = document.getElementById('refresh-btn');
    btn.disabled = true;
    
    const body = document.getElementById('portfolio-body');
    body.innerHTML = '<tr><td colspan="10">Calculando pesos de cartera...</td></tr>';

    let totalI = 0, totalV = 0, dipsActivos = 0;
    const sectorExposure = {};
    const currencyExposure = {};
    
    const BASE_INVEST = typeof UNIDAD_BASE !== 'undefined' ? UNIDAD_BASE : 200;

    try {
        const usdEurRate = await getUsdEurRate();
        const response = await fetch(API_SHEET_URL);
        const miCartera = await response.json();

        // --- PASO 1: PRE-CÁLCULO DEL VALOR TOTAL ---
        const posicionesProcesadas = [];
        
        for (const pos of miCartera) {
            const data = await fetchData(pos.tickerApp, pos);
            if (!data) continue;

            const accionesNum = parseFloat(pos.numAcciones) || 0;
            const valorActualPosicionNative = accionesNum * data.price;
            const valorActualPosicionEUR = nativeCurrencyToEUR(valorActualPosicionNative, pos.moneda, usdEurRate);
            const capitalEUR = nativeCurrencyToEUR(parseFloat(pos.capital) || 0, pos.moneda, usdEurRate);
            
            totalV += valorActualPosicionEUR;
            totalI += capitalEUR;

            posicionesProcesadas.push({ ...pos, ...data, valorActualCalculado: valorActualPosicionEUR, valorActualNativo: valorActualPosicionNative, capitalEUR });
        }

        posicionesProcesadas.forEach(pos => {
            const pesoActual = (pos.valorActualCalculado / totalV * 100) || 0;
            const sectorKey = pos.sector || 'Sin sector';
            const currencyKey = pos.moneda || 'N/A';
            sectorExposure[sectorKey] = (sectorExposure[sectorKey] || 0) + pesoActual;
            currencyExposure[currencyKey] = (currencyExposure[currencyKey] || 0) + pesoActual;
        });

        // --- PASO 2: GENERAR LAS FILAS HTML ---
        let rows = '';
        for (const pos of posicionesProcesadas) {
            const entradaNum = parseFloat(pos.entrada) || 0;
            const maximoNum = parseFloat(pos.maximoAlcanzado) || 0;
            const rendTotal = (pos.price - entradaNum) / (entradaNum || 1);
            const dipDesdeMax = (pos.price - maximoNum) / (maximoNum || 1);
            
            const perEmpresa = pos.per ? parseFloat(pos.per).toFixed(1) : "N/A";
            
            const pesoSugerido = parseFloat(pos.pesoSugerido) || 0;
            const pesoActual = (pos.valorActualCalculado / totalV * 100) || 0;
            const desviacion = (pesoActual - pesoSugerido).toFixed(1);
            const sectorKey = pos.sector || 'Sin sector';

            let colorDesviacion = desviacion < 0 ? 'var(--green)' : 'var(--amber)';
            if (Math.abs(desviacion) < 1) colorDesviacion = 'var(--muted)'; 
            
            const columnaPorcentaje = `
            <td style="text-align: center; vertical-align: middle;">
                <div style="font-size: 1.1rem; font-weight: bold;">${pesoActual.toFixed(1)}%</div>
                <div style="font-size: 0.75rem; margin-top: 2px;">
                    <span style="color: var(--muted);">Ideal:</span> 
                    <span style="font-weight: 600;">${pesoSugerido}%</span>
                </div>
                <div style="font-size: 0.7rem; color: ${colorDesviacion}; font-weight: bold; margin-top: 1px;">
                    (${desviacion > 0 ? '+' : ''}${desviacion}%)
                </div>
            </td>
            `;

            // 1. EVALUACIÓN ESTRUCTURAL ORIGINAL (Se mantiene intacta de fondo)
            let faseOriginalId = 1;
            let faseOriginalText = "Fase 1: Seguimiento";
            const estadoCongelada = pos.congelada ? pos.congelada.toString().trim().toUpperCase() : "";
            const beneficioMaximoHistorico = (maximoNum - entradaNum) / (entradaNum || 1);
            
            if (estadoCongelada === "SÍ" || estadoCongelada === "SI") {
                faseOriginalId = 4; 
                faseOriginalText = "Fase 4: Congelada";
            } else if (rendTotal < -0.05) {
                faseOriginalId = 3; 
                faseOriginalText = "Fase 3: Promediar Baja";
            } else if (beneficioMaximoHistorico >= 0.12 && dipDesdeMax <= -0.075 && rendTotal > 0) { 
                faseOriginalId = 2; 
                faseOriginalText = "Fase 2: Promediar Alza";
            }

            // 2. CÁLCULO DE LA SEÑAL TÁCTICA (MEDIDA 4)
            let badgeId = faseOriginalId; 
            let badgeText = faseOriginalText; // Por defecto, si no hay señal, el badge muestra la fase
            
            if (faseOriginalId !== 4 && pesoActual < pesoSugerido) {
                const rsiD = pos.rsiD || 0; 
                const dipPorcentaje = dipDesdeMax * 100;
                
                const sectorLimpio = (pos.sector || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const esTecnologicaO_Growth = ["tecnologia", "semiconductores", "fintech", "software"].includes(sectorLimpio);

                if (esTecnologicaO_Growth) {
                    if (dipPorcentaje <= -4.0 || rsiD <= 45) {
                        badgeId = "growth-buy"; 
                        badgeText = "REVISAR APORTE (GROWTH)";
                    }
                } else {
                    if (dipPorcentaje <= -8.0 || rsiD <= 35) {
                        badgeId = "support-buy"; 
                        badgeText = "REVISAR SOPORTE";
                    }
                }
            } else if (faseOriginalId !== 4 && pesoActual > (pesoSugerido + 1.5)) {
                badgeId = "excess-hold";
                badgeText = "EXCESO (OBSERVAR)";
            }

            const reviewStatus = evaluateReviewBlockers(
                { ...pos, rsiD: pos.rsiD, rsiW: pos.rsiW },
                { pesoActual, sectorWeight: sectorExposure[sectorKey] || 0 }
            );

            if (reviewStatus.blocked) {
                badgeId = "blocked-review";
                badgeText = "BLOQUEADA";
            }

            // 3. CONTADOR DE DIPS ALINEADO AL 100%
            // Si la estructura está en Fase 2 o 3, O si saltó una señal activa táctica de compra, sumamos al contador superior
            if (!reviewStatus.blocked && (faseOriginalId === 2 || faseOriginalId === 3 || badgeId === "growth-buy" || badgeId === "support-buy")) {
                dipsActivos++;
            }

            // 4. CÁLCULO QUIRÚRGICO DE ASIGNACIÓN MONETARIA
            let importeSugerido = 0;
            if (!reviewStatus.blocked && (faseOriginalId === 2 || faseOriginalId === 3 || badgeId === "growth-buy" || badgeId === "support-buy")) {
                const carteraTotalSegura = parseFloat(totalV) || 0;
                const valorActualPosicionSeguro = parseFloat(pos.valorActualCalculado) || 0; 
                
                if (carteraTotalSegura > 0) {
                    const dineroParaObjetivo = ((pesoSugerido / 100) * carteraTotalSegura) - valorActualPosicionSeguro;
                    
                    if (!isNaN(dineroParaObjetivo) && dineroParaObjetivo > 0) {
                        if (faseOriginalId === 3 && rendTotal < -0.10) {
                            importeSugerido = Math.min(dineroParaObjetivo, BASE_INVEST * 1.5);
                        } else {
                            importeSugerido = Math.min(dineroParaObjetivo, BASE_INVEST);
                        }
                        if (importeSugerido < 5) importeSugerido = 0;
                    }
                }
            }
            importeSugerido = parseFloat(importeSugerido.toFixed(2)) || 0;

            // Acoplamos el dinero sugerido directamente al texto del Badge principal si procede
            let badgeTextFinal = badgeText;
            if (importeSugerido > 0 && (badgeId === 2 || badgeId === 3 || badgeId === "growth-buy" || badgeId === "support-buy")) {
                badgeTextFinal = `${badgeText} [+${importeSugerido.toLocaleString('es-ES', {minimumFractionDigits: 2})}€]`;
            }

            // 5. MAQUETACIÓN DE LA NUEVA CELDA MULTI-INFORME DE FASE Y SEÑAL
            // Si el badge muestra una señal táctica, añadimos abajo el texto de la fase original para no perder el dato de rendimiento.
            let celdaFaseHTML = '';
            const reviewNotes = [...reviewStatus.blockers, ...reviewStatus.warnings]
                .slice(0, 2)
                .map(note => `<div style="font-size: 0.68rem; color: var(--muted); padding-left: 4px;">• ${note}</div>`)
                .join('');

            if (badgeId === "growth-buy" || badgeId === "support-buy" || badgeId === "excess-hold" || badgeId === "blocked-review") {
                celdaFaseHTML = `
                    <div style="margin-bottom: 3px;"><span class="fase-badge fase-${badgeId}">${badgeTextFinal}</span></div>
                    <div style="font-size: 0.72rem; color: var(--muted); padding-left: 4px; font-weight: 500;">Estructural: ${faseOriginalText}</div>
                    ${reviewNotes}
                `;
            } else {
                // Si no hay alerta de mercado, se muestra simplemente el badge original limpio
                celdaFaseHTML = `<div><span class="fase-badge fase-${badgeId}">${badgeTextFinal}</span></div>${reviewNotes}`;
            }

            // Proyecciones de balance post-operación e IA
            const nuevoValorPosicion = (pos.valorActualCalculado || 0) + importeSugerido;
            const nuevoTotalCartera = totalV + importeSugerido;
            const pesoPostCompra = (nuevoValorPosicion / nuevoTotalCartera * 100).toFixed(1);
            
            const rsiD = pos.rsiD || 0; 
            const rsiW = pos.rsiW || 0;
            const colorRSID = rsiD < 35 ? 'var(--dip-opportunity)' : (rsiD > 70 ? 'var(--phase-3)' : 'inherit');
            const colorRSIW = rsiW < 35 ? 'var(--dip-opportunity)' : (rsiW > 70 ? 'var(--phase-3)' : 'inherit');

            const min6M_real = pos.min6M || 0;
            const min6M_val = isNaN(min6M_real) ? 0 : min6M_real.toFixed(2);

            const pesoActualCalculado = (pos.valorActualCalculado / totalV * 100).toFixed(1);
            
            // RENDERIZADO FINAL DE LA FILA HTML
            rows += `
                <tr class="clickable" onclick="window.solicitarExplicacionIA('${pos.tickerApp}', {
                    actual: ${pos.price}, 
                    entrada: ${entradaNum},
                    per: '${perEmpresa}',
                    pesoActual: ${pesoActualCalculado},
                    totalCartera: ${totalV.toFixed(2)},
                    pesoPost: ${pesoPostCompra},
                    min6M: ${min6M_val}, 
                    pesoSugerido: ${pesoSugerido}, 
                    rol: '${pos.perfilRiesgo || "Estrategia General"}',
                    max: ${maximoNum}, 
                    dip: ${(dipDesdeMax*100).toFixed(1)}, 
                    rsiD: ${rsiD.toFixed(0)},
                    rsiW: ${rsiW.toFixed(0)}, 
                    fase: '${badgeText} (${faseOriginalText})', 
                    sector: '${pos.sector || "N/A"}',
                    esCartera: true, 
                    sugerencia: ${importeSugerido}
                })">
                    <td>
                        <div class="ticker">${pos.tickerApp}</div>
                        <div style="font-size:10px; color:var(--muted)">${pos.nombre}</div>
                    </td>
                    <td class="right">
                        ${formatEUR(pos.capitalEUR)}
                        <div style="font-size:9px; color:var(--muted)">${pos.moneda}${parseFloat(pos.capital).toFixed(2)} origen</div>
                    </td>
                    ${columnaPorcentaje}
                    <td class="right" style="color:var(--accent); font-weight:500; vertical-align: middle; text-align: right;">
                        ${perEmpresa}
                    </td>
                    <td class="right">
                        ${entradaNum.toFixed(2)}
                        <div style="font-size:9px; color:var(--muted)">Máx: ${maximoNum.toFixed(2)}</div>
                    </td>
                   
                    <td class="right"><b>${pos.price.toFixed(2)}</b>${pos.source === 'sheet-fallback' ? '<div style="font-size:9px; color:var(--amber)">fallback</div>' : ''}</td>
                    <td class="center">
                        <span style="color: ${colorRSID}">${rsiD.toFixed(0)}</span> 
                        <small style="color: ${colorRSIW}; opacity: 0.8">(${rsiW.toFixed(0)}w)</small>
                    </td>
                    <td class="right" style="color:${dipDesdeMax <= -0.075 ? 'var(--green)' : 'var(--muted)'}">
                        ${(dipDesdeMax*100).toFixed(1)}%
                    </td>
                    <td class="right">
                        <span class="var-pill ${rendTotal >= 0 ? 'pos' : 'neg'}">${(rendTotal*100).toFixed(1)}%</span>
                    </td>
                    
                    <td style="vertical-align: middle;">
                        ${celdaFaseHTML}
                    </td>
                </tr>`;
        }

        body.innerHTML = rows;
        
        // Sincronización de KPI Cards principales
        document.getElementById('total-invested').innerText = formatEUR(totalI);
        document.getElementById('total-value').innerText = formatEUR(totalV);
        document.getElementById('total-pnl').innerText = formatEUR(totalV - totalI);
        document.getElementById('dip-count').innerText = dipsActivos;
        updateRiskCards(posicionesProcesadas, sectorExposure, currencyExposure, usdEurRate);

        await loadWatchlist();
    } catch (error) {
        console.error("Error crítico en loadDashboard:", error);
        body.innerHTML = '<tr><td colspan="10" style="color:var(--red)">Error al sincronizar datos financieros.</td></tr>';
    } finally {
        btn.disabled = false;
    }
}


        

// --- LÓGICA DE REFRESCO AUTOMÁTICO (Sustituye el final de tu script por esto) ---
let timeLeft = 900; 
let timerInterval;

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 900; 
    
    timerInterval = setInterval(() => {
        timeLeft--;
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        
        const timerSpan = document.getElementById('timer-text');
        if (timerSpan) {
            timerSpan.textContent = `Refresco en ${mins}:${secs.toString().padStart(2, '0')}`;
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            loadDashboard();
        }
    }, 1000);
}

// Sobrescribimos el click del botón para que también reinicie el contador
document.getElementById('refresh-btn').onclick = () => {
    loadDashboard();
};

// Modificamos el final de loadDashboard para que llame a startTimer()
// Busca la función loadDashboard y asegúrate de que al final de todo (tras wRows)
// se incluya la llamada a startTimer(). 
// O simplemente, para no liarte, añade esta ejecución inicial:

loadDashboard().then(() => {
    startTimer();
});
