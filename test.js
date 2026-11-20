// Uji cepat di terminal: node test.js
const { simulate } = require('./sim.js');
const base = { nTruk: 37, nSt: 1, slots: 3, slotMode: 'all', chargeMin: 80, swapMin: 5, ppMin: 50.4, kwhPP: 57.27, capKwh: 320,
  socMin: 10, jitter: 0, startMode: 'bertahap', strategy: 'standar', earlySoc: 30, opsH: 24, propCharge: false, seed: 1 };
for (const nSt of [1, 2, 3, 4, 5]) {
  const k = simulate({ ...base, nSt }).kpi;
  console.log(`${nSt} station: swap ${k.swaps}, tunggu rata-rata ${k.avgWait.toFixed(1)} mnt, utilisasi charger ${(k.utilCharger * 100).toFixed(0)}%, efisiensi ${(k.eff * 100).toFixed(0)}%`);
}
