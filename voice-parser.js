/* Local, deterministic hotel extraction. No service or network lookup. */
(function (root) {
  'use strict';
  const clean = value => String(value || '').replace(/\s+/g, ' ').replace(/^[\s,;:.!?–—-]+|[\s,;:.!?–—-]+$/g, '').trim();
  const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const title = value => value === value.toLowerCase() ? value.replace(/\b\p{L}/gu, c => c.toUpperCase()) : value;
  const words = {zero:0,oh:0,one:1,two:2,three:3,four:4,for:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  const unit = '(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|for|five|six|seven|eight|nine|ten)';
  const decimal = '(?:\\d+|zero|oh|one|two|three|four|for|five|six|seven|eight|nine|twenty[ -]five|fifty|seventy[ -]five)';
  const number = `${unit}(?:\\s+(?:point|dot)\\s+${decimal}(?:\\s+${decimal})*|\\s+and\\s+(?:a\\s+half|a\\s+quarter|three\\s+quarters))?`;

  function numeric(value) {
    let s = value.toLowerCase().trim();
    s = s.replace(/twenty[ -]five/g, '25').replace(/seventy[ -]five/g, '75').replace(/fifty/g, '50');
    const fraction = s.match(/\s+and\s+(a half|a quarter|three quarters)$/);
    if (fraction) s = s.slice(0, fraction.index);
    const parts = s.split(/\s+(?:point|dot)\s+/);
    const whole = Object.hasOwn(words, parts[0]) ? words[parts[0]] : Number(parts[0]);
    const tail = parts[1]?.split(/\s+/).map(w => Object.hasOwn(words, w) ? words[w] : w).join('');
    return (tail ? Number(`${whole}.${tail}`) : whole) + (fraction ? {'a half':.5,'a quarter':.25,'three quarters':.75}[fraction[1]] : 0);
  }

  const countryAliases = new Map();
  const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  try {
    const names = new Intl.DisplayNames(['en'], {type:'region'});
    for (const code of codes) { const name = names.of(code); countryAliases.set(key(name), name); }
  } catch (_) { /* Explicit country labels still work on older browsers. */ }
  for (const [name, aliases] of Object.entries({
    'United States':['USA','U.S.A.','US','U.S.','United States of America','America'],
    'United Kingdom':['UK','U.K.','Great Britain','Britain','England','Scotland','Wales'],
    'United Arab Emirates':['UAE','U.A.E.'], 'South Korea':['Korea'],
    'Czechia':['Czech Republic'], 'Türkiye':['Turkey']
  })) for (const alias of [name,...aliases]) countryAliases.set(key(alias), name);
  const canonicalCountry = value => countryAliases.get(key(value)) || title(clean(value));

  // Common destinations; existing journal entries extend these on the device.
  const cityGroups = {
    'United States':'New York|New York City|Cleveland|Strongsville|Parma|Cleveland Heights|Chicago|San Francisco|Los Angeles|San Diego|Seattle|Portland|Boston|Miami|Washington|Washington DC|Philadelphia|Atlanta|Dallas|Houston|Austin|Denver|Las Vegas|Phoenix|Scottsdale|Nashville|New Orleans|Orlando|Tampa|Honolulu|Napa|Sonoma|St Louis|Saint Louis',
    'United Kingdom':'London|Edinburgh|Manchester|Glasgow|Bath|Oxford|Cambridge',
    'France':'Paris|Nice|Lyon|Bordeaux|Cannes|Marseille',
    'Japan':'Tokyo|Kyoto|Osaka|Hakone|Nara|Sapporo|Fukuoka',
    'Thailand':'Bangkok|Chiang Mai|Chiang Rai|Phuket|Krabi|Koh Samui',
    'Italy':'Rome|Florence|Venice|Milan|Naples|Bologna|Sorrento',
    'Spain':'Madrid|Barcelona|Seville|Valencia|Malaga',
    'Germany':'Berlin|Munich|Frankfurt|Hamburg',
    'Canada':'Toronto|Vancouver|Montreal|Quebec City|Ottawa|Calgary|Victoria',
    'Australia':'Sydney|Melbourne|Brisbane|Perth|Adelaide',
    'China':'Beijing|Shanghai|Chengdu|Guangzhou',
    'India':'Mumbai|New Delhi|Delhi|Jaipur|Agra|Bengaluru|Bangalore',
    'Portugal':'Lisbon|Porto', 'Switzerland':'Zurich|Geneva|Lucerne|Zermatt',
    'Mexico':'Mexico City|Cancun|Tulum|Oaxaca|Puerto Vallarta',
    'Indonesia':'Jakarta|Ubud', 'Vietnam':'Hanoi|Ho Chi Minh City|Da Nang|Hoi An',
    'United Arab Emirates':'Dubai|Abu Dhabi', 'Singapore':'Singapore',
    'South Korea':'Seoul|Busan', 'Taiwan':'Taipei', 'Hong Kong':'Hong Kong',
    'Netherlands':'Amsterdam|Rotterdam', 'Belgium':'Brussels|Bruges',
    'Austria':'Vienna|Salzburg', 'Greece':'Athens', 'Türkiye':'Istanbul',
    'Czechia':'Prague', 'Hungary':'Budapest', 'Denmark':'Copenhagen',
    'Sweden':'Stockholm', 'Norway':'Oslo|Bergen', 'Finland':'Helsinki',
    'Iceland':'Reykjavik', 'Ireland':'Dublin|Cork|Galway', 'New Zealand':'Auckland|Queenstown',
    'South Africa':'Cape Town|Johannesburg', 'Egypt':'Cairo', 'Morocco':'Marrakesh|Marrakech',
    'Peru':'Lima|Cusco', 'Argentina':'Buenos Aires', 'Brazil':'Rio de Janeiro|Sao Paulo'
  };
  const cityAliases = {nyc:'New York', 'new york city':'New York', 'st louis':'St. Louis', 'saint louis':'St. Louis', 'washington dc':'Washington, DC'};
  function cities(hotels) {
    const map = new Map();
    for (const [country,list] of Object.entries(cityGroups)) for (const city of list.split('|')) map.set(key(city), {city:cityAliases[key(city)] || city,country});
    map.set('nyc', {city:'New York',country:'United States'});
    for (const h of hotels) if (h.city) {
      const k = key(h.city), country = canonicalCountry(h.country || '');
      const prior = map.get(k);
      map.set(k, {city:h.city, country:prior && prior.country && country && key(prior.country)!==key(country) ? '' : country || prior?.country || ''});
    }
    return map;
  }
  function aliasPattern(alias) { return alias.split(' ').map(escape).join('[\\s.]+'); }
  function findTail(text, map) {
    for (const [alias, value] of [...map].sort((a,b)=>b[0].length-a[0].length)) {
      const match = text.match(new RegExp(`(?:^|[\\s,;])(${aliasPattern(alias)})[.,;\\s]*$`, 'i'));
      if (match) return {value,start:match.index + match[0].indexOf(match[1]),text:match[1]};
    }
    return null;
  }

  function parse(transcript, hotels=[]) {
    const fields = {}, issues = [], cityMap = cities(hotels);
    let text = String(transcript || '').replace(/[“”]/g,'"').replace(/[’]/g,"'").replace(/\r/g,'').trim();
    if (!text) return {fields,issues:['Say or type one hotel entry first.']};

    // Rating is the only place where number words/homophones are normalized.
    const patterns = [
      new RegExp(`\\b(?:my\\s+rating|rating|rated|rate(?:\\s+it)?|score(?:\\s+it)?|I\\s+(?:give|gave)(?:\\s+it)?)\\s*(?:(?:is|of|it|at)\\s+|[:=]\\s*)?(${number})(?:\\s*(?:out\\s+of|over|/)\\s*(?:five|5))?(?:\\s+stars?)?\\b`, 'ig'),
      new RegExp(`\\b(${number})\\s*(?:out\\s+of|over|/)\\s*(five|5|ten|10)\\b`, 'ig'),
      new RegExp(`\\b(${number})\\s+stars?(?![ -]+(?:hotel|property|resort|service|rooms?|experience))\\b`, 'ig'),
      new RegExp(`(?:^|(?<=[,;]))\\s*(${number})(?=\\s*(?:[,;.!?]|$))`, 'ig')
    ];
    let ratingFound = false;
    for (const pattern of patterns) text = text.replace(pattern, (whole, value, denominator) => {
      const n = numeric(value);
      const scale = typeof denominator === 'string' && /^(ten|10)$/.test(denominator) ? 10 : 5;
      if (scale !== 5 || !Number.isFinite(n) || n < 0 || n > 5) {
        issues.push('Rating must be between 0 and 5; enter it manually.');
        return whole;
      }
      if (ratingFound) issues.push('Multiple ratings heard; review the last rating.');
      fields.rating = Math.round(n * 100) / 100; ratingFound = true;
      return '';
    });

    // Labels work with punctuation or spoken "is", and can appear in any order.
    const labelRE = /\b(hotel\s+name|name|city|country|notes?)\s*(?::|=|\bis\b)\s*|\b(hotel\s+name|city|country|notes?)\s+(?=\S)/ig;
    const structured=/^\s*(?:hotel\s+name|city|country)\b/i.test(text);
    const labels=[];
    let inNotes=false;
    for (const match of text.matchAll(labelRE)) {
      const prefix=text.slice(0,match.index).trimEnd();
      if (!match[1] && (inNotes || (!structured && prefix && !/[.,;:!?]$/.test(prefix)))) continue;
      labels.push(match);
      inNotes=/^note/i.test(match[1]||match[2]);
    }
    let unlabeled = text;
    if (labels.length) {
      unlabeled = text.slice(0,labels[0].index);
      for (let i=0;i<labels.length;i++) {
        const m=labels[i], label=(m[1]||m[2]).toLowerCase();
        const value=clean(text.slice(m.index+m[0].length, labels[i+1]?.index ?? text.length));
        if (!value) continue;
        const field = /name/.test(label) ? 'name' : /^note/.test(label) ? 'notes' : label;
        fields[field]=value;
      }
    }
    // Split prose at sentence boundaries, never within a decimal or common initials.
    const sentences = unlabeled.replace(/\b(U\.S\.A\.|U\.S\.|U\.K\.|U\.A\.E\.)/gi, s=>s.replace(/\./g,''))
      .replace(/\b(St|Mt|Dr)\.\s/gi,'$1 ').split(/(?:[.!?]\s+|\n+)/).map(clean).filter(Boolean);
    let header = sentences.shift() || '';
    header = header.replace(/^(?:(?:I|we)\s+)?(?:stayed|staying)\s+(?:at|in)\s+/i,'').replace(/^(?:add|log)\s+(?:a\s+hotel\s+)?/i,'');
    header = header.replace(/^hotel\s*:\s*/i,'');

    // A trailing country gives a reliable location boundary without a web request.
    const countryTail = findTail(header,countryAliases);
    if (countryTail && countryTail.start>0) {
      fields.country ||= countryTail.value;
      header=clean(header.slice(0,countryTail.start));
    }
    const inMatch = header.match(/\s+(?:located\s+in|in)\s+(.+)$/i);
    if (inMatch) {
      fields.name ||= clean(header.slice(0,inMatch.index));
      const parts=inMatch[1].split(/[,;]/).map(clean).filter(Boolean);
      let place=parts.shift() || '';
      const country=findTail(place,countryAliases);
      if(country && country.start>0) {fields.country ||= country.value;place=clean(place.slice(0,country.start));}
      fields.city ||= place;
      if(parts.length && countryAliases.has(key(parts[0]))) fields.country ||= countryAliases.get(key(parts.shift()));
      if(parts.length) sentences.unshift(parts.join(', '));
    } else {
      const parts=header.split(/[,;]/).map(clean).filter(Boolean);
      const cityTail=findTail(header,cityMap);
      if (parts.length>=2) {
        fields.name ||= parts.shift();
        fields.city ||= parts.shift();
        if(parts.length && countryAliases.has(key(parts[0]))) fields.country ||= countryAliases.get(key(parts.shift()));
        if (parts.length) sentences.unshift(parts.join(', '));
      } else if (cityTail) {
        fields.city ||= cityTail.value.city;
        fields.country ||= cityTail.value.country;
        // City suffixes often belong to the official hotel name (e.g. Aman Tokyo).
        fields.name ||= header;
      } else if (header) fields.name ||= header;
    }
    if (fields.name) fields.name=clean(fields.name);
    if (fields.city) {
      const known = cityMap.get(key(fields.city));
      fields.city=known?.city || title(fields.city);
      if (!fields.country && known?.country) fields.country=known.country;
    }
    if (fields.country) fields.country=canonicalCountry(fields.country);
    // Existing exact hotel names can supply missing locations, only if unambiguous.
    const matches=hotels.filter(h=>key(h.name)===key(fields.name) && (!fields.city||key(h.city)===key(fields.city)));
    if (matches.length && new Set(matches.map(h=>key(h.city)+'|'+key(h.country))).size===1) {
      fields.city ||= matches[0].city;
      fields.country ||= matches[0].country;
      fields.name=matches[0].name;
    }
    const remaining=sentences.join('. ');
    if (remaining) fields.notes = clean([remaining,fields.notes].filter(Boolean).join('. '));
    if (fields.notes) fields.notes=clean(fields.notes);
    for (const field of ['name','city','country']) if (!fields[field]) issues.push(`Check ${field==='name'?'hotel name':field}; it was not identified.`);
    return {fields,issues:[...new Set(issues)]};
  }
  const api = {parse,numeric};
  if (typeof module==='object' && module.exports) module.exports=api;
  else root.HotelVoiceParser=api;
})(typeof globalThis==='object'?globalThis:this);
