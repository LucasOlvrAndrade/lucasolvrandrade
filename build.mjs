#!/usr/bin/env node
// Gera banner-dark.svg e banner-light.svg a partir de config.json.
// Sem dependencias. Rode: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(DIR, 'config.json'), 'utf8'));

// A fonte externa nao carrega no GitHub (proxy camo), entao usamos a mesma
// stack de fallback que o proprio lucas-andrade.dev usa.
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, &quot;Liberation Mono&quot;, &quot;Courier New&quot;, monospace';
// Avanco por caractere numa fonte monoespacada. Menlo/DejaVu/Liberation = .602,
// Consolas = .55. Usamos .6: as caixas ficam no maximo levemente largas, nunca
// cortam o texto.
const ADV = 0.6;
const w = (text, size, ls = 0) => text.length * size * ADV + Math.max(0, text.length - 1) * ls;

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// ---------------------------------------------------------------- layout
const W = 880;
const PAD = 24;           // moldura -> card
const INSET = 40;         // card -> conteudo
const L = PAD + INSET;    // 64
const R = W - PAD - INSET; // 816
const CARD_TOP = 52;

const NAME_SIZE = 26, ROLE_SIZE = 13.5;
const LABEL_SIZE = 10.5, LABEL_LS = 2.4;
const PILL_SIZE = 12, PILL_H = 26, PILL_PAD = 11, PILL_GAP = 8;
const ENTRY_SIZE = 13, META_SIZE = 11.5;

function layout() {
  const rows = [];
  let y = CARD_TOP + 68;                       // baseline do nome
  rows.push({ k: 'name', y });
  y += 28; rows.push({ k: 'role', y });

  for (const sec of cfg.sections) {
    y += 44;
    rows.push({ k: 'label', y, sec });
    if (sec.type === 'pills') {
      y += 12; rows.push({ k: 'pills', y, sec }); y += PILL_H;
    } else {
      for (const it of sec.items) {
        y += 26; rows.push({ k: 'entry', y, it });
        y += 20; rows.push({ k: 'desc', y, it });
      }
    }
  }
  const cardH = (y - CARD_TOP) + 34;
  return { rows, cardH, H: CARD_TOP + cardH + PAD };
}

// ------------------------------------------------------------------ logo
// Tracado pixel a pixel do logo.webp original (canvas 128x128).
const ART = [
  ['M28 13H55V49H28Z', 'text'],                // haste vertical
  ['M28 54H54L39 72L54 84L28 95Z', 'accent'],  // chanfro laranja
  ['M55 91H100V115H28V102Z', 'text'],          // pe do L
];
// Dentro do canvas 128x128 do arquivo original a arte ocupa so (28,13)-(100,115).
const ART_BOX = { x: 28, y: 13, w: 72, h: 102 };

// Largura ocupada pelo logo, para alinhar a direita sem margem morta.
const logoWidth = (size, box) => box ? size : size * (ART_BOX.w / ART_BOX.h);

function logo(x, y, size, t, box) {
  const paths = ART.map(([d, k]) => `<path d="${d}" fill="${t[k]}"/>`).join('');
  if (box) {
    // Com quadrado: mantem a margem original do arquivo.
    const s = size / 128;
    return `<g transform="translate(${x} ${y}) scale(${s.toFixed(6)})">`
      + `<rect width="128" height="128" rx="22" fill="${t.surface2}"/>${paths}</g>`;
  }
  // Sem quadrado: recorta na bbox real para o L ocupar o espaco reservado.
  const s = size / ART_BOX.h;
  return `<g transform="translate(${x} ${y}) scale(${s.toFixed(6)}) `
    + `translate(${-ART_BOX.x} ${-ART_BOX.y})">${paths}</g>`;
}

