const assert=require('node:assert/strict');
const {parse,numeric}=require('../voice-parser.js');
const cases=[
  ['Aman Tokyo in Tokyo, Japan. Rating four point seven five out of five. Notes: quiet rooms and excellent breakfast.',{name:'Aman Tokyo',city:'Tokyo',country:'Japan',rating:4.75,notes:'quiet rooms and excellent breakfast'}],
  ['Park Hyatt, Tokyo, Japan, 4.75 out of 5. Great breakfast.',{name:'Park Hyatt',city:'Tokyo',country:'Japan',rating:4.75,notes:'Great breakfast'}],
  ['Hotel name Park Hyatt city Kyoto country Japan notes Great city views rating four and a half.',{name:'Park Hyatt',city:'Kyoto',country:'Japan',rating:4.5,notes:'Great city views'}],
  ['Four Seasons in New York City, USA. Rating for point seven five. Notes: beautiful city views.',{name:'Four Seasons',city:'New York',country:'United States',rating:4.75,notes:'beautiful city views'}],
  ['Hilton in London. Five-star hotel with city views.',{name:'Hilton',city:'London',country:'United Kingdom',notes:'Five-star hotel with city views'}],
  ['Park Hyatt, Tokyo, Japan, 4.75, quiet rooms.',{name:'Park Hyatt',city:'Tokyo',country:'Japan',rating:4.75,notes:'quiet rooms'}],
  ['Aman Tokyo in Tokyo, Japan, rated four point seven five, quiet rooms.',{name:'Aman Tokyo',city:'Tokyo',country:'Japan',rating:4.75,notes:'quiet rooms'}],
  ['Park Hyatt in Tokyo Japan, great breakfast. Rating four point five.',{name:'Park Hyatt',city:'Tokyo',country:'Japan',rating:4.5,notes:'great breakfast'}],
  ['We stayed at Hotel Aurora in Bergen, Norway. Nice breakfast. I give it four and a quarter out of five.',{name:'Hotel Aurora',city:'Bergen',country:'Norway',rating:4.25,notes:'Nice breakfast'}],
  ['Country: Japan. City: Kyoto. Hotel name: The Mitsui. Notes: peaceful gardens. Rated 4.8.',{name:'The Mitsui',city:'Kyoto',country:'Japan',rating:4.8,notes:'peaceful gardens'}],
  ['Aman Tokyo. Quiet rooms. 4.75/5',{name:'Aman Tokyo',city:'Tokyo',country:'Japan',rating:4.75,notes:'Quiet rooms'}],
  ['Hotel name: New York New York. City: Las Vegas. Country: US. Rating zero out of five.',{name:'New York New York',city:'Las Vegas',country:'United States',rating:0}],
  ['Hotel Aurora in Smalltown, France. Quiet.',{name:'Hotel Aurora',city:'Smalltown',country:'France',notes:'Quiet'}],
  ['Hotel name: Four Seasons. City: NYC. Country: U.S.A. Rating four point seventy five. Notes: four nights for $500.',{name:'Four Seasons',city:'New York',country:'United States',rating:4.75,notes:'four nights for $500'}],
];
for(const [text,want] of cases) assert.deepEqual(parse(text).fields,want,text);
assert.equal(numeric('four point seven five'),4.75);
assert.equal(numeric('four point 75'),4.75);
assert.equal(numeric('four and three quarters'),4.75);
assert.equal(parse('Hotel X in Tokyo. Rating 6 out of 5.').fields.rating,undefined);
assert.ok(parse('Hotel X in Tokyo. 8 out of 10.').issues.some(s=>s.includes('between 0 and 5')));
assert.equal(parse('Four Seasons in Paris. Five star hotel. Stayed 4 nights for 500 dollars.').fields.rating,undefined);
assert.equal(parse('Aman Tokyo. Rating 4.2. Rating 4.6.').fields.rating,4.6);
assert.deepEqual(parse('').fields,{});
assert.equal(parse('Mystery Hotel').fields.city,undefined);
assert.equal(parse('Hotel X in Springfield.').fields.country,undefined);
assert.equal(parse('The Retreat',[{name:'The Retreat',city:'Reykjavik',country:'Iceland'}]).fields.country,'Iceland');
assert.equal(parse('The Retreat',[{name:'The Retreat',city:'Paris',country:'France'},{name:'The Retreat',city:'London',country:'United Kingdom'}]).fields.city,undefined);
assert.equal(parse('Hotel X in London.',[{name:'Test',city:'London',country:'Canada'}]).fields.country,undefined);
assert.equal(parse('Hotel <img src=x onerror=alert(1)> in Tokyo.').fields.name,'Hotel <img src=x onerror=alert(1)>');
console.log(`${cases.length} complete entries plus rating, ambiguity, preservation and injection cases passed.`);
