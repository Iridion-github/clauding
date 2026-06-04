// Total: 94 cards
// Number cards: value N has max(1,N) copies → 0:1, 1:1, 2:2 … 12:12  = 79 cards
// Modifier cards: +2 +4 +6 +8 +10 (1 each)                           =  5 cards
// x2 multiplier                                                        =  1 card
// Freeze (3), Flip Three (3), Second Chance (3)                        =  9 cards
//                                                                      = 94 total

let _uid = 0;
function uid() { return `c${++_uid}`; }

function card(type, value, label, extra = {}) {
  return { id: uid(), type, value, label, ...extra };
}

function buildDeck() {
  const cards = [];

  // Number cards
  for (let n = 0; n <= 12; n++) {
    const count = n <= 1 ? 1 : n;
    for (let i = 0; i < count; i++) cards.push(card('number', n, String(n)));
  }

  // Modifier cards
  for (const v of [2, 4, 6, 8, 10]) cards.push(card('modifier', v, `+${v}`));

  // x2
  cards.push(card('multiplier', 2, 'x2'));

  // Action cards
  for (let i = 0; i < 3; i++) cards.push(card('freeze',        0, 'Freeze'));
  for (let i = 0; i < 3; i++) cards.push(card('flip_three',    0, 'Flip 3'));
  for (let i = 0; i < 3; i++) cards.push(card('second_chance', 0, '2nd Chance'));

  return cards; // 94 cards
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

module.exports = { buildDeck, shuffle };
