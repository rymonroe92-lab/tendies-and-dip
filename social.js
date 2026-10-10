"use strict";
/* Tendies and Dip - OFFICE LIFE add-on (cosmetic only, 100% client-side, zero tokens, never writes engine state).
   Loaded after floor2d.js; wraps a few of its functions instead of editing them (Research Inc.'s additions stay intact).
   - Meet Kevin (display name for bot id "zip"); Nancy runs Research Inc. from her corner office on B1 (b1_nancy.js) and only
     comes up the Research Inc. stairs for team lunch or her daily meeting with El Jefe (same date-seeded schedule on both floors)
   - RimWorld-style relationships: directional opinions -100..+100, Friend/Rival/Crush/Lovers (PG), saved per viewer (localStorage)
   - Chats at the coffee machine / copier / water cooler / desks via the existing A* (no clipping), 2-3 bubbles max
   - Daily outfits (seed = ET date + character), Friday casual, October costume bits, December ugly sweaters
   - Idle routines: restroom/water-cooler breaks, stretches, phone calls, lunch (DoorDash to desks during market hours,
     break room for benched traders / after hours), fist bumps, crowding around real trades, desk celebrate/slump,
     El Jefe pacing, Goldie at her desk, night owls after the close.  Live hooks only READ the polled state.json. */
