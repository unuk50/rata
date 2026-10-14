// Sample groups for product review. Amounts are in major units (rupees, baht, dollars).
// Members are referred to by name; the seed script maps names to member ids.
//
// Split shapes:
//   { equal: ["A", "B"] }                 equal among the listed people ("all" = everyone)
//   { exact: { A: 100, B: 250.5 } }       exact amounts, must add up to the total
//   { percent: { A: 50, B: 50 } }          percent, must add up to 100
//   { shares: { A: 2, B: 1 } }             whole-number weights
// paid: "A" (one payer) or { A: 1000, B: 500 } (several payers, must add up to the total).

const FLAT = ["Aarav", "Priya", "Rohan"];
const GOA = ["Aarav", "Priya", "Kabir", "Neha", "Vikram", "Ananya"];
const BKK = ["Aarav", "Rohan", "Meera", "Siddharth"];
const PARTY = ["Ishaan", "Aarav", "Priya", "Kabir", "Neha", "Tanvi", "Arjun", "Zoya"];
const LONAVALA = ["Aarav", "Rohan", "Kabir"];

function flat() {
  const ops = [];
  const e = (o) => ops.push({ op: "expense", ...o });
  const p = (o) => ops.push({ op: "payment", ...o });
  const months = [
    { m: "07", elec: 3180, maid: true },
    { m: "08", elec: 4265, maid: true },
    { m: "09", elec: 3890, maid: true },
    { m: "10", elec: null, maid: false },
  ];
  for (const [i, mo] of months.entries()) {
    const d = (day) => `2026-${mo.m}-${String(day).padStart(2, "0")}`;
    e({
      key: `rent-${mo.m}`,
      date: d(1),
      desc: `Rent – ${["July", "August", "September", "October"][i]}`,
      amount: 78000,
      paid: "Aarav",
      split: { shares: { Aarav: 4, Priya: 3, Rohan: 3 } },
      cat: "Rent",
      note: i === 0 ? "Aarav has the master bedroom with balcony, so 4 shares" : undefined,
    });
    e({
      date: d(3),
      desc: "Society maintenance",
      amount: 4500,
      paid: "Priya",
      split: { equal: "all" },
      cat: "Bills",
    });
    e({
      date: d(5),
      desc: "Airtel Xstream Fiber",
      amount: 1179,
      paid: "Rohan",
      split: { equal: "all" },
      cat: "Bills",
    });
    if (mo.elec)
      e({
        key: `elec-${mo.m}`,
        date: d(18),
        desc: "Adani Electricity bill",
        amount: mo.elec,
        paid: "Rohan",
        split: { equal: "all" },
        cat: "Bills",
      });
    if (mo.maid)
      e({
        date: d(28),
        desc: "Sunita didi – cleaning & cooking",
        amount: 7500,
        paid: "Priya",
        split: { equal: "all" },
        cat: "Bills",
      });
  }
  // Groceries and household, roughly weekly.
  const groceries = [
    ["2026-07-04", "BigBasket order", 2345.5, "Priya"],
    ["2026-07-11", "Blinkit – milk, eggs, bread", 612, "Rohan"],
    ["2026-07-19", "DMart monthly stock-up", 3870.25, "Aarav"],
    ["2026-07-26", "Sabzi mandi – vegetables", 840, "Priya"],
    ["2026-08-02", "BigBasket order", 2918, "Priya"],
    ["2026-08-09", "Blinkit – snacks & cold drinks", 1034, "Rohan"],
    ["2026-08-16", "DMart monthly stock-up", 4102.75, "Aarav"],
    ["2026-08-23", "Zepto – fruits", 689, "Rohan"],
    ["2026-08-30", "Sabzi mandi – vegetables", 760, "Priya"],
    ["2026-09-06", "BigBasket order", 2580, "Priya"],
    ["2026-09-13", "Blinkit – detergent, dishwash", 948, "Aarav"],
    ["2026-09-20", "DMart monthly stock-up", 3655.5, "Aarav"],
    ["2026-09-27", "Zepto – milk & paneer", 532, "Rohan"],
    ["2026-10-04", "BigBasket order", 2211, "Priya"],
    ["2026-10-11", "Blinkit – atta, dal, rice", 1386, "Rohan"],
  ];
  for (const [date, desc, amount, paid] of groceries)
    e({ date, desc, amount, paid, split: { equal: "all" }, cat: "Groceries" });
  // Groceries with personal items carved out (exact split).
  e({
    date: "2026-08-12",
    desc: "Nature's Basket – includes Priya's protein powder",
    amount: 4240,
    paid: "Priya",
    split: { exact: { Aarav: 780, Priya: 2680, Rohan: 780 } },
    cat: "Groceries",
    note: "Protein powder ₹1,900 is Priya's only",
  });
  e({
    date: "2026-09-16",
    desc: "Amazon – Rohan's headphones + common bulbs",
    amount: 3398,
    paid: "Rohan",
    split: { exact: { Aarav: 233, Priya: 233, Rohan: 2932 } },
    cat: "Shopping",
  });
  // Gas, water.
  for (const date of ["2026-07-08", "2026-08-21", "2026-10-02"])
    e({
      date,
      desc: "HP Gas cylinder",
      amount: 903,
      paid: "Rohan",
      split: { equal: "all" },
      cat: "Bills",
    });
  for (const date of ["2026-07-14", "2026-08-14", "2026-09-14"])
    e({
      date,
      desc: "Bisleri 20L cans x10",
      amount: 900,
      paid: "Aarav",
      split: { equal: "all" },
      cat: "Groceries",
    });
  // Food: some evenings only two people.
  e({
    date: "2026-07-12",
    desc: "Swiggy – Bademiya rolls",
    amount: 1146,
    paid: "Aarav",
    split: { equal: ["Aarav", "Rohan"] },
    cat: "Food",
  });
  e({
    date: "2026-08-07",
    desc: "Zomato – Social, Bandra",
    amount: 2470,
    paid: "Rohan",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-08-25",
    desc: "Swiggy – biryani night",
    amount: 1389,
    paid: "Priya",
    split: { equal: ["Priya", "Rohan"] },
    cat: "Food",
  });
  e({
    date: "2026-09-21",
    desc: "Pizza Express – Rohan's birthday",
    amount: 3612,
    paid: "Aarav",
    split: { equal: ["Aarav", "Priya"] },
    cat: "Food",
    note: "Birthday treat, Rohan does not pay",
  });
  e({
    date: "2026-10-09",
    desc: "Swiggy Instamart – late night snacks",
    amount: 455,
    paid: "Rohan",
    split: { equal: "all" },
    cat: "Food",
  });
  // A big one-off, percent split.
  e({
    date: "2026-07-22",
    desc: "Samsung fridge from Croma",
    amount: 32990,
    paid: "Aarav",
    split: { percent: { Aarav: 40, Priya: 30, Rohan: 30 } },
    cat: "Shopping",
    note: "Aarav keeps the fridge if he moves out",
  });
  e({
    date: "2026-09-02",
    desc: "Plumber – kitchen sink",
    amount: 650,
    paid: "Priya",
    split: { equal: "all" },
    cat: "Other",
  });
  e({
    date: "2026-09-29",
    desc: "Pest control (Hicare)",
    amount: 1499,
    paid: "Aarav",
    split: { equal: "all" },
    cat: "Health",
  });
  // Edit: August electricity was first entered wrong.
  ops.push({
    op: "edit",
    key: "elec-08",
    changes: { amount: 4265, desc: "Adani Electricity bill" },
  });
  // Monthly settle-ups.
  p({ date: "2026-07-31", from: "Priya", to: "Aarav", amount: 20000 });
  p({ date: "2026-07-31", from: "Rohan", to: "Aarav", amount: 22000 });
  p({ date: "2026-08-31", from: "Priya", to: "Aarav", amount: 21000 });
  p({ date: "2026-08-31", from: "Rohan", to: "Aarav", amount: 18500 });
  p({ date: "2026-09-30", from: "Rohan", to: "Aarav", amount: 20000 });
  return ops;
}
// Make the August bill wrong at first, then fix it with an edit.
function flatWithWrongAugBill() {
  const ops = flat();
  const i = ops.findIndex((o) => o.key === "elec-08");
  ops[i] = { ...ops[i], amount: 2465, desc: "Adani Electricity bill (typo)" };
  return ops;
}

