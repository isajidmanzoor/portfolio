export default async function handler(req, res) {
  const QA_KEYWORDS = ['qa', 'test', 'tester', 'testing', 'quality', 'sdet', 'automation', 'sqa'];
  const matchesQA = (text) => QA_KEYWORDS.some(k => text.toLowerCase().includes(k));

  async function fetchArbeitnow() {
    try {
      const r = await fetch('https://www.arbeitnow.com/api/job-board-api');
      const j = await r.json();
      return (j.data || []).map(x => ({
        title: x.title, company: x.company_name, location: x.location,
        remote: !!x.remote, tags: x.tags || [], url: x.url,
        created: x.created_at ? x.created_at * 1000 : 0
      }));
    } catch (e) { return []; }
  }

  async function fetchRemotive() {
    try {
      const r = await fetch('https://remotive.com/api/remote-jobs?category=qa');
      const j = await r.json();
      return (j.jobs || []).map(x => ({
        title: x.title, company: x.company_name, location: x.candidate_required_location,
        remote: true, tags: x.tags || [], url: x.url,
        created: x.publication_date ? Date.parse(x.publication_date) : 0
      }));
    } catch (e) { return []; }
  }

  async function fetchRemoteOK() {
    try {
      const r = await fetch('https://remoteok.com/api', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobCenterBot/1.0)' }
      });
      const j = await r.json();
      return (j || []).filter(x => x.id).map(x => ({
        title: x.position, company: x.company, location: x.location || 'Remote',
        remote: true, tags: x.tags || [], url: x.url || ('https://remoteok.com/remote-jobs/' + x.id),
        created: x.date ? Date.parse(x.date) : 0
      }));
    } catch (e) { return []; }
  }

  try {
    const [a, b, c] = await Promise.all([fetchArbeitnow(), fetchRemotive(), fetchRemoteOK()]);
    const all = [...a, ...b, ...c];

    const seen = new Set();
    const matched = all
      .filter(j => matchesQA(j.title + ' ' + (j.tags || []).join(' ')))
      .filter(j => {
        const key = (j.title + j.company).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key); return true;
      })
      .sort((x, y) => y.created - x.created)
      .slice(0, 30);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.status(200).json({ totalScanned: all.length, jobs: matched });
  } catch (e) {
    res.status(500).json({ error: 'fetch_failed', totalScanned: 0, jobs: [] });
  }
}
