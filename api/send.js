// Sends one job-application email (optionally with the CV attached) from Sajid's Gmail.
// Set in Vercel: GMAIL_USER, GMAIL_APP_PASSWORD (a Google app password) and JOBCENTER_KEY
// (a password typed once in Job Center). Without them Job Center falls back to Gmail compose.
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}$/i;
const MAX_FILE = 3 * 1024 * 1024;
const TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
// One personal email per job: a daily cap keeps the Gmail account clear of spam flags.
const DAILY_LIMIT = 25;
const sentToday = new Map();

const configured = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && process.env.JOBCENTER_KEY);

function keyOk(given) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(process.env.JOBCENTER_KEY || ''));
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function transport() {
  if (process.env.JOBCENTER_MAIL_DRYRUN === '1') return nodemailer.createTransport({ jsonTransport: true });
  return nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
}

const fail = (res, code, error) => res.status(code).json({ ok: false, error });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ configured: configured(), from: configured() ? process.env.GMAIL_USER : null });
  if (req.method !== 'POST') return fail(res, 405, 'Use POST.');
  if (!configured()) return fail(res, 503, 'Email sending is not set up yet (GMAIL_USER, GMAIL_APP_PASSWORD and JOBCENTER_KEY in Vercel).');

  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return fail(res, 400, 'The request was not valid JSON.'); } }
  if (!keyOk(b.key)) return fail(res, 401, 'The Job Center key is wrong.');

  const to = String(b.to || '').trim();
  if (!EMAIL.test(to)) return fail(res, 400, 'The recipient address is not valid.');
  const subject = String(b.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  if (!subject) return fail(res, 400, 'Add a subject.');
  const text = String(b.text || '').trim();
  if (!text || text.length > 20000) return fail(res, 400, 'The message is empty or too long.');

  const attachments = [];
  if (b.attachment) {
    const name = String(b.attachment.name || 'CV.pdf').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
    const ext = name.split('.').pop().toLowerCase();
    if (!TYPES[ext]) return fail(res, 400, 'The CV must be a PDF, DOC or DOCX file.');
    const content = Buffer.from(String(b.attachment.data || ''), 'base64');
    if (!content.length || content.length > MAX_FILE) return fail(res, 400, 'The CV must be smaller than 3 MB.');
    if (ext === 'pdf' && content.subarray(0, 4).toString() !== '%PDF') return fail(res, 400, 'The CV file is not a valid PDF.');
    attachments.push({ filename: name, content, contentType: TYPES[ext] });
  }

  const day = new Date().toISOString().slice(0, 10);
  const count = sentToday.get(day) || 0;
  if (count >= DAILY_LIMIT) return fail(res, 429, `Daily limit of ${DAILY_LIMIT} emails reached — try again tomorrow.`);

  const me = process.env.GMAIL_USER;
  try {
    const info = await transport().sendMail({
      from: { name: 'Sajid Manzoor', address: me }, to, replyTo: me,
      bcc: b.copyToMe ? me : undefined, subject, text, attachments,
    });
    sentToday.clear();
    sentToday.set(day, count + 1);
    return res.status(200).json({ ok: true, id: info.messageId || null });
  } catch (e) {
    const auth = e && (e.code === 'EAUTH' || e.responseCode === 535);
    return fail(res, 502, auth ? 'Gmail rejected the login — check GMAIL_USER and the app password in Vercel.' : `Gmail could not send it: ${String(e?.message || e).slice(0, 160)}`);
  }
}