// ----------------------------------------------------------------- build
function render(themeName) {
  const t = cfg.themes[themeName];
  const { rows, cardH, H } = layout();
  const o = [];

  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">`);
  o.push(`<title id="t">${esc(cfg.name)}, ${esc(cfg.role)}</title>`);
  o.push(`<desc id="d">${esc(cfg.sections.map(s => s.label + ': ' + s.items.map(i => i.title || i).join('; ')).join(' | '))}</desc>`);
  o.push(`<style>text{font-family:${MONO};dominant-baseline:auto}</style>`);

  // moldura
  o.push(`<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.bg}" stroke="${t.border}"/>`);
  // breadcrumb: usuario / arquivo.md
  const bx = PAD + 14, by = 34, bs = 12.5;
  let cx = bx;
  const crumb = [[cfg.username, t.muted], [' / ', t.muted],
                 [cfg.file.replace(/\.md$/, ''), t.text], ['.md', t.accent]];
  for (const [s, fill] of crumb) {
    o.push(`<text x="${cx.toFixed(1)}" y="${by}" font-size="${bs}" fill="${fill}" xml:space="preserve">${esc(s)}</text>`);
    cx += w(s, bs);
  }
  // card
  o.push(`<rect x="${PAD}" y="${CARD_TOP}" width="${W - PAD * 2}" height="${cardH}" rx="10" fill="${t.surface}" stroke="${t.border}"/>`);

  const ls = cfg.logo.size;
  o.push(logo(R - logoWidth(ls, cfg.logo.box), CARD_TOP + 28, ls, t, cfg.logo.box));

  for (const r of rows) {
    if (r.k === 'name') {
      o.push(`<text x="${L}" y="${r.y}" font-size="${NAME_SIZE}" font-weight="700" fill="${t.text}">${esc(cfg.name)}</text>`);
      // cursor de bloco, igual terminal
      const cxx = L + w(cfg.name, NAME_SIZE) + 4;
      o.push(`<rect x="${cxx.toFixed(1)}" y="${r.y - NAME_SIZE * 0.74}" width="${(NAME_SIZE * 0.5).toFixed(1)}" height="${(NAME_SIZE * 0.82).toFixed(1)}" fill="${t.accent}"/>`);
    }
    if (r.k === 'role') {
      o.push(`<text x="${L}" y="${r.y}" font-size="${ROLE_SIZE}" fill="${t.muted}">${esc(cfg.role)}</text>`);
    }
    if (r.k === 'label') {
      o.push(`<text x="${L}" y="${r.y}" font-size="${LABEL_SIZE}" letter-spacing="${LABEL_LS}" fill="${t.muted}">${esc(r.sec.label)}</text>`);
      const lw = w(r.sec.label, LABEL_SIZE, LABEL_LS) + 14;
      o.push(`<line x1="${(L + lw).toFixed(1)}" y1="${r.y - 4}" x2="${R}" y2="${r.y - 4}" stroke="${t.border}"/>`);
    }
    if (r.k === 'pills') {
      let px = L;
      for (const item of r.sec.items) {
        const pw = w(item, PILL_SIZE) + PILL_PAD * 2;
        o.push(`<rect x="${px.toFixed(1)}" y="${r.y}" width="${pw.toFixed(1)}" height="${PILL_H}" rx="5" fill="${t.surface2}" stroke="${t.border}"/>`);
        o.push(`<text x="${(px + PILL_PAD).toFixed(1)}" y="${r.y + 17.5}" font-size="${PILL_SIZE}" fill="${t.text}">${esc(item)}</text>`);
        px += pw + PILL_GAP;
      }
      if (px - PILL_GAP > R) console.warn(`  aviso: linha de pills passa de ${R}px (${(px - PILL_GAP).toFixed(0)}px)`);
    }
    if (r.k === 'entry') {
      o.push(`<text x="${L}" y="${r.y}" font-size="${ENTRY_SIZE}" font-weight="700" fill="${t.text}">${esc(r.it.title)}</text>`);
      o.push(`<text x="${R}" y="${r.y}" font-size="${META_SIZE}" text-anchor="end" fill="${t.muted}">${esc(r.it.period)}</text>`);
    }
    if (r.k === 'desc') {
      o.push(`<text x="${L}" y="${r.y}" font-size="${META_SIZE}" fill="${t.muted}">${esc(r.it.desc)}</text>`);
    }
  }

  o.push('</svg>');
  return o.join('\n');
}

for (const name of ['dark', 'light']) {
  const svg = render(name);
  const out = join(DIR, `banner-${name}.svg`);
  writeFileSync(out, svg + '\n');
  console.log(`banner-${name}.svg  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
}
