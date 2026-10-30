// Live QA/testing jobs from public job boards, scored for Sajid's profile.
// Only titles that are clearly software QA/testing are kept; each job gets a 0-100 match
// score with the reasons, a few detected skills, and whether it is open to Pakistan.

const UA = 'Mozilla/5.0 (compatible; SajidJobCenter/2.0; +https://sajidthebhatti.vercel.app/job-center/)';
const TIMEOUT_MS = 7000;

// ---------- relevance ----------
// A QA/testing title in English, German or French.
const QA_TITLE = [
  /\b(?:qa|sqa|sdet|q\/a)\b/i,
  /\bquality\s+(?:assurance|engineer(?:ing)?)\b/i,
  /\btest(?:ing)?\s+(?:automation|engineer|analyst|lead|manager|architect|specialist|consultant|developer)\b/i,
  /\b(?:automation|software|manual|mobile|api|performance|game|web|uat|functional|regression)\s+test(?:er|ing|s)?\b/i,
  /\btesters?\b/i,
  /softwaretest|testingenieur|testautomatis|testmanager|testentwickl/i,
  /\btesteur|\btesteuse|ing[ée]nieur\s+(?:en\s+)?(?:test|qa|validation)|test\s+logiciel/i,
];
// Titles that mention testing but are another job.
const NOT_QA = /\b(?:flight|clinical|lab(?:oratory)?|phlebotom\w*|driver|teach\w*|tutor|trainer|instructor|penetration|pen[-\s]?test\w*|red\s+team|jailbreak|security\s+(?:tester|engineer)|hardware|electrical|mechanical|manufactur\w*|inspection|food|drug|medical\s+device|linguist\w*|languages?|translat\w*|annotat\w*|reviewer|usability|consumer|sales|marketing|recruit\w*|nurse|pharma\w*|chemist|construction|welding|automotive|vehicle)\b/i;

const SKILLS = [
  ['Playwright', /\bplaywright\b/i, 12],
  ['Selenium', /\bselenium\b/i, 6],
  ['Cypress', /\bcypress\b/i, 6],
  ['Postman', /\bpostman\b/i, 6],
  ['API testing', /\b(?:api|rest(?:ful)?)\b[^.]{0,30}\btest/i, 8],
  ['Automation', /\bautomat(?:ion|ed)\b/i, 6],
  ['Manual testing', /\bmanual\b/i, 5],
  ['Python', /\bpython\b|\bpytest\b/i, 4],
  ['JavaScript', /\b(?:javascript|typescript|node\.?js)\b/i, 4],
  ['Mobile', /\b(?:mobile|android|ios|appium)\b/i, 3],
  ['Performance', /\b(?:jmeter|performance|load\s+test|k6)\b/i, 3],
  ['JIRA', /\bjira\b/i, 2],
  ['AI/ML', /\b(?:ai|ml|llm|machine\s+learning)\b/i, 3],
  ['Banking/Fintech', /\b(?:bank\w*|fintech|payments?)\b/i, 3],
  ['Blockchain', /\b(?:blockchain|web3|crypto)\b/i, 3],
  // Not on Sajid's profile yet: tracked for the market view, no effect on the score.
  ['SQL', /\bsql\b/i, 0],
  ['CI/CD', /\b(?:ci\/cd|jenkins|github\s+actions|gitlab\s+ci|circleci)\b/i, 0],
  ['Java', /\bjava\b(?!\s*script)/i, 0],
  ['TypeScript', /\btypescript\b/i, 0],
  ['Appium', /\bappium\b/i, 0],
  ['Docker', /\bdocker\b/i, 0],
  ['AWS', /\baws\b/i, 0],
  ['BDD/Cucumber', /\b(?:cucumber|bdd|gherkin)\b/i, 0],
];

const OPEN_TO_PK = /\b(?:worldwide|anywhere|global(?:ly)?|pakistan|asia|apac|emea|international)\b/i;

