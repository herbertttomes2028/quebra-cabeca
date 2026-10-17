/* Regras do jogo — usadas pelo navegador (modo solo) e pelo servidor (salas) */
(function (root) {
  const NIMG = 4, COL = ['#ff6b57', '#12b5a5'];

  function fresh(img, lvl, players) {
    const cols = lvl ? 6 : 3, rows = lvl ? 8 : 4, n = cols * rows, ids = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const signs = k => Array.from({ length: k }, () => (Math.random() < .5 ? 1 : -1));
    return {
      img, lvl, cols, rows, order: ids,
      rot: Object.fromEntries(ids.map(i => [i, Math.random() * 4 | 0])),
      hs: signs((rows - 1) * cols), vs: signs(rows * (cols - 1)), // pinos e encaixes entre as peças
      hold: {}, rc: {}, placed: {}, players, err: 0, done: false, toast: null, last: null, seq: 0
    };
  }
  const held = (S, pid) => +Object.keys(S.hold).find(k => S.hold[k] === pid);

  function handle(S, pid, a) {
    if (!S.players[pid] || !a) return;
    const h = held(S, pid), has = !isNaN(h);
    const say = (t, k) => { S.toast = { t, k, n: ++S.seq, by: pid }; };
    if (a.a === 'grab') {
      const p = a.p | 0, o = S.hold[p];
      if (o === undefined && !has && S.order.includes(p)) { S.hold[p] = pid; S.rc[pid] = 3; }
      else if (o !== undefined && o !== pid) say('Essa peça já está com ' + S.players[o].n + '!', 'err');
    } else if (a.a === 'rotate' && has && S.rc[pid] > 0) {
      S.rot[h] = (S.rot[h] + 1) % 4; S.rc[pid]--;
    } else if (a.a === 'pass' && has && S.rc[pid] === 0) {
      delete S.hold[h];
      S.order = S.order.filter(x => x !== h).concat(h);
      S.rot[h] = Math.random() * 4 | 0;
      const nx = S.order.find(x => S.hold[x] === undefined && x !== h);
      S.hold[nx === undefined ? h : nx] = pid; S.rc[pid] = 3;
    } else if (a.a === 'place' && has) {
      const slot = a.slot | 0;
      if (S.placed[slot]) return;
      if (slot === h && S.rot[h] === 0) {
        S.placed[h] = 1; S.order = S.order.filter(x => x !== h); delete S.hold[h];
        S.last = { id: h, n: ++S.seq }; say('Encaixou! 🎉', 'ok');
      } else {
        S.err++;
        say(slot === h ? 'O lugar é esse, mas a peça precisa girar!' : 'Esse encaixe não combina. Tente outro lugar.', 'err');
      }
    } else if (a.a === 'new') {
      const img = Math.max(0, Math.min(NIMG - 1, a.img | 0));
      Object.assign(S, fresh(img, a.lvl ? 1 : 0, S.players), { seq: S.seq });
    }
    if (Object.keys(S.placed).length === S.cols * S.rows) S.done = true;
  }

  // Servidor: aproveita o quebra-cabeça que a pessoa já estava montando sozinha (valida o formato)
  function adopt(s) {
    try {
      const f = fresh(Math.max(0, Math.min(NIMG - 1, s.img | 0)), s.lvl ? 1 : 0, {}), n = f.cols * f.rows;
      const ids = [...s.order, ...Object.keys(s.placed).map(Number)];
      const okIds = ids.length === n && new Set(ids).size === n && ids.every(i => Number.isInteger(i) && i >= 0 && i < n);
      const okSg = (a, b) => Array.isArray(a) && a.length === b.length && a.every(v => v === 1 || v === -1);
      const okRot = ids.every(i => [0, 1, 2, 3].includes(s.rot[i]));
      if (!okIds || !okSg(s.hs, f.hs) || !okSg(s.vs, f.vs) || !okRot) return f;
      return Object.assign(f, {
        order: s.order.slice(), rot: { ...s.rot }, hs: s.hs.slice(), vs: s.vs.slice(),
        placed: Object.fromEntries(Object.keys(s.placed).map(k => [k, 1])), err: s.err | 0
      });
    } catch (e) { return fresh(0, 0, {}); }
  }

  const G = { NIMG, COL, fresh, handle, adopt, held };
  if (typeof module !== 'undefined') module.exports = G; else root.Game = G;
})(typeof window !== 'undefined' ? window : globalThis);
