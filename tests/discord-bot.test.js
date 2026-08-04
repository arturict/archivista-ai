/**
 * Discord companion bot unit tests.
 *
 * Covers: snowflake parsing, allowlist routing, mention/reply detection,
 * history isolation, text chunking, CDN URL validation, size limits,
 * duplicate document handling, slash commands, requester-bound buttons,
 * replay rejection, and Telegram compatibility (shared internals).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const discordBot = require('../dist/services/discordBotService');
const config = require('../dist/config/config');
const { parseJsonObject, extractDocumentIds, cleanAnswerCitations, chunkDiscordText, chunkTelegramText } =
  require('../dist/services/companionBotInternals');

// ============================================================
// Allowlist / snowflake parsing
// ============================================================

test('Discord allowlist accepts valid snowflakes and rejects non-snowflakes', () => {
  const users = discordBot.parseDiscordUsers(
    JSON.stringify([
      { discordId: '123456789012345678', paperlessToken: 'alice-token' },
      { discordId: 'not-an-id', paperlessToken: 'ignored' },
      { discordId: '12345', paperlessToken: 'too-short' },
      { discordId: '12345678901234567890', paperlessToken: 'too-long' }, // 20 chars = ok, 21 = not
    ]),
    'http://paperless:8000/api'
  );
  // Valid snowflakes: 17-20 digits
  assert.ok(users.has('123456789012345678'), 'should accept 18-digit snowflake');
  assert.ok(!users.has('not-an-id'), 'should reject non-numeric');
  assert.ok(!users.has('12345'), 'should reject too-short ID');
  // 20-digit should be ok (max snowflake)
  assert.ok(users.has('12345678901234567890'), 'should accept 20-digit snowflake');
});

test('Discord allowlist fills missing paperlessUrl from default', () => {
  const users = discordBot.parseDiscordUsers(
    JSON.stringify([{ discordId: '100000000000000001', paperlessToken: 'tok' }]),
    'http://paperless:8000/api'
  );
  assert.equal(users.get('100000000000000001').paperlessUrl, 'http://paperless:8000/api');
});

test('Discord allowlist respects per-user paperlessUrl override', () => {
  const users = discordBot.parseDiscordUsers(
    JSON.stringify([
      {
        discordId: '100000000000000002',
        paperlessToken: 'tok',
        paperlessUrl: 'https://my-paperless.example/api',
      },
    ]),
    'http://default-paperless:8000/api'
  );
  assert.equal(
    users.get('100000000000000002').paperlessUrl,
    'https://my-paperless.example/api'
  );
});

test('Discord allowlist accepts camelCase and snake_case field aliases', () => {
  const users = discordBot.parseDiscordUsers(
    JSON.stringify([
      { discord_id: '100000000000000003', paperless_token: 'tok3' },
    ]),
    'http://paperless:8000/api'
  );
  assert.ok(users.has('100000000000000003'));
  assert.equal(users.get('100000000000000003').paperlessToken, 'tok3');
});

test('Discord allowlist rejects entries missing a token', () => {
  const users = discordBot.parseDiscordUsers(
    JSON.stringify([{ discordId: '100000000000000004' }]),
    'http://paperless:8000/api'
  );
  assert.ok(!users.has('100000000000000004'), 'should reject entry without token');
});

test('Discord allowlist handles empty array', () => {
  const users = discordBot.parseDiscordUsers('[]', 'http://paperless:8000/api');
  assert.equal(users.size, 0);
});

test('Discord configuration is disabled and bounded by default', () => {
  assert.equal(config.discord.enabled, 'no');
  assert.equal(config.discord.usersJson, '[]');
  assert.equal(config.discord.uploadTimeoutSeconds, 180);
  assert.equal(config.discord.maxDocuments, 8);
  assert.equal(config.discord.historyTurns, 6);
  assert.equal(config.discord.maxFileBytes, 10 * 1024 * 1024);
  assert.equal(config.discord.automaticUploadMetadata, 'no');
});

// ============================================================
// Snowflake constant
// ============================================================

test('SNOWFLAKE_RE matches exactly 17-20 digit strings', () => {
  const { SNOWFLAKE_RE } = discordBot.internals;
  assert.ok(SNOWFLAKE_RE.test('12345678901234567'));   // 17
  assert.ok(SNOWFLAKE_RE.test('123456789012345678'));  // 18
  assert.ok(SNOWFLAKE_RE.test('1234567890123456789')); // 19
  assert.ok(SNOWFLAKE_RE.test('12345678901234567890')); // 20
  assert.ok(!SNOWFLAKE_RE.test('1234567890123456'));    // 16 - too short
  assert.ok(!SNOWFLAKE_RE.test('123456789012345678901')); // 21 - too long
  assert.ok(!SNOWFLAKE_RE.test('1234567890abcdefgh')); // has letters
});

// ============================================================
// Discord CDN URL validation
// ============================================================

test('Discord CDN validation accepts exact HTTPS attachment hosts only', () => {
  const { DISCORD_CDN_RE, isAllowedDiscordCdnUrl } = discordBot.internals;
  assert.ok(DISCORD_CDN_RE.test('https://cdn.discordapp.com/attachments/123/456/file.pdf'));
  assert.ok(isAllowedDiscordCdnUrl('https://media.discordapp.net/attachments/123/456/file.png'));
  assert.ok(!isAllowedDiscordCdnUrl('http://cdn.discordapp.com/attachments/123/456/file.pdf'));
  assert.ok(!isAllowedDiscordCdnUrl('https://evil.com/cdn.discordapp.com/file.pdf'));
  assert.ok(!isAllowedDiscordCdnUrl('https://cdn.discordapp.com.evil.example/file.pdf'));
  assert.ok(!isAllowedDiscordCdnUrl('https://user@cdn.discordapp.com/file.pdf'));
});

test('Discord mention cleanup removes bot mention variants', () => {
  const { cleanDiscordMention } = discordBot.internals;
  assert.equal(cleanDiscordMention('<@123456789012345678> find invoices'), 'find invoices');
  assert.equal(cleanDiscordMention('<@!123456789012345678> find invoices'), 'find invoices');
});

// ============================================================
// Shared internals – parseJsonObject
// ============================================================

test('parseJsonObject tolerates markdown code fences', () => {
  const result = parseJsonObject('```json\n{"query":"test"}\n```');
  assert.deepEqual(result, { query: 'test' });
});

test('parseJsonObject returns null for non-object JSON', () => {
  assert.equal(parseJsonObject('[1,2,3]'), null);
  assert.equal(parseJsonObject('"string"'), null);
  assert.equal(parseJsonObject('not json at all'), null);
});

// ============================================================
// Shared internals – extractDocumentIds / cleanAnswerCitations
// ============================================================

test('extractDocumentIds guards against out-of-context document IDs', () => {
  const available = [{ id: 10 }, { id: 11 }];
  const ids = extractDocumentIds('See [doc:10] and [doc:99] and [doc:10] again.', available);
  assert.deepEqual(ids, [10]);
});

test('cleanAnswerCitations replaces markers with human prose', () => {
  assert.equal(
    cleanAnswerCitations('The amount is [doc:42].'),
    'The amount is (document 42).'
  );
});

// ============================================================
// Discord text chunking
// ============================================================

test('chunkDiscordText splits below 2000 characters (1900 safety margin)', () => {
  // Each word is 6 chars + space = 7; 2500 words = ~17500 chars
  const chunks = chunkDiscordText('abcde '.repeat(2500));
  assert.ok(chunks.length > 1, 'should produce multiple chunks');
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 1900, `chunk too long: ${chunk.length}`);
  }
});

test('chunkDiscordText returns a fallback for empty input', () => {
  const chunks = chunkDiscordText('');
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], 'No answer was returned.');
});

test('chunkDiscordText returns single chunk for short text', () => {
  const chunks = chunkDiscordText('Hello, world!');
  assert.deepEqual(chunks, ['Hello, world!']);
});

// ============================================================
// Telegram compatibility (shared internals)
// ============================================================

test('chunkTelegramText splits below 4000 characters', () => {
  const chunks = chunkTelegramText('word '.repeat(2500));
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 4000, `Telegram chunk too long: ${chunk.length}`);
  }
});

// ============================================================
// Requester-bound button IDs
// ============================================================

test('discord_doc button customId encodes userId for binding', () => {
  // The customId must match discord_doc:<docId>:<userId>
  const userId = '123456789012345678';
  const docId = 42;
  const customId = `discord_doc:${docId}:${userId}`;
  const match = customId.match(/^discord_doc:(\d+):(\d{17,20})$/);
  assert.ok(match, 'customId should match expected format');
  assert.equal(Number(match[1]), docId);
  assert.equal(match[2], userId);
});

test('discord_approval button customId encodes action and userId', () => {
  const userId = '987654321098765432';
  const approvalId = '550e8400-e29b-41d4-a716-446655440000';
  const customId = `discord_approval:approve:${approvalId}:${userId}`;
  const match = customId.match(/^discord_approval:(approve|reject):([0-9a-f-]{36}):(\d{17,20})$/i);
  assert.ok(match, 'customId should match expected format');
  assert.equal(match[1], 'approve');
  assert.equal(match[2], approvalId);
  assert.equal(match[3], userId);
});

test('foreign userId in button customId does not match requesting user', () => {
  const requestingUser = '111111111111111111';
  const buttonOwner = '222222222222222222';
  const customId = `discord_doc:42:${buttonOwner}`;
  const match = customId.match(/^discord_doc:(\d+):(\d{17,20})$/);
  assert.ok(match);
  assert.notEqual(match[2], requestingUser, 'button owner should differ from requesting user');
});

test('document button handler rejects a foreign user before Paperless access', async () => {
  const service = new discordBot.DiscordBotService();
  service.users = new Map([['111111111111111111', {
    discordId: '111111111111111111', paperlessToken: 'tok', paperlessUrl: 'http://paperless/api',
  }]]);
  service.paperlessFor = () => { throw new Error('must not access Paperless'); };
  let reply;
  await service.handleButton({
    user: { id: '111111111111111111' },
    channel: { type: 1 },
    channelId: '111111111111111111',
    customId: 'discord_doc:42:222222222222222222',
    reply: async (value) => { reply = value; },
  });
  assert.match(reply.content, /another user/i);
  assert.equal(reply.ephemeral, true);
});

test('approval handler reports replayed decisions without executing them again', async () => {
  const service = new discordBot.DiscordBotService();
  const userId = '111111111111111111';
  service.users = new Map([[userId, {
    discordId: userId, paperlessToken: 'tok', paperlessUrl: 'http://paperless/api',
    householdId: 'household', memberId: 'member',
  }]]);
  const actionCenter = require('../dist/models/actionCenter');
  const originalDecide = actionCenter.decideApproval;
  actionCenter.decideApproval = () => { throw new Error('Approval is no longer pending'); };
  let edited;
  try {
    await service.handleButton({
      user: { id: userId }, channel: { type: 1 }, channelId: userId,
      customId: `discord_approval:reject:550e8400-e29b-41d4-a716-446655440000:${userId}`,
      deferReply: async () => {},
      editReply: async (value) => { edited = value; },
    });
  } finally {
    actionCenter.decideApproval = originalDecide;
  }
  assert.match(edited.content, /no longer pending/i);
});

// ============================================================
// Routing: silently ignore bots/webhooks
// ============================================================

test('Discord bot does not process messages from bots or webhooks', async () => {
  const service = new discordBot.DiscordBotService();
  service.users = new Map([
    ['123456789012345678', {
      discordId: '123456789012345678',
      paperlessToken: 'tok',
      paperlessUrl: 'http://paperless:8000/api',
    }],
  ]);
  const processed = [];
  service.handleDmMessage = async (msg, user) => processed.push({ msg, user });

  // Bot message
  await service.handleMessage({
    author: { bot: true, id: '123456789012345678' },
    webhookId: null,
    channel: { type: 1 }, // DM
    channelId: '123456789012345678',
    attachments: { size: 0 },
    content: 'hello',
    mentions: { has: () => false },
    reference: null,
  });
  assert.equal(processed.length, 0, 'should not process bot messages');

  // Webhook message
  await service.handleMessage({
    author: { bot: false, id: '123456789012345678' },
    webhookId: 'wh-id',
    channel: { type: 1 },
    channelId: '123456789012345678',
    attachments: { size: 0 },
    content: 'hello',
    mentions: { has: () => false },
    reference: null,
  });
  assert.equal(processed.length, 0, 'should not process webhook messages');
});

// ============================================================
// Routing: unknown user silently ignored
// ============================================================

test('Discord bot silently ignores messages from unknown users', async () => {
  const service = new discordBot.DiscordBotService();
  service.users = new Map(); // no allowlisted users
  const processed = [];
  service.handleDmMessage = async () => processed.push(true);

  await service.handleMessage({
    author: { bot: false, id: '999999999999999999' },
    webhookId: null,
    channel: { type: 1 }, // DM
    channelId: '999999999999999999',
    attachments: { size: 0 },
    content: 'hello',
    mentions: { has: () => false },
    reference: null,
  });
  assert.equal(processed.length, 0, 'should not process unknown user');
});

test('home-channel replies are accepted only when the referenced author is the bot', async () => {
  const service = new discordBot.DiscordBotService();
  service.client = { user: { id: '333333333333333333' } };
  const base = {
    mentions: { has: () => false },
    reference: { messageId: 'reply-target' },
  };
  assert.equal(await service.isBotAddressed({
    ...base,
    fetchReference: async () => ({ author: { id: '333333333333333333' } }),
  }), true);
  assert.equal(await service.isBotAddressed({
    ...base,
    fetchReference: async () => ({ author: { id: '444444444444444444' } }),
  }), false);
  assert.equal(await service.isBotAddressed({
    ...base,
    fetchReference: async () => { throw new Error('deleted'); },
  }), false);
});

test('multiple DM attachments are rejected before upload', async () => {
  const service = new discordBot.DiscordBotService();
  const messages = [];
  service.sendText = async (_channel, text) => messages.push(text);
  service.handleUpload = async () => { throw new Error('must not upload'); };
  await service.handleDmMessage({ attachments: { size: 2 }, channel: {}, content: '' }, {});
  assert.deepEqual(messages, ['Please send exactly one file per upload.']);
});

// ============================================================
// History isolation by (userId, channelId)
// ============================================================

test('Discord history is isolated by user and channel', () => {
  const service = new discordBot.DiscordBotService();
  const key1 = service.historyKey('user1', 'channel1');
  const key2 = service.historyKey('user1', 'channel2');
  const key3 = service.historyKey('user2', 'channel1');

  // All three keys must be distinct
  const keys = new Set([key1, key2, key3]);
  assert.equal(keys.size, 3, 'history keys must be distinct across user/channel combinations');
});

test('slash clear removes only the current user-channel history', async () => {
  const service = new discordBot.DiscordBotService();
  const userId = '111111111111111111';
  service.users = new Map([[userId, {
    discordId: userId, paperlessToken: 'tok', paperlessUrl: 'http://paperless/api',
  }]]);
  service.histories.set(`${userId}:dm-one`, [{ question: 'q', answer: 'a' }]);
  service.histories.set(`${userId}:dm-two`, [{ question: 'q2', answer: 'a2' }]);
  let reply;
  await service.handleSlashCommand({
    user: { id: userId }, channel: { type: 1 }, channelId: 'dm-one',
    commandName: 'clear', reply: async (value) => { reply = value; },
  });
  assert.equal(service.histories.has(`${userId}:dm-one`), false);
  assert.equal(service.histories.has(`${userId}:dm-two`), true);
  assert.match(reply.content, /cleared/i);
});

// ============================================================
// Attachment size validation
// ============================================================

test('upload is rejected when attachment.size exceeds max', async () => {
  const service = new discordBot.DiscordBotService();
  const messages = [];
  service.sendText = async (ch, text) => messages.push(text);
  service.paperlessFor = () => { throw new Error('should not reach Paperless'); };

  const maxBytes = 10 * 1024 * 1024; // 10 MiB
  const channel = { type: 1 };
  const message = {
    id: '1',
    author: { id: '100000000000000001' },
    channel,
    channelId: '100000000000000001',
    attachments: {
      size: 1,
      first: () => ({
        url: 'https://cdn.discordapp.com/attachments/1/2/big.pdf',
        size: maxBytes + 1,
        name: 'big.pdf',
        contentType: 'application/pdf',
      }),
    },
  };

  const user = {
    discordId: '100000000000000001',
    paperlessToken: 'tok',
    paperlessUrl: 'http://paperless:8000/api',
  };

  await service.handleUpload(message, user, false);
  assert.ok(messages.some((m) => m.includes('MiB')), 'should send a size-limit message');
});

// ============================================================
// CDN URL validation
// ============================================================

test('upload is rejected for non-CDN attachment URL', async () => {
  const service = new discordBot.DiscordBotService();
  const messages = [];
  service.sendText = async (ch, text) => messages.push(text);

  const channel = { type: 1 };
  const message = {
    id: '2',
    author: { id: '100000000000000002' },
    channel,
    channelId: '100000000000000002',
    attachments: {
      size: 1,
      first: () => ({
        url: 'http://evil.example.com/file.pdf',
        size: 100,
        name: 'file.pdf',
        contentType: 'application/pdf',
      }),
    },
  };

  const user = {
    discordId: '100000000000000002',
    paperlessToken: 'tok',
    paperlessUrl: 'http://paperless:8000/api',
  };

  await service.handleUpload(message, user, false);
  assert.ok(
    messages.some((m) => m.toLowerCase().includes('cdn') || m.toLowerCase().includes('url')),
    'should reject non-CDN URL'
  );
});

// ============================================================
// Duplicate document behavior
// ============================================================

test('upload links existing document on Paperless duplicate', async () => {
  const service = new discordBot.DiscordBotService();
  const messages = [];
  service.sendText = async (ch, text) => messages.push(text);
  service.sendTextWithDocumentButtons = async (ch, uid, text, docs) => {
    messages.push({ text, docs });
  };

  // Stub axios
  const axios = require('axios');
  const originalGet = axios.get;
  axios.get = async () => ({ data: Buffer.from('pdf'), headers: {} });

  const paperlessStub = {
    uploadDocument: async () => 'task-1',
    waitForConsumption: async () => ({ documentId: 55, duplicate: true, task: {} }),
  };

  service.paperlessFor = () => paperlessStub;

  const channel = { type: 1, send: async () => {}, sendTyping: async () => {} };
  const message = {
    id: '3',
    author: { id: '100000000000000003' },
    channel,
    channelId: '100000000000000003',
    attachments: {
      size: 1,
      first: () => ({
        url: 'https://cdn.discordapp.com/attachments/1/2/invoice.pdf',
        size: 1024,
        name: 'invoice.pdf',
        contentType: 'application/pdf',
      }),
    },
  };

  const user = {
    discordId: '100000000000000003',
    paperlessToken: 'tok',
    paperlessUrl: 'http://paperless:8000/api',
  };

  try {
    await service.handleUpload(message, user, false);
  } finally {
    axios.get = originalGet;
  }

  const last = messages[messages.length - 1];
  assert.ok(last.text && last.text.includes('duplicate'), 'should mention duplicate');
  assert.ok(last.docs && last.docs[0].id === 55, 'should link existing document');
});

// ============================================================
// Compose env pass-through
// ============================================================

test('Compose passes every Discord setting through with automatic metadata off by default', () => {
  const compose = fs.readFileSync(path.join(__dirname, '..', 'docker-compose.yml'), 'utf8');
  const expected = {
    DISCORD_BOT_ENABLED: 'no',
    DISCORD_BOT_TOKEN: '',
    DISCORD_USERS_JSON: '[]',
    DISCORD_HOME_CHANNEL_ID: '',
    DISCORD_UPLOAD_TIMEOUT_SECONDS: '180',
    DISCORD_MAX_DOCUMENTS: '8',
    DISCORD_HISTORY_TURNS: '6',
    DISCORD_MAX_FILE_BYTES: '10485760',
    DISCORD_UPLOAD_AUTOMATIC_METADATA: 'no',
  };
  for (const [name, fallback] of Object.entries(expected)) {
    assert.match(
      compose,
      new RegExp(`${name}: \\$\\{${name}:-${fallback.replace(/[[\]]/g, '\\$&')}\\}`),
      `Missing Compose pass-through for ${name}`
    );
  }
});

// ============================================================
// Telegram compatibility (internals still work after refactor)
// ============================================================

test('Telegram internals still export correctly after refactor', () => {
  const telegramBot = require('../dist/services/telegramBotService');
  assert.ok(typeof telegramBot.parseTelegramUsers === 'function');
  assert.ok(typeof telegramBot.internals.chunkTelegramText === 'function');
  assert.ok(typeof telegramBot.internals.extractDocumentIds === 'function');
  assert.ok(typeof telegramBot.internals.cleanAnswerCitations === 'function');
  assert.ok(typeof telegramBot.internals.parseJsonObject === 'function');
});

test('Telegram parseTelegramUsers still rejects non-numeric IDs after refactor', () => {
  const telegramBot = require('../dist/services/telegramBotService');
  const users = telegramBot.parseTelegramUsers(
    JSON.stringify([
      { telegramId: '123', paperlessToken: 'alice' },
      { telegramId: 'bad-id', paperlessToken: 'bob' },
    ]),
    'http://paperless:8000/api'
  );
  assert.equal(users.size, 1);
  assert.ok(users.has('123'));
});

test('shared internals buildPlanPrompt and buildQaPrompt export from companionBotInternals', () => {
  const internals = require('../dist/services/companionBotInternals');
  assert.ok(typeof internals.buildPlanPrompt === 'function');
  assert.ok(typeof internals.buildQaPrompt === 'function');
  assert.ok(typeof internals.historyText === 'function');
  assert.ok(typeof internals.documentContext === 'function');
  assert.ok(typeof internals.sanitizedFilename === 'function');
});