function goa() {
  const ops = [];
  const e = (o) => ops.push({ op: "expense", ...o });
  e({
    date: "2026-08-14",
    desc: "IndiGo flights BOM → GOI (return)",
    amount: 41652,
    paid: "Kabir",
    split: {
      exact: { Aarav: 6457, Priya: 6457, Kabir: 6457, Neha: 6457, Vikram: 7912, Ananya: 7912 },
    },
    cat: "Transport",
    note: "Vikram and Ananya booked a week later",
  });
  e({
    key: "villa",
    date: "2026-08-14",
    desc: "Villa in Anjuna – 4 nights (Airbnb)",
    amount: 54000,
    paid: { Kabir: 30000, Vikram: 24000 },
    split: { shares: { Aarav: 2, Priya: 1, Ananya: 1, Kabir: 1, Neha: 1, Vikram: 2 } },
    cat: "Stay",
    note: "Aarav and Vikram had their own rooms",
  });
  e({
    key: "dupe-taxi",
    date: "2026-08-14",
    desc: "Taxi Mopa airport → Anjuna",
    amount: 2800,
    paid: "Aarav",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-08-14",
    desc: "Taxi Mopa airport → Anjuna",
    amount: 2800,
    paid: "Aarav",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-08-14",
    desc: "Dinner at Thalassa",
    amount: 11480,
    paid: "Priya",
    split: { equal: "all" },
    cat: "Food",
    note: "Incl. 10% service charge",
  });
  e({
    date: "2026-08-15",
    desc: "Scooty rentals x3 (4 days)",
    amount: 4800,
    paid: "Vikram",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-08-15",
    desc: "Breakfast at Baba au Rhum",
    amount: 2960,
    paid: "Neha",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-08-15",
    desc: "Petrol",
    amount: 1250,
    paid: "Aarav",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-08-15",
    desc: "Parasailing at Calangute",
    amount: 6000,
    paid: "Kabir",
    split: { equal: ["Kabir", "Neha", "Vikram", "Ananya"] },
    cat: "Fun",
  });
  e({
    date: "2026-08-15",
    desc: "Lunch at Britto's",
    amount: 6215,
    paid: "Neha",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-08-15",
    desc: "Drinks at Tito's Lane",
    amount: 8400,
    paid: "Vikram",
    split: { percent: { Aarav: 20, Priya: 10, Kabir: 25, Neha: 10, Vikram: 25, Ananya: 10 } },
    cat: "Fun",
    note: "Priya, Neha and Ananya had mocktails",
  });
  e({
    date: "2026-08-16",
    desc: "Dudhsagar falls jeep safari",
    amount: 9000,
    paid: { Aarav: 5000, Ananya: 4000 },
    split: { equal: ["Aarav", "Priya", "Kabir", "Vikram", "Ananya"] },
    cat: "Fun",
    note: "Neha skipped, stayed at the villa",
  });
  e({
    date: "2026-08-16",
    desc: "Fish thali at Ritz Classic",
    amount: 3840,
    paid: "Ananya",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-08-16",
    desc: "Bottled water & snacks",
    amount: 486,
    paid: "Priya",
    split: { equal: "all" },
    cat: "Groceries",
  });
  e({
    date: "2026-08-16",
    desc: "Sunset cruise on the Mandovi",
    amount: 4800,
    paid: "Kabir",
    split: { shares: { Aarav: 1, Priya: 1, Kabir: 1, Neha: 1, Vikram: 1, Ananya: 1 } },
    cat: "Fun",
  });
  e({
    date: "2026-08-17",
    desc: "Cashews & feni from Zantye's",
    amount: 2400,
    paid: "Priya",
    split: { exact: { Priya: 1200, Ananya: 1200 } },
    cat: "Shopping",
  });
  e({
    date: "2026-08-17",
    desc: "Brunch at Artjuna",
    amount: 4125,
    paid: "Aarav",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-08-17",
    desc: "Beach shack – Curlies",
    amount: 5730,
    paid: "Kabir",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-08-17",
    desc: "Saturday night market tickets",
    amount: 600,
    paid: "Neha",
    split: { equal: "all" },
    cat: "Fun",
  });
  e({
    date: "2026-08-17",
    desc: "Petrol",
    amount: 900,
    paid: "Vikram",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-08-18",
    desc: "Villa cleaning tip",
    amount: 1000,
    paid: "Ananya",
    split: { equal: "all" },
    cat: "Stay",
  });
  e({
    date: "2026-08-18",
    desc: "Taxi Anjuna → Mopa airport",
    amount: 2600,
    paid: "Neha",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-08-18",
    desc: "Airport food court",
    amount: 1874,
    paid: "Vikram",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-08-18",
    desc: "Bebinca for office",
    amount: 750,
    paid: "Aarav",
    split: { exact: { Aarav: 750 } },
    cat: "Gifts",
    note: "Only Aarav, logged by mistake but harmless",
  });
  ops.push({ op: "delete", key: "dupe-taxi" });
  ops.push({ op: "payment", date: "2026-08-20", from: "Ananya", to: "Kabir", amount: 5000 });
  ops.push({ op: "payment", date: "2026-08-21", from: "Priya", to: "Vikram", amount: 3000 });
  ops.push({ op: "payment", date: "2026-08-22", from: "Neha", to: "Kabir", amount: 2500 });
  return ops;
}