export function isQaTitle(title) {
  const t = String(title || '');
  return QA_TITLE.some((r) => r.test(t)) && !NOT_QA.test(t);
}

export function scoreJob(job) {
  const reasons = ['QA/testing role'];
  let score = 50;
  const text = `${job.title} ${(job.tags || []).join(' ')} ${job.text || ''}`;
  const skills = [], fits = [];
  let skillPts = 0;
  for (const [name, re, pts] of SKILLS) if (re.test(text)) { skills.push(name); skillPts += pts; if (pts) fits.push(name); }
  // Long descriptions list every tool; cap so the score still separates good fits from the rest.
  score += Math.min(24, skillPts);
  if (fits.length) reasons.push(fits.slice(0, 3).join(', '));
  // Sajid has about 2 years of experience: junior/mid roles fit best.
  if (/\b(?:senior|sr\.?|lead|principal|staff|head|director|manager|architect|vp)\b/i.test(job.title)) { score -= 15; reasons.push('Senior level'); }
  else if (/\b(?:junior|jr\.?|associate|mid|intermediate|entry)\b/i.test(job.title)) { score += 6; reasons.push('Junior/mid level'); }
  if (job.openToPK) { score += 12; reasons.push('Open to Pakistan'); }
  else if (job.remote) score += 3;
  const ageDays = job.posted ? (Date.now() - job.posted) / 864e5 : 99;
  if (ageDays <= 3) score += 4;
  else if (ageDays > 30) score -= 8;
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons, skills };
}

// ---------- helpers ----------
const strip = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim();
const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  if (/^\d+$/.test(String(v))) return toMs(Number(v));
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
};
const money = (min, max, currency, period) => {
  const lo = Number(min) || 0, hi = Number(max) || 0;
  if (!lo && !hi) return null;
  return { min: lo || hi, max: hi || lo, currency: currency || 'USD', period: period || 'year' };
};

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---------- contact emails ----------
// Only addresses printed in the official job post: never guessed (guesses bounce and look like spam).
const EMAIL_RE = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;
const NOT_CONTACT = /^(?:no-?reply|donotreply|do-not-reply|privacy|gdpr|dpo|abuse|security|legal|unsubscribe|press|media|example|test|user|name|email|you|your\.?name|first\.?last|firstname\.lastname)@|@(?:example|test|domain|email|sentry)\.|\.(?:png|jpe?g|gif|svg|webp)$/i;
const BOARD = /@(?:[a-z0-9-]+\.)?(?:himalayas\.app|remotive\.com|remoteok\.com|jobicy\.com|arbeitnow\.com)$/i;
const HIRING = /(?:^|[._-])(?:hr|careers?|jobs?|recruit\w*|talent|hiring|apply|applications?|cv|resumes?|people|join)(?:[._-]|$)/i;

