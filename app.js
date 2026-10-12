(() => {
  'use strict';

  const { API_URL, TOKEN } = window.AGENDA_CONFIG || {};
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  /* ---------- Fechas (siempre 'yyyy-mm-dd') ---------- */
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const monday = s => addDays(s, -((parse(s).getDay() + 6) % 7));
  const hoy = () => iso(new Date());
  const corta = s => { const d = parse(s); return `${DIAS_CORTO[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };

  /* ---------- Estado ---------- */
  const esFinde = parse(hoy()).getDay() === 0 || parse(hoy()).getDay() === 6;
  const state = {
    view: esFinde ? 'semana' : 'hoy',
    fecha: esFinde ? addDays(monday(hoy()), 7) : hoy(),   // el finde se planifica la semana que viene
    data: { tareas: [], pendientes: [], diaLibre: 5, max: 3 },
    busy: false,
    loaded: false
  };

  const tareasDe = f => state.data.tareas.filter(t => t.fecha === f);
  const esLibre = f => parse(f).getDay() === state.data.diaLibre;
  const semana = () => Array.from({ length: 7 }, (_, i) => addDays(monday(state.fecha), i));

  /* ---------- API ---------- */
  async function load() {
    const d = monday(state.fecha);
    const url = `${API_URL}?action=state&token=${encodeURIComponent(TOKEN)}&desde=${d}&hasta=${addDays(d, 6)}`;
    const r = await (await fetch(url)).json();
    if (!r.ok) throw new Error(r.error);
    state.data = r.data;
    state.loaded = true;
  }

  async function act(action, payload = {}) {
    state.busy = true; render();
    try {
      // Sin headers: queda text/plain y evita el preflight CORS de Apps Script
      const r = await (await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ token: TOKEN, action, ...payload })
      })).json();
      if (!r.ok) throw new Error(r.error);
      await load();
    } catch (e) {
      toast(e.message || 'Error');
    } finally {
      state.busy = false; render();
    }
  }

  async function refresh() {
    state.busy = true; render();
    try { await load(); } catch (e) { toast(e.message || 'No se pudo cargar'); }
    state.busy = false; render();
  }

  /* ---------- UI helpers ---------- */
  function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().filter(c => c != null && c !== false).forEach(c => e.append(c instanceof Node ? c : String(c)));
    return e;
  }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }

  function addForm(placeholder, onSubmit, btn = 'Agregar') {
    const input = h('input', { type: 'text', placeholder, maxlength: 140, 'aria-label': placeholder });
    const form = h('form', { class: 'add', onsubmit: e => {
      e.preventDefault();
      const v = input.value.trim();
      if (v) { input.value = ''; onSubmit(v); }
    } }, input, h('button', { type: 'submit' }, btn));
    return form;
  }

  /* ---------- Navegación ---------- */
  function nav() {
    const paso = state.view === 'hoy' ? 1 : 7;
    const mover = n => { state.fecha = addDays(state.fecha, n); refresh(); };
    const irHoy = () => { state.fecha = hoy(); refresh(); };
    return h('nav', {},
      h('div', { class: 'tabs' },
        h('button', { class: state.view === 'hoy' ? 'on' : '', onclick: () => { state.view = 'hoy'; state.fecha = hoy(); refresh(); } }, 'Hoy'),
        h('button', { class: state.view === 'semana' ? 'on' : '', onclick: () => { state.view = 'semana'; refresh(); } }, 'Semana')
      ),
      h('div', { class: 'datenav' },
        h('button', { onclick: () => mover(-paso), 'aria-label': 'Anterior' }, '‹'),
        h('button', { class: 'hoy', onclick: irHoy }, 'hoy'),
        h('button', { onclick: () => mover(paso), 'aria-label': 'Siguiente' }, '›')
      )
    );
  }

  /* ---------- Fila de tarea ---------- */
  function filaTarea(t) {
    return h('div', { class: 'row' + (t.hecho ? ' done' : '') },
      h('input', { type: 'checkbox', checked: t.hecho, onchange: () => act('toggleTask', { id: t.id }) }),
      h('span', { class: 'txt' }, t.texto),
      h('button', { class: 'x', 'aria-label': 'Borrar', onclick: () => { if (confirm('¿Borrar la tarea?')) act('deleteTask', { id: t.id }); } }, '✕')
    );
  }

  /* ---------- Pendientes ---------- */
  function selectorDia(p) {
    const opts = semana().filter(f => f >= hoy() && !esLibre(f) && tareasDe(f).length < state.data.max);
    const sel = h('select', { 'aria-label': 'Asignar día', onchange: () => {
      if (sel.value) act('assignPending', { id: p.id, fecha: sel.value });
    } },
      h('option', { value: '' }, 'Asignar día…'),
      opts.map(f => h('option', { value: f }, `${corta(f)} (${tareasDe(f).length}/${state.data.max})`))
    );
    return sel;
  }

  function seccionPendientes() {
    const lista = state.data.pendientes;
    return [
      h('h2', {}, 'Fue surgiendo'),
      h('div', { class: 'card' },
        lista.length
          ? lista.map(p => h('div', { class: 'row' },
              h('span', { class: 'txt' }, p.texto),
              selectorDia(p),
              h('button', { class: 'x', 'aria-label': 'Descartar', onclick: () => act('closePending', { id: p.id }) }, '✕')))
          : h('div', { class: 'empty-msg' }, 'Nada pendiente.'),
        addForm('Idea o pendiente…', texto => act('addPending', { texto }))
      )
    ];
  }

  /* ---------- Vista Hoy ---------- */
  function vistaHoy() {
    const f = state.fecha;
    const d = parse(f);
    const ts = tareasDe(f);
    const libre = esLibre(f);
    const fechaLarga = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

    return [
      h('h1', {}, fechaLarga),
      h('p', { class: 'sub' }, libre ? 'Día libre' : `${ts.length}/${state.data.max} tareas importantes`),
      libre
        ? h('div', { class: 'free' }, 'Día libre para imprevistos. No se agendan tareas.')
        : h('div', { class: 'card' },
            ts.map(filaTarea),
            ts.length < state.data.max
              ? addForm(ts.length ? 'Otra tarea importante…' : 'Tu tarea más importante…', texto => act('addTask', { fecha: f, texto }))
              : h('div', { class: 'empty-msg' }, 'Cupo completo. Lo demás va a "Fue surgiendo".')
          ),
      seccionPendientes()
    ];
  }

  /* ---------- Vista Semana ---------- */
  function vistaSemana() {
    const dias = semana();
    const lunes = dias[0];
    const proxima = lunes > monday(hoy());
    return [
      esFinde && proxima ? h('div', { class: 'banner' }, 'Es fin de semana: repasá lo que fue surgiendo y asignale día a lo importante.') : null,
      h('h1', {}, `Semana del ${corta(lunes)}`),
      h('p', { class: 'sub' }, 'Máximo 3 tareas por día, un día libre para imprevistos.'),
      h('div', { class: 'card' },
        dias.map(f => {
          const ts = tareasDe(f);
          const libre = esLibre(f);
          return h('div', { class: 'day' + (f === hoy() ? ' today' : '') + (libre ? ' libre' : '') },
            h('div', { class: 'dhead' },
              h('span', { class: 'dname' }, `${DIAS[parse(f).getDay()]} ${parse(f).getDate()}`),
              h('span', { class: 'dcount' }, libre ? 'libre' : `${ts.length}/${state.data.max}`)),
            !libre && h('ul', {},
              ts.length
                ? ts.map(t => h('li', { class: t.hecho ? 'done' : '' }, t.texto))
                : h('li', { class: 'empty' }, '—'))
          );
        })
      ),
      seccionPendientes(),
      h('div', { class: 'cfg' }, 'Día libre semanal:',
        (() => {
          const s = h('select', { onchange: () => act('setFreeDay', { dia: Number(s.value) }) },
            DIAS.map((n, i) => h('option', { value: i, selected: i === state.data.diaLibre }, n)));
          return s;
        })())
    ];
  }

  /* ---------- Render ---------- */
  function render() {
    const app = document.getElementById('app');
    app.replaceChildren();
    if (!API_URL || API_URL.startsWith('PEGAR') || !TOKEN) {
      app.append(h('p', {}, 'Falta configurar config.js (API_URL y TOKEN).'));
      return;
    }
    app.className = state.busy ? 'loading' : '';
    app.append(nav());
    if (!state.loaded) { app.append(h('p', { class: 'sub' }, 'Cargando…')); return; }
    app.append(...[].concat(state.view === 'hoy' ? vistaHoy() : vistaSemana()).flat().filter(Boolean));
  }

  render();
  if (API_URL && !API_URL.startsWith('PEGAR')) refresh();
})();