function bangkok() {
  const ops = [];
  const e = (o) => ops.push({ op: "expense", ...o });
  e({
    date: "2026-10-02",
    desc: "Air India Express BOM → BKK (return)",
    amount: 102480,
    cur: "INR",
    paid: "Meera",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-10-02",
    desc: "Travel insurance (Tata AIG)",
    amount: 2396,
    cur: "INR",
    paid: "Aarav",
    split: { equal: "all" },
    cat: "Health",
  });
  e({
    date: "2026-10-02",
    desc: "Novotel Sukhumvit 20 – 5 nights",
    amount: 18750,
    cur: "THB",
    paid: "Aarav",
    split: { equal: "all" },
    cat: "Stay",
  });
  e({
    date: "2026-10-02",
    desc: "Airport Rail Link",
    amount: 180,
    cur: "THB",
    paid: "Rohan",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-10-02",
    desc: "AIS tourist SIM x4",
    amount: 1196,
    cur: "THB",
    paid: "Siddharth",
    split: { exact: { Aarav: 299, Rohan: 299, Meera: 299, Siddharth: 299 } },
    cat: "Bills",
  });
  e({
    date: "2026-10-03",
    desc: "Street food on Yaowarat",
    amount: 1240,
    cur: "THB",
    paid: "Siddharth",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-10-03",
    desc: "Tuk-tuk to Wat Arun",
    amount: 300,
    cur: "THB",
    paid: "Meera",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-10-04",
    desc: "Safari World tickets (Klook)",
    amount: 132,
    cur: "USD",
    paid: "Siddharth",
    split: { equal: "all" },
    cat: "Fun",
    note: "Klook charged in USD",
  });
  e({
    date: "2026-10-04",
    desc: "Thai massage at Health Land",
    amount: 2400,
    cur: "THB",
    paid: "Meera",
    split: { shares: { Aarav: 1, Rohan: 1, Meera: 2 } },
    cat: "Health",
    note: "Meera took the 2-hour package",
  });
  e({
    date: "2026-10-05",
    desc: "Phi Phi day trip (GetYourGuide)",
    amount: 96,
    cur: "EUR",
    paid: "Rohan",
    split: { exact: { Rohan: 48, Meera: 48 } },
    cat: "Fun",
  });
  e({
    date: "2026-10-05",
    desc: "Chatuchak market shopping",
    amount: 3450,
    cur: "THB",
    paid: { Aarav: 2000, Siddharth: 1450 },
    split: { exact: { Aarav: 1650, Siddharth: 1800 } },
    cat: "Shopping",
  });
  e({
    date: "2026-10-06",
    desc: "Rooftop drinks at Octave",
    amount: 4860,
    cur: "THB",
    paid: "Aarav",
    split: { percent: { Aarav: 30, Rohan: 30, Meera: 10, Siddharth: 30 } },
    cat: "Fun",
  });
  e({
    date: "2026-10-06",
    desc: "Dinner at Jay Fai",
    amount: 4000,
    cur: "THB",
    paid: "Rohan",
    split: { equal: "all" },
    cat: "Food",
    note: "Crab omelette was worth the wait",
  });
  e({
    date: "2026-10-07",
    desc: "Grab to Suvarnabhumi",
    amount: 420,
    cur: "THB",
    paid: "Siddharth",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-10-07",
    desc: "Duty free chocolates",
    amount: 38.5,
    cur: "USD",
    paid: "Meera",
    split: { equal: "all" },
    cat: "Gifts",
  });
  ops.push({
    op: "payment",
    date: "2026-10-07",
    from: "Rohan",
    to: "Aarav",
    amount: 3000,
    cur: "THB",
  });
  return ops;
}