(function () {
// ---------------------------------------------------------------- voice lines (written once; light parody, PG)
const L = {
  open: ["Did you see that candle?", "Who keeps microwaving fish?", "Coffee machine is judging me", "I backtested my lunch order",
    "My horoscope says buy {SYM}", "Is it Friday yet? Asking twice", "Nice shoes, {B}. Very bullish", "I dreamt in candlesticks again",
    "{B}, you look rested. Suspicious", "Who printed 400 charts?", "I named my plant Liquidity", "The copier ate my P&L",
    "Hot take: lunch is a position", "I'm long snacks, short sleep", "Have you met the bull statue?", "Quick, look busy. Jefe!",
    "My fantasy portfolio is crushing", "{SYM} chart looks like a duck", "Meeting about the meeting at 3", "I tried yoga. Stopped out",
    "Somebody hug the server rack", "My mom asked if I'm rich yet", "Do you hear the market? Me too", "Knobs tuned my chair. Too high",
    "If I sit still is that alpha?"],
  pos: ["Ha! Facts.", "Respect, {A}.", "You're alright, {A}.", "Big same.", "LOL. Coffee's on me", "Okay that's actually good",
    "This is why we're friends", "Bullish on this convo", "Noted. Filing under wins", "Love that energy", "Say less!",
    "High five! Socially distanced", "You get it, {A}.", "Agreed, 100%. Not Kevin 100%", "Top of the tape, {A}",
    "Adding you to my watchlist", "Okay, you win this round", "Same brain cell, {A}"],
  neg: ["Bold of you, {A}.", "Hard pass.", "Who asked, {A}?", "That's a sell rating from me", "Wow. Okay. Noted.",
    "Please stop talking about crypto", "Your take has no edge", "I'm putting you on mute", "Cool story, needs a stop loss",
    "Hmm. Backtest that.", "Not now, I'm pretending to work", "You stole my stapler", "Respectfully: no",
    "That's giving overfit", "I'll file that under noise"],
  friend: ["Bestie! Desk lunch later?", "My favorite coworker, {B}!", "Saved you the good chair", "Team {B} all day",
    "Fist bump, partner", "We should pair trade. Paper only", "You + me = green week", "Got you a donut, {B}",
    "Our handshake is 12 steps", "If I win silver, you get half"],
  rival: ["Oh. It's you, {B}.", "My P&L could beat up yours", "Nice try, {B}. Still red", "Stay off my side of the tape",
    "Ever heard of a stop loss, {B}?", "Silver plaque is mine, {B}", "I liked {B} better benched", "Who let you near the coffee?",
    "Chart crime detected, {B}", "Are you lost, {B}?"],
  crush: ["Oh! Hi {B}. Nice... chart.", "I, uh, made you a sparkline", "Is it warm in here or is it {SYM}?",
    "{B}, want to share a coffee?", "Saw this candle, thought of you", "You have great risk management",
    "No reason. Just saying hi!", "Your watchlist is so cool"],
  lovers: ["Saved you a coffee, sweetie", "Our love has no drawdown", "You're my favorite green candle",
    "Lunch date in the break room?", "Partners in paper profits", "Happy Wednesday, {B}!", "I put your name on my monitor",
    "Long-term hold, you and me"],
  zip: ["This is the bottom. 100% sure. Again.", "Crash incoming... any second now...", "I've never been wrong, except every time",
    "Smash that like if you're long", "BREAKING: I changed my mind again", "Load the boat! (paper boat)",
    "My ring light says bullish", "Generational buying opportunity #47", "I called it. Which time? All of them",
    "Thumbnail face: shocked. Market: flat", "I'm all in. Benched, but all in", "This time is different. I can feel it",
    "Sell everything. No wait, buy", "My conviction is 110%. Results: TBD", "Link in bio for my bad calls",
    "Hold on, live stream starting", "The Fed is about to pivot. Today. Maybe", "Confidently wrong is still confident",
    "If I'm wrong I'll double down", "Recession by lunch. Rally by 3", "Bench is a bull flag, trust me",
    "New video: Why I was right (I wasn't)"],
  kevinAsk: ["Nancy! Any tips? Asking for a friend", "Nancy, what are you buying? Just curious", "Nancy, quick collab? Huge audience",
    "Psst, Nancy. NVDA or no?", "Nancy, can I see your watchlist? Pls", "Nancy, I'll trade you a shoutout"],
  nancyIgnore: ["...", "Who let you in, dear?", "Mm-hm. Bye now.", "I don't recall.", "No comment, sweetie.",
    "Is someone talking? Odd.", "Lovely weather, isn't it?", "Lucky guess, dear. Go away."],
  kevinAfter: ["I'll take that as a buy signal", "She's definitely bullish then", "Noted. Going all in", "That's basically a yes"],
  nancy: ["Oh, I just had a feeling about NVDA.", "My husband's portfolio? Never heard of it.", "Lucky guess, dear.",
    "Just a hunch, sweetie.", "Timing? I don't know what you mean.", "I simply read the newspaper. Early.",
    "Calls? Like on the phone? Cute.", "Coincidence is my favorite indicator", "Research Inc., my office. Now, please.",
    "I'm a long-term investor. Ish.", "Pearls stay on. Risk stays off.", "Nobody beats Nancy. Lovingly.",
    "My index fund is called Nancy", "I'll wait for the dip I know about. Ha!", "Disclosure? Darling, it's paper money",
    "Every trade is a hunch, dear", "Perfectly timed, as usual", "I just like the stock, sweetie"],
  nancyCall: ["Sage, dear? A moment, please.", "Beats! Earnings chat. Now.", "Tape, come up. Bring charts.",
    "Scoop, any news? Early news?", "Proof, grade my hunches."],
  riToNancy: ["You rang, boss?", "Report for Nancy, as asked", "Here's the macro brief", "Earnings calendar, boss",
    "Hunch confirmed? Kidding"],
  nancyRiReply: ["Perfect. As I suspected.", "Leave it on the desk, dear.", "Hm. I already knew. Thanks!",
    "Wonderful. Not a word.", "Splendid. Off you go."],
  grok: ["Weekly rule, amigos: green by Friday", "Protect the Monday baseline", "No hail marys on my ranch",
    "Below Monday? Half size, partner", "Friday after 2: hands off", "Risk first, tacos second",
    "I wear shades because the P&L shines", "Cash is a position, compadre", "This hat has seen drawdowns",
    "Stop on every trade. Every one", "Give back half? Not on my watch", "Gold chain, iron discipline",
    "Who's touching the risk caps? Nobody", "Weekend gap? We sleep flat"],
  goldie: ["Don't tell, but {LEADER} is leading", "Silver plaque polished. Who wants it?", "Gold portrait frame is ready",
    "I hear {B} cried at the copier", "Psst. Knobs is up for an award", "Hall of Fame is monthly only, hon",
    "Scores update at the close, sugar", "{LEADER} keeps asking about trophies", "I judge fair. Mostly.",
    "New dress, same strict judging", "Somebody's getting a plaque Friday", "El Jefe can win too. Don't tell him",
    "Pixel's clean sessions add up!", "Nancy? Not eligible. She asked"],
  knobs: ["Out of sample or it didn't happen", "Walk-forward, never walk back", "That's overfit and you know it",
    "Sharpe ratio is my love language", "I tuned the coffee to 92 C", "Parameter grid: plus or minus one step",
    "Your idea needs more trades", "Profit factor 1.1 or bust", "I don't reward trade count. Ever",
    "Drawdown penalty applied. Sorry", "Let me backtest your excuse", "Nightly pass light, Friday full"],
  pixel: ["Bars are fresh. Mostly.", "Data delayed? Blame the cloud", "I ping, therefore I am",
    "NaN is not a number. Or a mood", "Rack temp nominal. Vibes nominal", "One clean session = 2 bucks",
    "yfinance blinked. I didn't", "I count candles to fall asleep", "Feed's up. Snacks are down",
    "Timestamps don't lie. Humans do", "I dream in CSV", "Cache hit! Best feeling ever"],
  indy: ["I just hold SPY. Zero stress.", "Fees? Never heard of them.", "I beat most of you. Quietly.",
    "Active trading? How quaint.", "Time in market, my friend", "My strategy fits on a napkin",
    "Couch is my trading desk", "Buy. Hold. Nap. Repeat.", "I'm the benchmark. You're the bench",
    "Rebalancing? I'm on vacation", "Diversified and relaxed", "Your edge is my index"],
  drift: ["Earnings gap? I'm drifting in", "Gap up, hold the low, ride it", "Post-earnings vibes only",
    "15 sessions max. Then I surf off", "Volume 1.5x? Now we're talking", "I read earnings like weather"],
  dash: ["Opening range or bust", "First 30 minutes, best 30 minutes", "VWAP below? I'm out", "Breakout! Probably!"],
  vee: ["VWAP is my safe space", "Dip to VWAP, reclaim, smile", "I only like green bars", "Patience is a setup"],
  snap: ["Bollinger band? More like bungee", "RSI2 under 10. I'm awake", "Mean reversion, mean coffee",
    "SPY and QQQ only. I'm loyal"],
  trek: ["New 20-day high? Saddle up", "Trend is my friend. You too", "Trailing stop, trailing jokes", "Uptrend hiking club"],
  dip: ["I buy dips. Even chips", "RSI2 is calling my name", "Oversold? Over here!", "Pullback? Pull up a chair"],
  rota: ["Rotation is just musical chairs", "Top 3 relative strength, baby", "Rank fell? Bye bye", "Sector speed dating"],
  ri: ["Fresh research, hot off the wire", "Signals file updated", "Earnings calendar looks spicy", "Macro data at 8:30, folks",
    "Risk flags first, ideas second", "Downstairs coffee is better", "I graded last week. Ouch", "Avoid list is short today",
    "Our analyst note is ready", "Up the stairs, cardio done"],
  // live trading events
  kevinBuy: ["{SYM}? That's going to zero. 100%", "Buying {SYM} at the top. Classic", "I'd short {SYM}. If I could. Long only",
    "{SYM} is a bubble. I'm sure. Again", "Sell {SYM}! Crash any second"],
  kevinWin: ["Wait, it went up? My model said down", "Lucky. I'd have made more. Allegedly", "Called the opposite. Still proud",
    "That's what I said. Just backwards"],
  kevinLoss: ["Told you! (I said the opposite)", "Buy more! Average down! Kidding... ?", "I predicted this. Somewhere. Maybe",
    "Loss? That's a generational entry"],
  winBrag: ["Green! Somebody ring a bell", "Paper profits taste great", "Booked it. Goldie, note that",
    "Plaque energy right there", "That's how we do it!"],
  lossGroan: ["Oof. Stop did its job", "Small loss, big lesson", "Market said no", "Taking the L. Just a small one",
    "Next one. Shake it off"],
  congrats: ["Nice trade, {B}!", "Ring the bell for {B}!", "That's my desk-mate!", "Teach me your ways, {B}", "Silver plaque vibes!"],
  smirk: ["Oof, {B}. Rough tape", "{B} donated to the market", "There goes {B}'s plaque", "F in the chat for {B}"],
  sitOut: ["Sitting out again? I had a feeling", "No trades today. Cash is comfy", "Gate said no. Fine. Snacks",
    "Desk sits out. I'll sharpen pencils"],
  kevinSit: ["Sitting out the rally of the decade? OK", "Worst day to sit out. Trust me", "This is when I'd go all in"],
  kevinBench: ["Benched is a buy-the-dip signal", "Bench? That's my content studio"],
  // idle routines
       food: {
         pizza: ["Pizza day! Best day", "Pineapple? Bold, {B}.", "Corner slice is mine", "Pepperoni = alpha", "Crust is a free option",
           "Extra cheese, extra risk", "One more slice. Then work", "This box is a bull flag", "Who ate the last slice?!", "Grease on my keyboard. Worth it"],
         tacos: ["Taco Wednesday? Any day!", "El Jefe approves these tacos", "Salsa level: volatile", "Al pastor or bust", "Three tacos, zero regrets",
           "Hot sauce = high beta", "Lime adds alpha", "I'm long guac", "Taco spread is tight today", "Tortilla fully hedged"],
         sushi: ["Sushi! Fancy Fridays early", "Spicy tuna, spicy tape", "Chopsticks: still learning", "Wasabi woke me up", "Salmon roll, bull roll",
           "California roll, low risk", "Ginger cleanses the P&L", "Who ordered 40 edamame?", "Soy sauce on my chart", "Nigiri? Nice, Goldie!"],
         burgers: ["Burger day! Big candles", "Double patty, double size", "Fries are a side position", "No pickles. Risk managed", "Cheeseburger = comfort trade",
           "Ketchup or mustard? Both", "Onion rings? Ring the bell", "This burger has momentum", "Shake it off. The shake", "Smash burger, smash day"],
       },
       kevinFood: ["Pizza is going to zero. Eating it anyway", "Sushi is a bubble. Pass the soy", "Tacos are a buy. 100%. Again",
         "Burgers: generational entry point", "Food prices crash next week. Trust me", "Subscribe for lunch hot takes"],
       lunchTalk: ["Lunch together? Love this team", "Pass the napkins, {B}", "No trading talk at lunch. Kidding", "Who's on dishes? Not me",
         "Market's open, mouth's full", "Team lunch > solo lunch", "{B}, try this one!", "Save some for Pixel", "Best part of the day",
         "Nancy brought her own pearls. Classy", "Goldie, does lunch count for awards?", "Don't drop crumbs on the bull", "The engine trades. We eat"],
       lunchCall: ["Lunch is here! {FOOD}!", "{FOOD} time, everyone!", "Break room! {FOOD}!", "Come and get it! {FOOD}!"],
       lunchOrder: ["Ordered {FOOD} for the team", "Lunch order in: {FOOD}", "{FOOD} on the way, hon"],
       courier: ["{FOOD} for Tendies and Dip!", "Delivery! {FOOD}!", "Order for the office!", "Big order! Enjoy!"],
       lunchDone: ["Back to the desk. Full", "Food coma, but focused", "Thanks for lunch, team!", "Okay. Back to work", "Best lunch this week"],
  phone: ["Yes Mom, it's paper money", "Can I call you after the close?", "No, I don't want an extended warranty",
    "Hello? You're breaking up. Bye", "Pizza for 12, extra cheese", "Dentist? Next Tuesday works", "Yeah I'm at the office. Mostly",
    "Grandma, SPY is up. You're welcome"],
  restroom: ["Be right back", "Nature calls. Not a margin call", "BRB, two minutes"],
  stretch: ["Stretch break. Back cracks", "Reach for the highs!", "Neck rolls. Very bullish", "Touching my toes. Almost"],
  cooler: ["Hydrate or liquidate", "Water cooler gossip time", "Cold water, hot takes", "Refill. Stay liquid"],
  pace: ["Weekly rule... weekly rule...", "Pacing helps me think, partner", "Thinking about Friday's close", "Spurs on, stops on"],
  bump: ["*fist bump*", "Boom! Bump it", "Pow! Teamwork"],
  gather: ["Let me see that fill!", "Gather round, a trade!", "Show me the P&L!", "Ooh, what happened?"],
  goldieDesk: ["Phones, files, plaques. Busy!", "Front desk, Goldie speaking", "Signing in visitors, hon", "Sorting award scores"],
  owl: ["Night owl mode", "Couple more charts then home", "Office is so quiet after the close", "Last one out hits the lights"],
};

// ---------------------------------------------------------------- helpers
let sseed = (Date.now() % 2147483646) + 1;
const srnd = () => (STRESS ? rnd() : ((sseed = (sseed * 16807) % 2147483647) / 2147483647));
const spick = (a) => a[(srnd() * a.length) | 0];
function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
const dayKey = () => (window.TND && window.TND.dayKey ? window.TND.dayKey() : new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()));
// generic add-on hooks (seasons.js uses them): extra outfit tweaks + extra context lines
const OUTFIT_HOOKS = [], LINE_HOOKS = [];
function extraLines(id) { let out = []; for (const f of LINE_HOOKS) { try { out = out.concat(f(id) || []); } catch (e) { /* ignore */ } } return out; }
const dist = (a, b) => Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
const vis = (id) => chars[id] && !chars[id].hidden && !(typeof LAID_OFF !== "undefined" && LAID_OFF.has(id));
const SYMS = ["NVDA", "AAPL", "TSLA", "SPY", "QQQ", "AMD", "META", "MSFT", "AMZN", "GOOGL"];
function fill(s, a, b, x) {
  const lb = S && S.awards && S.awards.week && S.awards.week.leaderboard;
  return s.replace(/\{A\}/g, DISP(a)).replace(/\{B\}/g, b ? DISP(b) : "PAL").replace(/\{SYM\}/g, (x && x.sym) || spick(SYMS))
    .replace(/\{LEADER\}/g, lb && lb[0] ? DISP(lb[0].bot) : "NOBODY");
}
const POOL = { zip: L.zip, nancy: L.nancy, grok: L.grok, goldie: L.goldie, knobs: L.knobs, pixel: L.pixel, indy: L.indy, drift: L.drift,
  dash: L.dash, vee: L.vee, snap: L.snap, trek: L.trek, dip: L.dip, rota: L.rota };
for (const id of RI_IDS) POOL[id] = L.ri;
const LINE_COUNT = Object.values(L).reduce((n, a) => n + (Array.isArray(a) ? a.length : Object.values(a).reduce((m, x) => m + x.length, 0)), 0);

// ---------------------------------------------------------------- cast + map additions
Object.assign(CAST.zip, { name: "MEET KEVIN", hair: "#2b1a10", shirt: "#1f2937", pants: "#111827", acc: "kevin" }); delete CAST.zip.spiky;
CAST.nancy = { name: "NANCY", skin: "#f1d0b5", hair: "#c9a27a", shirt: "#f7b8d0", pants: "#f7b8d0", acc: "pearls", long: 1 };
CAST.courier = { name: "DELIVERY", skin: "#c68642", hair: "#1b1b1b", shirt: "#ef3e36", pants: "#2b2d42", acc: "courier" };
COL.nancy = "#f7a8c8"; COL.courier = "#ef3e36";
ROLE_SHORT.zip = "swing: 52-week-high leaders";
ROLE_SHORT.nancy = "Research Inc. boss · corner office on B1 (no trading, no awards)";
ROLE_SHORT.courier = "lunch delivery guy (cosmetic)";
const newChar = (id) => ({ id, tx: 0, ty: 0, x: 0, y: 0, path: [], moving: false, from: null, goal: null, task: null, face: "S", pose: "stand",
  hidden: true, wait: 0, walkT: 0, bubble: null, emote: null, emoteUntil: 0, jumpUntil: 0, nextErrand: 0, homeKey: null,
  idleSince: 0, speed: 3.4, placed: false, arrivedAt: 0 });
chars.nancy = newChar("nancy"); chars.courier = newChar("courier"); chars.courier.speed = 4.2;
ORDER.splice(ORDER.indexOf("indy") + 1, 0, "nancy"); ORDER.push("courier");
S_("soc_mid_a", 11, 12, "E"); S_("soc_mid_b", 12, 12, "W"); S_("soc_cool", 4, 4, "E");

// ---------------------------------------------------------------- daily outfits (same for every viewer on a given ET day)
const PAL = ["#e63946", "#2a9d8f", "#264653", "#e9c46a", "#f4a261", "#8338ec", "#3a86ff", "#06d6a0", "#ef476f", "#118ab2", "#6a994e", "#bc6c25", "#7209b7", "#495057"];
const PANTS = ["#2b2d42", "#22223b", "#3a3a52", "#1f2937", "#40342a", "#5b4636", "#1e3a5f", "#e5e7eb", "#6b705c"];
const PASTEL = ["#f7b8d0", "#b8d8f7", "#c8f7c5", "#f7e3b8", "#d9c2f7", "#f7c9b8"];
const DRESS = [["#ff2d95", "#ffe14d"], ["#00b4d8", "#fff3b0"], ["#8ac926", "#ff595e"], ["#ff924c", "#4cc9f0"], ["#9b5de5", "#fee440"], ["#f15bb5", "#00f5d4"], ["#ffca3a", "#6a4c93"]];
const HEADWEAR = new Set(["headband", "beanie", "cap", "visor", "headset", "headphones", "bow", "jefe", "courier"]);
let outfitDay = null, outfitCache = {};
function outfitOf(id) {
  const base = CAST[id]; if (!base || id === "courier") return base;
  const day = dayKey();
  if (day !== outfitDay) { outfitDay = day; outfitCache = {}; }
  if (outfitCache[id]) return outfitCache[id];
  const r = (salt) => fnv(day + ":" + id + ":" + salt);
  const pk = (a, salt) => a[Math.floor(r(salt) * a.length)];
  const [y, m, d] = day.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const fri = wd === 5, oct = m === 10, dec = m === 12;
  const o = Object.assign({}, base);
  if (id === "grok") {                                // signature hat/shades/mustache/gold chain always on
    o.shirt = fri ? "#3b5b8c" : pk(["#23232b", "#1e2a44", "#3b1d24", "#2a2a2a", "#2d3a2e"], "s");
    o.tie = pk(["#f2c14e", "#c1121f", "#2ec4b6", "#f2c14e"], "t");
  } else if (id === "goldie") {                       // colorful dress, new color + pattern daily
    const dr = pk(DRESS, "d"); o.dress = dr[0]; o.dots = dr[1]; o.pattern = pk(["dots", "stripes", "checks", "floral"], "p");
  } else if (id === "nancy") {                        // pastel suit + pearls always
    o.shirt = o.pants = pk(PASTEL, "s"); o.top = "blazer"; o.jk = shade(o.shirt, 0.85);
  } else if (id === "zip") {                          // Meet Kevin: dark polo or suit, phone, sometimes the ring light
    o.shirt = pk(["#1f2937", "#111827", "#1e3a5f", "#3f3f46"], "s"); o.top = r("t") < 0.5 ? "polo" : "suit"; o.inner = "#e5e7eb";
    o.ring = r("ring") < 0.5;
  } else {
    o.shirt = pk(PAL, "s"); o.pants = pk(PANTS, "p");
    const top = pk([null, null, "hoodie", "tie", "sweater", "jacket"], "top");
    if (top === "hoodie" || top === "sweater") { o.top = top; }
    else if (top === "tie") { o.top = "tie"; o.tc = pk(["#c1121f", "#1d3557", "#2a9d8f", "#f2c14e"], "tc"); }
    else if (top === "jacket") { o.top = "jacket"; o.inner = o.shirt; o.shirt = pk(["#2b2d42", "#5c4033", "#1e3a5f", "#6b705c"], "jk"); }
    if (!HEADWEAR.has(base.acc) && r("cap") < 0.18) o.hat2 = pk(["#e63946", "#3a86ff", "#06d6a0", "#ffbe0b"], "hc");
  }
  if (fri && id !== "goldie" && id !== "grok") {     // Friday casual: jeans, no ties/blazers
    o.pants = "#3b5b8c"; if (o.top === "tie" || o.top === "jacket" || o.top === "suit") { o.top = r("fc") < 0.5 ? "hoodie" : null; if (o.inner) o.shirt = o.inner; }
    if (id === "nancy") { o.top = null; o.pants = "#3b5b8c"; }
  }
  if (oct && id !== "grok") {                         // October: the odd costume piece (more of them near Halloween)
    const p = d === 31 ? 0.6 : d >= 24 ? 0.25 : 0.12;
    if (r("cost") < p) o.costume = pk(["witch", "pumpkin", "horns", "catears", "vampire"], "ck");
    if (o.costume === "vampire" && !o.dress) o.top = "cape";
  }
  if (dec && !o.dress && r("ugly") < (d >= 15 ? 0.6 : 0.35)) { o.top = "ugly"; o.shirt = "#b91c1c"; }
  if (o.top === "hoodie") o.shirt = shade(o.shirt, 0.9);
  for (const f of OUTFIT_HOOKS) { try { f(id, o, day); } catch (e) { /* ignore */ } }
  return (outfitCache[id] = o);
}
const _drawChar = drawChar;
drawChar = function (c, t) {
  const orig = CAST[c.id], k = outfitOf(c.id) || orig;
  CAST[c.id] = k;
  try { _drawChar(c, t); } finally { CAST[c.id] = orig; }
  drawExtras(c, k, t);
};
function drawExtras(c, k, t) {
  const sitting = (c.pose === "sit" || c.pose === "feetup") && !c.moving && !c.path.length;
  const couch = c.pose === "couch" && !c.moving && !c.path.length;
  let fx = Math.round(c.x), fy = Math.round(c.y + 6);
  if (sitting) fy = Math.round(c.y + 3); if (couch) fy = Math.round(c.y + 4);
  if (c.jumpUntil > T) fy -= Math.round(Math.abs(Math.sin(T * 12)) * 3);
  const face = c.face, x0 = fx - 7, top = fy - 24, S_ON = face === "S";
  // torso layers
  if (!k.dress) switch (k.top) {
    case "hoodie": R(g, x0 + 2, top + 10, 10, 2, shade(k.shirt, 0.8)); R(g, x0 + 4, top + 15, 6, 2, shade(k.shirt, 0.8)); if (S_ON) { R(g, x0 + 5, top + 12, 1, 3, "#eee"); R(g, x0 + 8, top + 12, 1, 3, "#eee"); } break;
    case "tie": if (S_ON) { R(g, x0 + 5, top + 11, 4, 1, "#f5f5f5"); R(g, x0 + 6, top + 12, 2, 5, k.tc); } break;
    case "sweater": R(g, x0 + 2, top + 13, 10, 1, shade(k.shirt, 0.8)); R(g, x0 + 2, top + 16, 10, 1, shade(k.shirt, 0.8)); R(g, x0 + 4, top + 11, 6, 1, shade(k.shirt, 1.3)); break;
    case "jacket": case "suit": case "blazer": if (face !== "N") { R(g, x0 + 5, top + 11, 4, 7, k.inner || k.jk || "#e5e7eb"); if (k.top === "suit" && S_ON) R(g, x0 + 6, top + 12, 2, 5, "#7f1d1d"); } break;
    case "polo": R(g, x0 + 4, top + 11, 6, 1, shade(k.shirt, 1.6)); if (S_ON) R(g, x0 + 6, top + 12, 2, 2, shade(k.shirt, 1.5)); break;
    case "ugly": for (let i = 0; i < 5; i++) R(g, x0 + 2 + i * 2, top + 14 + (i % 2), 2, 1, "#15803d"); R(g, x0 + 3, top + 12, 1, 1, "#fff"); R(g, x0 + 9, top + 17, 1, 1, "#fff"); R(g, x0 + 6, top + 16, 2, 1, "#fde047"); break;
    case "cape": R(g, x0, top + 10, 14, 1, "#7f1d1d"); if (face === "N") R(g, x0 + 1, top + 11, 12, 9, "#111"); break;
  }
  if (k.dress && k.pattern && k.pattern !== "dots") {
    for (let yy = top + 13; yy < top + 21; yy += 2) {
      if (k.pattern === "stripes") R(g, x0 + 2, yy, 10, 1, k.dots);
      else for (let xx = x0 + 2 + ((yy >> 1) % 2) * 2; xx < x0 + 12; xx += 4) R(g, xx, yy, k.pattern === "floral" ? 1 : 2, 1, k.pattern === "floral" && xx % 3 ? "#ffffff" : k.dots);
    }
  }
  if (k.acc === "pearls" && face !== "N") for (let i = 0; i < 5; i++) R(g, x0 + 3 + i * 2, top + 11 + (i === 0 || i === 4 ? 0 : 1), 1, 1, "#fffaf0");
  const hx = face === "W" ? x0 - 3 : x0 + 12;
  if (k.acc === "kevin" && face !== "N") { R(g, hx, top + 12, 3, 5, "#111"); R(g, hx + 1, top + 13, 1, 3, "#7dd3fc"); }
  if (k.ring && !sitting && !c.moving) { const rx = face === "W" ? x0 + 15 : x0 - 9; R(g, rx, top + 2, 7, 1, "#fff6c2"); R(g, rx, top + 8, 7, 1, "#fff6c2"); R(g, rx, top + 2, 1, 7, "#fff6c2"); R(g, rx + 6, top + 2, 1, 7, "#fff6c2"); R(g, rx + 3, top + 9, 1, 12, "#555"); }
  if (k.acc === "courier") { R(g, x0 + 1, top - 2, 12, 4, "#ef3e36"); if (face !== "N") R(g, face === "W" ? x0 - 2 : x0 + 4, top + 1, 9, 2, "#b42318"); if (c.task && lunch && lunch.phase === "delivery") {
    if (lunch.food === "pizza") for (let i = 0; i < 3; i++) { R(g, x0 - 1, top + 12 - i * 3, 16, 3, i % 2 ? "#e8d3a8" : "#f2e2bf"); R(g, x0 + 4, top + 12 - i * 3, 5, 1, "#c1121f"); }
    else { R(g, hx - 1, top + 10, 7, 9, "#b08968"); R(g, hx - 1, top + 10, 7, 1, "#7f5539"); R(g, hx + 1, top + 13, 3, 2, "#ef3e36"); } } }
  if (k.hat2 && !k.costume) { R(g, x0 + 1, top - 2, 12, 4, k.hat2); if (face !== "N") R(g, face === "W" ? x0 - 2 : x0 + 4, top + 1, 9, 2, shade(k.hat2, 0.8)); }
  switch (k.costume) {
    case "witch": R(g, x0 - 2, top + 1, 18, 2, "#4c1d95"); R(g, x0 + 3, top - 4, 8, 5, "#4c1d95"); R(g, x0 + 5, top - 8, 4, 4, "#4c1d95"); R(g, x0 + 6, top - 10, 2, 2, "#4c1d95"); R(g, x0 + 3, top - 1, 8, 1, "#f97316"); break;
    case "pumpkin": R(g, x0 + 1, top - 3, 12, 5, "#f97316"); R(g, x0 + 4, top - 3, 1, 5, "#c2410c"); R(g, x0 + 9, top - 3, 1, 5, "#c2410c"); R(g, x0 + 6, top - 5, 2, 2, "#15803d"); break;
    case "horns": R(g, x0 + 1, top - 3, 2, 3, "#dc2626"); R(g, x0 + 11, top - 3, 2, 3, "#dc2626"); break;
    case "catears": R(g, x0 + 1, top - 3, 3, 3, "#111"); R(g, x0 + 10, top - 3, 3, 3, "#111"); R(g, x0 + 2, top - 2, 1, 1, "#f9a8d4"); R(g, x0 + 11, top - 2, 1, 1, "#f9a8d4"); break;
  }
  // routine props
  if (c.phoneUntil > T) R(g, face === "W" ? x0 - 1 : x0 + 12, top + 4, 2, 5, "#111");
  if (c.eatUntil > T && c.lunch && c.lunch.arrived && lunch) drawFood(lunch.food, sitting ? x0 + 9 : hx, top + 12, false);
  if (c.slumpUntil > T) { R(g, fx - 6, top - 10, 12, 4, "#94a3b8"); R(g, fx - 4, top - 12, 8, 2, "#cbd5e1"); if (Math.floor(t * 4) % 2) { R(g, fx - 4, top - 5, 1, 2, "#60a5fa"); R(g, fx + 2, top - 5, 1, 2, "#60a5fa"); } else R(g, fx - 1, top - 5, 1, 2, "#60a5fa"); }
}

// ---------------------------------------------------------------- relationships (persisted per viewer)
const SKEY = "tnd_social_v1";
const NO_ROMANCE = new Set(["nancy", "zip", "courier"]);   // real-person parodies stay out of romance
const PRESET = { "grok>goldie": 48, "goldie>grok": 44, "knobs>pixel": 50, "pixel>knobs": 46, "dash>zip": -45, "zip>dash": -40,
  "indy>zip": -50, "zip>indy": -42, "nancy>zip": -60, "zip>nancy": 55, "sage>proof": 48, "proof>sage": 45, "trek>dip": 22, "vee>snap": 18,
  "dash>vee": -18, "vee>dash": -22, "nancy>sage": 40, "sage>nancy": 38, "goldie>indy": 25 };
let SOC = null, socDirty = false, socSaved = 0;
function socLoad() {
  try { const s = JSON.parse(localStorage.getItem(SKEY) || "null"); if (s && s.v === 1 && s.op) return s; } catch (e) { /* private mode */ }
  return { v: 1, op: {}, lab: {}, crush: {}, lovers: [], lines: [], rel: [], created: new Date().toISOString() };
}
SOC = socLoad();
function socSave(force) {
  if (STRESS || !socDirty || (!force && Date.now() - socSaved < 15000)) return;
  try { localStorage.setItem(SKEY, JSON.stringify(SOC)); socSaved = Date.now(); socDirty = false; } catch (e) { /* full / private */ }
}
const SOCIAL_IDS = () => ORDER.filter((id) => id !== "courier" && !(CAST[id] && CAST[id].visitor));   // visitors (e.g. the copier tech) stay out of social
function op(a, b) {
  const k = a + ">" + b;
  if (SOC.op[k] == null) SOC.op[k] = PRESET[k] != null ? PRESET[k] : Math.round(fnv("seed:" + k) * 50 - 18) + (RI[a] && RI[b] ? 20 : 0);
  return SOC.op[k];
}
const pk2 = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
const mutual = (a, b) => (op(a, b) + op(b, a)) / 2;
const isLovers = (a, b) => SOC.lovers.some((p) => p === pk2(a, b));
function labelOf(a, b) { if (isLovers(a, b)) return "Lovers"; const m = mutual(a, b); return m >= 40 ? "Friends" : m <= -40 ? "Rivals" : ""; }
function relEvent(text, a, b) {
  if (STRESS) return;
  SOC.rel.push({ t: Date.now(), a, b, text }); while (SOC.rel.length > 10) SOC.rel.shift(); socDirty = true; socPanelDirty = true;
}
function logLine(id, text, kind) {
  if (STRESS) return;
  SOC.lines.push({ t: Date.now(), a: id, text, kind: kind || "" }); while (SOC.lines.length > 15) SOC.lines.shift(); socDirty = true; socPanelDirty = true;
}
function nudge(a, b, d) {
  if (STRESS) return;
  const before = labelOf(a, b);
  SOC.op[a + ">" + b] = Math.max(-100, Math.min(100, Math.round(op(a, b) + d)));
  const after = labelOf(a, b), key = pk2(a, b);
  if (before !== after && after !== "Lovers") {
    SOC.lab[key] = after;
    relEvent(after ? `${DISP(a)} and ${DISP(b)} are now ${after}` : `${DISP(a)} and ${DISP(b)} are ${before === "Rivals" ? "no longer rivals" : "drifting apart"}`, a, b);
  }
  // crush / lovers / breakups (wholesome, rare)
  if (!NO_ROMANCE.has(a) && !NO_ROMANCE.has(b)) {
    const lovered = (x) => SOC.lovers.some((p) => p.split("|").includes(x));
    if (d > 0 && op(a, b) >= 65 && !SOC.crush[a] && !lovered(a) && !lovered(b) && srnd() < 0.2) { SOC.crush[a] = b; relEvent(`${DISP(a)} has a crush on ${DISP(b)}`, a, b); }
    if (SOC.crush[a] === b && op(b, a) >= 55 && mutual(a, b) >= 60 && !lovered(a) && !lovered(b) && srnd() < 0.25) {
      SOC.lovers.push(key); delete SOC.crush[a]; if (SOC.crush[b] === a) delete SOC.crush[b];
      relEvent(`${DISP(a)} and ${DISP(b)} are now Lovers (aww)`, a, b);
    }
    if (SOC.crush[a] === b && op(a, b) < 40) { delete SOC.crush[a]; relEvent(`${DISP(a)} got over the crush on ${DISP(b)}`, a, b); }
    if (isLovers(a, b) && mutual(a, b) < 20) { SOC.lovers = SOC.lovers.filter((p) => p !== key); relEvent(`${DISP(a)} and ${DISP(b)} split up. Still cordial`, a, b); }
  }
  socDirty = true;
}

// ---------------------------------------------------------------- bubbles: max 3 on screen (oldest yields), stamp start time
const MAX_BUBBLES = 3;
const _say = say;
say = function (id, text, secs, kind) {
  const c = chars[id]; if (!c || c.hidden) return;
  const live = ORDER.map((x) => chars[x]).filter((x) => x !== c && !x.hidden && x.bubble && x.bubble.until > T);
  if (live.length >= MAX_BUBBLES) { live.sort((a, b) => (a.bubble.t0 || 0) - (b.bubble.t0 || 0)); live[0].bubble = null; }
  _say(id, text, secs, kind);
  if (c.bubble) { c.bubble.t0 = T; const full = String(text).toUpperCase(); if (full.length > 34 && full.length <= 48) c.bubble.text = full; }   // wraps to 3x16
};
const activeBubbles = () => ORDER.filter((x) => !chars[x].hidden && chars[x].bubble && chars[x].bubble.until > T).length;
function talk(id, text, secs, kind, logKind) {
  const t = riText(text, 46); if (!t || !vis(id)) return;
  say(id, t, secs || 4.8, kind || ""); logLine(id, t, logKind);
}

// ---------------------------------------------------------------- conversations (walk via existing A*, then chat)
const PAIRS = [["coffee_1", "coffee_2", "the espresso bar"], ["coffee_2", "coffee_3", "the espresso bar"], ["copier", "copier_2", "the copier"],
  ["soc_mid_a", "soc_mid_b", "the floor"], ["cooler", "soc_cool", "the water cooler"]];
function trading(id) { const b = bot(id); return mktStatus() === "open" && TRADERS.includes(id) && b && b.status === "active" && !deskSittingOut(DESK_OF[id]); }
function idle(id) { const c = chars[id]; return c && !c.hidden && !c.task && !c.moving && !c.path.length && !RI[id] && id !== "courier" && atSpot(c, home(id)); }
function faceEach(a, b) {
  const A = chars[a], Bc = chars[b], f = (x, y) => { const dx = y.tx - x.tx, dy = y.ty - x.ty; return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N"); };
  if (A.pose !== "sit") A.face = f(A, Bc); if (Bc.pose !== "sit") Bc.face = f(Bc, A);
}
function runLines(a, b, special) {
  if (!vis(a) || !vis(b)) return;
  faceEach(a, b);
  const m = mutual(a, b);
  let l1, l2, l3 = null, pos;
  if (special === "lunch") {           // shared meal: friendlier, food talk
    pos = srnd() < Math.max(0.35, Math.min(0.95, 0.72 + m / 250));
    const fl = L.food[lunch ? lunch.food : "pizza"];
    l1 = isLovers(a, b) ? spick(L.lovers) : m >= 40 && srnd() < 0.3 ? spick(L.friend) : m <= -40 && srnd() < 0.35 ? spick(L.rival) : a === "zip" && srnd() < 0.5 ? spick(L.kevinFood) : spick(srnd() < 0.55 ? fl : L.lunchTalk);
    l2 = srnd() < 0.35 ? spick(fl) : spick(pos ? L.pos : L.neg);
    if (srnd() < 0.3) l3 = spick(srnd() < 0.5 ? L.lunchTalk : fl);
    nudge(a, b, pos ? 4 + srnd() * 6 : -(2 + srnd() * 5)); nudge(b, a, pos ? 3 + srnd() * 5 : -(2 + srnd() * 5));
  } else if (special === "kevin-nancy") { l1 = spick(L.kevinAsk); l2 = spick(L.nancyIgnore); l3 = spick(L.kevinAfter); pos = false; nudge("nancy", "zip", -3); nudge("zip", "nancy", +3); }
  else {
    pos = srnd() < Math.max(0.15, Math.min(0.9, 0.55 + m / 250));
    if (isLovers(a, b)) l1 = spick(L.lovers);
    else if (SOC.crush[a] === b) l1 = spick(L.crush);
    else if (m >= 40 && srnd() < 0.5) l1 = spick(L.friend);
    else if (m <= -40 && srnd() < 0.5) l1 = spick(L.rival);
    else { const ex = extraLines(a); l1 = ex.length && srnd() < 0.4 ? spick(ex) : POOL[a] && srnd() < 0.55 ? spick(POOL[a]) : spick(L.open); }
    l2 = POOL[b] && srnd() < 0.3 ? spick(POOL[b]) : spick(pos ? L.pos : L.neg);
    if (srnd() < 0.35) l3 = pos ? spick(m >= 40 ? L.bump : L.pos) : spick(L.neg);
    nudge(a, b, pos ? 3 + srnd() * 6 : -(4 + srnd() * 7)); nudge(b, a, pos ? 2 + srnd() * 5 : -(3 + srnd() * 7));
  }
  talk(a, fill(l1, a, b), 5);
  setTimeoutSim(() => talk(b, fill(l2, b, a), 5, pos ? "" : ""), 2.8);
  if (l3) setTimeoutSim(() => { talk(a, fill(l3, a, b), 4.5); if (L.bump.includes(l3)) { emote(a, "clap", 2); emote(b, "clap", 2); } }, 6);
}
function startChat(a, b, special) {
  const A = chars[a], Bc = chars[b]; let sA = null, sB = null, where;
  const bh = home(b);
  const deskOk = SPOTS["front_" + b] && bh && bh.key === "chair_" + b && atSpot(Bc, bh) && !spotBusy("front_" + b, a);
  if (special || (deskOk && srnd() < 0.5)) { if (!deskOk) return false; sA = SPOTS["front_" + b]; where = DISP(b) + "'s desk"; }
  else {
    const ps = PAIRS.filter((p) => SPOTS[p[0]] && SPOTS[p[1]] && ![p[0], p[1]].some((k) => spotBusy(k, a) || spotBusy(k, b)));
    if (!ps.length) return false;
    const p = spick(ps); [sA, sB] = srnd() < 0.5 ? [SPOTS[p[0]], SPOTS[p[1]]] : [SPOTS[p[1]], SPOTS[p[0]]]; where = p[2];
  }
  const conv = { a, b, sB, done: false };
  setTask(a, [{ spot: sA, dur: 16, onArrive: () => convArrive(conv, special) }], `chats with ${DISP(b)} at ${where}`);
  if (sB) setTask(b, [{ spot: sB, dur: 13 }], `chats with ${DISP(a)} at ${where}`);
  routeTo(A, sA); if (sB) routeTo(Bc, sB);
  return true;
}
function convArrive(conv, special) {
  const A = chars[conv.a], Bc = chars[conv.b];
  const check = (n) => {
    if (conv.done || A.hidden) return;
    const here = !Bc.hidden && !Bc.moving && !Bc.path.length && (conv.sB ? (atSpot(Bc, conv.sB) || dist(A, Bc) <= 2) : dist(A, Bc) <= 2);
    if (here) { conv.done = true; runLines(conv.a, conv.b, special); }
    else if (n < 16) setTimeoutSim(() => check(n + 1), 0.5);
    else { conv.done = true; talk(conv.a, `Guess ${DISP(conv.b)} is busy`, 4); nudge(conv.a, conv.b, -1); }
  };
  check(0);
}
function socialTick() {
  const pool = SOCIAL_IDS().filter((id) => idle(id) && (!trading(id) || srnd() < 0.12));
  if (!pool.length) return;
  if (srnd() < 0.18 || pool.length < 2) {         // a one-liner to nobody in particular
    const id = spick(pool), ex = extraLines(id), lp = ex.length && srnd() < 0.5 ? ex : POOL[id];
    if (lp && activeBubbles() < 2) talk(id, fill(spick(lp), id, spick(pool.filter((x) => x !== id)) || null), 4.6);
    return;
  }
  const a = spick(pool);
  const others = SOCIAL_IDS().filter((id) => id !== a && idle(id) && id !== "courier");
  if (!others.length) return;
  // weighted: strong feelings (either way) attract interactions
  let tot = 0; const w = others.map((b) => { const x = 1 + Math.abs(mutual(a, b)) / 25; tot += x; return x; });
  let r = srnd() * tot, b = others[0];
  for (let i = 0; i < others.length; i++) { r -= w[i]; if (r <= 0) { b = others[i]; break; } }
  startChat(a, b);
}

// ---------------------------------------------------------------- live hooks (read-only use of the polled state.json)
const _onTrade = onTrade;
onTrade = function (t) {
  _onTrade(t);
  const id = t.bot; if (!id || !chars[id] || id === "indy") return;
  const x = { sym: t.symbol };
  if (vis("zip") && id !== "zip" && srnd() < 0.7) {
    const pool = t.side === "BUY" ? L.kevinBuy : (t.pnl || 0) >= 0 ? L.kevinWin : L.kevinLoss;
    setTimeoutSim(() => talk("zip", fill(spick(pool), "zip", id, x), 5, "", "event"), 3.6);
  }
  if (t.side === "SELL") {
    const win = (t.pnl || 0) >= 0;
    setTimeoutSim(() => talk(id, spick(win ? L.winBrag : L.lossGroan), 4.5, win ? "up" : "dn", "event"), 4.2);
    if (!win) chars[id].slumpUntil = T + 5;
    gather(id, win);
    for (const o of SOCIAL_IDS()) if (o !== id && vis(o) && mutual(o, id) >= 40) nudge(o, id, win ? 1 : 0.5);
  }
};
function gather(id, win) {     // a couple of idle colleagues crowd around the trader's desk for a moment
  const c = chars[id], h = home(id);
  if (!vis(id) || !h || h.key !== "chair_" + id || !SPOTS["front_" + id]) return;
  const crowd = SOCIAL_IDS().filter((o) => o !== id && idle(o) && !trading(o)).sort(() => srnd() - 0.5).slice(0, srnd() < 0.5 ? 1 : 2);
  for (const o of crowd) {
    const base = SPOTS["front_" + id], sp = spotBusy(base.key, o) ? riNearSpot(base, o) : base;
    if (!sp) continue;
    const friend = mutual(o, id) >= 40, rival = mutual(o, id) <= -40;
    const line = win ? (rival ? null : spick(friend ? L.bump : L.congrats)) : (rival ? spick(L.smirk) : spick(L.gather));
    setTask(o, [{ spot: sp, dur: 6, onArrive: () => { faceEach(o, id); if (line) talk(o, fill(line, o, id), 4.5); if (win && friend) { emote(o, "clap", 2); emote(id, "clap", 2); } } }], "crowds around " + DISP(id) + "'s trade");
    routeTo(chars[o], sp);
  }
}
const _onEvent = onEvent;
onEvent = function (e) {
  _onEvent(e);
  if (e.type === "sit_out") {
    const tr = TRADERS.filter((b) => vis(b) && b !== "zip" && !(typeof LAID_OFF !== "undefined" && LAID_OFF.has(b)));
    if (tr.length) setTimeoutSim(() => talk(spick(tr), spick(L.sitOut), 4.6, "dn", "event"), 2.5);
    if (vis("zip")) setTimeoutSim(() => talk("zip", spick(L.kevinSit), 5, "", "event"), 5.5);
  } else if (e.type === "bench" && e.bot !== "zip" && vis("zip") && srnd() < 0.5) setTimeoutSim(() => talk("zip", spick(L.kevinBench), 4.6, "", "event"), 5);
};
let lastDeskPnl = null;
const _processState = processState;
processState = function (prev) {
  if (S) for (const e of S.events || []) if (e.msg) e.msg = e.msg.replace(/\bZip\b/g, "Meet Kevin");   // display only (local copy)
  _processState(prev);
  if (!S || !S.accounts || STRESS) return;
  const cur = { day: (S.accounts.day || {}).pnl_today || 0, swing: (S.accounts.swing || {}).pnl_today || 0 };
  if (lastDeskPnl && mktStatus() === "open") for (const d of ["day", "swing"]) {
    const dv = cur[d] - lastDeskPnl[d];
    if (Math.abs(dv) < 8) continue;
    for (const b of TRADERS) if (DESK_OF[b] === d && vis(b) && atSpot(chars[b], SPOTS["chair_" + b])) {
      if (dv > 0) { emote(b, "cheer", 2.5); chars[b].jumpUntil = T + 1.2; } else { chars[b].slumpUntil = T + 5; emote(b, "sweat", 3); }
    }
  }
  lastDeskPnl = cur;
};
const _riReply = riReply;
riReply = function (to, v) { return to === "nancy" ? riText(spick(L.nancyRiReply)) : _riReply(to, v); };
const _riArrive = riArrive;
riArrive = function (c, v, dur) {
  _riArrive(c, v, dur);
  if (v && v.to && vis(v.to) && !RI[v.to] && srnd() < 0.35) setTimeoutSim(() => { if (vis(c.id) && vis(v.to)) runLines(c.id, v.to); }, Math.max(4, dur - 6));
};

// ---------------------------------------------------------------- lifelike routines
const benched = (id) => TRADERS.includes(id) && bot(id) && BENCHED.has(bot(id).status);
function lifeErrand(c) {
  const id = c.id;
  const r = srnd(), quick = (spot, dur, line, label, extra) => { if (!spot) return false; setTask(id, [Object.assign({ spot, dur, say: riText(line, 46) }, extra || {})], label); amb(id, label); return true; };
  if (id === "goldie" && r < 0.5) { c.nextErrand = T + errandGap(id); if (activeBubbles() < 2) talk(id, spick(L.goldieDesk), 4.2); return true; }
  if (id === "grok" && r < 0.35) { setTask(id, [{ spot: SPOTS.pace_a, dur: 4, say: riText(spick(L.pace), 46) }, { spot: SPOTS.pace_b, dur: 4 }, { spot: SPOTS.pace_a, dur: 3 }], "paces the office"); return true; }
  if (trading(id) && r > 0.06) return false;     // active traders mostly stay put; rare quick restroom break
  if (r < 0.08) {                                 // restroom break: out the door for ~a minute, then back
    c.awayUntil = T + 40 + srnd() * 40; c.awayWhy = "takes a restroom break";
    setTask(id, [{ spot: SPOTS.door, dur: 0, leave: true, say: riText(spick(L.restroom), 46) }], "restroom break"); return true;
  }
  if (r < 0.18) { const k = freeSpot(["cooler", "soc_cool"], id); if (k) return quick(SPOTS[k], 8, spick(L.cooler), "at the water cooler"); }
  if (r < 0.27) { const k = freeSpot(["chat_1", "chat_2", "chat_3", "chat_4", "chat_5", "chat_6"], id); if (k) { c.phoneUntil = T + 15; return quick(SPOTS[k], 14, spick(L.phone), "takes a phone call"); } }
  if (r < 0.34) { const k = freeSpot(["chat_1", "chat_2", "chat_3", "chat_6", "center"], id); if (k) return quick(SPOTS[k], 6, spick(L.stretch), "stretches", { onArrive: () => { chars[id].jumpUntil = T + 0.8; } }); }
  return false;
}
const _startErrand = startErrand;
startErrand = function (c) { if (c.id === "courier") return; if (!lifeErrand(c)) _startErrand(c); };

// ---- team lunch: ~noon ET a courier brings the day's food (date seed: pizza / tacos / sushi / burgers) to the break room,
//      EVERYONE (active traders included) eats together with extra banter, then back to the desks. Purely cosmetic.
const FOODS = ["pizza", "tacos", "sushi", "burgers"];
const FOOD_NAME = { pizza: "PIZZA", tacos: "TACOS", sushi: "SUSHI", burgers: "BURGERS" };
const foodOf = (day) => FOODS[Math.floor(fnv(day + ":lunch") * FOODS.length)];
// break-room seats around the table first (inner ones first), then standing spots, then overflow by the door / espresso bar.
// (4,4), (5,4..7), (4,6), (4,7) are never seats: they are the walkway, so nobody gets boxed in.
S_("lunch_a", 1, 4, "E"); S_("lunch_b", 1, 5, "E"); S_("lunch_c", 1, 6, "E"); S_("lunch_d", 2, 7, "N"); S_("lunch_e", 3, 7, "N");
S_("lunch_g", 7, 4, "W"); S_("lunch_h", 7, 6, "W");
const LUNCH_SPOTS = ["lunch_a", "break_0", "break_1", "lunch_b", "lunch_c", "break_2", "break_3", "break_6", "lunch_d", "lunch_e", "break_4",
  "lunch_g", "lunch_h", "coffee_1", "coffee_2", "coffee_3"];
let lunch = null, lunchDay = null, stressT0 = null, stressLunch = false;
const lunchers = () => SOCIAL_IDS().filter((id) => chars[id].lunch);
function lunchCheck() {
  if (lunch) return;
  if (STRESS) {
    if (stressT0 == null) { stressT0 = T; stressLunch = false; }
    if (!stressLunch && T - stressT0 > 20) { stressLunch = true; startLunch(spick(FOODS)); }
    return;
  }
  stressT0 = null;
  const day = dayKey(), h = etNow().h;
  if (lunchDay === day) return;
  const start = 11.9 + fnv(day + ":lt") * 0.15;                    // ~11:54-12:03 ET
  if (h < start || h > 12.9) return;
  if (SOCIAL_IDS().filter((id) => vis(id)).length < 3) return;   // nobody around (weekend/holiday)
  lunchDay = day; startLunch(foodOf(day));
}
function startLunch(food) {
  lunch = { food, phase: "delivery", t0: T, served: 0 };
  amb("courier", `team lunch ordered: ${food} (animation only - the engine keeps trading)`);
  logLine("goldie", riText(spick(L.lunchOrder).replace("{FOOD}", FOOD_NAME[food]), 46), "event");
}
function serveLunch() {
  if (!lunch || lunch.phase !== "delivery") return;
  lunch.phase = "eating"; lunch.served = T;
  const len = STRESS ? 110 : 240 + srnd() * 60;
  lunch.until = T + len;
  const caller = vis("goldie") ? "goldie" : vis("grok") ? "grok" : null;
  if (caller) talk(caller, spick(L.lunchCall).replace("{FOOD}", FOOD_NAME[lunch.food]), 4.5);
  relEvent(`Team lunch: ${lunch.food} in the break room`, "goldie", "grok");
  if (chars.nancy.hidden) chars.nancy.wantUp = "lunch";     // she comes up the Research Inc. stairs and joins
  // nearest first (they take the inner seats), after the courier is out of the doorway
  const dr = SPOTS.break_5, who = SOCIAL_IDS().filter((id) => vis(id)).sort((a, b) => dist(chars[a], { tx: dr.x, ty: dr.y }) - dist(chars[b], { tx: dr.x, ty: dr.y }));
  who.forEach((id, i) => setTimeoutSim(() => joinLunch(id), 4.5 + i * 1.1));
}
function joinLunch(id) {
  const c = chars[id];
  if (!lunch || lunch.phase !== "eating" || !vis(id) || c.lunch || (c.task && c.task.label === "leave")) return;
  c.task = null; c.goal = null; if (!c.moving) c.path = [];
  c.lunch = { spot: null, t0: T, until: lunch.until + (srnd() - 0.5) * 30, lastTile: c.tx + "," + c.ty, lastMove: T, tries: 0 };
  pickLunchSpot(c);
  if (!c.lunch.spot) { c.lunch = null; return; }
  amb(id, "heads to the break room for team lunch");
}
function claimed(key, self) { return SOCIAL_IDS().some((o) => o !== self && chars[o].lunch && chars[o].lunch.spot && chars[o].lunch.spot.key === key); }
function pickLunchSpot(c) {
  const L_ = c.lunch, h = _home(c.id);
  if (benched(c.id) && h && LUNCH_SPOTS.includes(h.key) && !L_.tries) { L_.spot = h; return; }     // benched: already in the break room
  const dyn = L_.tries ? dynBlockers(c) : null;
  for (const k of LUNCH_SPOTS) {
    if (claimed(k, c.id) || spotBusy(k, c.id) || (L_.spot && L_.spot.key === k)) continue;
    L_.pickedAt = T;
    if (dyn && !astar(c.tx, c.ty, SPOTS[k].x, SPOTS[k].y, dyn)) continue;           // reachable right now?
    L_.spot = SPOTS[k]; return;
  }
  if (L_.tries > 6) L_.spot = null;     // nothing reachable for a long while: skip lunch (else keep the seat and keep trying)
}
function endLunch(c) {
  if (!c.lunch) return;
  c.lunch = null; c.homeKey = null; c.goal = null; c.eatUntil = 0; c.nextErrand = T + errandGap(c.id) * (0.5 + srnd());
}
function lunchDirector(c) {
  const L_ = c.lunch;
  if (!lunch || T > L_.until || c.hidden) {
    const wasEating = !!L_.arrived; endLunch(c);
    if (wasEating && !c.hidden && srnd() < 0.3 && activeBubbles() < 2) talk(c.id, spick(L.lunchDone), 4);
    return false;
  }
  if (c.task) { runTask(c); return true; }       // e.g. a ceremony call wins; lunch resumes after
  const sp = L_.spot;
  const tile = c.tx + "," + c.ty;
  if (tile !== L_.lastTile) { L_.lastTile = tile; L_.lastMove = T; }
  if (sp && atSpot(c, sp)) {
    c.face = sp.face; c.pose = sp.pose || "stand"; c.homeKey = sp.key;
    if (!L_.arrived) { L_.arrived = T; c.eatUntil = L_.until; }
    return true;
  }
  if (L_.arrived && sp && !atSpot(c, sp)) L_.arrived = 0;
  if (sp && (!c.goal || c.goal.key !== sp.key) && !c.moving) { if (!routeTo(c, sp)) { L_.tries++; pickLunchSpot(c); } }
  if (!c.moving && (T - L_.lastMove > 5 || T - (L_.pickedAt || L_.t0) > 14)) { L_.tries++; L_.lastMove = T; L_.pickedAt = T; pickLunchSpot(c); if (L_.spot) routeTo(c, L_.spot); }   // boxed in: re-pick
  if (!L_.spot || (T - L_.t0 > 100 && !L_.arrived)) { endLunch(c); return false; }   // give up: back to normal
  return true;
}
function lunchTick() {
  if (!lunch) return;
  if (lunch.phase === "delivery" && T - lunch.t0 > 75) serveLunch();          // courier never got in: food "arrives" anyway
  if (lunch.phase === "eating") {
    if (T > lunch.until + 40 && !lunchers().length) { lunch = null; socPanelDirty = true; return; }
    const eaters = lunchers().filter((id) => chars[id].lunch.arrived && vis(id));
    if (eaters.length >= 2 && activeBubbles() < 2 && srnd() < 0.7) {
      const a = spick(eaters), near = eaters.filter((b) => b !== a && dist(chars[a], chars[b]) <= 3);
      if (a === "zip" && near.includes("nancy") && srnd() < 0.3) return runLines("zip", "nancy", "kevin-nancy");
      if (near.length && srnd() < 0.65) runLines(a, spick(near), "lunch");
      else talk(a, fill(spick(L.food[lunch.food].concat(a === "zip" ? L.kevinFood : POOL[a] || [], L.lunchTalk, extraLines(a).slice(0, 6))), a, spick(eaters.filter((x) => x !== a)) || null), 4.6);
    }
  }
}
// courier: walks the order from the entrance to the break-room table, then leaves
function courierDirector(c) {
  if (c.hidden) {
    if (!lunch || lunch.phase !== "delivery" || !S) return;
    const d = SPOTS.door; if (occ.has(I(d.x, d.y))) return;
    c.hidden = false; place(c, d.x, d.y); c.task = null; c.goal = null; c.pose = "stand"; c.bubble = null; c.courierSince = T;
    const base = SPOTS.break_5, sp = spotBusy(base.key, "courier") ? riNearSpot(base, "courier") : base;
    const steps = [];
    if (sp) steps.push({ spot: sp, dur: 3, onArrive: () => { chars.courier.face = "W"; say("courier", riText(spick(L.courier).replace("{FOOD}", FOOD_NAME[lunch.food]), 46), 3.5); setTimeoutSim(serveLunch, 1.2); } });
    steps.push({ spot: SPOTS.door, dur: 0, leave: true });
    setTask("courier", steps, "lunch delivery");
    amb("courier", `delivery guy brings ${lunch.food} to the break room`);
    return;
  }
  if (!c.task) setTask("courier", [{ spot: SPOTS.door, dur: 0, leave: true }], "heads out");
  if (T - c.courierSince > 85) { for (const [k, v] of occ) if (v === "courier") occ.delete(k); c.hidden = true; c.task = null; c.goal = null; c.bubble = null; serveLunch(); return; }
  runTask(c);
}
const _director = director;
director = function (c) {
  if (c.id === "courier") return courierDirector(c);
  if (c.hidden && c.awayUntil > T) return;          // on a restroom break
  if (c.lunch && lunchDirector(c)) return;
  if (c.id === "nancy") return nancyVisit(c);
  _director(c);
};
// ---- Nancy: lives on B1; up the Research Inc. stairs only for team lunch or her daily El Jefe meeting.
//      Meeting time = same date seed as b1_nancy.js (10:00-15:15 ET, never over lunch).
const RI_STAIR_KEYS = ["ri_stairs", "ri_stairs_2", "ri_stairs_3"];
function nancyMeetH(day) { let mt = 10 + fnv(day + ":nj") * 5.25; if (Math.abs(mt - 12.05) < 0.5) mt += 1.2; return mt; }
let nancyStressNext = 60;
function nancyVisit(c) {
  if (c.hidden) {
    let why = null;
    if (c.wantUp === "lunch") { if (lunch && lunch.phase === "eating") why = "lunch"; else c.wantUp = null; }
    else if (STRESS) { if (T > nancyStressNext && vis("grok")) { nancyStressNext = T + 100; why = "jefe"; } }
    else if (mktStatus() === "open" && vis("grok")) {
      const day = dayKey(), h = etNow().h, mt = nancyMeetH(day);
      if (h >= mt && h < mt + 0.05 && c.metDay !== day) { c.metDay = day; why = "jefe"; }
    }
    if (!why) return;
    const k = RI_STAIR_KEYS.find((x) => !occ.has(I(SPOTS[x].x, SPOTS[x].y)));
    if (!k) return;
    c.wantUp = null; c.hidden = false; place(c, SPOTS[k].x, SPOTS[k].y); c.task = null; c.goal = null; c.pose = "stand"; c.face = "N"; c.bubble = null; c.since = T;
    if (why === "lunch") { amb("nancy", "comes up from her B1 office for team lunch"); joinLunch("nancy"); return; }
    const base = SPOTS.front_grok, sp = spotBusy(base.key, "nancy") ? riNearSpot(base, "nancy") : base;
    amb("nancy", "comes up from her B1 office to meet El Jefe");
    setTask("nancy", [sp ? { spot: sp, dur: 22, onArrive: () => nancyMeet() } : null, { spot: SPOTS[k], dur: 0, leave: true }].filter(Boolean), "meets El Jefe");
    return;
  }
  if (!c.task && !c.lunch) {
    const k = RI_STAIR_KEYS.find((x) => !spotBusy(x, "nancy")) || "ri_stairs";
    setTask("nancy", [{ spot: SPOTS[k], dur: 0, leave: true }], "back to B1");
  }
  if (c.task) runTask(c);
  if (!c.hidden && T - c.since > 150 && !c.lunch) { for (const [k, v] of occ) if (v === "nancy") occ.delete(k); c.hidden = true; c.task = null; c.goal = null; c.bubble = null; }   // never seen; safety
}
function nancyMeet() {
  if (!vis("grok")) return;
  faceEach("nancy", "grok");
  talk("nancy", spick(["Jefe, dear. Quick word.", "Research says hi, Jefe.", "Lovely tape today, Jefe.", "Just a hunch for you, Jefe."]), 4.6);
  setTimeoutSim(() => talk("grok", spick(["Weekly rule stands, jefa.", "Risk first, Nancy. Always.", "Gracias. No hail marys.", "Below Monday? Half size."]), 4.6), 3);
  setTimeoutSim(() => talk("nancy", spick(L.nancy), 4.6), 7);
  nudge("nancy", "grok", 3); nudge("grok", "nancy", 3);
}
const _amb = amb;
amb = function (id, msg) {
  const c = chars[id];
  if (msg === "heads home" && c && c.awayUntil > T) msg = c.awayWhy || "steps out for a minute";
  if (msg === "heads home" && id === "courier") msg = "heads out (delivery done)";
  if (msg === "heads home" && id === "nancy") msg = "heads back down to her B1 office";
  _amb(id, msg);
};
const _home = home;
home = function (id) { if (id === "nancy") return SPOTS.ri_stairs; if (id === "courier") return SPOTS.door; return _home(id); };
function nightOwls() {
  const cands = ["dash", "vee", "zip", "snap", "trek", "dip", "rota", "drift", "knobs", "indy"];
  const d = dayKey(); return new Set(cands.slice().sort((a, b) => fnv(d + a) - fnv(d + b)).slice(0, 3));
}
const _present = present;
present = function (id) {
  if (id === "courier" || id === "nancy") return false;
  if (!STRESS && mktStatus() === "after-hours" && etNow().h < 20.75 && nightOwls().has(id)) return true;   // a few night owls
  return _present(id);
};
const _whereIs = whereIs;
whereIs = function (id) {
  const c = chars[id];
  if (c && c.hidden && c.awayUntil > T) return "restroom break";
  if (id === "courier") return c.hidden ? "not here" : "delivering lunch";
  if (id === "nancy" && c.hidden) return "B1: her corner office";
  if (id === "nancy" && !c.lunch) return c.task && c.task.label === "meets El Jefe" ? "visiting El Jefe" : "heading back to B1";
  if (c && c.lunch) return c.lunch.arrived ? "team lunch (break room)" : "heading to team lunch";
  return _whereIs(id);
};
const _ambientChatter = ambientChatter;
ambientChatter = function () { if (activeBubbles() >= 2 || (lunch && lunch.phase === "eating") || srnd() < 0.4) return; _ambientChatter(); };
const _btable = DRAW.btable;
DRAW.btable = function (f, t) {
  _btable(f, t);
  if (!lunch || lunch.phase !== "eating") return;
  const px = f.x * TS, py = f.y * TS;
  drawFood(lunch.food, px + 3, py - 2, true);
};
function drawFood(food, x, y, table) {
  if (food === "pizza") {
    if (table) { R(g, x, y + 2, 12, 2, "#e8d3a8"); R(g, x, y, 12, 2, "#f2e2bf"); R(g, x + 3, y, 5, 1, "#c1121f"); }
    R(g, x + (table ? 14 : 0), y + 1, table ? 11 : 5, table ? 9 : 4, "#e8d3a8"); R(g, x + (table ? 15 : 1), y + 2, table ? 9 : 3, table ? 7 : 2, "#f4a261");
    if (table) { R(g, x + 17, y + 4, 1, 1, "#c1121f"); R(g, x + 21, y + 3, 1, 1, "#c1121f"); R(g, x + 19, y + 6, 1, 1, "#c1121f"); R(g, x + 22, y + 7, 1, 1, "#c1121f"); }
    else R(g, x + 2, y + 2, 1, 1, "#c1121f");
  } else if (food === "tacos") {
    const n = table ? 4 : 1;
    for (let i = 0; i < n; i++) { R(g, x + i * 6, y + 3, 5, 3, "#f4c430"); R(g, x + i * 6 + 1, y + 2, 3, 1, "#6a994e"); R(g, x + i * 6 + 2, y + 2, 1, 1, "#e63946"); }
    if (table) { R(g, x + 9, y + 7, 6, 2, "#c0c0c0"); R(g, x + 10, y + 7, 4, 1, "#e63946"); }
  } else if (food === "sushi") {
    if (table) { R(g, x, y + 2, 24, 7, "#111"); R(g, x + 1, y + 2, 22, 1, "#c1121f"); }
    const n = table ? 5 : 2;
    for (let i = 0; i < n; i++) { const sx = x + (table ? 2 + i * 4 : i * 3), sy = y + (table ? 4 : 2); R(g, sx, sy, 3, 3, "#f5f5f5"); R(g, sx + 1, sy, 1, 2, i % 2 ? "#f4845f" : "#2a9d8f"); }
  } else {
    const n = table ? 3 : 1;
    if (table) { R(g, x + 18, y, 6, 8, "#b08968"); R(g, x + 18, y, 6, 1, "#7f5539"); }
    for (let i = 0; i < n; i++) { const bx = x + i * 6; R(g, bx, y + 3, 5, 2, "#d4a373"); R(g, bx, y + 5, 5, 1, "#6a994e"); R(g, bx, y + 6, 5, 1, "#5c3a1e"); R(g, bx, y + 7, 5, 1, "#d4a373"); }
  }
}

// ---------------------------------------------------------------- main hook
let socAcc = 0, socNext = 8, lunchAcc = 0, owlAcc = 0;
const _step = step;
step = function (dt) {
  _step(dt);
  if (!S) return;
  socAcc += dt; lunchAcc += dt; owlAcc += dt;
  if (socAcc >= socNext) { socAcc = 0; socNext = STRESS ? 2.5 : 16 + srnd() * 18; if (!(lunch && lunch.phase === "eating")) socialTick(); }
  if (lunchAcc >= 2) { lunchAcc = 0; lunchCheck(); lunchTick(); }
  if (owlAcc >= 120 && !STRESS) {
    owlAcc = 0;
    if (mktStatus() === "after-hours" && srnd() < 0.5) { const o = [...nightOwls()].filter(vis); if (o.length && activeBubbles() < 2) talk(spick(o), spick(L.owl), 4.5); }
  }
  if (!STRESS) { socSave(false); if (socPanelDirty && T - socPanelAt > 1.5) renderSocial(); }
};
addEventListener("pagehide", () => socSave(true));

// ---------------------------------------------------------------- side panel: Office Chatter + relationships
let socPanelDirty = true, socPanelAt = -10;
function relRows() {
  const ids = SOCIAL_IDS(), fr = [], rv = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j], m = mutual(a, b);
    if (isLovers(a, b)) continue;
    if (m >= 40) fr.push([a, b, m]); else if (m <= -40) rv.push([a, b, m]);
  }
  fr.sort((x, y) => y[2] - x[2]); rv.sort((x, y) => x[2] - y[2]);
  return { fr, rv };
}
const nm = (id) => `<b style="color:${COL[id] || "#ccc"}">${esc(DISP(id))}</b>`;
function renderSocial() {
  socPanelDirty = false; socPanelAt = T;
  const el = $("chat"); if (!el) return;
  const items = SOC.lines.map((x) => Object.assign({ rel: 0 }, x)).concat(SOC.rel.map((x) => Object.assign({ rel: 1 }, x))).sort((a, b) => b.t - a.t).slice(0, 18);
  let h = items.length ? items.map((x) => x.rel
    ? `<div class="sq"><span class="t">${hhmm(new Date(x.t).toISOString())}</span><span class="m" style="color:var(--gold)">♥ ${esc(x.text)}</span></div>`
    : `<div class="sq"><span class="t">${hhmm(new Date(x.t).toISOString())}</span><span class="w" style="color:${COL[x.a] || "#ccc"}">${esc(DISP(x.a))}</span><span class="m">${esc(x.text)}</span></div>`).join("")
    : `<div class="mut">quiet office... chatter starts when people are in</div>`;
  const { fr, rv } = relRows();
  const list = (a, sep) => a.slice(0, 6).map(([x, y, m]) => `${nm(x)}${sep}${nm(y)} <span class="mut">${m > 0 ? "+" : ""}${Math.round(m)}</span>`).join(" · ") || `<span class="mut">none yet</span>`;
  const crushes = Object.entries(SOC.crush).map(([a, b]) => `${nm(a)} → ${nm(b)}`).join(" · ") || `<span class="mut">none yet</span>`;
  const couples = SOC.lovers.map((p) => p.split("|")).map(([a, b]) => `${nm(a)} ♥ ${nm(b)}`).join(" · ") || `<span class="mut">none yet</span>`;
  h += `<div class="gate"><b>FRIENDS</b> ${list(fr, " & ")}</div><div class="gate"><b>RIVALS</b> ${list(rv, " vs ")}</div>`;
  h += `<div class="gate"><b>CRUSHES</b> ${crushes} · <b>COUPLES</b> ${couples}</div>`;
  const tl = lunch && lunch.phase === "eating" ? `TEAM LUNCH NOW: ${FOOD_NAME[lunch.food]} in the break room` : `Team lunch ~noon ET today: ${FOOD_NAME[foodOf(dayKey())]}`;
  h += `<div class="gate"><b>LUNCH</b> ${esc(tl)}</div>`;
  h += `<div class="gate mut">Animation only: office life runs in your browser and never touches the trading engine. Relationships are saved on this device.</div>`;
  el.innerHTML = h;
  const c = $("c-chat"); if (c) c.textContent = `${fr.length} friends · ${rv.length} rivals`;
}
const _renderPanel = renderPanel;
renderPanel = function () {
  _renderPanel();
  const r = $("roster"); if (r) {
    const cr = r.querySelector('[data-bot="courier"]'); if (cr) cr.remove();
    const nr = r.querySelector('[data-bot="nancy"] .r'); if (nr) nr.innerHTML = "";
  }
  if (socPanelDirty || T - socPanelAt > 20) renderSocial();
};

window.__social = {
  addOutfitHook(f) { OUTFIT_HOOKS.push(f); outfitDay = null; },
  addLineHook(f) { LINE_HOOKS.push(f); },
  talk: (id, text, secs) => talk(id, text, secs),
  fill: (s, a, b) => fill(s, a, b),
  activeBubbles: () => activeBubbles(),
  LINE_COUNT, soc: () => SOC, outfitOf, mutual, labelOf, lunch: () => lunch, foodOf, startLunch: (f) => startLunch(f || foodOf(dayKey())),
  chatNow(a, b) { return startChat(a, b); },
  talkNow(a, b) { runLines(a, b); },
  stats() { return { lines: LINE_COUNT, pairs: Object.keys(SOC.op).length, friends: relRows().fr.length, rivals: relRows().rv.length }; },
};
})();
