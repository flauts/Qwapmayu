(function () {
  'use strict';

  const MAX_SAMPLES = 40;
  const STALE_THRESHOLD_MS = 30000;
  const STALE_CHECK_INTERVAL_MS = 2000;
  const MAX_EVENTS = 100;
  const MAX_INSPECTOR_ROWS = 1000;
  const MAX_DISCOVERED_TOPICS = 200;
  const MISSING_MARK = '\u2014';

  const GW_SUB_TOPIC = 'qawapmayu/v1/gw/+/+';
  const DEFAULT_MONITOREO_TOPIC = 'qawapmayu/v1/+/+/+/+';
  const LWT_MSG_STORAGE_KEY = 'qawapmayu.lwtMessage';
  const DEFAULT_LWT_MESSAGE = 'Desconexión abrupta detectada (LWT)';

  const QUICK_FILTER_TOPICS = [
    { topic: 'qawapmayu/v1/+/+/+/+', label: 'Todas las estaciones' },
    { topic: 'qawapmayu/v1/barranco/#', label: 'Distrito Barranco' },
    { topic: 'qawapmayu/v1/chorrillos/#', label: 'Distrito Chorrillos' },
    { topic: 'qawapmayu/v1/#', label: 'Todo QawapMayu' },
  ];

  const CHANNEL_DIAG_TOPICS = [
    { topic: 'qawapmayu/v1/+/+/+/telemetria', label: 'Telemetría de estaciones' },
    { topic: 'qawapmayu/v1/+/+/+/estado', label: 'Transiciones de estado FSM' },
    { topic: 'qawapmayu/v1/+/+/+/meta', label: 'Metadatos y coordenadas' },
    { topic: 'qawapmayu/v1/+/+/+/conexion', label: 'Presencia LWT de estaciones' },
    { topic: 'qawapmayu/v1/gw/+/+', label: 'Gateway gw01 (LWT y diagnóstico)' },
  ];

  const VAL_PH = 0x01;
  const VAL_TDS = 0x02;
  const VAL_TURB = 0x04;
  const VAL_TEMP = 0x08;

  const ANO_PH = 0x01;
  const ANO_TDS = 0x02;
  const ANO_TURB = 0x04;

  const DEFAULT_MAP_CENTER = [-12.165, -77.012];
  const DEFAULT_MAP_ZOOM = 12;

  const ACCENT_HEX = '#0f5f73';
  const ACCENT_FILL = 'rgba(15, 95, 115, 0.08)';
  const REF_LINE_COLOR = 'rgba(15, 95, 115, 0.25)';
  const NEGATIVE_HEX = '#c4242a';
  const GRID_RULE_HEX = '#eff2f4';
  const MUTED_HEX = '#5d5f60';

  const VIEW_META = {
    monitoreo: { title: 'Monitoreo' },
    eventos: { title: 'Eventos' },
    inspector: { title: 'Inspector MQTT' },
    conexion: { title: 'Conexión' },
  };

  const METRIC_ORDER = ['ph', 'tds', 'it', 'temp'];
  const METRIC_META = {
    ph: {
      key: 'ph',
      label: 'pH',
      shortLabel: 'pH',
      unit: 'u.pH',
      decimals: 2,
      valBit: VAL_PH,
      anoBit: ANO_PH,
      hint: 'Rango normal 6.5\u20138.5 u.pH',
      kpiHint: 'Rango 6.5\u20138.5',
      suggestedMin: 5.5,
      suggestedMax: 9.5,
      refs: [6.5, 8.5],
    },
    tds: {
      key: 'tds',
      label: 'TDS',
      shortLabel: 'TDS',
      unit: 'mg/L',
      decimals: 0,
      valBit: VAL_TDS,
      anoBit: ANO_TDS,
      hint: 'Sólidos disueltos (delta +100 mg/L)',
      kpiHint: 'Base +100 mg/L',
      suggestedMin: 0,
      suggestedMax: undefined,
      refs: [],
    },
    it: {
      key: 'it',
      label: 'Turbidez (IT)',
      shortLabel: 'IT',
      unit: 'NTU',
      decimals: 3,
      valBit: VAL_TURB,
      anoBit: ANO_TURB,
      hint: 'Máximo esperado 0.200 NTU',
      kpiHint: 'Máx. 0.200',
      suggestedMin: 0,
      suggestedMax: 0.35,
      refs: [0.2],
    },
    temp: {
      key: 'temp',
      label: 'Temperatura',
      shortLabel: 'Temp.',
      unit: '°C',
      decimals: 2,
      valBit: VAL_TEMP,
      anoBit: 0,
      hint: 'Sonda térmica DS18B20',
      kpiHint: 'Sonda térmica',
      suggestedMin: 10,
      suggestedMax: 35,
      refs: [],
    },
  };

  const TIME_HMS_FMT = new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const TIME_HMS_MS_FMT = new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  });

  function getDefaultBrokerUrl() {
    const host = window.location.hostname || 'localhost';
    return 'ws://' + host + ':9001';
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatClockTime(ms) {
    const date = new Date(ms || Date.now());
    return TIME_HMS_FMT.format(date);
  }

  function formatClockWithMs(ms) {
    const date = new Date(ms || Date.now());
    return TIME_HMS_MS_FMT.format(date);
  }

  function formatNumber(val, decimals) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return MISSING_MARK;
    return val.toFixed(decimals);
  }

  function numOrNull(val) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return null;
    return val;
  }

  function parseHostLabel(url) {
    if (!url) return 'localhost:9001';
    try {
      const parsed = new URL(url);
      return parsed.host || url;
    } catch (_err) {
      return url.replace(/^wss?:\/\//, '');
    }
  }

  function isReducedMotion() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function loadLwtCustomMessage() {
    try {
      const saved = window.localStorage.getItem(LWT_MSG_STORAGE_KEY);
      if (typeof saved === 'string' && saved.trim()) {
        return saved.trim();
      }
    } catch (_err) {
      // Ignorar si localStorage no está disponible.
    }
    return DEFAULT_LWT_MESSAGE;
  }

  function saveLwtCustomMessage(rawMsg) {
    const clean = String(rawMsg || '').trim() || DEFAULT_LWT_MESSAGE;
    state.lwtCustomMessage = clean;
    try {
      window.localStorage.setItem(LWT_MSG_STORAGE_KEY, clean);
    } catch (_err) {
      // Ignorar si localStorage no está disponible.
    }
    const inputEl = getEl('lwt-custom-msg-input');
    if (inputEl && inputEl.value !== clean) {
      inputEl.value = clean;
    }
    return clean;
  }

  const state = {
    client: null,
    connected: false,
    connecting: false,
    brokerUrl: getDefaultBrokerUrl(),
    activeView: 'monitoreo',
    monitoreoTopic: DEFAULT_MONITOREO_TOPIC,
    stationCache: new Map(),
    discoveredTopics: new Map(),
    knownStations: new Map(),
    lwtEntities: new Map(),
    gwOnline: null,
    gwId: 'gw01',
    gwLwtRetained: false,
    gwLwtTsMs: null,
    gwDiag: {
      estado: null,
      sordera: false,
      reintentosRx: 0,
      silencioS: 0,
      nodosOffline: 0,
      motivo: '',
      nodo: '',
      tsMs: null,
      retained: false,
    },
    lwtCustomMessage: loadLwtCustomMessage(),
    nodes: new Map(),
    selectedKey: null,
    activeMetric: 'ph',
    chartMode: 'single',
    events: [],
    seenEventKeys: new Set(),
    inspectorClient: null,
    inspectorConnected: false,
    inspectorTopic: 'qawapmayu/v1/#',
    inspectorSubscribedTopic: '',
    inspectorRows: [],
    inspectorPaused: false,
    inspectorPage: 1,
    inspectorPageSize: 25,
    totalMessages: 0,
    retainedMessages: 0,
    lastErrorText: '',
    vendorStatus: {
      mqtt: false,
      leaflet: false,
      chart: false,
      errors: [],
    },
    mapMode: 'none',
    map: null,
    tileLayer: null,
    offlineTilesFailed: false,
    tileFallbackTimerId: null,
    markers: new Map(),
    hasAutoFittedMap: false,
    charts: {
      focus: null,
      ph: null,
      tds: null,
      it: null,
      temp: null,
    },
    staleTimerId: null,
    renderScheduled: false,
    comboboxControllers: [],
  };

  function announce(text) {
    const announcer = getEl('sr-announcer');
    if (!announcer || !text) return;
    announcer.textContent = '';
    window.requestAnimationFrame(() => {
      announcer.textContent = text;
    });
  }

  /* ---------- Vendor Inspection ---------- */

  function checkVendorAvailability() {
    const errors = Array.isArray(window.__qawapVendorErrors) ? window.__qawapVendorErrors : [];
    state.vendorStatus = {
      mqtt: typeof window.mqtt !== 'undefined' && typeof window.mqtt.connect === 'function',
      leaflet: typeof window.L !== 'undefined',
      chart: typeof window.Chart !== 'undefined',
      errors,
    };

    const healthList = getEl('vendor-health-list');
    if (healthList) {
      const items = [
        { name: 'vendor/mqtt.min.js', ok: state.vendorStatus.mqtt },
        { name: 'vendor/leaflet.js', ok: state.vendorStatus.leaflet },
        {
          name: 'vendor/leaflet.css',
          ok: !errors.includes('./vendor/leaflet.css'),
        },
        { name: 'vendor/chart.umd.min.js', ok: state.vendorStatus.chart },
      ];
      healthList.innerHTML = '';
      for (const item of items) {
        const li = createEl('li', 'vendor-item');
        li.appendChild(createEl('code', 'topic-slug', item.name));
        li.appendChild(
          createEl(
            'span',
            item.ok ? 'pill pill--ok' : 'pill pill--warn',
            item.ok ? 'Cargado' : 'Respaldo'
          )
        );
        healthList.appendChild(li);
      }
    }

    const banner = getEl('vendor-banner');
    const bannerText = getEl('vendor-banner-text');
    if (banner && bannerText) {
      const missing = [];
      if (!state.vendorStatus.leaflet) missing.push('Leaflet (mapa SVG activo)');
      if (!state.vendorStatus.chart) missing.push('Chart.js (curvas SVG activas)');
      if (missing.length > 0) {
        bannerText.textContent =
          'No se cargaron ' +
          missing.join(' y ') +
          '; la visualización continúa con respaldo local SVG.';
        banner.hidden = false;
      } else {
        banner.hidden = true;
      }
    }

    if (!state.vendorStatus.mqtt) {
      setConnectionError(
        'Falta ./vendor/mqtt.min.js; el cliente MQTT sobre WebSockets no pudo inicializarse.'
      );
    }
  }

  function setConnectionError(message) {
    state.lastErrorText = message || '';
    const banner = getEl('connection-error-banner');
    const textEl = getEl('connection-error-text');
    if (!banner || !textEl) return;
    if (message) {
      textEl.textContent = message;
      banner.hidden = false;
    } else {
      textEl.textContent = '';
      banner.hidden = true;
    }
  }

  /* ---------- Navigation & Mobile Drawer ---------- */

  function isMobileDrawerViewport() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 860px)').matches;
  }

  function openMobileDrawer() {
    const sidebar = getEl('app-sidebar');
    const toggle = getEl('btn-menu-toggle');
    if (!sidebar || !toggle) return;
    sidebar.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    const closeBtn = getEl('btn-menu-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeMobileDrawer(restoreFocus) {
    const sidebar = getEl('app-sidebar');
    const toggle = getEl('btn-menu-toggle');
    if (!sidebar || !toggle) return;
    const wasOpen = sidebar.classList.contains('open');
    sidebar.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus && wasOpen && isMobileDrawerViewport()) {
      toggle.focus();
    }
  }

  function switchView(viewName) {
    if (!VIEW_META[viewName]) return;
    state.activeView = viewName;

    const pageTitle = getEl('page-title');
    if (pageTitle) pageTitle.textContent = VIEW_META[viewName].title;

    for (const key of Object.keys(VIEW_META)) {
      const section = getEl('view-' + key);
      if (section) section.hidden = key !== viewName;
    }

    const navButtons = document.querySelectorAll('.nav-item[data-view]');
    for (const btn of navButtons) {
      if (btn.dataset.view === viewName) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    }

    closeMobileDrawer(false);

    if (viewName === 'monitoreo') {
      window.requestAnimationFrame(() => {
        if (state.map && state.mapMode === 'leaflet') {
          state.map.invalidateSize();
        }
        renderCharts();
      });
    }
  }

  /* ---------- Topic & FSM Parsing ---------- */

  function parseTopic(topic) {
    const parts = String(topic || '').split('/');
    if (parts[0] !== 'qawapmayu' || parts[1] !== 'v1') return null;
    if (parts.length === 5 && parts[2] === 'gw') {
      return {
        kind: 'gw',
        gwId: parts[3] || 'gw01',
        canal: parts[4] || '',
      };
    }
    if (parts.length === 6) {
      return {
        kind: 'node',
        zona: parts[2],
        sitio: parts[3],
        nodo: parts[4],
        canal: parts[5],
      };
    }
    return null;
  }

  function mqttTopicMatches(filter, topic) {
    if (typeof filter !== 'string' || typeof topic !== 'string' || !filter || !topic) {
      return false;
    }
    if (topic.startsWith('$') && (filter.startsWith('+') || filter.startsWith('#'))) {
      return false;
    }
    const fParts = filter.split('/');
    const tParts = topic.split('/');
    for (let i = 0; i < fParts.length; i += 1) {
      const fSeg = fParts[i];
      if (fSeg === '#') return true;
      if (i >= tParts.length) return false;
      if (fSeg !== '+' && fSeg !== tParts[i]) return false;
    }
    return fParts.length === tParts.length;
  }

  function topicFilterMatchesStation(filterTopic, station) {
    if (!filterTopic || !station) return false;
    const keyParts = typeof station.key === 'string' ? station.key.split('/') : [];
    const zona = keyParts[0] || station.zona;
    const sitio = keyParts[1] || station.sitio;
    const nodo = keyParts[2] || station.nodo;
    if (!zona || !sitio || !nodo) return false;
    const prefix = 'qawapmayu/v1/' + zona + '/' + sitio + '/' + nodo + '/';
    return ['telemetria', 'meta', 'estado', 'conexion', 'enlace', 'evento'].some((canal) =>
      mqttTopicMatches(filterTopic, prefix + canal)
    );
  }

  function makePayloadPreview(payloadStr) {
    const compact = String(payloadStr || '').replace(/\s+/g, ' ').trim();
    if (compact.length <= 44) return compact;
    return compact.slice(0, 41) + '...';
  }

  function recordDiscoveredTopic(topic, payloadStr, isRetained, now) {
    if (!topic) return false;
    const isNew = !state.discoveredTopics.has(topic);
    state.discoveredTopics.set(topic, {
      topic,
      lastSeenMs: now,
      retained: isRetained,
      payloadPreview: makePayloadPreview(payloadStr),
    });
    if (state.discoveredTopics.size > MAX_DISCOVERED_TOPICS) {
      const oldestKey = state.discoveredTopics.keys().next().value;
      if (oldestKey) state.discoveredTopics.delete(oldestKey);
    }

    const parsed = parseTopic(topic);
    if (parsed && parsed.kind === 'node') {
      const stationKey = parsed.zona + '/' + parsed.sitio + '/' + parsed.nodo;
      let known = state.knownStations.get(stationKey);
      if (!known) {
        known = {
          key: stationKey,
          zona: parsed.zona,
          sitio: parsed.sitio,
          nodo: parsed.nodo,
          nombre: parsed.nodo,
          simulado: false,
          hasMeta: false,
        };
        state.knownStations.set(stationKey, known);
      }
      if (parsed.canal === 'meta') {
        try {
          const meta = JSON.parse(payloadStr);
          if (meta && typeof meta === 'object') {
            if (typeof meta.nombre === 'string' && meta.nombre.trim()) {
              known.nombre = meta.nombre.trim();
            }
            if (typeof meta.zona === 'string' && meta.zona.trim()) {
              known.zona = meta.zona.trim();
            }
            if (typeof meta.simulado === 'boolean') {
              known.simulado = meta.simulado;
            }
            known.hasMeta = true;
          }
        } catch (_err) {
          // Ignorar JSON malformado en meta.
        }
      }
    }
    return isNew;
  }

  function normalizeDiagTs(rawTs, fallbackMs) {
    if (typeof rawTs !== 'number' || !Number.isFinite(rawTs) || rawTs <= 0) {
      return fallbackMs;
    }
    if (rawTs > 1e9 && rawTs < 1e12) {
      return Math.round(rawTs * 1000);
    }
    return rawTs;
  }

  function getGwDiagMeta(estado, reintentosRx) {
    switch (estado) {
      case 'escuchando':
        return { label: 'Escuchando', pillClass: 'pill--ok' };
      case 'recuperado':
        return { label: 'Recuperado', pillClass: 'pill--ok' };
      case 'sordera_rearmando':
        return {
          label:
            'Rearmando RAK' +
            (typeof reintentosRx === 'number' && Number.isFinite(reintentosRx)
              ? ' (' + reintentosRx + '/3)'
              : ''),
          pillClass: 'pill--warn',
        };
      case 'nodo_silencio':
        return { label: 'Nodo en silencio', pillClass: 'pill--warn' };
      case 'sordera_reinicio':
        return { label: 'Reinicio sordera', pillClass: 'pill--bad' };
      default:
        return { label: estado || 'Sin diagnóstico', pillClass: 'pill--neutral' };
    }
  }

  function humanizeSorderaMotivo(motivo, diag) {
    const code = String(motivo || '').trim().toLowerCase();
    switch (code) {
      case 'inicio':
        return 'Gateway conectado y escuchando LoRa';
      case 'sin_tramas_lora_rearme_ok':
        return 'Sin tramas LoRa; radio RAK rearmada';
      case 'sin_tramas_lora_rearme_fallo':
        return 'Sin tramas LoRa; falló el rearme del RAK';
      case 'reinicio_por_sordera':
        return '3 fallos RX seguidos; reinicio automático del gateway';
      case 'timeout_lora_nodo':
        return 'Sin tramas LoRa del nodo (>30 s)';
      case 'trama_rx_recuperada':
        return 'Trama LoRa recuperada';
      case 'nodo_reconectado':
        return 'Nodo reconectado por LoRa';
      default: {
        if (code) {
          const readable = String(motivo).trim().replace(/_/g, ' ');
          return readable.charAt(0).toUpperCase() + readable.slice(1);
        }
        const d = diag || {};
        return buildDefaultDiagReason(
          d.estado,
          d.silencioS || 0,
          d.reintentosRx || 0,
          d.nodo || ''
        );
      }
    }
  }

  function buildDefaultDiagReason(estado, silencioS, reintentosRx, nodo) {
    switch (estado) {
      case 'sordera_rearmando':
        return (
          'Sin tramas LoRa (' +
          silencioS +
          ' s), rearmando RX (' +
          reintentosRx +
          '/3)'
        );
      case 'sordera_reinicio':
        return 'Reinicio ESP32 tras ' + (reintentosRx || 3) + ' fallos de RX';
      case 'nodo_silencio':
        return (
          'Silencio del nodo ' +
          (nodo || 'Hardware') +
          (silencioS > 0 ? ' (' + silencioS + ' s)' : '')
        );
      case 'recuperado':
        return 'Recepción LoRa recuperada' + (nodo ? ' (' + nodo + ')' : '');
      default:
        return 'Gateway escuchando tramas LoRa';
    }
  }

  function stripQuotes(text) {
    return String(text || '')
      .trim()
      .replace(/^["']|["']$/g, '');
  }

  function normalizeFsm(raw) {
    if (typeof raw !== 'string') return null;
    const clean = raw.trim().toUpperCase();
    return clean || null;
  }

  function getOrCreateNode(zona, sitio, nodo) {
    const key = zona + '/' + sitio + '/' + nodo;
    let node = state.nodes.get(key);
    if (!node) {
      node = state.stationCache.get(key);
      if (!node) {
        node = {
          key,
          zona,
          sitio,
          nodo,
          nombre: nodo,
          lat: null,
          lon: null,
          simulado: false,
          conexion: null,
          conexionRetained: false,
          conexionTsMs: null,
          estado: null,
          hasTelemetry: false,
          ph: null,
          tds: null,
          it: null,
          temp: null,
          validez: 0,
          anomalias: 0,
          rssi: null,
          snr: null,
          pdr: null,
          seq: null,
          boot: null,
          lastTelemetryTs: 0,
          lastLiveTelemetryRxMs: 0,
          lastMsgRxMs: 0,
          history: [],
        };
      }
      state.nodes.set(key, node);
    }
    state.stationCache.set(key, node);
    return node;
  }

  function isNodeStale(node, now) {
    if (!node.hasTelemetry) return false;
    if (node.lastTelemetryTs > 0) {
      return now - node.lastTelemetryTs > STALE_THRESHOLD_MS;
    }
    if (node.lastLiveTelemetryRxMs > 0) {
      return now - node.lastLiveTelemetryRxMs > STALE_THRESHOLD_MS;
    }
    return true;
  }

  function isNodeOnline(node, now) {
    return node.conexion !== 'fuera_de_linea' && node.hasTelemetry && !isNodeStale(node, now);
  }

  function getNodeBadgeInfo(node, now) {
    if (node.conexion === 'fuera_de_linea') {
      return { text: 'Fuera de línea', pillClass: 'pill--bad', pinClass: 'offline' };
    }
    if (isNodeStale(node, now)) {
      return { text: 'Inactivo', pillClass: 'pill--neutral', pinClass: 'offline' };
    }
    switch (node.estado) {
      case 'ARMADO':
        return { text: 'ARMADO', pillClass: 'pill--ok', pinClass: 'armado' };
      case 'MUESTREANDO':
        return { text: 'MUESTREANDO', pillClass: 'pill--accent', pinClass: 'muestreando' };
      case 'CAPTURA_ESTIMADA':
        return { text: 'CAPTURA_ESTIMADA', pillClass: 'pill--warn', pinClass: 'captura' };
      case 'BLOQUEADO':
        return { text: 'BLOQUEADO', pillClass: 'pill--bad', pinClass: 'bloqueado' };
      case 'FALLO':
        return { text: 'FALLO', pillClass: 'pill--bad', pinClass: 'fallo' };
      default:
        return {
          text: node.hasTelemetry ? 'Activo' : 'Esperando datos',
          pillClass: 'pill--neutral',
          pinClass: 'offline',
        };
    }
  }

  function formatRelativeAge(node, now) {
    if (!node.hasTelemetry) return MISSING_MARK;
    const ref = node.lastTelemetryTs > 0 ? node.lastTelemetryTs : node.lastLiveTelemetryRxMs;
    if (!ref) return 'Retenido';
    const diffSec = Math.max(0, Math.floor((now - ref) / 1000));
    if (diffSec < 60) return diffSec + ' s';
    if (diffSec < 3600) return Math.floor(diffSec / 60) + ' min';
    return Math.floor(diffSec / 3600) + ' h';
  }

  function describeAnomalias(mask) {
    const flags = [];
    if (mask & ANO_PH) flags.push('pH fuera de rango');
    if (mask & ANO_TDS) flags.push('salto de TDS');
    if (mask & ANO_TURB) flags.push('turbidez alta');
    return flags;
  }

  function recordEvent(dedupeKey, entry) {
    if (dedupeKey && state.seenEventKeys.has(dedupeKey)) return;
    if (dedupeKey) {
      state.seenEventKeys.add(dedupeKey);
      if (state.seenEventKeys.size > MAX_EVENTS * 4) {
        state.seenEventKeys.clear();
      }
    }
    state.events.unshift(entry);
    if (state.events.length > MAX_EVENTS) {
      state.events.length = MAX_EVENTS;
    }
  }

  function handleFsmUpdate(node, rawEstado, anomalias, allowOverwrite, tsMs) {
    const nextState = normalizeFsm(rawEstado);
    if (!nextState) return;
    const prevState = node.estado;
    if (allowOverwrite || !node.estado) {
      node.estado = nextState;
    }
    if (prevState && prevState !== nextState && allowOverwrite) {
      const flags = describeAnomalias(anomalias);
      const detail =
        prevState +
        ' -> ' +
        nextState +
        (flags.length > 0 ? ' (' + flags.join(', ') + ')' : '');
      const pill = getNodeBadgeInfo(node, Date.now());
      recordEvent('fsm:' + node.key + ':' + prevState + ':' + nextState + ':' + tsMs, {
        ts: tsMs || Date.now(),
        station: node.nombre || node.key,
        slug: node.key,
        badgeText: nextState,
        pillClass: pill.pillClass,
        detail,
      });
      if (nextState === 'MUESTREANDO' || nextState === 'FALLO' || nextState === 'BLOQUEADO') {
        announce((node.nombre || node.key) + ': ' + detail);
      }
    }
  }

  function handleMessage(topic, payloadBuffer, packet) {
    const now = Date.now();
    const isRetained = Boolean(packet && packet.retain);
    const payloadStr = payloadBuffer ? payloadBuffer.toString() : '';

    state.totalMessages += 1;
    if (isRetained) state.retainedMessages += 1;

    recordDiscoveredTopic(topic, payloadStr, isRetained, now);

    const parsed = parseTopic(topic);
    if (!parsed) {
      scheduleRender();
      return;
    }

    if (parsed.kind === 'gw') {
      state.gwId = parsed.gwId;
      if (parsed.canal === 'conexion') {
        const clean = stripQuotes(payloadStr).toLowerCase();
        const prevGw = state.gwOnline;
        if (clean === 'en_linea' || clean === 'fuera_de_linea') {
          state.gwOnline = clean === 'en_linea';
          state.gwLwtRetained = isRetained;
          state.gwLwtTsMs = now;
          state.lwtEntities.set(topic, {
            key: 'gw/' + state.gwId,
            kind: 'gw',
            id: state.gwId,
            label: 'Gateway ' + state.gwId,
            topic,
            payload: clean,
            online: state.gwOnline,
            retained: isRetained,
            tsMs: now,
            simulado: false,
          });
          if (
            (prevGw !== null && prevGw !== state.gwOnline) ||
            (prevGw === null && !isRetained && !state.gwOnline)
          ) {
            recordEvent('gw:' + state.gwId + ':' + clean + ':' + now, {
              ts: now,
              station: 'Gateway ' + state.gwId,
              slug: 'gw/' + state.gwId,
              badgeText: state.gwOnline ? 'En línea' : 'Fuera de línea',
              pillClass: state.gwOnline ? 'pill--ok' : 'pill--bad',
              detail: state.gwOnline
                ? 'Gateway LoRa conectado al broker'
                : state.lwtCustomMessage + ' (gw/' + state.gwId + ')',
            });
            announce(
              state.gwOnline
                ? 'Gateway ' + state.gwId + ' en línea'
                : 'Gateway ' + state.gwId + ' fuera de línea'
            );
          }
        }
      } else if (parsed.canal === 'diagnostico') {
        let diagData = null;
        try {
          diagData = JSON.parse(payloadStr);
        } catch (_err) {
          diagData = null;
        }
        if (diagData && typeof diagData === 'object') {
          const rawEstado =
            typeof diagData.estado === 'string'
              ? diagData.estado.trim().toLowerCase()
              : null;
          const reintentosRx =
            typeof diagData.reintentos_rx === 'number' && Number.isFinite(diagData.reintentos_rx)
              ? diagData.reintentos_rx
              : 0;
          const silencioS =
            typeof diagData.silencio_s === 'number' && Number.isFinite(diagData.silencio_s)
              ? diagData.silencio_s
              : 0;
          const nodosOffline =
            typeof diagData.nodos_offline === 'number' && Number.isFinite(diagData.nodos_offline)
              ? diagData.nodos_offline
              : 0;
          const motivo = typeof diagData.motivo === 'string' ? diagData.motivo.trim() : '';
          const nodo = typeof diagData.nodo === 'string' ? diagData.nodo.trim() : '';
          const sordera =
            typeof diagData.sordera === 'boolean'
              ? diagData.sordera
              : rawEstado === 'sordera_rearmando' || rawEstado === 'sordera_reinicio';
          const tsMs = normalizeDiagTs(diagData.ts, now);

          state.gwDiag = {
            estado: rawEstado,
            sordera,
            reintentosRx,
            silencioS,
            nodosOffline,
            motivo,
            nodo,
            tsMs,
            retained: isRetained,
          };

          if (
            rawEstado === 'sordera_rearmando' ||
            rawEstado === 'sordera_reinicio' ||
            rawEstado === 'nodo_silencio' ||
            rawEstado === 'recuperado'
          ) {
            const diagMeta = getGwDiagMeta(rawEstado, reintentosRx);
            const humanMotivo = humanizeSorderaMotivo(motivo, {
              estado: rawEstado,
              reintentosRx,
              silencioS,
              nodo,
            });
            const detail =
              rawEstado === 'nodo_silencio' && nodo && !humanMotivo.includes(nodo)
                ? humanMotivo + ' · ' + nodo
                : humanMotivo;
            const dedupeStamp = diagData.ts
              ? String(diagData.ts)
              : isRetained
                ? 'ret'
                : String(now);
            const dedupeKey =
              'gwdiag:' +
              state.gwId +
              ':' +
              rawEstado +
              ':' +
              reintentosRx +
              ':' +
              dedupeStamp;
            recordEvent(dedupeKey, {
              ts: tsMs,
              station: 'Gateway ' + state.gwId,
              slug: 'gw/' + state.gwId + '/diagnostico',
              badgeText: diagMeta.label,
              pillClass: diagMeta.pillClass,
              detail,
            });
            if (rawEstado === 'sordera_rearmando' || rawEstado === 'sordera_reinicio') {
              announce('Gateway ' + state.gwId + ': ' + detail);
            }
          }
        }
      }
      scheduleRender();
      return;
    }

    if (!mqttTopicMatches(state.monitoreoTopic, topic)) {
      scheduleRender();
      return;
    }

    const node = getOrCreateNode(parsed.zona, parsed.sitio, parsed.nodo);
    node.lastMsgRxMs = now;

    if (parsed.canal === 'conexion') {
      const clean = stripQuotes(payloadStr).toLowerCase();
      const prevConn = node.conexion;
      if (clean === 'en_linea' || clean === 'fuera_de_linea') {
        node.conexion = clean;
        node.conexionRetained = isRetained;
        node.conexionTsMs = now;
        const known = state.knownStations.get(node.key);
        const simulado = known ? known.simulado : node.simulado;
        state.lwtEntities.set(topic, {
          key: node.key,
          kind: 'node',
          id: node.nodo,
          label: (known && known.nombre) || node.nombre || node.nodo,
          topic,
          payload: clean,
          online: clean === 'en_linea',
          retained: isRetained,
          tsMs: now,
          simulado,
        });
        if (
          (prevConn && prevConn !== clean && !isRetained) ||
          (!prevConn && !isRetained && clean === 'fuera_de_linea')
        ) {
          const depNote = simulado
            ? 'Directo MQTT'
            : 'Vía LoRa (' + (state.gwId || 'gw01') + ')';
          recordEvent('conn:' + node.key + ':' + clean + ':' + now, {
            ts: now,
            station: node.nombre || node.key,
            slug: node.key,
            badgeText: clean === 'en_linea' ? 'En línea' : 'Fuera de línea',
            pillClass: clean === 'en_linea' ? 'pill--ok' : 'pill--bad',
            detail:
              clean === 'en_linea'
                ? 'Estación reconectada (' + depNote + ')'
                : state.lwtCustomMessage + ' (' + depNote + ')',
          });
          if (clean === 'fuera_de_linea') {
            announce((node.nombre || node.key) + ' fuera de línea');
          }
        }
      }
      scheduleRender();
      return;
    }

    let data = null;
    try {
      data = JSON.parse(payloadStr);
    } catch (_err) {
      scheduleRender();
      return;
    }
    if (!data || typeof data !== 'object') {
      scheduleRender();
      return;
    }

    switch (parsed.canal) {
      case 'meta': {
        if (typeof data.nombre === 'string' && data.nombre.trim()) {
          node.nombre = data.nombre.trim();
        }
        if (typeof data.zona === 'string' && data.zona.trim()) {
          node.zona = data.zona.trim();
        }
        if (typeof data.lat === 'number' && Number.isFinite(data.lat)) {
          node.lat = data.lat;
        }
        if (typeof data.lon === 'number' && Number.isFinite(data.lon)) {
          node.lon = data.lon;
        }
        if (typeof data.simulado === 'boolean') {
          node.simulado = data.simulado;
        }
        state.knownStations.set(node.key, {
          key: node.key,
          zona: node.zona,
          sitio: node.sitio,
          nodo: node.nodo,
          nombre: node.nombre,
          simulado: node.simulado,
          hasMeta: true,
        });
        const connTopic = 'qawapmayu/v1/' + parsed.zona + '/' + parsed.sitio + '/' + parsed.nodo + '/conexion';
        const lwtEnt = state.lwtEntities.get(connTopic);
        if (lwtEnt) {
          lwtEnt.label = node.nombre || node.nodo;
          lwtEnt.simulado = node.simulado;
        }
        if (!state.selectedKey) {
          state.selectedKey = node.key;
        }
        break;
      }

      case 'telemetria': {
        const validez =
          typeof data.validez === 'number' && Number.isFinite(data.validez)
            ? data.validez
            : 15;
        const anomalias =
          typeof data.anomalias === 'number' && Number.isFinite(data.anomalias)
            ? data.anomalias
            : 0;
        const ph = validez & VAL_PH ? numOrNull(data.ph) : null;
        const tds = validez & VAL_TDS ? numOrNull(data.tds) : null;
        const it = validez & VAL_TURB ? numOrNull(data.it) : null;
        const temp = validez & VAL_TEMP ? numOrNull(data.temp) : null;

        node.validez = validez;
        node.anomalias = anomalias;
        node.ph = ph;
        node.tds = tds;
        node.it = it;
        node.temp = temp;
        node.hasTelemetry = true;

        const sampleTs =
          typeof data.ts === 'number' && Number.isFinite(data.ts) && data.ts > 0
            ? data.ts
            : 0;
        node.lastTelemetryTs = sampleTs;
        if (!isRetained) {
          node.lastLiveTelemetryRxMs = now;
        }

        if (typeof data.rssi === 'number') node.rssi = data.rssi;
        if (typeof data.snr === 'number') node.snr = data.snr;
        if (typeof data.pdr === 'number') node.pdr = data.pdr;
        if (typeof data.seq === 'number') node.seq = data.seq;
        if (typeof data.boot === 'number') node.boot = data.boot;

        const incomingSeq = typeof data.seq === 'number' ? data.seq : null;
        const incomingBoot = typeof data.boot === 'number' ? data.boot : null;
        const lastSample =
          node.history.length > 0 ? node.history[node.history.length - 1] : null;
        const sameSeqAndBoot = Boolean(
          lastSample &&
            incomingSeq !== null &&
            lastSample.seq === incomingSeq &&
            lastSample.boot === incomingBoot
        );
        const isDuplicate =
          sameSeqAndBoot &&
          (isRetained || sampleTs === 0 || lastSample.ts === sampleTs);

        if (!isDuplicate) {
          const label = sampleTs
            ? formatClockTime(sampleTs)
            : incomingSeq !== null
              ? '#' + incomingSeq
              : formatClockTime(now);
          node.history.push({
            label,
            ts: sampleTs,
            seq: incomingSeq,
            boot: incomingBoot,
            ph,
            tds,
            it,
            temp,
            anomalias,
          });
          if (node.history.length > MAX_SAMPLES) {
            node.history.shift();
          }
        }

        handleFsmUpdate(node, data.estado, anomalias, false, sampleTs || now);
        if (!state.selectedKey) {
          state.selectedKey = node.key;
        }
        break;
      }

      case 'estado': {
        if (typeof data.anomalias === 'number' && Number.isFinite(data.anomalias)) {
          node.anomalias = data.anomalias;
        }
        const tsVal =
          typeof data.ts === 'number' && Number.isFinite(data.ts) && data.ts > 0
            ? data.ts
            : now;
        handleFsmUpdate(node, data.estado, node.anomalias, true, tsVal);
        break;
      }

      case 'evento': {
        // Nunca sobrescribir node.estado desde eventos retenidos o históricos.
        const evState = normalizeFsm(data.estado) || 'EVENTO';
        const evAnom =
          typeof data.anomalias === 'number' && Number.isFinite(data.anomalias)
            ? data.anomalias
            : node.anomalias;
        const tsVal =
          typeof data.ts === 'number' && Number.isFinite(data.ts) && data.ts > 0
            ? data.ts
            : now;
        const flags = describeAnomalias(evAnom);
        const evCode = data.evento !== undefined ? 'código ' + data.evento : 'alerta';
        const detail =
          'Evento ' +
          evCode +
          ' (' +
          evState +
          ')' +
          (flags.length > 0 ? ' · ' + flags.join(', ') : '');
        const dedupeStamp = data.ts ? String(data.ts) : isRetained ? 'ret' : String(now);
        const dedupeKey =
          'ev:' +
          node.key +
          ':' +
          String(data.evento ?? 'x') +
          ':' +
          evState +
          ':' +
          dedupeStamp;

        let pillClass = 'pill--neutral';
        if (evState === 'MUESTREANDO') pillClass = 'pill--accent';
        else if (evState === 'CAPTURA_ESTIMADA') pillClass = 'pill--warn';
        else if (evState === 'BLOQUEADO' || evState === 'FALLO' || evAnom > 0) {
          pillClass = 'pill--bad';
        } else if (evState === 'ARMADO') pillClass = 'pill--ok';

        recordEvent(dedupeKey, {
          ts: tsVal,
          station: node.nombre || node.key,
          slug: node.key,
          badgeText: evState,
          pillClass,
          detail,
        });
        break;
      }

      case 'enlace': {
        if (typeof data.rssi === 'number') node.rssi = data.rssi;
        if (typeof data.snr === 'number') node.snr = data.snr;
        if (typeof data.pdr === 'number') node.pdr = data.pdr;
        if (typeof data.seq === 'number') node.seq = data.seq;
        if (typeof data.boot === 'number') node.boot = data.boot;
        break;
      }

      default:
        break;
    }

    scheduleRender();
  }

  /* ---------- MQTT Client Lifecycle ---------- */

  function disconnectMqtt() {
    if (state.client) {
      try {
        state.client.end(true);
      } catch (_err) {
        // Ignorar cierre forzado previo.
      }
      state.client = null;
    }
    state.connected = false;
    state.connecting = false;
    state.stationCache.clear();
    disconnectInspectorBroker();
    updateConnectionUI();
  }

  function validateMqttTopicFilter(topic) {
    if (typeof topic !== 'string' || topic.length === 0) {
      return { valid: false, error: 'El tópico MQTT no puede estar vacío.' };
    }
    if (/\s/.test(topic) || topic.includes('\0')) {
      return {
        valid: false,
        error: 'El tópico MQTT no puede contener espacios ni caracteres nulos.',
      };
    }

    const segments = topic.split('/');
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      if (seg.includes('#') && (seg !== '#' || i !== segments.length - 1)) {
        return {
          valid: false,
          error: 'El comodín "#" solo es válido como último segmento completo.',
        };
      }
      if (seg.includes('+') && seg !== '+') {
        return {
          valid: false,
          error: 'El comodín "+" debe ocupar un segmento completo entre "/".',
        };
      }
    }

    return { valid: true, error: '' };
  }

  function updateInspectorSubStatus(text, pillClass) {
    const statusEl = getEl('inspector-sub-status');
    if (!statusEl) return;
    statusEl.className = 'pill ' + (pillClass || 'pill--neutral');
    statusEl.textContent = text;
  }

  function disconnectInspectorBroker() {
    if (state.inspectorClient) {
      try {
        state.inspectorClient.end(true);
      } catch (_err) {
        // Ignorar cierre forzado previo.
      }
      state.inspectorClient = null;
    }
    state.inspectorConnected = false;
    state.inspectorSubscribedTopic = '';
    updateInspectorSubStatus('Sin conectar', 'pill--neutral');
  }

  function connectInspectorBroker(brokerUrl) {
    if (!state.vendorStatus.mqtt || !brokerUrl) return;
    disconnectInspectorBroker();
    updateInspectorSubStatus('Conectando...', 'pill--warn');

    const client = window.mqtt.connect(brokerUrl, {
      clientId: 'qawapmayu-inspector-' + Math.random().toString(16).slice(2, 8),
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 8000,
    });
    state.inspectorClient = client;

    client.on('connect', () => {
      if (state.inspectorClient !== client) return;
      state.inspectorConnected = true;
      const targetTopic = state.inspectorTopic || 'qawapmayu/v1/#';
      client.subscribe(targetTopic, { qos: 1 }, (err) => {
        if (state.inspectorClient !== client) return;
        if (err) {
          updateInspectorSubStatus('Error', 'pill--bad');
          return;
        }
        state.inspectorSubscribedTopic = targetTopic;
        updateInspectorSubStatus('Suscrito', 'pill--ok');
      });
    });

    client.on('message', (topic, payloadBuffer, packet) => {
      if (state.inspectorClient !== client) return;
      const payloadText = payloadBuffer ? payloadBuffer.toString() : '';
      const retained = Boolean(packet && packet.retain);
      recordDiscoveredTopic(topic, payloadText, retained, Date.now());
      syncStationScopeSelects(state.monitoreoTopic || DEFAULT_MONITOREO_TOPIC);
      if (state.inspectorPaused) return;
      state.inspectorRows.unshift({
        timeMs: Date.now(),
        retained,
        topic,
        payload: payloadText,
      });
      if (state.inspectorRows.length > MAX_INSPECTOR_ROWS) {
        state.inspectorRows.length = MAX_INSPECTOR_ROWS;
      }
      renderInspectorTable();
    });

    client.on('reconnect', () => {
      if (state.inspectorClient !== client) return;
      state.inspectorConnected = false;
      updateInspectorSubStatus('Reconectando...', 'pill--warn');
    });

    client.on('close', () => {
      if (state.inspectorClient !== client) return;
      state.inspectorConnected = false;
      updateInspectorSubStatus('Sin conectar', 'pill--neutral');
    });

    client.on('offline', () => {
      if (state.inspectorClient !== client) return;
      state.inspectorConnected = false;
      updateInspectorSubStatus('Sin conectar', 'pill--neutral');
    });

    client.on('error', () => {
      if (state.inspectorClient !== client) return;
      state.inspectorConnected = false;
      updateInspectorSubStatus('Error', 'pill--bad');
    });
  }

  function subscribeInspectorTopic(rawTopic) {
    const nextTopic = String(rawTopic || '').trim();
    const validation = validateMqttTopicFilter(nextTopic);
    const errorEl = getEl('inspector-sub-error');

    if (!validation.valid) {
      if (errorEl) {
        errorEl.textContent = validation.error;
        errorEl.hidden = false;
      }
      return;
    }

    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }

    const inputEl = getEl('inspector-sub-input');
    if (inputEl && inputEl.value !== nextTopic) {
      inputEl.value = nextTopic;
    }

    state.inspectorTopic = nextTopic;

    state.inspectorRows = [];
    state.inspectorPage = 1;
    renderInspectorTable();

    if (state.inspectorClient && state.inspectorConnected) {
      const prevTopic = state.inspectorSubscribedTopic;
      const doSubscribe = () => {
        if (!state.inspectorClient || !state.inspectorConnected) return;
        state.inspectorClient.subscribe(nextTopic, { qos: 1 }, (err) => {
          if (err) {
            updateInspectorSubStatus('Error', 'pill--bad');
            return;
          }
          state.inspectorSubscribedTopic = nextTopic;
          updateInspectorSubStatus('Suscrito', 'pill--ok');
        });
      };

      if (prevTopic) {
        state.inspectorClient.unsubscribe(prevTopic, doSubscribe);
      } else {
        doSubscribe();
      }
    }
  }

  function connectMqtt(urlInput) {
    if (!state.vendorStatus.mqtt) {
      setConnectionError('window.mqtt no está disponible en ./vendor/mqtt.min.js.');
      return;
    }

    const targetUrl = String(urlInput || state.brokerUrl || getDefaultBrokerUrl()).trim();
    if (!targetUrl) {
      setConnectionError('Ingresa una URL WebSocket válida antes de conectar.');
      return;
    }

    state.brokerUrl = targetUrl;
    const urlField = getEl('broker-url');
    if (urlField && urlField.value !== targetUrl) urlField.value = targetUrl;

    disconnectMqtt();
    setConnectionError('');
    state.connecting = true;
    updateConnectionUI();

    const clientId = 'qm-web-' + Math.random().toString(16).slice(2, 10);
    const client = window.mqtt.connect(targetUrl, {
      clientId,
      clean: true,
      keepalive: 30,
      reconnectPeriod: 3000,
      connectTimeout: 8000,
    });

    state.client = client;

    client.on('connect', () => {
      if (state.client !== client) return;
      state.connected = true;
      state.connecting = false;
      setConnectionError('');

      const initialTopics =
        state.monitoreoTopic === GW_SUB_TOPIC
          ? [GW_SUB_TOPIC]
          : [GW_SUB_TOPIC, state.monitoreoTopic];
      client.subscribe(initialTopics, { qos: 1 }, (err) => {
        if (err) {
          setConnectionError('Error al suscribirse al tópico MQTT: ' + err.message);
        }
      });

      updateConnectionUI();
      announce('Conectado al broker MQTT ' + parseHostLabel(targetUrl));
      scheduleRender();
    });

    client.on('reconnect', () => {
      if (state.client !== client) return;
      state.connected = false;
      state.connecting = true;
      updateConnectionUI();
    });

    client.on('close', () => {
      if (state.client !== client) return;
      state.connected = false;
      state.connecting = false;
      updateConnectionUI();
    });

    client.on('offline', () => {
      if (state.client !== client) return;
      state.connected = false;
      updateConnectionUI();
    });

    client.on('error', (err) => {
      if (state.client !== client) return;
      state.connecting = false;
      setConnectionError(err && err.message ? err.message : 'Fallo de conexión WebSocket');
      updateConnectionUI();
    });

    client.on('message', (topic, payloadBuffer, packet) => {
      if (state.client !== client) return;
      handleMessage(topic, payloadBuffer, packet);
    });

    connectInspectorBroker(targetUrl);
  }

  function clearMonitoreoMarkers() {
    if (state.map && state.mapMode === 'leaflet') {
      for (const marker of state.markers.values()) {
        state.map.removeLayer(marker);
      }
    }
    state.markers.clear();
  }

  function getAvailableStations() {
    const stationMap = new Map();

    const upsert = (entry, preferLive) => {
      if (!entry) return;
      const keyParts = typeof entry.key === 'string' ? entry.key.split('/') : [];
      const zona = keyParts[0] || entry.zona || '';
      const sitio = keyParts[1] || entry.sitio || '';
      const nodo = keyParts[2] || entry.nodo || '';
      if (!zona || !sitio || !nodo) return;

      const key = zona + '/' + sitio + '/' + nodo;
      const prev = stationMap.get(key);
      const hasMeta = Boolean(entry.hasMeta);
      const rawNombre = typeof entry.nombre === 'string' ? entry.nombre.trim() : '';
      const prevNombre = prev ? prev.nombre : nodo;
      const resolvedNombre =
        rawNombre && (preferLive || hasMeta || rawNombre !== nodo || prevNombre === nodo)
          ? rawNombre
          : prevNombre;
      const displayZona =
        typeof entry.zona === 'string' && entry.zona.trim() && (preferLive || hasMeta || !prev)
          ? entry.zona.trim()
          : prev
            ? prev.displayZona
            : zona;
      const simulado =
        preferLive || hasMeta
          ? Boolean(entry.simulado)
          : Boolean((prev && prev.simulado) || entry.simulado);

      stationMap.set(key, {
        key,
        zona,
        sitio,
        nodo,
        displayZona,
        nombre: resolvedNombre || nodo,
        simulado,
      });
    };

    for (const entry of state.stationCache.values()) upsert(entry, false);
    for (const entry of state.knownStations.values()) upsert(entry, false);
    for (const entry of state.nodes.values()) upsert(entry, true);

    return Array.from(stationMap.values())
      .sort(
        (a, b) =>
          String(a.nodo).localeCompare(String(b.nodo), 'es') ||
          String(a.key).localeCompare(String(b.key), 'es')
      )
      .map((s) => {
        const topic = 'qawapmayu/v1/' + s.zona + '/' + s.sitio + '/' + s.nodo + '/#';
        const etiquetaNombre =
          s.nombre && s.nombre !== s.nodo ? s.nombre + ' (' + s.nodo + ')' : s.nodo;
        return {
          key: s.key,
          zona: s.zona,
          sitio: s.sitio,
          nodo: s.nodo,
          displayZona: s.displayZona,
          nombre: s.nombre,
          etiquetaNombre,
          simulado: s.simulado,
          topic,
        };
      });
  }

  function populateStationScopeSelect(selectEl, activeTopic) {
    if (!selectEl) return;
    const targetTopic = activeTopic || state.monitoreoTopic || DEFAULT_MONITOREO_TOPIC;
    const stations = getAvailableStations();
    const optionDefs = stations.map((s) => ({
      value: s.topic,
      label: s.topic,
    }));
    const listSig = optionDefs.map((opt) => opt.value + '\u0001' + opt.label).join('\u0002');
    const nextSig = targetTopic + '\u0003' + listSig;

    if (selectEl.dataset.scopeSig === nextSig && selectEl.value === targetTopic) {
      return;
    }

    const baseValues = new Set();
    for (const opt of Array.from(selectEl.options)) {
      if (
        opt.dataset.customTopic !== 'true' &&
        (!opt.parentElement || opt.parentElement.dataset.stationScopeGroup !== 'true')
      ) {
        baseValues.add(opt.value);
      }
    }
    const needsCustomOption =
      !baseValues.has(targetTopic) && !optionDefs.some((opt) => opt.value === targetTopic);

    if (
      selectEl.dataset.listSig === listSig &&
      !needsCustomOption &&
      !selectEl.querySelector('option[data-custom-topic="true"]')
    ) {
      selectEl.value = targetTopic;
      selectEl.dataset.scopeSig = nextSig;
      return;
    }

    const existingGroup = selectEl.querySelector('optgroup[data-station-scope-group="true"]');
    if (existingGroup) existingGroup.remove();
    const existingCustom = selectEl.querySelector('option[data-custom-topic="true"]');
    if (existingCustom) existingCustom.remove();

    if (optionDefs.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'Estaciones disponibles';
      group.dataset.stationScopeGroup = 'true';
      for (const def of optionDefs) {
        const opt = document.createElement('option');
        opt.value = def.value;
        opt.textContent = def.label;
        group.appendChild(opt);
      }
      selectEl.appendChild(group);
    }

    if (needsCustomOption) {
      const customOpt = document.createElement('option');
      customOpt.dataset.customTopic = 'true';
      customOpt.value = targetTopic;
      customOpt.textContent = targetTopic;
      selectEl.appendChild(customOpt);
    }

    selectEl.value = targetTopic;
    selectEl.dataset.listSig = listSig;
    selectEl.dataset.scopeSig = nextSig;
  }

  function describeMonitoreoTopic(topic) {
    const resolved = String(topic || '').trim();
    if (resolved === 'qawapmayu/v1/+/+/+/+') return 'Todas las estaciones';
    if (resolved === 'qawapmayu/v1/barranco/#') return 'Distrito Barranco';
    if (resolved === 'qawapmayu/v1/chorrillos/#') return 'Distrito Chorrillos';
    const match = getAvailableStations().find((s) => s.topic === resolved);
    if (match) {
      return match.etiquetaNombre + (match.simulado ? ' (Simulado)' : '');
    }
    return 'Filtro personalizado';
  }

  function syncStationScopeSelects(activeTopic) {
    const resolvedTopic = activeTopic || state.monitoreoTopic || DEFAULT_MONITOREO_TOPIC;
    populateStationScopeSelect(getEl('monitoreo-station-scope'), resolvedTopic);
    populateStationScopeSelect(getEl('zone-filter'), resolvedTopic);
    const monitoreoActiveDesc = getEl('monitoreo-active-desc');
    if (monitoreoActiveDesc) {
      monitoreoActiveDesc.textContent = describeMonitoreoTopic(resolvedTopic);
    }
  }

  function changeMonitoreoTopic(rawTopic) {
    const nextTopic = String(rawTopic || '').trim();
    const validation = validateMqttTopicFilter(nextTopic);
    if (!validation.valid) {
      return false;
    }

    const prevTopic = state.monitoreoTopic;
    const prevSelectedKey = state.selectedKey;

    for (const [key, node] of state.nodes.entries()) {
      state.stationCache.set(key, node);
    }

    state.monitoreoTopic = nextTopic;
    state.nodes.clear();
    state.selectedKey = null;
    state.hasAutoFittedMap = false;
    clearMonitoreoMarkers();

    for (const [key, cached] of state.stationCache.entries()) {
      if (topicFilterMatchesStation(nextTopic, cached)) {
        state.nodes.set(key, cached);
      }
    }
    if (prevSelectedKey && state.nodes.has(prevSelectedKey)) {
      state.selectedKey = prevSelectedKey;
    }

    updateMonitoreoTopicUI();

    if (state.client && state.connected) {
      const doSubscribe = () => {
        if (!state.client || !state.connected) return;
        state.client.subscribe(nextTopic, { qos: 1 }, (err) => {
          if (err) {
            setConnectionError('Error al suscribirse al tópico MQTT: ' + err.message);
          }
        });
      };

      if (prevTopic && prevTopic !== GW_SUB_TOPIC) {
        state.client.unsubscribe(prevTopic, doSubscribe);
      } else {
        doSubscribe();
      }
    }

    announce('Suscripción de monitoreo actualizada a ' + nextTopic);
    scheduleRender();
    return true;
  }

  function updateMonitoreoTopicUI() {
    const activeTopic = state.monitoreoTopic || DEFAULT_MONITOREO_TOPIC;

    const topSub = getEl('active-sub-pill');
    if (topSub) topSub.textContent = activeTopic;
    const settingsSub = getEl('settings-active-sub');
    if (settingsSub) settingsSub.textContent = activeTopic;
    const monitoreoActiveDesc = getEl('monitoreo-active-desc');
    if (monitoreoActiveDesc) monitoreoActiveDesc.textContent = describeMonitoreoTopic(activeTopic);
    const monitoreoActiveTopic = getEl('monitoreo-active-topic');
    if (monitoreoActiveTopic) monitoreoActiveTopic.textContent = activeTopic;

    syncStationScopeSelects(activeTopic);
  }

  function updateConnectionUI() {
    const topBadge = getEl('broker-badge');
    const topBadgeText = getEl('broker-badge-text');
    const sidebarPill = getEl('sidebar-broker-pill');
    const sidebarHost = getEl('sidebar-broker-host');
    const sidebarBtn = getEl('btn-sidebar-connect');
    const topBtn = getEl('btn-topbar-connect');
    const formConnectBtn = getEl('btn-connect');
    const formDisconnectBtn = getEl('btn-disconnect');
    const settingsStatus = getEl('settings-broker-status');

    let pillClass = 'pill--neutral';
    let shortLabel = 'Desconectado';
    let badgeText = 'MQTT: desconectado';
    let settingsLabel = 'Estado: desconectado';

    if (state.connected) {
      pillClass = 'pill--ok';
      shortLabel = 'En línea';
      badgeText = 'MQTT: conectado';
      settingsLabel = 'Estado: conectado a ' + state.brokerUrl;
    } else if (state.connecting) {
      pillClass = 'pill--warn';
      shortLabel = 'Conectando';
      badgeText = 'MQTT: conectando';
      settingsLabel = 'Estado: conectando a ' + state.brokerUrl + '...';
    }

    if (topBadge) topBadge.className = 'pill ' + pillClass;
    if (topBadgeText) topBadgeText.textContent = badgeText;

    if (sidebarPill) {
      sidebarPill.className = 'pill ' + pillClass;
      sidebarPill.textContent = shortLabel;
    }
    if (sidebarHost) {
      sidebarHost.textContent = parseHostLabel(state.brokerUrl);
    }

    const actionText = state.connected || state.connecting ? 'Desconectar' : 'Conectar';
    if (sidebarBtn) sidebarBtn.textContent = actionText;
    if (topBtn) topBtn.textContent = actionText;

    if (formConnectBtn) {
      formConnectBtn.disabled = false;
      formConnectBtn.textContent = state.connecting ? 'Conectando...' : 'Conectar';
    }
    if (formDisconnectBtn) {
      formDisconnectBtn.disabled = !state.connected && !state.connecting;
    }
    if (settingsStatus) settingsStatus.textContent = settingsLabel;

    updateGatewayUI();
  }

  function updateGatewayUI() {
    const gwId = state.gwId || 'gw01';
    const gwBadge = getEl('gw-badge');
    const gwText = getEl('gw-badge-text');
    const sidebarGwPill = getEl('sidebar-gw-pill');

    const isSordera =
      state.gwDiag.sordera ||
      state.gwDiag.estado === 'sordera_rearmando' ||
      state.gwDiag.estado === 'sordera_reinicio';

    let pillClass = 'pill--neutral';
    let label = gwId + ': esperando LWT';
    let compactLabel = gwId + ' · esperando';

    if (state.gwOnline === false) {
      pillClass = 'pill--bad';
      label = gwId + ': fuera de línea (LWT)';
      compactLabel = gwId + ' · offline';
    } else if (isSordera) {
      pillClass = state.gwDiag.estado === 'sordera_reinicio' ? 'pill--bad' : 'pill--warn';
      label =
        state.gwDiag.estado === 'sordera_reinicio'
          ? gwId + ': reinicio sordera'
          : gwId + ': rearmando RX (' + (state.gwDiag.reintentosRx || 0) + '/3)';
      compactLabel = gwId + ' · sordera';
    } else if (state.gwDiag.estado === 'nodo_silencio') {
      pillClass = 'pill--warn';
      label = gwId + ': nodo en silencio';
      compactLabel = gwId + ' · silencio';
    } else if (state.gwOnline === true) {
      pillClass = 'pill--ok';
      label = gwId + ': en línea';
      compactLabel = gwId + ' · en línea';
    }

    if (gwBadge) gwBadge.className = 'pill ' + pillClass;
    if (gwText) gwText.textContent = label;
    if (sidebarGwPill) {
      sidebarGwPill.className = 'pill ' + pillClass;
      sidebarGwPill.textContent = compactLabel;
    }
  }

  /* ---------- Render Pipeline ---------- */

  function getSortedNodes() {
    const list = Array.from(state.nodes.values());
    list.sort((a, b) => a.key.localeCompare(b.key, 'es'));
    return list;
  }

  function scheduleRender() {
    if (state.renderScheduled) return;
    state.renderScheduled = true;
    window.requestAnimationFrame(() => {
      state.renderScheduled = false;
      renderAll();
    });
  }

  function renderAll() {
    const now = Date.now();
    const nodes = getSortedNodes();

    if (nodes.length > 0 && (!state.selectedKey || !state.nodes.has(state.selectedKey))) {
      state.selectedKey = nodes[0].key;
    } else if (nodes.length === 0) {
      state.selectedKey = null;
    }

    syncStationScopeSelects(state.monitoreoTopic || DEFAULT_MONITOREO_TOPIC);

    const coverageEl = getEl('monitoreo-coverage');
    const telemetryEl = getEl('monitoreo-telemetry');
    if (coverageEl) coverageEl.hidden = false;
    if (telemetryEl) telemetryEl.hidden = false;

    renderStationsList(nodes, now);
    renderSummaryStrip(nodes, now);
    renderMap(nodes, now);
    renderSelectedTelemetry(nodes, now);
    renderLwtPanel();
    renderEventsViews();
    renderInspectorTable();
    updateGatewayUI();
  }

  function buildInlineChannelChip(label, val, decimals, unit, valid, isAnom) {
    const missing = !valid || val === null;
    const chip = createEl(
      'span',
      'metric-chip' +
        (missing ? ' metric-chip--missing' : '') +
        (isAnom ? ' metric-chip--anom' : '')
    );
    chip.appendChild(createEl('span', 'metric-chip__label', label));
    const formatted = missing ? MISSING_MARK : formatNumber(val, decimals) + ' ' + unit;
    chip.appendChild(createEl('span', 'metric-chip__val', formatted));
    return chip;
  }

  function renderStationsList(nodes, now) {
    const countEl = getEl('station-count');
    if (countEl) {
      countEl.textContent =
        nodes.length + (nodes.length === 1 ? ' estación' : ' estaciones');
    }

    const listEl = getEl('stations-grid');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (nodes.length === 0) {
      const empty = createEl('div', 'empty-state');
      empty.appendChild(createEl('p', 'empty-state__title', 'Sin estaciones descubiertas'));
      const desc = createEl('p', 'empty-state__desc');
      desc.appendChild(
        document.createTextNode(
          'Conecta al broker MQTT para recibir mensajes retenidos y telemetría desde '
        )
      );
      desc.appendChild(
        createEl(
          'code',
          'topic-slug',
          state.monitoreoTopic || DEFAULT_MONITOREO_TOPIC
        )
      );
      desc.appendChild(document.createTextNode('.'));
      empty.appendChild(desc);
      listEl.appendChild(empty);
      return;
    }

    for (const node of nodes) {
      const stale = isNodeStale(node, now);
      const offline = node.conexion === 'fuera_de_linea';
      const selected = node.key === state.selectedKey;
      const badge = getNodeBadgeInfo(node, now);

      const row = createEl(
        'button',
        'station-row' +
          (selected ? ' station-row--selected' : '') +
          (stale || offline ? ' station-row--stale' : '')
      );
      row.type = 'button';
      row.dataset.nodeKey = node.key;
      row.dataset.stale = stale ? 'true' : 'false';
      row.dataset.offline = offline ? 'true' : 'false';
      row.setAttribute('aria-pressed', selected ? 'true' : 'false');

      const top = createEl('div', 'station-row__top');
      const identity = createEl('div', 'station-row__identity');
      identity.appendChild(createEl('span', 'station-row__name', node.nombre || node.nodo));
      identity.appendChild(
        createEl(
          'span',
          'station-row__source',
          ' · ' + (node.simulado ? 'Simulado' : 'Hardware')
        )
      );
      top.appendChild(identity);

      const right = createEl('div', 'station-row__right');
      right.appendChild(createEl('span', 'pill ' + badge.pillClass, badge.text));
      const ageEl = createEl('span', 'station-row__age num', formatRelativeAge(node, now));
      ageEl.dataset.ageFor = node.key;
      right.appendChild(ageEl);
      top.appendChild(right);
      row.appendChild(top);

      const bottom = createEl('div', 'station-row__bottom');
      bottom.appendChild(createEl('code', 'topic-slug', node.key));

      const metrics = createEl('div', 'station-row__metrics num');
      metrics.appendChild(
        buildInlineChannelChip(
          'pH',
          node.ph,
          2,
          'u.pH',
          Boolean(node.validez & VAL_PH),
          Boolean(node.anomalias & ANO_PH)
        )
      );
      metrics.appendChild(
        buildInlineChannelChip(
          'TDS',
          node.tds,
          0,
          'mg/L',
          Boolean(node.validez & VAL_TDS),
          Boolean(node.anomalias & ANO_TDS)
        )
      );
      metrics.appendChild(
        buildInlineChannelChip(
          'IT',
          node.it,
          3,
          'NTU',
          Boolean(node.validez & VAL_TURB),
          Boolean(node.anomalias & ANO_TURB)
        )
      );
      metrics.appendChild(
        buildInlineChannelChip(
          'T',
          node.temp,
          1,
          '°C',
          Boolean(node.validez & VAL_TEMP),
          false
        )
      );

      bottom.appendChild(metrics);
      row.appendChild(bottom);

      row.addEventListener('click', () => selectStation(node.key));
      listEl.appendChild(row);
    }
  }

  function renderSummaryStrip(nodes, now) {
    let onlineCount = 0;
    let alertCount = 0;
    let simCount = 0;

    for (const node of nodes) {
      if (node.simulado) simCount += 1;
      if (isNodeOnline(node, now)) {
        onlineCount += 1;
        if (
          node.anomalias > 0 ||
          node.estado === 'MUESTREANDO' ||
          node.estado === 'CAPTURA_ESTIMADA' ||
          node.estado === 'BLOQUEADO' ||
          node.estado === 'FALLO'
        ) {
          alertCount += 1;
        }
      } else if (
        node.anomalias > 0 ||
        node.estado === 'FALLO' ||
        node.estado === 'BLOQUEADO'
      ) {
        alertCount += 1;
      }
    }

    const kpiOnline = getEl('kpi-online');
    const kpiOnlineSub = getEl('kpi-online-sub');
    if (kpiOnline) kpiOnline.textContent = onlineCount + ' / ' + nodes.length;
    if (kpiOnlineSub) {
      kpiOnlineSub.textContent =
        nodes.length === 0
          ? 'Esperando metadatos'
          : simCount > 0
            ? simCount + (simCount === 1 ? ' simulada' : ' simuladas')
            : 'Estaciones en campo';
    }

    const kpiAlerts = getEl('kpi-alerts');
    const kpiAlertsSub = getEl('kpi-alerts-sub');
    if (kpiAlerts) kpiAlerts.textContent = String(alertCount);
    if (kpiAlertsSub) {
      kpiAlertsSub.textContent =
        alertCount === 0
          ? 'Sin alertas'
          : alertCount === 1
            ? '1 activa ahora'
            : alertCount + ' activas ahora';
    }

    const kpiMessages = getEl('kpi-messages');
    const kpiMessagesSub = getEl('kpi-messages-sub');
    if (kpiMessages) kpiMessages.textContent = String(state.totalMessages);
    if (kpiMessagesSub) {
      kpiMessagesSub.textContent = state.retainedMessages + ' retenidos';
    }
  }

  /* ---------- Map (Leaflet + SVG Fallback) ---------- */

  function teardownLeafletToOfflineSvg() {
    if (state.tileFallbackTimerId) {
      window.clearTimeout(state.tileFallbackTimerId);
      state.tileFallbackTimerId = null;
    }
    state.offlineTilesFailed = true;
    if (state.tileLayer) {
      try {
        state.tileLayer.off();
        state.tileLayer.remove();
      } catch (_err) {
        // Ignorar error de limpieza de capa de teselas.
      }
      state.tileLayer = null;
    }
    if (state.map) {
      try {
        state.map.remove();
      } catch (_err) {
        // Ignorar error de limpieza del mapa Leaflet.
      }
      state.map = null;
    }
    state.markers.clear();
    renderSvgMap(getSortedNodes(), Date.now());
  }

  function ensureLeafletMap() {
    if (state.offlineTilesFailed) return false;
    if (state.map) return true;
    if (!state.vendorStatus.leaflet || typeof window.L === 'undefined') return false;
    const container = getEl('map-container');
    if (!container) return false;

    container.innerHTML = '';
    const map = window.L.map(container, {
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      zoomControl: true,
    });

    let tileLoadCount = 0;
    let tileErrorCount = 0;

    const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    });

    tileLayer.on('tileload', () => {
      tileLoadCount += 1;
      if (state.tileFallbackTimerId) {
        window.clearTimeout(state.tileFallbackTimerId);
        state.tileFallbackTimerId = null;
      }
    });

    tileLayer.on('tileerror', () => {
      if (state.map !== map || state.offlineTilesFailed) return;
      tileErrorCount += 1;
      if (tileErrorCount >= 2 && tileLoadCount === 0) {
        teardownLeafletToOfflineSvg();
        return;
      }
      if (!state.tileFallbackTimerId && tileLoadCount === 0) {
        state.tileFallbackTimerId = window.setTimeout(() => {
          state.tileFallbackTimerId = null;
          if (state.map === map && tileLoadCount === 0 && tileErrorCount >= 1) {
            teardownLeafletToOfflineSvg();
          }
        }, 1200);
      }
    });

    tileLayer.addTo(map);
    state.tileLayer = tileLayer;
    state.map = map;
    state.mapMode = 'leaflet';
    const badge = getEl('map-mode-badge');
    if (badge) badge.hidden = true;
    return true;
  }

  function buildMarkerIcon(pinClass, selected) {
    return window.L.divIcon({
      className: 'qm-pin-wrapper',
      html:
        '<div class="qm-pin qm-pin--' +
        escapeHtml(pinClass) +
        (selected ? ' qm-pin--selected' : '') +
        '"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
  }

  function buildPopupHtml(node, badge) {
    const phText =
      node.validez & VAL_PH && node.ph !== null ? formatNumber(node.ph, 2) + ' u.pH' : MISSING_MARK;
    const tdsText =
      node.validez & VAL_TDS && node.tds !== null ? formatNumber(node.tds, 0) + ' mg/L' : MISSING_MARK;
    const itText =
      node.validez & VAL_TURB && node.it !== null ? formatNumber(node.it, 3) + ' NTU' : MISSING_MARK;
    const tempText =
      node.validez & VAL_TEMP && node.temp !== null ? formatNumber(node.temp, 2) + ' °C' : MISSING_MARK;

    return (
      '<div class="qm-popup">' +
      '<strong class="qm-popup__title">' +
      escapeHtml(node.nombre || node.nodo) +
      '</strong>' +
      '<code class="topic-slug">' +
      escapeHtml(node.key) +
      '</code>' +
      '<div class="qm-popup__grid">' +
      '<span class="qm-popup__state">Estado: <strong>' +
      escapeHtml(badge.text) +
      '</strong></span>' +
      '<span>pH: <strong>' +
      escapeHtml(phText) +
      '</strong></span>' +
      '<span>TDS: <strong>' +
      escapeHtml(tdsText) +
      '</strong></span>' +
      '<span>IT: <strong>' +
      escapeHtml(itText) +
      '</strong></span>' +
      '<span>Temp: <strong>' +
      escapeHtml(tempText) +
      '</strong></span>' +
      '</div></div>'
    );
  }

  function fitMapToStations() {
    const coords = [];
    for (const node of state.nodes.values()) {
      if (typeof node.lat === 'number' && typeof node.lon === 'number') {
        coords.push([node.lat, node.lon]);
      }
    }
    if (state.mapMode === 'leaflet' && state.map) {
      if (coords.length > 1) {
        state.map.fitBounds(coords, { padding: [36, 36], maxZoom: 15 });
      } else if (coords.length === 1) {
        state.map.setView(coords[0], 15);
      } else {
        state.map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      }
    } else if (state.mapMode === 'svg') {
      renderSvgMap(getSortedNodes(), Date.now());
    }
  }

  function renderSvgMap(nodes, now) {
    const container = getEl('map-container');
    if (!container) return;

    state.mapMode = 'svg';
    const modeBadge = getEl('map-mode-badge');
    if (modeBadge) {
      modeBadge.textContent = 'Esquema offline';
      modeBadge.hidden = false;
    }

    const svgNS = 'http://www.w3.org/2000/svg';
    const minLon = -77.045;
    const maxLon = -76.965;
    const maxLat = -12.115;
    const minLat = -12.225;
    const width = 640;
    const height = 360;

    function project(lat, lon) {
      const x = ((lon - minLon) / (maxLon - minLon)) * (width - 80) + 40;
      const y = ((maxLat - lat) / (maxLat - minLat)) * (height - 60) + 30;
      return {
        x: Math.max(24, Math.min(width - 24, x)),
        y: Math.max(24, Math.min(height - 24, y)),
      };
    }

    container.innerHTML = '';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'qm-svg-map');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Mapa esquemático costero Barranco y Chorrillos');

    const bg = document.createElementNS(svgNS, 'rect');
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('fill', '#f4f6f8');
    svg.appendChild(bg);

    const sea = document.createElementNS(svgNS, 'path');
    sea.setAttribute(
      'd',
      'M 0 0 L 124 0 C 146 42 174 88 178 125 C 181 156 158 178 124 198 C 102 211 108 225 162 235 C 238 248 332 264 382 288 C 398 310 410 334 424 360 L 0 360 Z'
    );
    sea.setAttribute('fill', '#e7eff2');
    svg.appendChild(sea);

    for (const lonVal of [-77.04, -77.02, -77.0, -76.98]) {
      const gx = project(maxLat, lonVal).x;
      const vLine = document.createElementNS(svgNS, 'line');
      vLine.setAttribute('x1', gx.toFixed(1));
      vLine.setAttribute('y1', '0');
      vLine.setAttribute('x2', gx.toFixed(1));
      vLine.setAttribute('y2', String(height));
      vLine.setAttribute('stroke', '#e4e8ec');
      vLine.setAttribute('stroke-width', '1');
      svg.appendChild(vLine);

      const lonLbl = document.createElementNS(svgNS, 'text');
      lonLbl.setAttribute('x', (gx + 4).toFixed(1));
      lonLbl.setAttribute('y', String(height - 8));
      lonLbl.setAttribute('font-size', '11');
      lonLbl.setAttribute('fill', '#6b6b6b');
      lonLbl.textContent = Math.abs(lonVal).toFixed(2) + '°W';
      svg.appendChild(lonLbl);
    }

    for (const latVal of [-12.12, -12.14, -12.16, -12.18, -12.2, -12.22]) {
      const gy = project(latVal, minLon).y;
      const hLine = document.createElementNS(svgNS, 'line');
      hLine.setAttribute('x1', '0');
      hLine.setAttribute('y1', gy.toFixed(1));
      hLine.setAttribute('x2', String(width));
      hLine.setAttribute('y2', gy.toFixed(1));
      hLine.setAttribute('stroke', '#e4e8ec');
      hLine.setAttribute('stroke-width', '1');
      svg.appendChild(hLine);

      if (latVal === -12.14 || latVal === -12.18 || latVal === -12.22) {
        const latLbl = document.createElementNS(svgNS, 'text');
        latLbl.setAttribute('x', String(width - 8));
        latLbl.setAttribute('y', (gy - 4).toFixed(1));
        latLbl.setAttribute('text-anchor', 'end');
        latLbl.setAttribute('font-size', '11');
        latLbl.setAttribute('fill', '#6b6b6b');
        latLbl.textContent = Math.abs(latVal).toFixed(2) + '°S';
        svg.appendChild(latLbl);
      }
    }

    const wetland = document.createElementNS(svgNS, 'path');
    wetland.setAttribute(
      'd',
      'M 416 268 C 428 254 456 256 474 270 C 488 282 484 308 464 318 C 444 326 418 314 414 294 C 411 282 412 274 416 268 Z'
    );
    wetland.setAttribute('fill', '#dcf0e4');
    wetland.setAttribute('stroke', '#9bd3b3');
    wetland.setAttribute('stroke-width', '1');
    svg.appendChild(wetland);

    const coast = document.createElementNS(svgNS, 'path');
    coast.setAttribute(
      'd',
      'M 124 0 C 146 42 174 88 178 125 C 181 156 158 178 124 198 C 102 211 108 225 162 235 C 238 248 332 264 382 288 C 398 310 410 334 424 360'
    );
    coast.setAttribute('stroke', '#0f5f73');
    coast.setAttribute('stroke-width', '1.75');
    coast.setAttribute('fill', 'none');
    svg.appendChild(coast);

    const labels = [
      { text: 'Océano Pacífico', x: 22, y: 30, fill: '#0f5f73', weight: '500' },
      { text: 'Barranco', x: 396, y: 82, fill: '#5d5f60', weight: '500' },
      { text: 'Chorrillos', x: 396, y: 204, fill: '#5d5f60', weight: '500' },
    ];
    for (const lbl of labels) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', String(lbl.x));
      t.setAttribute('y', String(lbl.y));
      t.setAttribute('font-size', '12');
      t.setAttribute('font-weight', lbl.weight);
      t.setAttribute('fill', lbl.fill);
      t.textContent = lbl.text;
      svg.appendChild(t);
    }

    const compassGroup = document.createElementNS(svgNS, 'g');
    compassGroup.setAttribute('aria-hidden', 'true');
    const compassCircle = document.createElementNS(svgNS, 'circle');
    compassCircle.setAttribute('cx', '606');
    compassCircle.setAttribute('cy', '34');
    compassCircle.setAttribute('r', '15');
    compassCircle.setAttribute('fill', '#ffffff');
    compassCircle.setAttribute('stroke', '#e4e8ec');
    compassCircle.setAttribute('stroke-width', '1');
    compassGroup.appendChild(compassCircle);

    const northArrow = document.createElementNS(svgNS, 'path');
    northArrow.setAttribute('d', 'M 606 23 L 610 31 L 606 29 L 602 31 Z');
    northArrow.setAttribute('fill', '#0f5f73');
    compassGroup.appendChild(northArrow);

    const northTxt = document.createElementNS(svgNS, 'text');
    northTxt.setAttribute('x', '606');
    northTxt.setAttribute('y', '44');
    northTxt.setAttribute('text-anchor', 'middle');
    northTxt.setAttribute('font-size', '11');
    northTxt.setAttribute('font-weight', '600');
    northTxt.setAttribute('fill', '#131416');
    northTxt.textContent = 'N';
    compassGroup.appendChild(northTxt);
    svg.appendChild(compassGroup);

    const pinColors = {
      armado: '#1e7b4f',
      muestreando: '#0f5f73',
      captura: '#92400e',
      bloqueado: '#c4242a',
      fallo: '#c4242a',
      offline: '#8a8f96',
    };

    const placedLabels = [];
    for (const node of nodes) {
      if (typeof node.lat !== 'number' || typeof node.lon !== 'number') continue;
      const pt = project(node.lat, node.lon);
      const badge = getNodeBadgeInfo(node, now);
      const selected = node.key === state.selectedKey;
      const stationTitle = node.nombre || node.nodo;

      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('cursor', 'pointer');
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', stationTitle + ' (' + badge.text + ')');
      g.addEventListener('click', () => selectStation(node.key));
      g.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          selectStation(node.key);
        }
      });

      if (selected) {
        const ring = document.createElementNS(svgNS, 'circle');
        ring.setAttribute('cx', pt.x.toFixed(1));
        ring.setAttribute('cy', pt.y.toFixed(1));
        ring.setAttribute('r', '13');
        ring.setAttribute('fill', 'rgba(15, 95, 115, 0.18)');
        ring.setAttribute('stroke', '#0f5f73');
        ring.setAttribute('stroke-width', '1.5');
        g.appendChild(ring);
      }

      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
      dot.setAttribute('r', selected ? '8' : '6.5');
      dot.setAttribute('fill', pinColors[badge.pinClass] || '#8a8f96');
      dot.setAttribute('stroke', '#ffffff');
      dot.setAttribute('stroke-width', '2');
      g.appendChild(dot);

      const alignLeft = pt.x > width - 170;
      let labelY = pt.y + 4;
      for (const prev of placedLabels) {
        if (Math.abs(prev.x - pt.x) < 120 && Math.abs(prev.y - labelY) < 18) {
          labelY = prev.y + 18;
        }
      }
      placedLabels.push({ x: pt.x, y: labelY });

      const nameLbl = document.createElementNS(svgNS, 'text');
      nameLbl.setAttribute('x', (alignLeft ? pt.x - 12 : pt.x + 12).toFixed(1));
      nameLbl.setAttribute('y', labelY.toFixed(1));
      if (alignLeft) nameLbl.setAttribute('text-anchor', 'end');
      nameLbl.setAttribute('font-size', '12.5');
      nameLbl.setAttribute('font-weight', selected ? '600' : '500');
      nameLbl.setAttribute('fill', '#131416');
      nameLbl.setAttribute('paint-order', 'stroke');
      nameLbl.setAttribute('stroke', '#f4f6f8');
      nameLbl.setAttribute('stroke-width', '3.5');
      nameLbl.setAttribute('stroke-linejoin', 'round');
      nameLbl.textContent = stationTitle;
      g.appendChild(nameLbl);

      svg.appendChild(g);
    }

    container.appendChild(svg);
  }

  function renderMap(nodes, now) {
    if (!ensureLeafletMap()) {
      renderSvgMap(nodes, now);
      return;
    }

    const activeKeys = new Set();
    let coordCount = 0;

    for (const node of nodes) {
      if (typeof node.lat !== 'number' || typeof node.lon !== 'number') continue;
      coordCount += 1;
      activeKeys.add(node.key);
      const badge = getNodeBadgeInfo(node, now);
      const selected = node.key === state.selectedKey;
      const existing = state.markers.get(node.key);

      if (existing) {
        existing.setLatLng([node.lat, node.lon]);
        existing.setIcon(buildMarkerIcon(badge.pinClass, selected));
        existing.setPopupContent(buildPopupHtml(node, badge));
      } else {
        const marker = window.L.marker([node.lat, node.lon], {
          icon: buildMarkerIcon(badge.pinClass, selected),
        }).addTo(state.map);
        marker.bindPopup(buildPopupHtml(node, badge));
        marker.on('click', () => selectStation(node.key, { openPopup: true }));
        state.markers.set(node.key, marker);
      }
    }

    for (const [key, marker] of state.markers.entries()) {
      if (!activeKeys.has(key)) {
        state.map.removeLayer(marker);
        state.markers.delete(key);
      }
    }

    if (!state.hasAutoFittedMap && coordCount > 0) {
      state.hasAutoFittedMap = true;
      fitMapToStations();
    }
  }

  /* ---------- Selected Station Telemetry Tray & Charts ---------- */

  function selectStation(key, options) {
    if (!key || !state.nodes.has(key)) return;
    state.selectedKey = key;
    const node = state.nodes.get(key);
    if (
      state.mapMode === 'leaflet' &&
      state.map &&
      typeof node.lat === 'number' &&
      typeof node.lon === 'number'
    ) {
      state.map.panTo([node.lat, node.lon], { animate: !isReducedMotion() });
    }
    renderAll();
    if (
      options &&
      options.openPopup &&
      state.mapMode === 'leaflet' &&
      state.map &&
      typeof node.lat === 'number' &&
      typeof node.lon === 'number'
    ) {
      const marker = state.markers.get(key);
      if (marker) marker.openPopup();
    }
  }

  function setActiveMetric(metricKey) {
    if (!METRIC_META[metricKey]) return;
    state.activeMetric = metricKey;
    updateMetricTabAttributes();
    renderCharts();
  }

  function updateMetricTabAttributes() {
    for (const metric of METRIC_ORDER) {
      const tab = getEl('kpi-tab-' + metric);
      if (!tab) continue;
      const isSelected = metric === state.activeMetric;
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tab.tabIndex = isSelected ? 0 : -1;
    }
    const panel = getEl('focus-chart-panel');
    if (panel) {
      panel.setAttribute('aria-labelledby', 'kpi-tab-' + state.activeMetric);
    }
  }

  function setChartMode(mode) {
    if (mode !== 'single' && mode !== 'quad') return;
    state.chartMode = mode;

    const btnSingle = getEl('btn-mode-single');
    const btnQuad = getEl('btn-mode-quad');
    if (btnSingle) btnSingle.setAttribute('aria-pressed', mode === 'single' ? 'true' : 'false');
    if (btnQuad) btnQuad.setAttribute('aria-pressed', mode === 'quad' ? 'true' : 'false');

    const singleWrap = getEl('charts-single-layout');
    const quadWrap = getEl('charts-grid');
    if (singleWrap) singleWrap.hidden = mode !== 'single';
    if (quadWrap) quadWrap.hidden = mode !== 'quad';

    window.requestAnimationFrame(() => renderCharts());
  }

  function renderSelectedTelemetry(nodes, now) {
    const selectEl = getEl('station-select');
    if (selectEl) {
      selectEl.innerHTML = '';
      if (nodes.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Sin estaciones';
        selectEl.appendChild(opt);
        selectEl.disabled = true;
      } else {
        for (const node of nodes) {
          const opt = document.createElement('option');
          opt.value = node.key;
          opt.textContent = (node.nombre || node.nodo) + ' (' + node.key + ')';
          if (node.key === state.selectedKey) opt.selected = true;
          selectEl.appendChild(opt);
        }
        selectEl.disabled = false;
      }
    }

    const node = state.selectedKey ? state.nodes.get(state.selectedKey) : null;
    const nameEl = getEl('selected-station-name');
    const slugEl = getEl('selected-station-slug');
    const linkEl = getEl('selected-station-link');
    const samplesEl = getEl('chart-samples-badge');
    const emptyEl = getEl('charts-empty');
    const trayContentEl = getEl('charts-tray-content');

    if (!node) {
      if (nameEl) nameEl.textContent = 'Estación seleccionada';
      if (slugEl) {
        slugEl.textContent = '';
        slugEl.hidden = true;
      }
      if (linkEl) {
        linkEl.textContent =
          'Selecciona una estación en la lista o el mapa para inspeccionar su enlace LoRa y series.';
      }
      if (samplesEl) samplesEl.textContent = '0 / ' + MAX_SAMPLES + ' muestras';
      if (emptyEl) emptyEl.hidden = false;
      if (trayContentEl) trayContentEl.hidden = true;
      return;
    }

    const badge = getNodeBadgeInfo(node, now);
    if (nameEl) nameEl.textContent = node.nombre || node.nodo;
    if (slugEl) {
      slugEl.textContent = node.key;
      slugEl.hidden = false;
    }

    if (linkEl) {
      const rssiStr = node.rssi !== null ? node.rssi + ' dBm' : MISSING_MARK;
      const snrStr = node.snr !== null ? node.snr + ' dB' : MISSING_MARK;
      const pdrStr = node.pdr !== null ? formatNumber(node.pdr, 1) + ' %' : MISSING_MARK;
      const seqStr = node.seq !== null ? '#' + node.seq : MISSING_MARK;
      const bootStr = node.boot !== null ? 'boot ' + node.boot : '';
      linkEl.textContent =
        badge.text +
        ' · RSSI ' +
        rssiStr +
        ' · SNR ' +
        snrStr +
        ' · PDR ' +
        pdrStr +
        ' · Trama ' +
        seqStr +
        (bootStr ? ' (' + bootStr + ')' : '');
    }

    if (samplesEl) {
      samplesEl.textContent = node.history.length + ' / ' + MAX_SAMPLES + ' muestras';
    }

    if (emptyEl) emptyEl.hidden = true;
    if (trayContentEl) trayContentEl.hidden = false;

    for (const metric of METRIC_ORDER) {
      const meta = METRIC_META[metric];
      const tabEl = getEl('kpi-tab-' + metric);
      const valEl = getEl('kpi-val-' + metric);
      const unitEl = getEl('kpi-unit-' + metric);
      const hintEl = getEl('kpi-hint-' + metric);

      const isValid = Boolean(node.validez & meta.valBit) && node[metric] !== null;
      const isAnom = Boolean(meta.anoBit && node.anomalias & meta.anoBit);

      if (tabEl) {
        tabEl.classList.toggle('kpi--anom', isAnom);
      }
      if (valEl) {
        valEl.textContent = isValid ? formatNumber(node[metric], meta.decimals) : MISSING_MARK;
        valEl.classList.toggle('kpi-value--missing', !isValid);
      }
      if (unitEl) {
        unitEl.hidden = !isValid;
        unitEl.textContent = meta.unit;
      }
      if (hintEl) {
        if (!isValid) {
          hintEl.textContent = 'Sonda desconectada';
        } else if (isAnom) {
          hintEl.textContent = 'Fuera de umbral';
        } else {
          hintEl.textContent = meta.kpiHint;
        }
      }
    }

    updateMetricTabAttributes();
    renderRecentEventsPanel();
    renderCharts();
  }

  function renderRecentEventsPanel() {
    const container = getEl('recent-events-list');
    if (!container) return;
    container.innerHTML = '';

    const subset = state.events.slice(0, 5);
    if (subset.length === 0) {
      const empty = createEl('div', 'empty-state empty-state--compact');
      empty.appendChild(
        createEl('p', 'empty-state__desc', 'Sin transiciones ni alertas recientes.')
      );
      container.appendChild(empty);
      return;
    }

    for (const ev of subset) {
      const item = createEl('div', 'recent-item');
      const top = createEl('div', 'recent-item__top');
      top.appendChild(createEl('span', 'recent-item__station', ev.station));
      top.appendChild(createEl('span', 'recent-item__time num', formatClockTime(ev.ts)));
      item.appendChild(top);
      item.appendChild(createEl('div', 'recent-item__detail', ev.detail));
      container.appendChild(item);
    }
  }

  const thresholdLinesPlugin = {
    id: 'qmThresholdLines',
    beforeDatasetsDraw(chart) {
      const refs =
        chart.config && chart.config.options && chart.config.options.qmRefs
          ? chart.config.options.qmRefs
          : [];
      if (!refs.length) return;
      const yScale = chart.scales && chart.scales.y;
      const area = chart.chartArea;
      if (!yScale || !area) return;

      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = REF_LINE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      for (const refVal of refs) {
        const yPx = yScale.getPixelForValue(refVal);
        if (yPx >= area.top && yPx <= area.bottom) {
          ctx.beginPath();
          ctx.moveTo(area.left, yPx);
          ctx.lineTo(area.right, yPx);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  };

  function destroyChartSlot(slotKey) {
    if (state.charts[slotKey]) {
      state.charts[slotKey].destroy();
      state.charts[slotKey] = null;
    }
  }

  function renderSvgChart(fallbackEl, samples, meta) {
    if (!fallbackEl) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const width = 560;
    const height = 180;
    const padL = 38;
    const padR = 12;
    const padT = 14;
    const padB = 22;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    fallbackEl.innerHTML = '';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);

    const nums = [];
    for (const s of samples) {
      if (typeof s[meta.key] === 'number' && Number.isFinite(s[meta.key])) {
        nums.push(s[meta.key]);
      }
    }
    for (const r of meta.refs) nums.push(r);

    let minY = nums.length ? Math.min(...nums) : meta.suggestedMin ?? 0;
    let maxY = nums.length ? Math.max(...nums) : meta.suggestedMax ?? 1;
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    } else {
      const pad = (maxY - minY) * 0.1;
      minY -= pad;
      maxY += pad;
    }

    const toX = (idx) => {
      if (samples.length <= 1) return padL + plotW / 2;
      return padL + (idx / (samples.length - 1)) * plotW;
    };
    const toY = (val) => padT + ((maxY - val) / (maxY - minY)) * plotH;

    for (const refVal of meta.refs) {
      const ry = toY(refVal);
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(padL));
      line.setAttribute('x2', String(width - padR));
      line.setAttribute('y1', ry.toFixed(1));
      line.setAttribute('y2', ry.toFixed(1));
      line.setAttribute('stroke', REF_LINE_COLOR);
      line.setAttribute('stroke-dasharray', '4 4');
      svg.appendChild(line);
    }

    let segment = [];
    const flushSegment = () => {
      if (segment.length >= 2) {
        const poly = document.createElementNS(svgNS, 'polyline');
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', ACCENT_HEX);
        poly.setAttribute('stroke-width', '2');
        poly.setAttribute('points', segment.map((p) => p.x + ',' + p.y).join(' '));
        svg.appendChild(poly);
      } else if (segment.length === 1) {
        const pt = document.createElementNS(svgNS, 'circle');
        pt.setAttribute('cx', segment[0].x);
        pt.setAttribute('cy', segment[0].y);
        pt.setAttribute('r', '3');
        pt.setAttribute('fill', ACCENT_HEX);
        svg.appendChild(pt);
      }
      segment = [];
    };

    samples.forEach((sample, idx) => {
      const val = sample[meta.key];
      if (typeof val === 'number' && Number.isFinite(val)) {
        const px = toX(idx).toFixed(1);
        const py = toY(val).toFixed(1);
        segment.push({ x: px, y: py });
      } else {
        flushSegment();
      }
    });
    flushSegment();

    samples.forEach((sample, idx) => {
      const val = sample[meta.key];
      if (
        typeof val === 'number' &&
        Number.isFinite(val) &&
        meta.anoBit &&
        sample.anomalias & meta.anoBit
      ) {
        const anomDot = document.createElementNS(svgNS, 'circle');
        anomDot.setAttribute('cx', toX(idx).toFixed(1));
        anomDot.setAttribute('cy', toY(val).toFixed(1));
        anomDot.setAttribute('r', '4');
        anomDot.setAttribute('fill', NEGATIVE_HEX);
        anomDot.setAttribute('stroke', '#ffffff');
        anomDot.setAttribute('stroke-width', '1.5');
        svg.appendChild(anomDot);
      }
    });

    const minLabel = document.createElementNS(svgNS, 'text');
    minLabel.setAttribute('x', '4');
    minLabel.setAttribute('y', String(height - padB));
    minLabel.setAttribute('font-size', '12');
    minLabel.setAttribute('fill', MUTED_HEX);
    minLabel.textContent = formatNumber(minY, meta.decimals);
    svg.appendChild(minLabel);

    const maxLabel = document.createElementNS(svgNS, 'text');
    maxLabel.setAttribute('x', '4');
    maxLabel.setAttribute('y', String(padT + 8));
    maxLabel.setAttribute('font-size', '12');
    maxLabel.setAttribute('fill', MUTED_HEX);
    maxLabel.textContent = formatNumber(maxY, meta.decimals);
    svg.appendChild(maxLabel);

    fallbackEl.appendChild(svg);
  }

  function renderSingleChartSlot(slotKey, canvasId, fallbackId, latestId, node, meta) {
    const latestEl = getEl(latestId);
    const isValid = node && Boolean(node.validez & meta.valBit) && node[meta.key] !== null;
    const isAnom = node && Boolean(meta.anoBit && node.anomalias & meta.anoBit);

    if (latestEl) {
      latestEl.textContent = isValid
        ? formatNumber(node[meta.key], meta.decimals) + ' ' + meta.unit
        : MISSING_MARK;
      latestEl.classList.toggle('chart-latest--anom', isAnom);
    }

    const canvas = getEl(canvasId);
    const fallbackEl = getEl(fallbackId);
    if (!canvas || !fallbackEl) return;

    const samples = node ? node.history : [];

    if (!state.vendorStatus.chart || typeof window.Chart === 'undefined') {
      destroyChartSlot(slotKey);
      canvas.hidden = true;
      fallbackEl.hidden = false;
      renderSvgChart(fallbackEl, samples, meta);
      return;
    }

    canvas.hidden = false;
    fallbackEl.hidden = true;

    const labels = samples.map((s) => s.label);
    const dataPoints = samples.map((s) => s[meta.key]);
    const pointRadii = samples.map((s) =>
      meta.anoBit && s.anomalias & meta.anoBit ? 4 : 0
    );
    const pointColors = samples.map((s) =>
      meta.anoBit && s.anomalias & meta.anoBit ? NEGATIVE_HEX : ACCENT_HEX
    );

    const existing = state.charts[slotKey];
    if (existing) {
      existing.data.labels = labels;
      existing.data.datasets[0].label = meta.label;
      existing.data.datasets[0].data = dataPoints;
      existing.data.datasets[0].pointRadius = pointRadii;
      existing.data.datasets[0].pointBackgroundColor = pointColors;
      existing.options.qmRefs = meta.refs;
      existing.options.scales.y.suggestedMin = meta.suggestedMin;
      existing.options.scales.y.suggestedMax = meta.suggestedMax;
      existing.update('none');
      existing.resize();
      return;
    }

    state.charts[slotKey] = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: meta.label,
            data: dataPoints,
            borderColor: ACCENT_HEX,
            backgroundColor: ACCENT_FILL,
            borderWidth: 2,
            tension: 0,
            fill: true,
            spanGaps: false,
            pointRadius: pointRadii,
            pointHoverRadius: 5,
            pointBackgroundColor: pointColors,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        qmRefs: meta.refs,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const v = ctx.parsed && ctx.parsed.y;
                if (typeof v !== 'number' || !Number.isFinite(v)) {
                  return meta.shortLabel + ': ' + MISSING_MARK;
                }
                return meta.shortLabel + ': ' + v.toFixed(meta.decimals) + ' ' + meta.unit;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: MUTED_HEX,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6,
              font: { size: 12 },
            },
          },
          y: {
            suggestedMin: meta.suggestedMin,
            suggestedMax: meta.suggestedMax,
            grid: { color: GRID_RULE_HEX },
            ticks: {
              color: MUTED_HEX,
              font: { size: 12 },
            },
          },
        },
      },
      plugins: [thresholdLinesPlugin],
    });
  }

  function renderCharts() {
    if (state.activeView !== 'monitoreo') return;
    const node = state.selectedKey ? state.nodes.get(state.selectedKey) : null;
    if (!node) return;

    if (state.chartMode === 'single') {
      const meta = METRIC_META[state.activeMetric] || METRIC_META.ph;
      const titleEl = getEl('focus-chart-title');
      const hintEl = getEl('focus-chart-hint');
      if (titleEl) titleEl.textContent = meta.label;
      if (hintEl) hintEl.textContent = meta.hint;
      renderSingleChartSlot(
        'focus',
        'chart-focus',
        'chart-fallback-focus',
        'focus-chart-latest',
        node,
        meta
      );
    } else {
      for (const metric of METRIC_ORDER) {
        renderSingleChartSlot(
          metric,
          'chart-' + metric,
          'chart-fallback-' + metric,
          'chart-latest-' + metric,
          node,
          METRIC_META[metric]
        );
      }
    }
  }

  /* ---------- Topic Combobox & LWT Panel ---------- */

  function renderTopicMenu(menuEl, filterQuery) {
    if (!menuEl) return;

    const query = String(filterQuery || '').trim().toLowerCase();
    const activeTopic = state.inspectorTopic;

    const stationItems = getAvailableStations().map((s) => ({
      topic: s.topic,
      label:
        s.etiquetaNombre +
        ' · ' +
        s.displayZona +
        (s.simulado ? ' · Simulado' : ''),
    }));

    const liveItems = Array.from(state.discoveredTopics.values())
      .sort((a, b) => a.topic.localeCompare(b.topic, 'es'))
      .map((entry) => ({
        topic: entry.topic,
        label:
          (entry.retained ? 'Retenido' : 'En vivo') +
          (entry.payloadPreview ? ' · ' + entry.payloadPreview : ''),
      }));

    const groups = [
      { title: 'Filtros rápidos', items: QUICK_FILTER_TOPICS },
      { title: 'Estaciones detectadas', items: stationItems },
      { title: 'Canales y diagnóstico', items: CHANNEL_DIAG_TOPICS },
      { title: 'Tópicos en vivo', items: liveItems },
    ];

    menuEl.innerHTML = '';
    let renderedCount = 0;

    for (const group of groups) {
      const matched = query
        ? group.items.filter(
            (item) =>
              item.topic.toLowerCase().includes(query) ||
              item.label.toLowerCase().includes(query)
          )
        : group.items;

      if (matched.length === 0) continue;

      const header = createEl('div', 'topic-menu__group', group.title);
      header.setAttribute('role', 'presentation');
      menuEl.appendChild(header);

      for (const item of matched) {
        const isSelected = item.topic === activeTopic;
        const btn = createEl(
          'button',
          'topic-menu__item' + (isSelected ? ' topic-menu__item--active' : '')
        );
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        btn.dataset.topic = item.topic;
        btn.appendChild(createEl('span', 'topic-menu__slug', item.topic));
        btn.appendChild(createEl('span', 'topic-menu__label', item.label));
        menuEl.appendChild(btn);
        renderedCount += 1;
      }
    }

    if (renderedCount === 0) {
      menuEl.appendChild(
        createEl(
          'div',
          'topic-menu__empty',
          'Sin sugerencias coincidentes. Pulsa Suscribir para suscribir el tópico escrito.'
        )
      );
    }
  }

  function renderLwtPanel() {
    const gwId = state.gwId || 'gw01';
    const panelBadge = getEl('lwt-panel-badge');
    const gwIdEl = getEl('lwt-gw-id');
    const gwStatePill = getEl('lwt-gw-state-pill');
    const gwTopicEl = getEl('lwt-gw-topic');
    const gwOriginEl = getEl('lwt-gw-origin');
    const gwMsgEl = getEl('lwt-gw-message');
    const diagPill = getEl('lwt-diag-pill');
    const diagTopicEl = getEl('lwt-diag-topic');
    const diagRetriesEl = getEl('lwt-diag-retries');
    const diagMotivoEl = getEl('lwt-diag-motivo');
    const presenceCountEl = getEl('lwt-presence-count');
    const presenceListEl = getEl('lwt-presence-list');

    if (gwIdEl) gwIdEl.textContent = gwId;
    if (gwTopicEl) gwTopicEl.textContent = 'qawapmayu/v1/gw/' + gwId + '/conexion';
    if (diagTopicEl) diagTopicEl.textContent = 'qawapmayu/v1/gw/' + gwId + '/diagnostico';

    const isSordera =
      state.gwDiag.sordera ||
      state.gwDiag.estado === 'sordera_rearmando' ||
      state.gwDiag.estado === 'sordera_reinicio';

    let offlineStations = 0;
    for (const ent of state.lwtEntities.values()) {
      if (ent.kind === 'node' && !ent.online) offlineStations += 1;
    }

    if (panelBadge) {
      if (state.gwOnline === false) {
        panelBadge.className = 'pill pill--bad';
        panelBadge.textContent = 'Gateway offline (LWT)';
      } else if (isSordera) {
        panelBadge.className =
          'pill ' + (state.gwDiag.estado === 'sordera_reinicio' ? 'pill--bad' : 'pill--warn');
        panelBadge.textContent = 'Sordera RX (' + (state.gwDiag.reintentosRx || 0) + '/3)';
      } else if (offlineStations > 0) {
        panelBadge.className = 'pill pill--warn';
        panelBadge.textContent =
          offlineStations + (offlineStations === 1 ? ' estación offline' : ' estaciones offline');
      } else if (state.gwOnline === true) {
        panelBadge.className = 'pill pill--ok';
        panelBadge.textContent = 'Enlace nominal';
      } else {
        panelBadge.className = 'pill pill--neutral';
        panelBadge.textContent = 'Esperando LWT';
      }
    }

    if (gwStatePill) {
      if (state.gwOnline === true) {
        gwStatePill.className = 'pill pill--ok';
        gwStatePill.textContent = 'En línea';
      } else if (state.gwOnline === false) {
        gwStatePill.className = 'pill pill--bad';
        gwStatePill.textContent = 'Fuera de línea (LWT)';
      } else {
        gwStatePill.className = 'pill pill--neutral';
        gwStatePill.textContent = 'Esperando';
      }
    }

    if (gwOriginEl) {
      if (state.gwOnline !== null) {
        gwOriginEl.textContent =
          (state.gwLwtRetained ? 'Retenido' : 'En vivo') +
          (state.gwLwtTsMs ? ' · ' + formatClockTime(state.gwLwtTsMs) : '');
      } else {
        gwOriginEl.textContent = 'Sin mensajes';
      }
    }

    if (gwMsgEl) {
      if (state.gwOnline === false) {
        gwMsgEl.textContent = state.lwtCustomMessage;
      } else if (state.gwOnline === true) {
        gwMsgEl.textContent = 'Enlace MQTT activo';
      } else {
        gwMsgEl.textContent = 'Esperando publicación LWT del gateway.';
      }
    }

    const diagMeta = getGwDiagMeta(state.gwDiag.estado, state.gwDiag.reintentosRx);
    if (diagPill) {
      diagPill.className = 'pill ' + diagMeta.pillClass;
      diagPill.textContent = diagMeta.label;
    }
    if (diagRetriesEl) {
      diagRetriesEl.textContent =
        'Reintentos RX: ' +
        (state.gwDiag.reintentosRx || 0) +
        (state.gwDiag.silencioS > 0 ? ' · Silencio ' + state.gwDiag.silencioS + ' s' : '') +
        (state.gwDiag.tsMs ? ' · ' + formatClockTime(state.gwDiag.tsMs) : '');
    }

    if (diagMotivoEl) {
      if (state.gwDiag.estado) {
        const humanMotivo = humanizeSorderaMotivo(state.gwDiag.motivo, state.gwDiag);
        diagMotivoEl.textContent =
          state.gwDiag.estado === 'nodo_silencio' &&
          state.gwDiag.nodo &&
          !humanMotivo.includes(state.gwDiag.nodo)
            ? humanMotivo + ' · ' + state.gwDiag.nodo
            : humanMotivo;
      } else {
        diagMotivoEl.textContent = 'Esperando diagnóstico de radio LoRa.';
      }
    }

    if (!presenceListEl) return;
    const entities = Array.from(state.lwtEntities.values()).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'gw' ? -1 : 1;
      return a.key.localeCompare(b.key, 'es');
    });

    if (presenceCountEl) {
      presenceCountEl.textContent =
        entities.length + (entities.length === 1 ? ' entidad' : ' entidades');
    }

    presenceListEl.innerHTML = '';
    if (entities.length === 0) {
      const empty = createEl('div', 'empty-state empty-state--compact');
      empty.appendChild(
        createEl('p', 'empty-state__desc', 'Aún no se registran estados de presencia en .../conexion.')
      );
      presenceListEl.appendChild(empty);
      return;
    }

    for (const ent of entities) {
      const isImpactedHw =
        ent.kind === 'node' && !ent.simulado && (state.gwOnline === false || isSordera);
      const isNodeSilenced =
        ent.kind === 'node' &&
        state.gwDiag.estado === 'nodo_silencio' &&
        state.gwDiag.nodo === ent.id;

      const row = createEl('div', 'lwt-row' + (ent.online ? '' : ' lwt-row--offline'));

      const main = createEl('div', 'lwt-row__main');
      main.appendChild(createEl('div', 'lwt-row__title', ent.label));

      const subLabel =
        ent.kind === 'gw'
          ? 'Puente LoRa · afecta Hardware'
          : ent.simulado
            ? 'Directo MQTT'
            : 'Vía LoRa (' + gwId + ')';
      main.appendChild(createEl('span', 'lwt-row__sub', subLabel));

      let noteText = '';
      if (!ent.online) {
        noteText = state.lwtCustomMessage;
        if (isImpactedHw) {
          noteText +=
            ' · ' +
            gwId +
            (state.gwOnline === false ? ' fuera de línea (LWT)' : ' en sordera RX');
        }
      } else if (ent.kind === 'gw' && isSordera) {
        noteText = humanizeSorderaMotivo(state.gwDiag.motivo, state.gwDiag);
      } else if (isImpactedHw) {
        noteText =
          state.gwOnline === false
            ? 'Impactado: ' + gwId + ' fuera de línea (LWT)'
            : 'Impactado: ' + gwId + ' sin tramas LoRa';
      }
      if (noteText) {
        main.appendChild(createEl('p', 'lwt-row__note', noteText));
      }
      row.appendChild(main);

      const side = createEl('div', 'lwt-row__side');
      let sidePillClass = 'pill pill--ok';
      let sidePillLabel = 'En línea';
      if (!ent.online) {
        sidePillClass = 'pill pill--bad';
        sidePillLabel = 'Fuera de línea';
      } else if ((ent.kind === 'gw' && isSordera) || isImpactedHw || isNodeSilenced) {
        sidePillClass =
          'pill ' +
          (ent.kind === 'gw' && state.gwDiag.estado === 'sordera_reinicio'
            ? 'pill--bad'
            : 'pill--warn');
        sidePillLabel = 'Silencio LoRa';
      }
      side.appendChild(createEl('span', sidePillClass, sidePillLabel));
      side.appendChild(
        createEl(
          'span',
          'lwt-row__meta num',
          (ent.retained ? 'Retenido' : 'En vivo') + ' · ' + formatClockTime(ent.tsMs)
        )
      );
      row.appendChild(side);

      presenceListEl.appendChild(row);
    }
  }

  /* ---------- Events & Inspector Views ---------- */

  function renderEventsViews() {
    const navBadge = getEl('nav-events-badge');
    if (navBadge) {
      navBadge.textContent = String(state.events.length);
      navBadge.hidden = state.events.length === 0;
    }

    renderRecentEventsPanel();

    const filterInput = getEl('event-filter');
    const query = filterInput ? filterInput.value.trim().toLowerCase() : '';
    const filtered = query
      ? state.events.filter(
          (ev) =>
            ev.station.toLowerCase().includes(query) ||
            ev.slug.toLowerCase().includes(query) ||
            ev.badgeText.toLowerCase().includes(query) ||
            ev.detail.toLowerCase().includes(query)
        )
      : state.events;

    const countEl = getEl('event-count');
    if (countEl) {
      countEl.textContent =
        filtered.length + (filtered.length === 1 ? ' evento' : ' eventos');
    }

    const listEl = getEl('event-log-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (filtered.length === 0) {
      const empty = createEl('div', 'empty-state empty-state--compact');
      empty.appendChild(
        createEl(
          'p',
          'empty-state__desc',
          state.events.length === 0
            ? 'Aún no se registran eventos de captura ni cambios de estado.'
            : 'Ningún evento coincide con el filtro.'
        )
      );
      listEl.appendChild(empty);
      return;
    }

    for (const ev of filtered) {
      const row = createEl('div', 'event-item');
      row.appendChild(createEl('span', 'event-item__time num', formatClockTime(ev.ts)));
      row.appendChild(createEl('span', 'event-item__station', ev.station));
      row.appendChild(createEl('span', 'pill ' + ev.pillClass, ev.badgeText));
      row.appendChild(createEl('span', 'event-item__detail', ev.detail));
      listEl.appendChild(row);
    }
  }

  function renderInspectorTable() {
    const filterInput = getEl('inspector-filter');
    const query = filterInput ? filterInput.value.trim().toLowerCase() : '';
    const filtered = query
      ? state.inspectorRows.filter(
          (row) =>
            row.topic.toLowerCase().includes(query) ||
            row.payload.toLowerCase().includes(query)
        )
      : state.inspectorRows;

    const total = filtered.length;
    const pageSize = state.inspectorPageSize || 25;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    state.inspectorPage = Math.min(Math.max(1, state.inspectorPage), totalPages);
    const startIdx = (state.inspectorPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageRows = filtered.slice(startIdx, endIdx);

    const countEl = getEl('inspector-count');
    if (countEl) {
      countEl.textContent =
        total + (total === 1 ? ' msg' : ' msgs');
    }

    const pageInfoEl = getEl('inspector-page-info');
    if (pageInfoEl) {
      pageInfoEl.textContent =
        total > 0
          ? 'Mostrando ' + (startIdx + 1) + '\u2013' + endIdx + ' de ' + total
          : '0 mensajes';
    }

    const pageLabelEl = getEl('inspector-page-label');
    if (pageLabelEl) {
      pageLabelEl.textContent = 'P\u00e1gina ' + state.inspectorPage + ' de ' + totalPages;
    }

    const btnPrev = getEl('btn-inspector-prev');
    if (btnPrev) btnPrev.disabled = state.inspectorPage <= 1;

    const btnNext = getEl('btn-inspector-next');
    if (btnNext) btnNext.disabled = state.inspectorPage >= totalPages;

    const tbody = getEl('inspector-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (total === 0) {
      const tr = document.createElement('tr');
      const td = createEl(
        'td',
        'mqtt-table__empty',
        state.inspectorRows.length === 0
          ? 'Sin tráfico MQTT recibido todavía.'
          : 'Ningún mensaje coincide con el filtro.'
      );
      td.colSpan = 4;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    for (const row of pageRows) {
      const tr = document.createElement('tr');

      const tdTime = createEl('td', 'mqtt-table__time num', formatClockWithMs(row.timeMs));
      tdTime.setAttribute('data-label', 'Hora');
      tr.appendChild(tdTime);

      const tdOrigin = createEl('td', 'mqtt-table__origin');
      tdOrigin.setAttribute('data-label', 'Origen');
      tdOrigin.appendChild(
        createEl(
          'span',
          row.retained ? 'pill pill--neutral' : 'pill pill--ok',
          row.retained ? 'Retenido' : 'En vivo'
        )
      );
      tr.appendChild(tdOrigin);

      const tdTopic = createEl('td', 'mqtt-table__topic');
      tdTopic.setAttribute('data-label', 'Tópico');
      tdTopic.appendChild(createEl('code', 'topic-slug', row.topic));
      tr.appendChild(tdTopic);

      const tdPayload = createEl('td', 'mqtt-table__payload');
      tdPayload.setAttribute('data-label', 'Payload');
      tdPayload.appendChild(createEl('code', 'num', row.payload));
      tr.appendChild(tdPayload);

      tbody.appendChild(tr);
    }
  }

  /* ---------- Stale Refresh Loop & Event Wiring ---------- */

  function tickStaleCheck() {
    const now = Date.now();
    const ageNodes = document.querySelectorAll('[data-age-for]');
    for (const el of ageNodes) {
      const node = state.nodes.get(el.dataset.ageFor);
      if (node) {
        el.textContent = formatRelativeAge(node, now);
      }
    }

    let stateChanged = false;
    for (const row of document.querySelectorAll('.station-row[data-node-key]')) {
      const node = state.nodes.get(row.dataset.nodeKey);
      if (!node) continue;
      const stale = isNodeStale(node, now);
      if ((row.dataset.stale === 'true') !== stale) {
        stateChanged = true;
        break;
      }
    }

    if (stateChanged) {
      scheduleRender();
    }
  }

  function wireMetricKeyboardNavigation() {
    const tablist = getEl('metric-kpi-strip');
    if (!tablist) return;

    tablist.addEventListener('keydown', (evt) => {
      const idx = METRIC_ORDER.indexOf(state.activeMetric);
      if (idx < 0) return;

      let nextIdx = -1;
      if (evt.key === 'ArrowRight' || evt.key === 'ArrowDown') {
        nextIdx = (idx + 1) % METRIC_ORDER.length;
      } else if (evt.key === 'ArrowLeft' || evt.key === 'ArrowUp') {
        nextIdx = (idx - 1 + METRIC_ORDER.length) % METRIC_ORDER.length;
      } else if (evt.key === 'Home') {
        nextIdx = 0;
      } else if (evt.key === 'End') {
        nextIdx = METRIC_ORDER.length - 1;
      }

      if (nextIdx >= 0) {
        evt.preventDefault();
        const nextMetric = METRIC_ORDER[nextIdx];
        setActiveMetric(nextMetric);
        const targetTab = getEl('kpi-tab-' + nextMetric);
        if (targetTab) targetTab.focus();
      }
    });
  }

  function wireTopicCombobox({ formId, inputId, toggleId, menuId, errorId, onSubmit }) {
    const formEl = getEl(formId);
    const inputEl = getEl(inputId);
    const toggleEl = getEl(toggleId);
    const menuEl = getEl(menuId);
    const errorEl = getEl(errorId);
    if (!formEl || !inputEl || !toggleEl || !menuEl) return null;

    let dirtyFilter = false;
    let activeIndex = -1;

    function getOptionNodes() {
      return Array.from(menuEl.querySelectorAll('.topic-menu__item[data-topic]'));
    }

    function updateFocusedOption(nextIdx) {
      const items = getOptionNodes();
      for (const item of items) {
        item.classList.remove('topic-menu__item--focused');
      }
      if (items.length === 0 || nextIdx < 0) {
        activeIndex = -1;
        return;
      }
      const bounded = ((nextIdx % items.length) + items.length) % items.length;
      activeIndex = bounded;
      const target = items[bounded];
      target.classList.add('topic-menu__item--focused');
      target.scrollIntoView({ block: 'nearest' });
    }

    function openMenu(useFilter) {
      for (const ctrl of state.comboboxControllers) {
        if (ctrl.menuEl !== menuEl) ctrl.closeMenu();
      }
      activeIndex = -1;
      renderTopicMenu(menuEl, useFilter ? inputEl.value : '');
      menuEl.hidden = false;
      inputEl.setAttribute('aria-expanded', 'true');
      toggleEl.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      if (menuEl.hidden) return;
      menuEl.hidden = true;
      activeIndex = -1;
      inputEl.setAttribute('aria-expanded', 'false');
      toggleEl.setAttribute('aria-expanded', 'false');
    }

    function commitTopic(topic) {
      dirtyFilter = false;
      inputEl.value = topic;
      closeMenu();
      onSubmit(topic);
    }

    inputEl.addEventListener('focus', () => {
      openMenu(dirtyFilter);
    });

    inputEl.addEventListener('input', () => {
      dirtyFilter = true;
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.hidden = true;
      }
      openMenu(true);
    });

    inputEl.addEventListener('keydown', (evt) => {
      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        if (menuEl.hidden) {
          openMenu(dirtyFilter);
        }
        updateFocusedOption(activeIndex + 1);
      } else if (evt.key === 'ArrowUp') {
        if (!menuEl.hidden) {
          evt.preventDefault();
          updateFocusedOption(activeIndex <= 0 ? getOptionNodes().length - 1 : activeIndex - 1);
        }
      } else if (evt.key === 'Escape') {
        if (!menuEl.hidden) {
          evt.preventDefault();
          evt.stopPropagation();
          closeMenu();
        }
      } else if (evt.key === 'Enter' && !menuEl.hidden && activeIndex >= 0) {
        const items = getOptionNodes();
        const chosen = items[activeIndex];
        if (chosen && chosen.dataset.topic) {
          evt.preventDefault();
          commitTopic(chosen.dataset.topic);
        }
      }
    });

    toggleEl.addEventListener('click', () => {
      if (!menuEl.hidden) {
        closeMenu();
      } else {
        openMenu(false);
        inputEl.focus();
      }
    });

    menuEl.addEventListener('click', (evt) => {
      const targetBtn = evt.target && evt.target.closest
        ? evt.target.closest('.topic-menu__item[data-topic]')
        : null;
      if (!targetBtn) return;
      const chosenTopic = targetBtn.dataset.topic;
      if (chosenTopic) {
        commitTopic(chosenTopic);
      }
    });

    formEl.addEventListener('submit', (evt) => {
      evt.preventDefault();
      dirtyFilter = false;
      closeMenu();
      onSubmit(inputEl.value);
    });

    const controller = { formEl, inputEl, menuEl, closeMenu };
    state.comboboxControllers.push(controller);
    return controller;
  }

  function wireDOMEvents() {
    const navButtons = document.querySelectorAll('.nav-item[data-view]');
    for (const btn of navButtons) {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    }

    const menuToggle = getEl('btn-menu-toggle');
    if (menuToggle) menuToggle.addEventListener('click', openMobileDrawer);
    const menuClose = getEl('btn-menu-close');
    if (menuClose) menuClose.addEventListener('click', () => closeMobileDrawer(true));

    document.addEventListener('pointerdown', (evt) => {
      for (const ctrl of state.comboboxControllers) {
        if (!ctrl.menuEl.hidden && !ctrl.formEl.contains(evt.target)) {
          ctrl.closeMenu();
        }
      }
    });

    document.addEventListener('focusin', (evt) => {
      for (const ctrl of state.comboboxControllers) {
        if (!ctrl.menuEl.hidden && !ctrl.formEl.contains(evt.target)) {
          ctrl.closeMenu();
        }
      }
    });

    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') {
        let closedAnyMenu = false;
        for (const ctrl of state.comboboxControllers) {
          if (!ctrl.menuEl.hidden) {
            const hadFocusInsideMenu = ctrl.menuEl.contains(document.activeElement);
            ctrl.closeMenu();
            if (hadFocusInsideMenu && ctrl.inputEl) {
              ctrl.inputEl.focus();
            }
            closedAnyMenu = true;
          }
        }
        if (!closedAnyMenu) {
          closeMobileDrawer(true);
        }
      }
    });

    const toggleConnectHandler = () => {
      if (state.connected || state.connecting) {
        disconnectMqtt();
      } else {
        const urlField = getEl('broker-url');
        connectMqtt(urlField ? urlField.value : state.brokerUrl);
      }
    };

    const sidebarConnectBtn = getEl('btn-sidebar-connect');
    if (sidebarConnectBtn) sidebarConnectBtn.addEventListener('click', toggleConnectHandler);
    const topbarConnectBtn = getEl('btn-topbar-connect');
    if (topbarConnectBtn) topbarConnectBtn.addEventListener('click', toggleConnectHandler);

    const connectForm = getEl('connect-form');
    if (connectForm) {
      connectForm.addEventListener('submit', (evt) => {
        evt.preventDefault();
        const urlField = getEl('broker-url');
        connectMqtt(urlField ? urlField.value : state.brokerUrl);
      });
    }

    const disconnectBtn = getEl('btn-disconnect');
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectMqtt);

    const dismissVendor = getEl('btn-dismiss-vendor');
    if (dismissVendor) {
      dismissVendor.addEventListener('click', () => {
        const banner = getEl('vendor-banner');
        if (banner) banner.hidden = true;
      });
    }

    const monitoreoScopeSelect = getEl('monitoreo-station-scope');
    if (monitoreoScopeSelect) {
      monitoreoScopeSelect.addEventListener('change', (evt) =>
        changeMonitoreoTopic(evt.target.value)
      );
    }

    wireTopicCombobox({
      formId: 'inspector-sub-form',
      inputId: 'inspector-sub-input',
      toggleId: 'btn-inspector-dropdown',
      menuId: 'inspector-topic-menu',
      errorId: 'inspector-sub-error',
      onSubmit: (topic) => subscribeInspectorTopic(topic),
    });

    const zoneSelect = getEl('zone-filter');
    if (zoneSelect) {
      zoneSelect.addEventListener('change', (evt) => changeMonitoreoTopic(evt.target.value));
    }

    const stationSelect = getEl('station-select');
    if (stationSelect) {
      stationSelect.addEventListener('change', (evt) => selectStation(evt.target.value));
    }

    const btnFitMap = getEl('btn-fit-map');
    if (btnFitMap) btnFitMap.addEventListener('click', fitMapToStations);

    const btnModeSingle = getEl('btn-mode-single');
    if (btnModeSingle) btnModeSingle.addEventListener('click', () => setChartMode('single'));
    const btnModeQuad = getEl('btn-mode-quad');
    if (btnModeQuad) btnModeQuad.addEventListener('click', () => setChartMode('quad'));

    for (const metric of METRIC_ORDER) {
      const tab = getEl('kpi-tab-' + metric);
      if (tab) tab.addEventListener('click', () => setActiveMetric(metric));
    }
    wireMetricKeyboardNavigation();

    const btnAllEvents = getEl('btn-view-all-events');
    if (btnAllEvents) btnAllEvents.addEventListener('click', () => switchView('eventos'));

    const lwtMsgForm = getEl('lwt-custom-msg-form');
    if (lwtMsgForm) {
      lwtMsgForm.addEventListener('submit', (evt) => {
        evt.preventDefault();
        const inputEl = getEl('lwt-custom-msg-input');
        saveLwtCustomMessage(inputEl ? inputEl.value : '');
        renderLwtPanel();
        announce('Mensaje ante LWT guardado');
      });
    }

    const eventFilter = getEl('event-filter');
    if (eventFilter) eventFilter.addEventListener('input', renderEventsViews);

    const btnClearEvents = getEl('btn-clear-events');
    if (btnClearEvents) {
      btnClearEvents.addEventListener('click', () => {
        state.events = [];
        state.seenEventKeys.clear();
        renderEventsViews();
      });
    }

    const inspectorFilter = getEl('inspector-filter');
    if (inspectorFilter) {
      inspectorFilter.addEventListener('input', () => {
        state.inspectorPage = 1;
        renderInspectorTable();
      });
    }

    const btnPauseInspector = getEl('btn-pause-inspector');
    if (btnPauseInspector) {
      btnPauseInspector.addEventListener('click', () => {
        state.inspectorPaused = !state.inspectorPaused;
        btnPauseInspector.setAttribute('aria-pressed', state.inspectorPaused ? 'true' : 'false');
        btnPauseInspector.textContent = state.inspectorPaused ? 'Reanudar' : 'Pausar';
      });
    }

    const btnClearInspector = getEl('btn-clear-inspector');
    if (btnClearInspector) {
      btnClearInspector.addEventListener('click', () => {
        state.inspectorRows = [];
        state.inspectorPage = 1;
        renderInspectorTable();
      });
    }

    const inspectorPageSize = getEl('inspector-page-size');
    if (inspectorPageSize) {
      inspectorPageSize.addEventListener('change', () => {
        const parsed = Number.parseInt(inspectorPageSize.value, 10);
        state.inspectorPageSize = Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
        state.inspectorPage = 1;
        renderInspectorTable();
      });
    }

    const btnInspectorPrev = getEl('btn-inspector-prev');
    if (btnInspectorPrev) {
      btnInspectorPrev.addEventListener('click', () => {
        if (state.inspectorPage > 1) {
          state.inspectorPage -= 1;
          renderInspectorTable();
        }
      });
    }

    const btnInspectorNext = getEl('btn-inspector-next');
    if (btnInspectorNext) {
      btnInspectorNext.addEventListener('click', () => {
        state.inspectorPage += 1;
        renderInspectorTable();
      });
    }

    const presetButtons = document.querySelectorAll('.preset-btn[data-preset-url]');
    for (const btn of presetButtons) {
      btn.addEventListener('click', () => {
        const presetUrl = btn.dataset.presetUrl;
        const urlField = getEl('broker-url');
        if (urlField && presetUrl) {
          urlField.value = presetUrl;
          urlField.focus();
        }
      });
    }
  }

  function initPresets() {
    const defaultUrl = getDefaultBrokerUrl();
    const urlInput = getEl('broker-url');
    if (urlInput) {
      urlInput.value = defaultUrl;
      urlInput.placeholder = defaultUrl;
    }
    const localPresetBtn = getEl('preset-local-broker');
    if (localPresetBtn) {
      localPresetBtn.dataset.presetUrl = defaultUrl;
      const codeEl = localPresetBtn.querySelector('code');
      if (codeEl) codeEl.textContent = defaultUrl;
    }
    const datalist = getEl('broker-url-presets');
    if (datalist) {
      datalist.innerHTML = '';
      for (const preset of [defaultUrl, 'wss://broker.emqx.io:8084/mqtt']) {
        const opt = document.createElement('option');
        opt.value = preset;
        datalist.appendChild(opt);
      }
    }
  }

  function init() {
    checkVendorAvailability();
    initPresets();
    const lwtInput = getEl('lwt-custom-msg-input');
    if (lwtInput) {
      lwtInput.value = state.lwtCustomMessage;
    }
    wireDOMEvents();
    updateMonitoreoTopicUI();
    updateConnectionUI();
    renderAll();

    if (state.staleTimerId) {
      window.clearInterval(state.staleTimerId);
    }
    state.staleTimerId = window.setInterval(tickStaleCheck, STALE_CHECK_INTERVAL_MS);

    if (state.vendorStatus.mqtt) {
      connectMqtt(state.brokerUrl);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