function party() {
  const ops = [];
  const e = (o) => ops.push({ op: "expense", ...o });
  e({
    date: "2026-09-14",
    desc: "Ganpati murti & decoration",
    amount: 6450,
    paid: "Ishaan",
    split: { equal: "all" },
    cat: "Other",
  });
  e({
    date: "2026-09-14",
    desc: "Modaks from Panshikar",
    amount: 2880,
    paid: "Tanvi",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-09-14",
    desc: "Flowers & aarti items",
    amount: 1240,
    paid: "Zoya",
    split: { equal: "all" },
    cat: "Other",
  });
  e({
    date: "2026-09-15",
    desc: "Catering – Maharashtrian thali for 8",
    amount: 14400,
    paid: { Ishaan: 8000, Arjun: 6400 },
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-09-15",
    desc: "Dhol tasha group",
    amount: 5000,
    paid: "Kabir",
    split: {
      shares: { Ishaan: 2, Aarav: 1, Priya: 1, Kabir: 1, Neha: 1, Tanvi: 1, Arjun: 1, Zoya: 1 },
    },
    cat: "Fun",
    note: "Ishaan's family counts double",
  });
  e({
    date: "2026-09-15",
    desc: "Cold drinks & ice",
    amount: 980,
    paid: "Aarav",
    split: { equal: "all" },
    cat: "Food",
  });
  ops.push({ op: "payment", date: "2026-09-16", from: "Neha", to: "Ishaan", amount: 3200 });
  return ops;
}

