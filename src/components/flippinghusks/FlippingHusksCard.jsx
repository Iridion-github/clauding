import { useId } from 'react';
import './FlippingHusksCard.css';
import { useCardTheme } from './CardThemeContext';

const VINE = [null,'#9e9e9e','#aed136','#e91e63','#26c6da','#00897b','#6a1b9a','#8d6e63','#43a047','#f57c00','#c62828','#1565c0','#455a64'];
const RAINBOW_STOPS = ['#ff3333','#ff9900','#ffee00','#33cc33','#3399ff','#cc33ff','#ff3399'];

// ─── ClassicFantasy theme: card face → image file in public/images/ClassicFantasy/cards ──
// Only number cards (0–12) and the three action cards have artwork. Score cards
// (modifiers / ×2) and the card back fall back to the default look.
// These textless images carry no baked-in number/text — those are overlaid separately.
const CF_NUMBER_IMG = {
  0: 'Bagpipes.webp',       1: 'Potion.webp',         2: 'Mimic.webp',
  3: 'Beholder.webp',       4: 'DisplacerBeast.webp', 5: 'Dragon.webp',
  6: 'Evol.webp',           7: 'Leyah.webp',          8: 'Frederick.webp',
  9: 'Vikas.webp',          10: 'Morzan.webp',        11: 'Ecate.webp',
  12: 'Ashari.webp',
};
const CF_ACTION_IMG = {
  freeze: 'FreezeTextless.webp',
  flip_three: 'FlipThreeTextless.webp',
  second_chance: 'SecondChanceTextless.webp',
};
// In-world names overlaid on the (textless) action-card artwork. Each entry is the
// list of lines to stack, rendered in the same gothic blackletter face as the numbers.
const CF_ACTION_TEXT = {
  freeze: ['Ice Storm'],
  flip_three: ['Jilka'],
  second_chance: ['Silver Flame', 'Shield'],
};

function cfImageFor(card) {
  if (card.type === 'number') return CF_NUMBER_IMG[card.value] ?? null;
  return CF_ACTION_IMG[card.type] ?? null;
}

// Preload all ClassicFantasy art (every face + the back) so cards never pop-in on their
// first reveal. Cheap now that they're small WebPs. Call once when that theme is active.
let _cardImagesPreloaded = false;
export function preloadCardImages() {
  if (_cardImagesPreloaded) return;
  _cardImagesPreloaded = true;
  const base = `${process.env.PUBLIC_URL}/images/ClassicFantasy`;
  const urls = [...Object.values(CF_NUMBER_IMG), ...Object.values(CF_ACTION_IMG)]
    .map(f => `${base}/cards/${f}`);
  urls.push(`${base}/cardBack.webp`);
  for (const url of urls) { const img = new Image(); img.src = url; }
}

export function FlippingHusksCard({ card, faceDown = false, small = false, highlight = false, theme }) {
  const activeTheme = useCardTheme(theme);
  if (!card) return null;
  if (faceDown) {
    return activeTheme === 'classic_fantasy'
      ? <ClassicFantasyCardBack small={small} />
      : <CardBack small={small} />;
  }

  // ClassicFantasy: number & action cards use artwork; the score cards (+N, ×2)
  // get a dedicated dark-gold engraved card. Anything else falls through to default.
  if (activeTheme === 'classic_fantasy') {
    const img = cfImageFor(card);
    if (img) return <ClassicFantasyCard card={card} img={img} small={small} highlight={highlight} />;
    if (card.type === 'modifier' || card.type === 'multiplier')
      return <ClassicFantasyScoreCard card={card} small={small} highlight={highlight} />;
  }

  if (card.type === 'number') return <NumberCard card={card} small={small} highlight={highlight} />;
  if (card.type === 'modifier' || card.type === 'multiplier') return <ScoreCard card={card} small={small} highlight={highlight} />;
  return <ActionCard card={card} small={small} highlight={highlight} />;
}

// ─── ClassicFantasy Card (image only) ──────────────────────────────────────────

