/* ═══════════════════════════════════════════════════════════════
   Club de Cyclisme de Salouel — weather.js
   Intégration de l'API Open-Meteo (gratuite, pas de clé)
   
   Documentation : https://open-meteo.com/en/docs
   
   API publique :
     CCS_WEATHER.fetch(lat, lng, dateISO?) → Promise<WeatherData>
     CCS_WEATHER.renderInto(container, lat, lng, dateISO?, opts?)
     CCS_WEATHER.symbolFor(wmoCode)  → emoji
     CCS_WEATHER.labelFor(wmoCode)   → libellé FR
   
   Le module gère un cache mémoire de 30 min pour éviter les appels répétés.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const API_BASE = 'https://api.open-meteo.com/v1/forecast';

  // Cache mémoire (clé = "lat,lng,date" arrondi à 3 décimales)
  const CACHE = new Map();
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Code météo WMO (World Meteorological Organization) → emoji + libellé FR
   * Référence : https://open-meteo.com/en/docs (section "Weather variable documentation")
   */
  const WMO_CODES = {
    0:  { symbol: '☀️',  label: 'Ciel dégagé' },
    1:  { symbol: '🌤️',  label: 'Peu nuageux' },
    2:  { symbol: '⛅',  label: 'Partiellement nuageux' },
    3:  { symbol: '☁️',  label: 'Couvert' },
    45: { symbol: '🌫️',  label: 'Brouillard' },
    48: { symbol: '🌫️',  label: 'Brouillard givrant' },
    51: { symbol: '🌦️',  label: 'Bruine légère' },
    53: { symbol: '🌦️',  label: 'Bruine modérée' },
    55: { symbol: '🌦️',  label: 'Bruine dense' },
    56: { symbol: '🌧️',  label: 'Bruine verglaçante' },
    57: { symbol: '🌧️',  label: 'Bruine verglaçante dense' },
    61: { symbol: '🌧️',  label: 'Pluie légère' },
    63: { symbol: '🌧️',  label: 'Pluie modérée' },
    65: { symbol: '🌧️',  label: 'Pluie forte' },
    66: { symbol: '🌧️',  label: 'Pluie verglaçante' },
    67: { symbol: '🌧️',  label: 'Pluie verglaçante forte' },
    71: { symbol: '❄️',  label: 'Neige légère' },
    73: { symbol: '❄️',  label: 'Neige modérée' },
    75: { symbol: '❄️',  label: 'Neige forte' },
    77: { symbol: '❄️',  label: 'Grains de neige' },
    80: { symbol: '🌦️',  label: 'Averses légères' },
    81: { symbol: '🌧️',  label: 'Averses modérées' },
    82: { symbol: '⛈️',  label: 'Averses violentes' },
    85: { symbol: '🌨️',  label: 'Averses de neige' },
    86: { symbol: '🌨️',  label: 'Averses de neige fortes' },
    95: { symbol: '⛈️',  label: 'Orage' },
    96: { symbol: '⛈️',  label: 'Orage avec grêle' },
    99: { symbol: '⛈️',  label: 'Orage violent avec grêle' },
  };

  function symbolFor(code) { return WMO_CODES[code]?.symbol || '❔'; }
  function labelFor(code)  { return WMO_CODES[code]?.label || 'Conditions inconnues'; }

  function _cacheKey(lat, lng, date) {
    const r = (n) => Math.round(n * 1000) / 1000;
    return `${r(lat)},${r(lng)},${date || 'today'}`;
  }

  /**
   * Récupère la météo pour un point et une date donnée.
   * 
   * @param {number} lat       Latitude
   * @param {number} lng       Longitude
   * @param {string} [dateISO] Date au format YYYY-MM-DD. Si omise → aujourd'hui (current).
   *                           Si dans le futur (jusqu'à 16 jours) → forecast.
   *                           Si dans le passé → "archive" (≤ 5 ans).
   * @returns {Promise<WeatherData>}
   *   { current: {temp, windKmh, windDir, weatherCode, humidity, ...},
   *     daily: {tempMin, tempMax, precipMm, weatherCode, ...},
   *     hourly: [{ time, temp, weatherCode, precipMm, windKmh }, ...] }
   */
  async function fetchWeather(lat, lng, dateISO = null) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new Error('lat/lng requis');
    }

    // Cache hit ?
    const key = _cacheKey(lat, lng, dateISO);
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data;
    }

    // Construire l'URL — différent si forecast ou archive
    const today = new Date().toISOString().slice(0, 10);
    const isPast = dateISO && dateISO < today;

    let url;
    if (isPast) {
      // Archive (réel observé)
      url = 'https://archive-api.open-meteo.com/v1/archive'
          + '?latitude=' + lat.toFixed(4)
          + '&longitude=' + lng.toFixed(4)
          + '&start_date=' + dateISO + '&end_date=' + dateISO
          + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max'
          + '&hourly=temperature_2m,weather_code,precipitation,wind_speed_10m'
          + '&timezone=auto';
    } else {
      // Forecast (jusqu'à 16 j) — toujours inclure current pour temps présent
      const params = [
        'latitude=' + lat.toFixed(4),
        'longitude=' + lng.toFixed(4),
        'current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,apparent_temperature',
        'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset',
        'hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m',
        'timezone=auto',
      ];
      if (dateISO) {
        params.push('start_date=' + dateISO);
        params.push('end_date=' + dateISO);
      }
      url = API_BASE + '?' + params.join('&');
    }

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error('Open-Meteo HTTP ' + res.status);
      const raw = await res.json();

      const data = _normalize(raw);
      CACHE.set(key, { ts: Date.now(), data });
      return data;
    } catch (err) {
      console.warn('[CCS_WEATHER]', err.message);
      throw err;
    }
  }

  /** Normalise la réponse Open-Meteo en un format simple */
  function _normalize(raw) {
    const out = {
      current: null,
      daily: null,
      hourly: [],
    };

    if (raw.current) {
      out.current = {
        temp:        raw.current.temperature_2m,
        apparent:    raw.current.apparent_temperature,
        windKmh:     raw.current.wind_speed_10m,
        windDir:     raw.current.wind_direction_10m,
        humidity:    raw.current.relative_humidity_2m,
        weatherCode: raw.current.weather_code,
      };
    }

    if (raw.daily?.weather_code?.length) {
      out.daily = {
        weatherCode: raw.daily.weather_code[0],
        tempMin:     raw.daily.temperature_2m_min?.[0],
        tempMax:     raw.daily.temperature_2m_max?.[0],
        precipMm:    raw.daily.precipitation_sum?.[0],
        windMaxKmh:  raw.daily.wind_speed_10m_max?.[0],
        sunrise:     raw.daily.sunrise?.[0],
        sunset:      raw.daily.sunset?.[0],
      };
    }

    if (raw.hourly?.time?.length) {
      for (let i = 0; i < raw.hourly.time.length; i++) {
        out.hourly.push({
          time:        raw.hourly.time[i],
          temp:        raw.hourly.temperature_2m?.[i],
          weatherCode: raw.hourly.weather_code?.[i],
          precipProb:  raw.hourly.precipitation_probability?.[i],
          precipMm:    raw.hourly.precipitation?.[i],
          windKmh:     raw.hourly.wind_speed_10m?.[i],
        });
      }
    }

    return out;
  }

  /**
   * Rendu HTML d'un widget météo dans un conteneur.
   * @param {HTMLElement} container
   * @param {number} lat, lng
   * @param {string} [dateISO] (sinon = aujourd'hui)
   * @param {object} [opts] { compact: bool }
   */
  async function renderInto(container, lat, lng, dateISO = null, opts = {}) {
    if (!container) return;
    container.innerHTML = `<div class="weather-loading"><span class="weather-spinner"></span> Météo en cours…</div>`;

    try {
      const data = await fetchWeather(lat, lng, dateISO);
      const isPast = dateISO && dateISO < new Date().toISOString().slice(0, 10);
      const isFuture = dateISO && dateISO > new Date().toISOString().slice(0, 10);

      // Choisir la source d'affichage : current si présent (aujourd'hui), sinon daily
      let source = data.current;
      let label;

      if (dateISO && data.daily) {
        // Date spécifique → afficher la prévision/observation du jour
        source = {
          temp:    data.daily.tempMax,
          tempMin: data.daily.tempMin,
          tempMax: data.daily.tempMax,
          windKmh: data.daily.windMaxKmh,
          weatherCode: data.daily.weatherCode,
          precipMm: data.daily.precipMm,
        };
        label = isPast ? 'Météo observée' : (isFuture ? 'Prévision' : 'Aujourd\'hui');
      } else {
        label = 'Météo actuelle';
      }

      if (!source) {
        container.innerHTML = `<div class="weather-error">Météo non disponible</div>`;
        return;
      }

      const symbol = symbolFor(source.weatherCode);
      const labelMeteo = labelFor(source.weatherCode);
      const compact = opts.compact;

      if (compact) {
        container.innerHTML = `
          <div class="weather-widget weather-compact">
            <div class="weather-symbol">${symbol}</div>
            <div class="weather-temp">${source.temp != null ? Math.round(source.temp) + '°' : '—'}</div>
            <div class="weather-label">${labelMeteo}</div>
          </div>`;
      } else {
        const tempMinMax = (source.tempMin != null && source.tempMax != null && source.tempMin !== source.tempMax)
          ? `<div class="weather-temp-range">${Math.round(source.tempMin)}° / ${Math.round(source.tempMax)}°</div>` : '';
        const wind = source.windKmh != null
          ? `<div class="weather-meta-item"><span class="weather-meta-icon">💨</span> ${Math.round(source.windKmh)} km/h</div>` : '';
        const precip = source.precipMm > 0
          ? `<div class="weather-meta-item"><span class="weather-meta-icon">💧</span> ${source.precipMm.toFixed(1)} mm</div>` : '';
        const humidity = source.humidity != null
          ? `<div class="weather-meta-item"><span class="weather-meta-icon">🌡️</span> ${source.humidity}% humidité</div>` : '';

        container.innerHTML = `
          <div class="weather-widget">
            <div class="weather-head">
              <span class="weather-head-label">${label}</span>
              ${dateISO ? `<span class="weather-head-date">${_formatDate(dateISO)}</span>` : ''}
            </div>
            <div class="weather-main">
              <div class="weather-symbol">${symbol}</div>
              <div class="weather-info">
                <div class="weather-temp">${source.temp != null ? Math.round(source.temp) + '°' : '—°'}<span class="weather-unit">C</span></div>
                <div class="weather-label">${labelMeteo}</div>
                ${tempMinMax}
              </div>
            </div>
            <div class="weather-meta">
              ${wind}
              ${precip}
              ${humidity}
            </div>
            <div class="weather-source">Source : Open-Meteo · données ouvertes</div>
          </div>`;
      }
    } catch (err) {
      container.innerHTML = `<div class="weather-error">⚠️ Météo indisponible — ${err.message}</div>`;
    }
  }

  function _formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso; }
  }

  // Exporter
  window.CCS_WEATHER = {
    fetch:      fetchWeather,
    renderInto: renderInto,
    symbolFor:  symbolFor,
    labelFor:   labelFor,
  };
})();