function lonavala() {
  const ops = [];
  const e = (o) => ops.push({ op: "expense", ...o });
  e({
    date: "2026-06-21",
    desc: "Fuel – Mumbai ↔ Lonavala",
    amount: 2400,
    paid: "Rohan",
    split: { equal: "all" },
    cat: "Transport",
  });
  e({
    date: "2026-06-21",
    desc: "Lunch at Della Adventure",
    amount: 3150,
    paid: "Kabir",
    split: { equal: "all" },
    cat: "Food",
  });
  e({
    date: "2026-06-21",
    desc: "Chikki from Maganlal",
    amount: 450,
    paid: "Aarav",
    split: { equal: "all" },
    cat: "Food",
  });
  ops.push({ op: "payment", date: "2026-06-22", from: "Aarav", to: "Rohan", amount: 400 });
  ops.push({ op: "payment", date: "2026-06-22", from: "Aarav", to: "Kabir", amount: 1150 });
  return ops;
}

/** me: the member the capture script picks on the Join screen. */
export const GROUPS = [
  {
    slug: "flat",
    name: "Flat 4B, Bandra",
    kind: "home",
    currency: "INR",
    members: FLAT,
    me: "Aarav",
    created: "2026-06-28",
    ops: flatWithWrongAugBill(),
  },
  {
    slug: "goa",
    name: "Goa trip",
    kind: "trip",
    currency: "INR",
    members: GOA,
    me: "Aarav",
    created: "2026-07-30",
    ops: goa(),
  },
  {
    slug: "bangkok",
    name: "Bangkok trip",
    kind: "trip",
    currency: "INR",
    members: BKK,
    me: "Aarav",
    created: "2026-09-20",
    ops: bangkok(),
  },
  {
    slug: "party",
    name: "Ganpati at Ishaan's",
    kind: "party",
    currency: "INR",
    members: PARTY,
    me: "Aarav",
    created: "2026-09-10",
    ops: party(),
  },
  {
    slug: "lonavala",
    name: "Lonavala day out",
    kind: "other",
    currency: "INR",
    members: LONAVALA,
    me: "Aarav",
    created: "2026-06-20",
    ops: lonavala(),
  },
];