function ClassicFantasyCard({ card, img, small, highlight }) {
  const src = `${process.env.PUBLIC_URL}/images/ClassicFantasy/cards/${img}`;
  // The artwork is textless. Number cards (0–12) get their value engraved in a sharp
  // gothic blackletter (UnifrakturMaguntia) face in opposite corners; the action cards
  // get their in-world name as a title in that same face.
  const num = card.type === 'number' ? String(card.value) : null;
  const titleLines = CF_ACTION_TEXT[card.type] ?? null;
  // An <img> (rather than a CSS background) lets the browser apply its
  // highest-quality scaler — far smoother when the artwork is shrunk to card size.
  return (
    <div className={`fhcard fhcard-cf${small ? ' fhcard-small' : ''}${highlight ? ' fhcard-highlight' : ''}`}>
      <img className="fhcard-cf-img" src={src} alt={card.label ?? card.type} draggable={false} />
      {num !== null && (
        <>
          <span className="fhcf-num fhcf-num-tl" aria-hidden="true">{num}</span>
          <span className="fhcf-num fhcf-num-br" aria-hidden="true">{num}</span>
        </>
      )}
      {titleLines && (
        <div className="fhcf-title" aria-hidden="true">
          {titleLines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── ClassicFantasy Score Card (+2…+10, ×2) ────────────────────────────────────
// No red frame — a darker, coarse gold slab with the value engraved into it.
function ClassicFantasyScoreCard({ card, small, highlight }) {
  const label = card.type === 'multiplier' ? '×2' : card.label;
  return (
    <div className={`fhcard fhcard-cf-score${small ? ' fhcard-small' : ''}${highlight ? ' fhcard-highlight' : ''}`}>
      <span className="fhcf-score-label">{label}</span>
    </div>
  );
}

// ─── Card Back ─────────────────────────────────────────────────────────────────

function CardBack({ small }) {
  return (
    <div className={`fhcard fhcard-back${small ? ' fhcard-small' : ''}`}>
      <div className="fhback-inner">
        <span className="fhback-line">FLIPPING</span>
        <span className="fhback-line">HUSKS</span>
      </div>
    </div>
  );
}

// ─── ClassicFantasy Card Back ──────────────────────────────────────────────────
// The cardBack.png artwork with the gold UnifrakturCook Light title overlaid.
function ClassicFantasyCardBack({ small }) {
  const src = `${process.env.PUBLIC_URL}/images/ClassicFantasy/cardBack.webp`;
  return (
    <div className={`fhcard fhcard-cf-back${small ? ' fhcard-small' : ''}`}>
      <img className="fhcard-cf-img" src={src} alt="card back" draggable={false} />
      <div className="fhback-inner">
        <span className="fhcf-back-line">Flipping</span>
        <span className="fhcf-back-line">Eberron</span>
      </div>
    </div>
  );
}

// ─── Number Card ───────────────────────────────────────────────────────────────

function NumberCard({ card, small, highlight }) {
  const isRainbow = card.value === 0;
  const vine = VINE[card.value] ?? '#888';
  const num  = String(card.value);
  const corner = `fhcard-corner${isRainbow ? ' fhcard-corner-rb' : ''}`;
  return (
    <div
      className={`fhcard fhcard-number${small ? ' fhcard-small' : ''}${highlight ? ' fhcard-highlight' : ''}`}
      style={{ '--vine': vine }}
    >
      <VineBorder vine={vine} isRainbow={isRainbow} cut />
      <span className={`${corner} fhcard-corner-tl`} aria-hidden="true">{num}</span>
      <div className="fhcard-nbody">
        <BigNum value={num} vine={vine} isRainbow={isRainbow} big />
      </div>
      <span className={`${corner} fhcard-corner-br`} aria-hidden="true">{num}</span>
    </div>
  );
}

// ─── Score Card (+2…+10, ×2) ───────────────────────────────────────────────────

function ScoreCard({ card, small, highlight }) {
  const label = card.type === 'multiplier' ? '×2' : card.label;
  return (
    <div className={`fhcard fhcard-score${small ? ' fhcard-small' : ''}${highlight ? ' fhcard-highlight' : ''}`}>
      <VineBorder vine="#cc2200" isRainbow={false} outlineColor="#ffffff" />
      <div className="fhcard-nbody">
        <BigNum value={label} vine="#cc2200" isRainbow={false} />
      </div>
    </div>
  );
}

// ─── Action Card ───────────────────────────────────────────────────────────────

function ActionCard({ card, small, highlight }) {
  const typeSlug = card.type.replace(/_/g, '-');
  const lines = actionLines(card.type);
  return (
    <div className={`fhcard fhcard-action fhac-${typeSlug}${small ? ' fhcard-small' : ''}${highlight ? ' fhcard-highlight' : ''}`}>
      {card.type === 'flip_three'    && <FlipThreeDeco />}
      {card.type === 'freeze'        && <FreezeDeco />}
      {card.type === 'second_chance' && <HeartsDeco />}
      <div className="fhcard-drapes">
        {lines.map((line, i) => (
          <div key={i} className="fhcard-drape">
            <span className="fhcard-drape-text">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function actionLines(type) {
  if (type === 'flip_three') return ['FLIP', 'THREE'];
  if (type === 'freeze') return ['FREEZE'];
  if (type === 'second_chance') return ['SECOND', 'CHANCE'];
  return [type.toUpperCase()];
}

// ─── Vine Border SVG ───────────────────────────────────────────────────────────

// Mayan crenellated inner boundary (5 teeth on top/bottom, 8 on left/right).
// Outer rounded rect + this inner stepped path → frame with Mayan zigzag inner edge.
// Unit = 20px, tooth = 12px wide × 6px deep, gap = 8px.  Card 140×200, outer at y=4/x=4.
const MAYAN_INNER = [
  'M120,10',
  // top edge — going LEFT, baseline y=10, teeth DOWN to y=14
  'L112,10 L112,14 L100,14 L100,10',
  'L92,10 L92,14 L80,14 L80,10',
  'L72,10 L72,14 L60,14 L60,10',
  'L52,10 L52,14 L40,14 L40,10',
  'L32,10 L32,14 L20,14 L20,10',
  // top-left corner step
  'L10,10 L10,20',
  // left edge — going DOWN, baseline x=10, teeth RIGHT to x=14
  'L10,28 L14,28 L14,40 L10,40',
  'L10,48 L14,48 L14,60 L10,60',
  'L10,68 L14,68 L14,80 L10,80',
  'L10,88 L14,88 L14,100 L10,100',
  'L10,108 L14,108 L14,120 L10,120',
  'L10,128 L14,128 L14,140 L10,140',
  'L10,148 L14,148 L14,160 L10,160',
  'L10,168 L14,168 L14,180 L10,180',
  // bottom-left corner step
  'L10,190 L20,190',
  // bottom edge — going RIGHT, baseline y=190, teeth UP to y=186
  'L28,190 L28,186 L40,186 L40,190',
  'L48,190 L48,186 L60,186 L60,190',
  'L68,190 L68,186 L80,186 L80,190',
  'L88,190 L88,186 L100,186 L100,190',
  'L108,190 L108,186 L120,186 L120,190',
  // bottom-right corner step
  'L130,190 L130,180',
  // right edge — going UP, baseline x=130, teeth LEFT to x=126
  'L130,172 L126,172 L126,160 L130,160',
  'L130,152 L126,152 L126,140 L130,140',
  'L130,132 L126,132 L126,120 L130,120',
  'L130,112 L126,112 L126,100 L130,100',
  'L130,92 L126,92 L126,80 L130,80',
  'L130,72 L126,72 L126,60 L130,60',
  'L130,52 L126,52 L126,40 L130,40',
  'L130,32 L126,32 L126,20 L130,20',
  // top-right corner step back to start
  'L130,10 L120,10 Z',
].join(' ');

function VineBorder({ vine, isRainbow, outlineColor, cut }) {
  const uid = useId().replace(/:/g, '');
  const gid = `fhvg${uid}`;
  const outerPath = rrCW(4, 4, 132, 192, 10); // rounded outer boundary
  const fill = isRainbow ? `url(#${gid})` : vine;
  const sw = outlineColor ? 1.5 : 0;
  const stroke = outlineColor ?? 'none';

  return (
    <svg className="fhcard-vine" viewBox="0 0 140 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {isRainbow && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
            {RAINBOW_STOPS.map((c, i) => (
              <stop key={i} offset={`${Math.round(i / (RAINBOW_STOPS.length - 1) * 100)}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
      )}
      <path
        d={`${outerPath} ${MAYAN_INNER}`}
        fill={fill}
        fillRule="evenodd"
        stroke={stroke}
        strokeWidth={sw}
      />
      {cut && (
        // Slice the frame off the upper-left and lower-right corners (fill with the
        // number-card background) so the corner index numbers have clear space.
        <g fill="#fffde7">
          <path d="M2,2 L46,2 L2,46 Z" />
          <path d="M138,198 L94,198 L138,154 Z" />
        </g>
      )}
    </svg>
  );
}

function rrCW(x, y, w, h, r) {
  return `M${x+r},${y} L${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} L${x+r},${y+h} Q${x},${y+h} ${x},${y+h-r} L${x},${y+r} Q${x},${y} ${x+r},${y} Z`;
}

// ─── Double-outlined number ─────────────────────────────────────────────────────

function BigNum({ value, vine, isRainbow, big }) {
  return (
    <div
      className={`fhcard-bignum${isRainbow ? ' fhcard-bignum-rb' : ''}${big ? ' fhcard-bignum-big' : ''}`}
      style={{ '--vine': vine }}
    >
      <span className="fhbn-outer" aria-hidden="true">{value}</span>
      <span className="fhbn-face">{value}</span>
    </div>
  );
}

// ─── Flip Three decoration ──────────────────────────────────────────────────────

function FlipThreeDeco() {
  return (
    <svg className="fhcard-deco" viewBox="0 0 140 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g opacity="0.78">
        <rect x="28" y="20" width="42" height="60" rx="5"
          fill="rgba(255,255,255,0.88)" stroke="#8a9200" strokeWidth="2"
          transform="rotate(-24,49,50)" />
        <rect x="70" y="20" width="42" height="60" rx="5"
          fill="rgba(255,255,255,0.88)" stroke="#8a9200" strokeWidth="2"
          transform="rotate(24,91,50)" />
        <rect x="49" y="16" width="42" height="60" rx="5"
          fill="rgba(255,255,255,0.94)" stroke="#8a9200" strokeWidth="2" />
      </g>
      <path d="M 86,88 L 71,118 L 82,118 L 64,152 L 100,110 L 86,110 Z"
        fill="#fff" stroke="#555500" strokeWidth="1.5" opacity="0.9" />
    </svg>
  );
}

// ─── Freeze decoration ──────────────────────────────────────────────────────────

// [x, y, radius, rotation°, opacity] — scattered across the 140×200 viewBox
const ICE_FLAKES = [
  [12, 14,  7, 15, 0.80], [70,  10,  9, 30, 0.75], [128, 20,  6, 45, 0.70],
  [35, 38,  5,  0, 0.65], [100, 33,  7, 20, 0.70], [18,  66,  8, 10, 0.72],
  [120, 60, 5, 50, 0.60], [55,  52,  4, 35, 0.50], [92,  78,  6, 25, 0.65],
  [15, 108, 5, 40, 0.70], [130,103,  6, 15, 0.65], [44,  90,  4, 55, 0.55],
  [75,  42, 3, 10, 0.50], [6,  170,  5,  5, 0.65], [52, 163,  7, 20, 0.70],
  [112,148, 5, 40, 0.65], [20, 155,  6,  5, 0.70], [126,176,  7, 30, 0.75],
  [70, 180, 5, 50, 0.60], [34, 188,  4, 25, 0.55], [100,186,  5, 45, 0.60],
  [8,  42,  4, 55, 0.60], [135,142,  4, 20, 0.55], [107,112,  4, 15, 0.50],
  [26, 132, 5, 35, 0.60], [80, 172,  3, 10, 0.45], [48,  18,  4, 50, 0.60],
  [96,   8, 5, 35, 0.65], [134, 90,  3, 25, 0.50], [5,  188,  4, 10, 0.55],
];

function IceCrystal({ x, y, r, rot, op }) {
  const sw = Math.max(0.5, r * 0.16);
  const b  = r * 0.65;
  const bn = r * 0.22;
  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`}
       stroke="#fff" strokeWidth={sw} strokeLinecap="round" opacity={op}>
      <line x1="0" y1={-r} x2="0" y2={r} />
      <line x1={-r*0.866} y1={-r*0.5} x2={r*0.866} y2={r*0.5} />
      <line x1={-r*0.866} y1={r*0.5}  x2={r*0.866} y2={-r*0.5} />
      {r >= 5 && <>
        <line x1="0" y1={-b} x2={ bn} y2={-b+bn} />
        <line x1="0" y1={-b} x2={-bn} y2={-b+bn} />
        <line x1="0" y1={ b} x2={ bn} y2={ b-bn} />
        <line x1="0" y1={ b} x2={-bn} y2={ b-bn} />
      </>}
    </g>
  );
}

function FreezeDeco() {
  return (
    <svg className="fhcard-deco" viewBox="0 0 140 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {ICE_FLAKES.map(([x, y, r, rot, op], i) => (
        <IceCrystal key={i} x={x} y={y} r={r} rot={rot} op={op} />
      ))}
      <g transform="translate(70,128)" opacity="0.88">
        <path d="M-15,-10 Q-15,-28 0,-28 Q15,-28 15,-10"
          fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
        <rect x="-20" y="-10" width="40" height="30" rx="5" fill="#fff" />
        <circle cx="0" cy="9" r="5.5" fill="#1565c0" />
        <rect x="-3" y="9" width="6" height="9" rx="2.5" fill="#1565c0" />
      </g>
    </svg>
  );
}

// ─── Second Chance decoration ───────────────────────────────────────────────────

const HEART_PATH = 'M50,96 C20,78 0,56 0,30 C0,12 14,2 30,2 C40,2 48,7 50,15 C52,7 60,2 70,2 C86,2 100,12 100,30 C100,56 80,78 50,96Z';

function Heart({ cx, cy, s, fill, opacity }) {
  return (
    <g transform={`translate(${cx - s / 2},${cy - s / 2}) scale(${s / 100})`} opacity={opacity}>
      <path d={HEART_PATH} fill={fill} />
    </g>
  );
}

function HeartsDeco() {
  return (
    <svg className="fhcard-deco" viewBox="0 0 140 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <Heart cx={70} cy={48} s={62} fill="#ff6b6b" opacity={0.85} />
      <Heart cx={34} cy={104} s={40} fill="#ff8888" opacity={0.6} />
      <Heart cx={106} cy={104} s={40} fill="#ff8888" opacity={0.6} />
    </svg>
  );
}
