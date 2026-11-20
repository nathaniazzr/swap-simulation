// Simulasi swapping station per menit. Satu sumber untuk uji Node dan halaman dashboard.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// state truk: 0 standby, 1 jalan (PP), 2 antri, 3 swap
function simulate(P) {
  const T = Math.round(P.opsH * 60);
  const rnd = mulberry32(P.seed | 0);
  const N = P.nTruk, S = P.nSt;
  const socPerPP = (P.kwhPP / P.capKwh) * 100;
  const ppPerSwap = Math.max(1, Math.floor((100 - P.socMin) / socPerPP + 1e-9));
  const nb = P.slotMode === 'one' ? Math.max(1, P.slots - 1) : P.slots;
  const jit = () => 1 + (P.jitter > 0 ? (rnd() * 2 - 1) * P.jitter : 0);
  const cycleIdeal = ppPerSwap * P.ppMin + P.swapMin;

  const trucks = [];
  for (let i = 0; i < N; i++) {
    trucks.push({
      soc: P.startMode === 'bertahap' ? 100 - socPerPP * ppPerSwap * 0.98 * (i / N) : 100,
      state: 0, rem: 0, st: -1, qAt: 0, pp: 0, swaps: 0, wait: 0, startAt: 0,
    });
  }
  const sts = [];
  for (let k = 0; k < S; k++) sts.push({ ready: new Array(nb).fill(0), busyUntil: 0, queue: [], swapTruck: -1 });

  const tState = new Uint8Array(T * N), tSoc = new Float32Array(T * N), tSt = new Int8Array(T * N);
  const qLen = new Uint16Array(T * S), rdy = new Uint8Array(T * S), chg = new Uint8Array(T * S);
  const slotState = new Uint8Array(T * S * nb);
  const bayBusy = new Uint8Array(T * S);
  const events = []; // {t, truck, st, slot, wait, arr}

  function estWait(k, t) {
    const s = sts[k];
    const q = s.queue.length;
    const sorted = s.ready.slice().sort((a, b) => a - b);
    const idx = Math.min(q, nb - 1);
    const battWait = Math.max(0, sorted[idx] - t) + (q >= nb ? P.chargeMin : 0);
    const bayWait = Math.max(0, s.busyUntil - t) + q * P.swapMin;
    return Math.max(battWait, bayWait);
  }
  function chooseStation(t) {
    let best = 0, bw = Infinity;
    for (let k = 0; k < S; k++) {
      const w = estWait(k, t);
      if (w < bw - 1e-9) { bw = w; best = k; }
    }
    return best;
  }
  function readyCount(k, t) { let c = 0; for (const r of sts[k].ready) if (r <= t) c++; return c; }

  for (let t = 0; t < T; t++) {
    for (let i = 0; i < N; i++) {
      const tr = trucks[i];
      if (tr.state === 0) {
        if (t >= tr.startAt) { tr.state = 1; tr.rem = P.ppMin * jit(); }
      }
      if (tr.state === 1) {
        tr.rem -= 1;
        if (tr.rem <= 0) {
          tr.soc -= socPerPP; tr.pp += 1;
          const nextSoc = tr.soc - socPerPP;
          let go = nextSoc < P.socMin - 1e-9;
          if (!go && P.strategy === 'fleksibel' && tr.soc <= P.earlySoc) {
            const k = chooseStation(t);
            if (sts[k].queue.length === 0 && sts[k].busyUntil <= t && readyCount(k, t) > 0) go = true;
          }
          if (go) {
            const k = chooseStation(t);
            tr.state = 2; tr.st = k; tr.qAt = t; sts[k].queue.push(i);
          } else {
            tr.rem = P.ppMin * jit();
          }
        }
      } else if (tr.state === 3) {
        tr.rem -= 1;
        if (tr.rem <= 0) {
          tr.soc = 100; tr.swaps += 1; tr.state = 1; tr.rem = P.ppMin * jit();
          sts[tr.st].swapTruck = -1;
        }
      }
    }
    for (let k = 0; k < S; k++) {
      const s = sts[k];
      if (s.swapTruck < 0 && s.busyUntil <= t && s.queue.length > 0) {
        let j = -1, best = Infinity;
        for (let x = 0; x < nb; x++) if (s.ready[x] <= t && s.ready[x] < best) { best = s.ready[x]; j = x; }
        if (j >= 0) {
          const i = s.queue.shift();
          const tr = trucks[i];
          const w = t - tr.qAt;
          tr.wait += w; tr.state = 3; tr.rem = P.swapMin;
          const ct = P.propCharge ? (P.chargeMin * (100 - tr.soc)) / 100 : P.chargeMin;
          s.ready[j] = t + ct;
          s.busyUntil = t + P.swapMin; s.swapTruck = i;
          events.push({ t, truck: i, st: k, slot: j, wait: w, arr: tr.qAt, soc: tr.soc });
        }
      }
    }
    for (let i = 0; i < N; i++) {
      tState[t * N + i] = trucks[i].state; tSoc[t * N + i] = trucks[i].soc; tSt[t * N + i] = trucks[i].st;
    }
    for (let k = 0; k < S; k++) {
      const s = sts[k];
      qLen[t * S + k] = s.queue.length;
      let rc = 0, cc = 0;
      for (let x = 0; x < nb; x++) {
        const isReady = s.ready[x] <= t;
        slotState[(t * S + k) * nb + x] = isReady ? 0 : 1;
        if (isReady) rc++; else cc++;
      }
      rdy[t * S + k] = rc; chg[t * S + k] = cc;
      bayBusy[t * S + k] = s.swapTruck >= 0 ? 1 : 0;
    }
  }

  // metrik
  const waits = events.map((e) => e.wait).sort((a, b) => a - b);
  const swaps = events.length;
  const avgWait = swaps ? waits.reduce((a, b) => a + b, 0) / swaps : 0;
  const maxWait = swaps ? waits[swaps - 1] : 0;
  const p90 = swaps ? waits[Math.min(swaps - 1, Math.floor(0.9 * swaps))] : 0;
  let ppTotal = 0, waitTotal = 0;
  for (const tr of trucks) { ppTotal += tr.pp; waitTotal += tr.wait; }
  const idealPP = N * T / (P.ppMin + P.swapMin / ppPerSwap);
  let chargeMin = 0, bayMin = 0, peakQ = 0, sumQ = 0, peakCharging = 0;
  for (let t = 0; t < T; t++) {
    let qs = 0, cs = 0;
    for (let k = 0; k < S; k++) { qs += qLen[t * S + k]; cs += chg[t * S + k]; bayMin += bayBusy[t * S + k]; }
    chargeMin += cs; sumQ += qs; if (qs > peakQ) peakQ = qs; if (cs > peakCharging) peakCharging = cs;
  }
  const kwPerCharger = P.capKwh / (P.chargeMin / 60);
  let energy = 0;
  for (const e of events) energy += ((100 - e.soc) / 100) * P.capKwh;
  const waitByHour = new Array(Math.ceil(T / 60)).fill(0).map(() => ({ n: 0, w: 0 }));
  for (const e of events) { const h = Math.min(waitByHour.length - 1, Math.floor(e.arr / 60)); waitByHour[h].n++; waitByHour[h].w += e.wait; }

  return {
    P, T, N, S, nb, socPerPP, ppPerSwap, cycleIdeal, trucks, events,
    tState, tSoc, tSt, qLen, rdy, chg, slotState, bayBusy,
    kpi: {
      swaps, ppTotal, idealPP, eff: idealPP ? ppTotal / idealPP : 0,
      avgWait, maxWait, p90,
      utilCharger: chargeMin / (S * nb * T), utilBay: bayMin / (S * T),
      avgQ: sumQ / T, peakQ, peakKW: peakCharging * kwPerCharger, energyMWh: energy / 1000,
      waitShare: waitTotal / (N * T),
      capacity: S * nb * (T / P.chargeMin),
    },
    waitByHour: waitByHour.map((x) => (x.n ? x.w / x.n : 0)),
    waitByHourN: waitByHour.map((x) => x.n),
  };
}
if (typeof module !== 'undefined') module.exports = { simulate };
