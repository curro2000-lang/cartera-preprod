# cartera-preprod

Entorno de preproducción de la app de cartera.

- URL objetivo: `https://curro2000-lang.github.io/cartera-preprod/`
- App watch-only: no trading, no brokers, no ejecución de órdenes.
- Fuente de cartera: Google Apps Script configurado en `strategy.js`.
- Mercado: intenta Yahoo vía proxy resiliente y cae a fallback Sheet si falla.

Este repo existe para probar cambios con calma antes de migrarlos a producción.