export function findEmails(html) {
  const text = String(html || '')
    .replace(/&#0*64;|&commat;/gi, '@')
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@')
    .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.');
  const found = [...new Set((text.match(EMAIL_RE) || []).map((e) => e.toLowerCase().replace(/\.+$/, '')))]
    .filter((e) => !NOT_CONTACT.test(e) && !BOARD.test(e));
  // Hiring inboxes (careers@, hr@, jobs@ …) first.
  return found.sort((a, b) => HIRING.test(b.split('@')[0]) - HIRING.test(a.split('@')[0])).slice(0, 3);
}

// ---------- sources ----------
// Himalayas: remote jobs; country=PK returns only jobs a candidate in Pakistan may apply to.
async function himalayas() {
  const pk = ['qa', 'qa engineer', 'test automation', 'quality assurance', 'sdet', 'tester'].map((q) => [q, true]);
  const world = ['qa automation', 'sdet', 'software tester'].map((q) => [q, false]);
  const pages = await Promise.allSettled([...pk, ...world].map(([q, isPk]) =>
    getJson(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}${isPk ? '&country=PK' : ''}`)
      .then((j) => (j.jobs || []).map((x) => ({ x, isPk })))));
  if (pages.every((p) => p.status === 'rejected')) throw pages[0].reason;
  return pages.filter((p) => p.status === 'fulfilled').flatMap((p) => p.value).map(({ x, isPk }) => {
    const regions = x.locationRestrictions || [];
    return {
      source: 'Himalayas', title: x.title, company: x.companyName,
      location: regions.length ? regions.join(', ') : 'Worldwide',
      remote: true, openToPK: isPk || !regions.length || regions.includes('Pakistan'),
      tags: [...(x.seniority || []), x.employmentType].filter(Boolean),
      url: x.applicationLink, posted: toMs(x.pubDate),
      salary: money(x.minSalary, x.maxSalary, x.currency, x.salaryPeriod),
      text: `${x.excerpt || ''} ${(x.categories || []).join(' ')} ${strip(x.description).slice(0, 2500)}`,
      blurb: `${strip(x.excerpt)} ${strip(x.description).slice(0, 1500)}`,
      contacts: findEmails(x.description),
    };
  });
}

async function remotive() {
  const j = await getJson('https://remotive.com/api/remote-jobs?category=qa');
  return (j.jobs || []).map((x) => ({
    source: 'Remotive', title: x.title, company: x.company_name,
    location: x.candidate_required_location || 'Worldwide', remote: true,
    openToPK: OPEN_TO_PK.test(x.candidate_required_location || 'Worldwide'),
    tags: x.tags || [], url: x.url, posted: toMs(x.publication_date),
    salaryText: x.salary || '', text: strip(x.description).slice(0, 2500), contacts: findEmails(x.description),
  }));
}

async function remoteok() {
  const j = await getJson('https://remoteok.com/api');
  return (Array.isArray(j) ? j : []).filter((x) => x.id && x.position).map((x) => ({
    source: 'RemoteOK', title: x.position, company: x.company,
    location: x.location || 'Remote', remote: true,
    openToPK: !x.location || OPEN_TO_PK.test(x.location),
    tags: x.tags || [], url: x.url || `https://remoteok.com/remote-jobs/${x.id}`, posted: toMs(x.date || x.epoch),
    salary: money(x.salary_min, x.salary_max, 'USD', 'year'), text: strip(x.description).slice(0, 2500), contacts: findEmails(x.description),
  }));
}

