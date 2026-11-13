/**
 * ============================================================================
 *  GRISKA GO - js/chart.js
 * ----------------------------------------------------------------------------
 *  Diagram lingkaran (donut) proporsi pengeluaran, dibuat dengan SVG murni
 *  (tanpa library eksternal).
 * ============================================================================
 */

(function (global) {
  'use strict';

  /* Warna konsisten dengan tema: biru laut, teal, emas. */
  const WARNA = {
    akomodasi: '#0E5486',
    transportasi: '#1177B8',
    tiket: '#0F9D76',
    makan: '#2FC79C',
    aktivitas: '#E8A33D',
    lainLain: '#F0B95E',
    cadangan: '#8FA9BF'
  };

  /**
   * Membuat markup SVG donut.
   * @param {Array<{kunci: string, label: string, nilai: number}>} data
   * @param {object} opsi - { ukuran, tebal, labelTengah, subTengah }
   * @returns {string} markup SVG
   */
  function donut(data, opsi) {
    const o = Object.assign({ ukuran: 190, tebal: 26, labelTengah: '', subTengah: '' }, opsi || {});
    const total = data.reduce((s, d) => s + Math.max(0, d.nilai || 0), 0);
    const cx = o.ukuran / 2;
    const cy = o.ukuran / 2;
    const r = (o.ukuran - o.tebal) / 2 - 2;
    const keliling = 2 * Math.PI * r;

    if (!total) {
      return '<svg viewBox="0 0 ' + o.ukuran + ' ' + o.ukuran + '" class="donut" role="img" aria-label="Belum ada data">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#E7E1D6" stroke-width="' + o.tebal + '" />' +
        '</svg>';
    }

    let offset = 0;
    const segmen = data.filter((d) => d.nilai > 0).map((d) => {
      const bagian = d.nilai / total;
      const seg = { bagian: bagian, offset: offset, warna: WARNA[d.kunci] || '#8FA9BF' };
      offset += bagian;
      return seg;
    });

    const lingkaran = segmen.map((seg) => {
      const dash = (seg.bagian * keliling).toFixed(2) + ' ' + keliling.toFixed(2);
      const putar = (seg.offset * 360 - 90).toFixed(2);
      return '<circle class="donut__seg" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
        'stroke="' + seg.warna + '" stroke-width="' + o.tebal + '" ' +
        'stroke-dasharray="' + dash + '" stroke-dashoffset="0" ' +
        'transform="rotate(' + putar + ' ' + cx + ' ' + cy + ')">' +
        '<animate attributeName="stroke-dasharray" from="0 ' + keliling.toFixed(2) + '" ' +
        'to="' + dash + '" dur="0.7s" fill="freeze" />' +
        '</circle>';
    }).join('');

    const track = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#EDE8DE" stroke-width="' + o.tebal + '" />';
    const tengah = '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="donut__total">' + o.labelTengah + '</text>' +
      (o.subTengah ? '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" class="donut__sub">' + o.subTengah + '</text>' : '');

    return '<svg viewBox="0 0 ' + o.ukuran + ' ' + o.ukuran + '" class="donut" role="img" aria-label="Proporsi pengeluaran">' +
      track + lingkaran + tengah + '</svg>';
  }

  /**
   * Bar horizontal proporsi (dipakai di mobile).
   */
  function bar(data) {
    const total = data.reduce((s, d) => s + Math.max(0, d.nilai || 0), 0);
    if (!total) return '';
    return data.filter((d) => d.nilai > 0).map((d) => {
      const persen = (d.nilai / total) * 100;
      return '<span class="bar__seg" style="width:' + persen.toFixed(2) + '%;background:' +
        (WARNA[d.kunci] || '#8FA9BF') + '" title="' + d.label + ' ' + persen.toFixed(1) + '%"></span>';
    }).join('');
  }

  global.GriskaChart = { donut: donut, bar: bar, WARNA: WARNA };

})(window);
