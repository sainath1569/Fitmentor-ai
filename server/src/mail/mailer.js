import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import { config, dataDir } from '../config.js';

const { mail } = config;
const transport = mail.host
  ? nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.port === 465,
    auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
  })
  : null;

export const mailStatus = () => (transport ? `SMTP via ${mail.host}` : 'no SMTP set, written to server/.data/outbox.log');

/** Sends through SMTP when configured; otherwise keeps a local outbox so nothing is lost in dev. */
export async function sendMail({ to, subject, html, text }) {
  if (transport) return transport.sendMail({ from: mail.from, to, subject, html, text });
  await appendFile(join(dataDir, 'outbox.log'), `\n=== ${new Date().toISOString()} -> ${to}\n${subject}\n\n${text}\n`);
  return { outbox: true };
}