async function jobicy() {
  const tags = ['testing', 'qa engineer', 'automation'];
  const lists = await Promise.allSettled(tags.map((t) => getJson(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(t)}`)));
  if (lists.every((p) => p.status === 'rejected')) throw lists[0].reason;
  return lists.filter((p) => p.status === 'fulfilled').flatMap((p) => p.value.jobs || []).map((x) => ({
    source: 'Jobicy', title: strip(x.jobTitle), company: x.companyName,
    location: x.jobGeo || 'Anywhere', remote: true,
    openToPK: OPEN_TO_PK.test(x.jobGeo || 'Anywhere'),
    tags: [...(x.jobIndustry || []), x.jobLevel].filter(Boolean).map(strip), url: x.url, posted: toMs(x.pubDate),
    salary: money(x.salaryMin, x.salaryMax, x.salaryCurrency, x.salaryPeriod), text: strip(x.jobExcerpt), contacts: findEmails(x.jobDescription),
  }));
}

async function arbeitnow() {
  const j = await getJson('https://www.arbeitnow.com/api/job-board-api');
  return (j.data || []).map((x) => ({
    source: 'Arbeitnow', title: x.title, company: x.company_name,
    location: x.location || (x.remote ? 'Remote' : ''), remote: !!x.remote, openToPK: false,
    tags: x.tags || [], url: x.url, posted: toMs(x.created_at), text: strip(x.description).slice(0, 2500), contacts: findEmails(x.description),
  }));
}

const SOURCES = { Himalayas: himalayas, Remotive: remotive, RemoteOK: remoteok, Jobicy: jobicy, Arbeitnow: arbeitnow };

function hashId(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

// First words of the description, without a repeated "Job Title: ..." / "Location: ..." header.
export function summarize(text, title) {
  let s = String(text || '').trim();
  s = s.replace(/^(?:job\s*title|position|role)\s*:\s*/i, '');
  if (title && s.toLowerCase().startsWith(String(title).toLowerCase())) s = s.slice(String(title).length);
  const FIELD = '(?:location|employment\\s+type|job\\s+type|type|department|schedule|experience|work\\s+mode|salary)';
  const header = new RegExp(`^[\\s:|–-]*${FIELD}\\s*:\\s*.*?(?=\\s${FIELD}\\s*:|[.!]\\s|$)[.!]?`, 'i');
  for (let i = 0; i < 6 && header.test(s); i++) s = s.replace(header, '');
  s = s.replace(/^[\s:|.–-]+/, '');
  // A leading section heading, often glued to the next word ("Job OverviewWe are…").
  s = s.replace(/^(?:job\s+overview|role\s+overview|overview|about\s+us|about\s+the\s+(?:role|company|job|position)|job\s+description|position\s+summary|summary|who\s+we\s+are|the\s+role|the\s+opportunity)\s*:?\s*/i, '');
  // One real sentence about the role beats "Category: … Location: …" headers and company history.
  const sentences = s.split(/(?<=[.!?])\s+|\s+[•·]\s+/)
    .map((x) => x.replace(/^.{0,120}?\babout\s+the\s+(?:role|position|job)\b\s*:?\s*/i, '').replace(/^About\s+[A-Z][\w&.-]*?(?=[A-Z][a-z])/, '').trim());
  const prose = sentences.filter((x) => x.split(/\s+/).length >= 8 && !/^[^.]{0,30}:/.test(x) && /\b(?:we|we're|you|you'll|our|is|are|will|seeking|looking|join|hiring|responsible)\b/i.test(x));
  const pick = prose.find((x) => /\b(?:qa|test\w*|quality|automation|engineer\w*|tester)\b/i.test(x)) || prose[0];
  if (!pick) return (s.match(/\b\w+\s*:/g) || []).length >= 2 || s.split(/\s+/).length < 6 ? '' : clip(s);
  return clip(pick);
}
const clip = (s) => (s.length > 220 ? s.slice(0, 217).replace(/\s+\S*$/, '') + '…' : s);

export function rank(all) {
  const seen = new Map();
  for (const j of all) {
    if (!j.url || !/^https?:\/\//i.test(j.url) || !isQaTitle(j.title)) continue;
    const key = `${j.title}|${j.company}`.toLowerCase().replace(/[^a-z0-9|]+/g, '');
    const prev = seen.get(key);
    // Keep one copy; prefer the one known to be open to Pakistan.
    if (prev && (prev.openToPK || !j.openToPK)) continue;
    seen.set(key, j);
  }
  return [...seen.values()].map((j) => {
    const { score, reasons, skills } = scoreJob(j);
    const { text, blurb, ...rest } = j;
    return { ...rest, id: hashId(j.url), score, reasons, skills, summary: summarize(blurb ?? text, j.title) };
  }).sort((a, b) => b.score - a.score || b.posted - a.posted).slice(0, 120);
}

export default async function handler(req, res) {
  const names = Object.keys(SOURCES);
  const started = Date.now();
  const results = await Promise.allSettled(names.map((n) => SOURCES[n]()));
  const sources = names.map((name, i) => {
    const r = results[i];
    return r.status === 'fulfilled' ? { name, ok: true, count: r.value.length } : { name, ok: false, error: String(r.reason?.message || r.reason).slice(0, 80) };
  });
  const all = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
  const jobs = rank(all);
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
  res.status(sources.some((s) => s.ok) ? 200 : 502).json({
    updated: Date.now(), ms: Date.now() - started, totalScanned: all.length, sources, jobs,
  });
}
