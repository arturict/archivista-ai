import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { periodId, providerCategory } from './telemetryPrivacy';
import { resolveDataDirectory } from './dataDirectory';

const documentModel = require('../models/document');
const reviewService = require('./reviewService');

interface TelemetryState {
  secret: string;
  lastSentAt?: string;
}

const statePath = path.join(resolveDataDirectory(), 'telemetry.json');
let timer: NodeJS.Timeout | null = null;
let active = false;
let scheduleGeneration = 0;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_SHORT_RETRIES = 2;

function enabled(env = process.env): boolean {
  return ['yes', 'true', '1', 'on'].includes(String(env.TAGVICO_TELEMETRY_ENABLED || '').toLowerCase());
}

function bucket(value: number, ranges: Array<[number, string]>): string {
  for (const [max, label] of ranges) if (value <= max) return label;
  return ranges.at(-1)?.[1] || 'unknown';
}

async function loadState(): Promise<TelemetryState> {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, 'utf8'));
    if (typeof parsed.secret === 'string') return parsed;
  } catch {
    // First opt-in/preview creates a local-only secret. It is never transmitted.
  }
  const state = { secret: crypto.randomBytes(32).toString('hex') };
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  return state;
}

async function buildPayload(now = new Date()) {
  const state = await loadState();
  const processed = Number(await documentModel.getProcessedDocumentsCount()) || 0;
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const provider = String(process.env.AI_PROVIDER || 'openrouter').toLowerCase();

  return {
    schema: 1,
    daily_id: periodId(state.secret, `day:${day}`),
    monthly_id: periodId(state.secret, `month:${month}`),
    period: { day, month },
    version: String(process.env.TAGVICO_AI_VERSION || require(path.join(process.cwd(), 'package.json')).version),
    documents_processed: bucket(processed, [[0, '0'], [10, '1-10'], [100, '11-100'], [1000, '101-1000'], [Number.MAX_SAFE_INTEGER, '1000+']]),
    write_mode: reviewService.getWriteMode(),
    provider_category: providerCategory(provider),
    features: {
      ocr_rescue: String(process.env.OCR_ENABLED || process.env.MISTRAL_OCR_ENABLED || 'no') === 'yes',
      custom_fields: String(process.env.ACTIVATE_CUSTOM_FIELDS || 'yes') === 'yes',
      controlled_tags: String(process.env.CONTROLLED_TAGGING_ENABLED || 'no') === 'yes'
    }
  };
}

async function sendNow() {
  if (!enabled()) return { sent: false, reason: 'disabled' };
  const endpoint = String(process.env.TAGVICO_TELEMETRY_ENDPOINT || '').trim();
  if (!endpoint.startsWith('https://')) return { sent: false, reason: 'invalid_endpoint' };
  const payload = await buildPayload();
  await axios.post(endpoint, payload, { timeout: 5000, headers: { 'Content-Type': 'application/json' }, maxRedirects: 0 });
  const state = await loadState();
  state.lastSentAt = new Date().toISOString();
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  console.log('[TELEMETRY] Shared anonymous aggregate heartbeat:', JSON.stringify(payload));
  return { sent: true };
}

function jitteredDelay(
  baseMs: number,
  jitterMs: number,
  random: () => number = Math.random
) {
  const sample = Math.max(0, Math.min(0.999999, random()));
  return baseMs + Math.floor(sample * jitterMs);
}

function retryableStatus(status?: number) {
  return status === undefined || status === 408 || status === 429 || status >= 500;
}

function schedule(delayMs: number, generation: number, retriesRemaining = MAX_SHORT_RETRIES) {
  if (!active || generation !== scheduleGeneration) return;
  timer = setTimeout(async () => {
    timer = null;
    try {
      await sendNow();
      schedule(jitteredDelay(DAY_MS, 60 * MINUTE_MS), generation, MAX_SHORT_RETRIES);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[TELEMETRY] Heartbeat was not sent:', message);
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (retriesRemaining > 0 && retryableStatus(status)) {
        schedule(
          jitteredDelay(5 * MINUTE_MS, 10 * MINUTE_MS),
          generation,
          retriesRemaining - 1
        );
      } else {
        schedule(jitteredDelay(DAY_MS, 60 * MINUTE_MS), generation, MAX_SHORT_RETRIES);
      }
    }
  }, delayMs);
  timer.unref?.();
}

function start() {
  if (active) return;
  active = true;
  scheduleGeneration += 1;
  schedule(jitteredDelay(15 * MINUTE_MS, 45 * MINUTE_MS), scheduleGeneration);
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
  active = false;
  scheduleGeneration += 1;
}

export = { buildPayload, enabled, jitteredDelay, retryableStatus, sendNow, start, stop };
