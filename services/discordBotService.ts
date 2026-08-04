/**
 * Discord companion bot for Tagvico.
 *
 * Provides full Telegram parity for allowlisted Discord users:
 *   - bounded document Q&A / follow-ups with cited originals
 *   - one attachment upload → Paperless consumption + optional metadata
 *   - active actions, action proposals, approve / reject buttons
 *
 * Channel routing:
 *   - Allowlisted DMs: always processed (commands, questions, uploads).
 *   - Optional DISCORD_HOME_CHANNEL_ID: slash commands, bot mentions, and
 *     replies to the bot are processed.  Unaddressed messages are ignored so
 *     no privileged Message Content intent is required.
 *   - All other channels: silently ignored.
 *
 * Per-user history is keyed by (userId, channelId) so DM and home-channel
 * conversations remain isolated.
 */

import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Interaction,
  TextChannel,
  DMChannel,
  ChannelType,
  Partials,
} from 'discord.js';
import axios from 'axios';
import {
  safeText,
  normalizedUrl,
  errorMessage,
  parseJsonObject,
  extractDocumentIds,
  cleanAnswerCitations,
  chunkDiscordText,
  sanitizedFilename,
  answerDocumentQuestion,
  buildActionApprovalPayload,
  classifyPaperlessUpload,
  ChatTurn,
  PaperlessDocument,
} from './companionBotInternals';
import { TelegramPaperlessClient } from './telegramPaperlessClient';
import { encryptSecret } from './secretBox';

const config = require('../config/config');
const AIServiceFactory = require('./aiServiceFactory');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscordUserConfig {
  discordId: string;
  paperlessToken: string;
  paperlessUrl: string;
  householdId?: string;
  memberId?: string;
}

interface TextGenerator {
  generateText(prompt: string): Promise<string>;
  analyzeDocument(
    content: string,
    tags?: string[],
    correspondents?: string[],
    documentTypes?: string[],
    id?: string
  ): Promise<{ document?: Record<string, unknown>; error?: unknown }>;
}

// Discord snowflake: 17-20 digit unsigned integer string
const SNOWFLAKE_RE = /^\d{17,20}$/;

// CDN URL validation: must be HTTPS and on cdn.discordapp.com
const DISCORD_CDN_RE = /^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\//;

function isAllowedDiscordCdnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username && !url.password && !url.port &&
      ['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname);
  } catch {
    return false;
  }
}

function cleanDiscordMention(value: string): string {
  return safeText(value).replace(/<@!?\d+>/g, '').trim();
}

// Maximum 10 MiB default (hard maximum also 10 MiB per spec)
const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const HARD_MAX_FILE_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Allowlist parser
// ---------------------------------------------------------------------------

export function parseDiscordUsers(
  usersJson: string,
  defaultPaperlessUrl: string
): Map<string, DiscordUserConfig> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(usersJson || '[]');
  } catch {
    parsed = [];
  }
  const entries: unknown[] = Array.isArray(parsed) ? parsed : [];
  const users = new Map<string, DiscordUserConfig>();
  for (const raw of entries) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const discordId = safeText(item.discordId ?? item.discord_id ?? item.id);
    if (!SNOWFLAKE_RE.test(discordId)) continue;
    const paperlessToken = safeText(item.paperlessToken ?? item.paperless_token ?? item.token);
    if (!paperlessToken) continue;
    const paperlessUrl = safeText(item.paperlessUrl ?? item.paperless_url ?? defaultPaperlessUrl);
    if (!paperlessUrl) continue;
    const householdId = safeText(item.householdId ?? item.household_id);
    const memberId = safeText(item.memberId ?? item.member_id);
    users.set(discordId, {
      discordId,
      paperlessToken,
      paperlessUrl,
      ...(householdId ? { householdId } : {}),
      ...(memberId ? { memberId } : {}),
    });
  }
  return users;
}

// ---------------------------------------------------------------------------
// Discord bot service class
// ---------------------------------------------------------------------------

class DiscordBotService {
  private client: Client | null = null;
  private users = new Map<string, DiscordUserConfig>();
  // History keyed by `${userId}:${channelId}`
  private readonly histories = new Map<string, ChatTurn[]>();
  private homeChannelId = '';
  private running = false;

  start(): void {
    if (config.discord.enabled !== 'yes' || this.running) return;
    const botToken = safeText(config.discord.botToken);
    if (!botToken) {
      console.warn('[Discord] Bot is enabled but DISCORD_BOT_TOKEN is empty');
      return;
    }
    try {
      this.users = parseDiscordUsers(
        config.discord.usersJson,
        config.paperless.apiUrl || ''
      );
    } catch (error) {
      console.warn(`[Discord] DISCORD_USERS_JSON is invalid: ${errorMessage(error)}`);
      return;
    }
    if (!this.users.size) {
      console.warn('[Discord] Bot is enabled but no valid users are allowlisted');
      return;
    }

    this.homeChannelId = safeText(config.discord.homeChannelId);
    if (this.homeChannelId && !SNOWFLAKE_RE.test(this.homeChannelId)) {
      console.warn('[Discord] DISCORD_HOME_CHANNEL_ID is not a valid Discord snowflake; home-channel routing is disabled');
      this.homeChannelId = '';
    }

    // Validate household/member links
    const actionCenter = require('../models/actionCenter');
    for (const user of this.users.values()) {
      if (!user.householdId || !user.memberId) continue;
      const member = actionCenter.getMemberSecretRecord(user.householdId, user.memberId);
      const samePaperless =
        normalizedUrl(user.paperlessUrl) === normalizedUrl(config.paperless.apiUrl);
      if (!member || !samePaperless) {
        console.warn(
          `[Discord] Action Center link ignored for Discord user ${user.discordId}: ` +
            'household/member mapping or Paperless URL is invalid'
        );
        delete user.householdId;
        delete user.memberId;
        continue;
      }
      actionCenter.setPaperlessToken(
        user.householdId,
        user.memberId,
        encryptSecret(user.paperlessToken)
      );
    }

    // Create client with minimum required intents.
    // We do NOT request MessageContent privileged intent.
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });

    this.client.on(Events.ClientReady, async (ready) => {
      console.log(`[Discord] Logged in as ${ready.user.tag} for ${this.users.size} allowlisted user(s)`);
      await this.registerSlashCommands(botToken, ready.user.id).catch((error) =>
        console.warn(`[Discord] Slash command registration failed: ${errorMessage(error)}`)
      );
    });

    this.client.on(Events.InteractionCreate, (interaction: Interaction) => {
      this.handleInteraction(interaction).catch((error) =>
        console.warn(`[Discord] Interaction error: ${errorMessage(error)}`)
      );
    });

    this.client.on(Events.MessageCreate, (message: Message) => {
      this.handleMessage(message).catch((error) =>
        console.warn(`[Discord] Message error: ${errorMessage(error)}`)
      );
    });

    this.client.on(Events.Error, (error) => {
      console.warn(`[Discord] Client error: ${errorMessage(error)}`);
    });

    this.running = true;
    this.client.login(botToken).catch((error) => {
      console.warn(`[Discord] Login failed: ${errorMessage(error)}`);
      this.running = false;
      this.client?.destroy();
      this.client = null;
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.histories.clear();
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {
        // Ignore destroy errors during shutdown
      }
      this.client = null;
    }
  }

  // -------------------------------------------------------------------------
  // Slash command registration
  // -------------------------------------------------------------------------

  private async registerSlashCommands(botToken: string, clientId: string): Promise<void> {
    const commands = [
      new SlashCommandBuilder()
        .setName('start')
        .setDescription('Show help and privacy boundaries'),
      new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Forget your in-memory conversation history'),
      new SlashCommandBuilder()
        .setName('actions')
        .setDescription('Show active household actions'),
      new SlashCommandBuilder()
        .setName('privacy')
        .setDescription('Show data-processing information'),
    ].map((cmd) => cmd.toJSON());

    const rest = new REST().setToken(botToken);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
  }

  // -------------------------------------------------------------------------
  // Routing
  // -------------------------------------------------------------------------

  private userFor(userId: string): DiscordUserConfig | null {
    return this.users.get(userId) || null;
  }

  private historyKey(userId: string, channelId: string): string {
    return `${userId}:${channelId}`;
  }

  private isHomeChannel(channelId: string): boolean {
    return Boolean(this.homeChannelId) && channelId === this.homeChannelId;
  }

  private isDm(channelType: ChannelType | null): boolean {
    return channelType === ChannelType.DM;
  }

  // -------------------------------------------------------------------------
  // Message handler (for DM questions + home-channel mentions/replies)
  // -------------------------------------------------------------------------

  private async handleMessage(message: Message): Promise<void> {
    // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;

    const userId = message.author.id;
    const user = this.userFor(userId);

    const inDm = this.isDm(message.channel.type);
    const inHome = this.isHomeChannel(message.channelId);

    // In DMs: always allowed for allowlisted users
    if (inDm) {
      if (!user) return; // silently ignore unknown users
      await this.handleDmMessage(message, user);
      return;
    }

    // In home channel: only process if bot was mentioned or message is a reply
    // to a bot message.  Do NOT read arbitrary message content (no privileged intent).
    if (inHome) {
      if (!user) return;
      if (!(await this.isBotAddressed(message))) return;
      await this.handleHomeChannelMessage(message, user);
      return;
    }

    // All other channels: silently ignore
  }

  /** Returns true when the bot was @mentioned or the message is a reply to a bot message. */
  private async isBotAddressed(message: Message): Promise<boolean> {
    if (!this.client?.user) return false;
    if (message.mentions.has(this.client.user.id)) return true;
    if (message.reference?.messageId) {
      try {
        const referenced = await message.fetchReference();
        return referenced.author.id === this.client.user.id;
      } catch {
        return false;
      }
    }
    return false;
  }

  private async handleDmMessage(message: Message, user: DiscordUserConfig): Promise<void> {
    // Attachments: exactly one file upload
    if (message.attachments.size === 1 && message.attachments.size > 0) {
      return this.handleUpload(message, user, false);
    }
    if (message.attachments.size > 1) {
      await this.sendText(message.channel, 'Please send exactly one file per upload.');
      return;
    }
    const text = safeText(message.content);
    if (!text) return;
    // Commands
    if (text.startsWith('/')) {
      await this.handleTextCommand(text, message, user, false);
      return;
    }
    await this.handleQuestion(message, user, false);
  }

  private async handleHomeChannelMessage(message: Message, user: DiscordUserConfig): Promise<void> {
    // Attachments in home channel → ephemeral download not applicable here,
    // but we can upload documents
    if (message.attachments.size === 1) {
      return this.handleUpload(message, user, true);
    }
    if (message.attachments.size > 1) {
      await this.sendText(message.channel, 'Please send exactly one file per upload.');
      return;
    }
    const text = safeText(message.content);
    if (!text) return;
    if (text.startsWith('/')) {
      await this.handleTextCommand(text, message, user, true);
      return;
    }
    await this.handleQuestion(message, user, true);
  }

  // -------------------------------------------------------------------------
  // Interaction handler (slash commands + buttons)
  // -------------------------------------------------------------------------

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isButton()) {
      return this.handleButton(interaction as ButtonInteraction);
    }
    if (interaction.isChatInputCommand()) {
      return this.handleSlashCommand(interaction as ChatInputCommandInteraction);
    }
  }

  // -------------------------------------------------------------------------
  // Slash commands
  // -------------------------------------------------------------------------

  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = this.userFor(userId);

    const inDm = interaction.channel?.type === ChannelType.DM;
    const inHome = this.isHomeChannel(interaction.channelId);

    // Only process allowlisted users in DMs or the home channel
    if (!user || (!inDm && !inHome)) {
      return;
    }

    const histKey = this.historyKey(userId, interaction.channelId);
    const ephemeral = inHome; // home channel replies are ephemeral

    switch (interaction.commandName) {
      case 'start':
        await interaction.reply({
          content:
            'Ask me to find or read documents in your Paperless archive, including follow-up questions. ' +
            'Send a PDF or photo to upload and classify it. Use `/clear` to forget this in-memory conversation.\n\n' +
            this.privacyText(),
          ephemeral,
        });
        break;

      case 'clear':
        this.histories.delete(histKey);
        await interaction.reply({
          content: 'Conversation cleared. Nothing was stored in a database.',
          ephemeral,
        });
        break;

      case 'privacy':
        await interaction.reply({ content: this.privacyText(), ephemeral });
        break;

      case 'actions':
        if (!user.householdId || !user.memberId) {
          await interaction.reply({
            content:
              'Link this Discord user to a valid `householdId` and `memberId` in `DISCORD_USERS_JSON` to use the Action Center.',
            ephemeral,
          });
          return;
        }
        await interaction.deferReply({ ephemeral });
        try {
          const actionCenter = require('../models/actionCenter');
          const actions = (actionCenter.listCases(user.householdId) as Record<string, unknown>[])
            .filter(
              (item) =>
                !['done', 'dismissed'].includes(String(item.status))
            )
            .slice(0, 12);
          const text = actions.length
            ? actions
                .map(
                  (item) =>
                    `• ${safeText(item.title)}${item.dueAt ? ` — due ${String(item.dueAt).slice(0, 10)}` : ''}`
                )
                .join('\n')
            : 'No active household actions.';
          await interaction.editReply({ content: text });
        } catch (error) {
          await interaction.editReply({ content: `Could not load actions: ${errorMessage(error)}` });
        }
        break;

      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  }

  // -------------------------------------------------------------------------
  // Text-prefixed commands (typed as /cmd in a message)
  // -------------------------------------------------------------------------

  private async handleTextCommand(
    text: string,
    message: Message,
    user: DiscordUserConfig,
    inHomeChannel: boolean
  ): Promise<void> {
    const command = text.split(/\s+/)[0].toLowerCase();
    const histKey = this.historyKey(message.author.id, message.channelId);
    switch (command) {
      case '/clear':
        this.histories.delete(histKey);
        await this.sendText(
          message.channel,
          'Conversation cleared. Nothing was stored in a database.'
        );
        break;
      case '/privacy':
        await this.sendText(message.channel, this.privacyText());
        break;
      case '/actions':
        if (!user.householdId || !user.memberId) {
          await this.sendText(
            message.channel,
            'Link this Discord user to a valid `householdId` and `memberId` in `DISCORD_USERS_JSON` to use the Action Center.'
          );
          return;
        }
        try {
          const actionCenter = require('../models/actionCenter');
          const actions = (actionCenter.listCases(user.householdId) as Record<string, unknown>[])
            .filter((item) => !['done', 'dismissed'].includes(String(item.status)))
            .slice(0, 12);
          await this.sendText(
            message.channel,
            actions.length
              ? actions
                  .map(
                    (item) =>
                      `• ${safeText(item.title)}${item.dueAt ? ` — due ${String(item.dueAt).slice(0, 10)}` : ''}`
                  )
                  .join('\n')
              : 'No active household actions.'
          );
        } catch (error) {
          await this.sendText(message.channel, `Could not load actions: ${errorMessage(error)}`);
        }
        break;
      case '/start':
      default:
        await this.sendText(
          message.channel,
          'Ask me to find or read documents in your Paperless archive, including follow-up questions. ' +
            'Send a PDF or photo to upload and classify it. Use `/clear` to forget this in-memory conversation.\n\n' +
            this.privacyText()
        );
    }
    // Suppress the unused variable warning
    void inHomeChannel;
  }

  // -------------------------------------------------------------------------
  // Q&A handler
  // -------------------------------------------------------------------------

  private async handleQuestion(
    message: Message,
    user: DiscordUserConfig,
    inHomeChannel: boolean
  ): Promise<void> {
    const question = cleanDiscordMention(message.content);
    if (!question) return;

    const histKey = this.historyKey(message.author.id, message.channelId);
    const history = this.histories.get(histKey) || [];

    await (message.channel as TextChannel).sendTyping().catch(() => {});

    let result;
    try {
      result = await answerDocumentQuestion(
        this.ai(),
        this.paperlessFor(user),
        history,
        question,
        Number(config.discord.maxDocuments)
      );
    } catch (error) {
      console.warn(`[Discord] Document question failed: ${errorMessage(error)}`);
      await this.sendText(
        message.channel,
        'I could not complete that document request. Please try again.'
      );
      return;
    }

    if (!result.documents.length) {
      await this.sendText(
        message.channel,
        `I found no documents for "${result.query}". Try a correspondent, title, date, or a more specific phrase.`
      );
      return;
    }

    // Send the answer
    await this.sendTextWithDocumentButtons(
      message.channel,
      message.author.id,
      result.answer,
      result.documents.filter((document) => result.citedDocumentIds.includes(document.id)),
      inHomeChannel
    );

    // Possibly propose an action
    if (result.plan?.proposeAction === true && user.householdId && user.memberId && result.actionDocument) {
      const actionCenter = require('../models/actionCenter');
      const approval = actionCenter.createApproval(
        user.householdId,
        null,
        user.memberId,
        'action.create',
        buildActionApprovalPayload(result.plan, result.actionDocument)
      );
      await this.sendApprovalButtons(
        message.channel,
        message.author.id,
        approval.id,
        safeText(approval.payload.title)
      );
    } else if (
      result.plan?.proposeAction === true &&
      user.householdId &&
      user.memberId
    ) {
      await this.sendText(
        message.channel,
        'I found several possible documents, so I did not guess. Name one Paperless document ID and ask me to create the action again.'
      );
    }

    const nextHistory = [...history, { question, answer: result.answer }].slice(
      -Number(config.discord.historyTurns)
    );
    this.histories.set(histKey, nextHistory);
  }

  // -------------------------------------------------------------------------
  // File upload handler
  // -------------------------------------------------------------------------

  private async handleUpload(
    message: Message,
    user: DiscordUserConfig,
    inHomeChannel: boolean
  ): Promise<void> {
    const attachment = message.attachments.first();
    if (!attachment) return;

    const maxBytes = Math.min(
      Number(config.discord.maxFileBytes) || DEFAULT_MAX_FILE_BYTES,
      HARD_MAX_FILE_BYTES
    );

    // Validate CDN URL
    if (!isAllowedDiscordCdnUrl(attachment.url)) {
      await this.sendText(
        message.channel,
        'The attachment URL is not a recognized Discord CDN URL. Upload rejected.'
      );
      return;
    }

    // Check declared size
    if (attachment.size && attachment.size > maxBytes) {
      await this.sendText(
        message.channel,
        `The file is ${(attachment.size / 1024 / 1024).toFixed(1)} MiB. The maximum is ${(maxBytes / 1024 / 1024).toFixed(0)} MiB. Send a smaller file or upload it in Paperless.`
      );
      return;
    }

    const filename = sanitizedFilename(
      attachment.name || `discord-upload-${message.id}`,
      `discord-upload-${message.id}`
    );

    await (message.channel as TextChannel).sendTyping().catch(() => {});
    await this.sendText(message.channel, 'Uploading to Paperless and waiting for OCR…');

    // Download from Discord CDN
    let buffer: Buffer;
    try {
      const response = await axios.get<ArrayBuffer>(attachment.url, {
        responseType: 'arraybuffer',
        timeout: Number(config.discord.uploadTimeoutSeconds) * 1000,
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        maxRedirects: 0,
      });
      buffer = Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download attachment: ${errorMessage(error)}`);
    }

    // Double-check downloaded size
    if (buffer.length > maxBytes) {
      await this.sendText(
        message.channel,
        `Downloaded file is ${(buffer.length / 1024 / 1024).toFixed(1)} MiB and exceeds the ${(maxBytes / 1024 / 1024).toFixed(0)} MiB limit.`
      );
      return;
    }

    const mimeType =
      attachment.contentType ||
      (filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

    const paperless = this.paperlessFor(user);
    const taskId = await paperless.uploadDocument(buffer, filename, mimeType);
    const consumed = await paperless.waitForConsumption(
      taskId,
      Number(config.discord.uploadTimeoutSeconds) * 1000
    );

    if (!consumed.documentId) throw new Error('Paperless finished without returning a document id');

    if (consumed.duplicate) {
      await this.sendTextWithDocumentButtons(
        message.channel,
        message.author.id,
        'Paperless detected a duplicate. I kept the existing document.',
        [{ id: consumed.documentId, title: 'Existing document' }],
        inHomeChannel
      );
      return;
    }

    if (config.discord.automaticUploadMetadata !== 'yes') {
      await this.sendTextWithDocumentButtons(
        message.channel,
        message.author.id,
        'Uploaded successfully. Automatic Discord metadata is off, so Paperless consumption rules remain in control.',
        [{ id: consumed.documentId, title: filename }],
        inHomeChannel
      );
      return;
    }

    const result = await classifyPaperlessUpload(
      this.ai(),
      paperless,
      consumed.documentId,
      (error) => console.warn(`[Discord] Document note was not added: ${errorMessage(error)}`)
    );
    await this.sendTextWithDocumentButtons(
      message.channel,
      message.author.id,
      result,
      [{ id: consumed.documentId, title: filename }],
      inHomeChannel
    );
  }

  // -------------------------------------------------------------------------
  // Button interaction handler
  // -------------------------------------------------------------------------

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const userId = interaction.user.id;
    const user = this.userFor(userId);

    // Validate the button is in an allowed context
    const inDm = interaction.channel?.type === ChannelType.DM;
    const inHome = this.isHomeChannel(interaction.channelId);

    if (!user || (!inDm && !inHome)) {
      await interaction.reply({
        content: 'You are not authorized to use this button.',
        ephemeral: true,
      });
      return;
    }

    const data = safeText(interaction.customId);

    // --- Approval buttons ---
    const approvalMatch = data.match(/^discord_approval:(approve|reject):([0-9a-f-]{36}):(\d{17,20})$/i);
    if (approvalMatch) {
      // Reject foreign user attempting to use another user's button
      const originator = approvalMatch[3];
      if (originator !== userId) {
        await interaction.reply({
          content: 'This approval button belongs to another user.',
          ephemeral: true,
        });
        return;
      }
      if (!user.householdId || !user.memberId) {
        await interaction.reply({
          content: 'Approval requires a linked household account.',
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply({ ephemeral: inHome });
      try {
        const actionCenter = require('../models/actionCenter');
        const decision = approvalMatch[1] === 'approve' ? 'approved' : 'rejected';
        actionCenter.decideApproval(user.householdId, approvalMatch[2], user.memberId, decision);
        const result =
          decision === 'approved'
            ? await require('./approvalExecutor').executeApproval(
                user.householdId,
                approvalMatch[2],
                user.memberId
              )
            : null;
        const syncFailed = result?.result?.sync?.ok === false;
        await interaction.editReply({
          content:
            decision === 'approved'
              ? syncFailed
                ? 'Approved and saved locally. Paperless sync failed and will retry automatically.'
                : 'Approved and synced with Paperless.'
              : 'Proposal rejected.',
        });
      } catch (error) {
        console.warn(`[Discord] Approval decision failed: ${errorMessage(error)}`);
        await interaction.editReply({
          content: 'This proposal is no longer pending or could not be processed.',
        });
      }
      return;
    }

    // --- Document download buttons ---
    const docMatch = data.match(/^discord_doc:(\d+):(\d{17,20})$/);
    if (docMatch) {
      // Reject foreign user or replayed interaction
      const originator = docMatch[2];
      if (originator !== userId) {
        await interaction.reply({
          content: 'This download button belongs to another user.',
          ephemeral: true,
        });
        return;
      }
      const documentId = Number(docMatch[1]);
      // Home channel downloads must be ephemeral
      await interaction.deferReply({ ephemeral: inHome });
      try {
        const file = await this.paperlessFor(user).downloadDocument(documentId);
        const maxDownloadBytes = Math.min(
          Number(config.discord.maxFileBytes) || DEFAULT_MAX_FILE_BYTES,
          HARD_MAX_FILE_BYTES
        );
        if (file.buffer.length > maxDownloadBytes) {
          await interaction.editReply({
            content: `That original is ${(file.buffer.length / 1024 / 1024).toFixed(1)} MiB and exceeds this bot's ${(maxDownloadBytes / 1024 / 1024).toFixed(0)} MiB download limit. Open it in Paperless instead.`,
          });
          return;
        }
        await interaction.editReply({
          content: `Paperless document ${documentId}`,
          files: [
            {
              attachment: file.buffer,
              name: sanitizedFilename(file.filename, 'document.pdf'),
            },
          ],
        });
      } catch (error) {
        await interaction.editReply({
          content: `Could not download the document: ${errorMessage(error)}`,
        });
      }
      return;
    }

    await interaction.reply({ content: 'Unknown button action.', ephemeral: true });
  }

  // -------------------------------------------------------------------------
  // AI and Paperless helpers
  // -------------------------------------------------------------------------

  private ai(): TextGenerator {
    const service = AIServiceFactory.getService() as TextGenerator;
    if (typeof service.generateText !== 'function') {
      throw new Error('The selected AI provider does not support conversational answers');
    }
    return service;
  }

  private paperlessFor(user: DiscordUserConfig): TelegramPaperlessClient {
    return new TelegramPaperlessClient(user.paperlessUrl, user.paperlessToken);
  }

  private privacyText(): string {
    const provider = safeText(config.aiProvider);
    const location =
      provider === 'ollama' || provider === 'compatible'
        ? 'the configured local/compatible endpoint'
        : `the configured ${provider} provider`;
    return (
      `Privacy: Discord bot messages are not end-to-end encrypted. Your questions and retrieved OCR text are sent to ${location}. ` +
      'Tagvico keeps conversation history in memory only, per Discord user and channel, until `/clear` or restart. ' +
      'AI totals are summaries, not accounting-grade results.'
    );
  }

  // -------------------------------------------------------------------------
  // Message sending helpers
  // -------------------------------------------------------------------------

  private async sendText(
    channel: Message['channel'],
    text: string
  ): Promise<void> {
    const chunks = chunkDiscordText(text);
    for (const chunk of chunks) {
      await (channel as TextChannel | DMChannel).send({ content: chunk });
    }
  }

  private async sendTextWithDocumentButtons(
    channel: Message['channel'],
    requestingUserId: string,
    text: string,
    documents: PaperlessDocument[],
    ephemeral: boolean // unused for now; buttons are always non-ephemeral in channel messages
  ): Promise<void> {
    const chunks = chunkDiscordText(text);
    for (let i = 0; i < chunks.length; i += 1) {
      const isLast = i === chunks.length - 1;
      const components: ActionRowBuilder<ButtonBuilder>[] = [];

      if (isLast && documents.length) {
        // Up to 5 document buttons per row, up to 5 rows (25 total), but we cap at 8
        const capped = documents.slice(0, Number(config.discord.maxDocuments) || 8);
        // Build rows of up to 5 buttons
        for (let rowStart = 0; rowStart < capped.length; rowStart += 5) {
          const row = new ActionRowBuilder<ButtonBuilder>();
          const rowDocs = capped.slice(rowStart, rowStart + 5);
          for (const doc of rowDocs) {
            const label = `📄 ${safeText(doc.title) || `Document ${doc.id}`}`.slice(0, 80);
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`discord_doc:${doc.id}:${requestingUserId}`)
                .setLabel(label)
                .setStyle(ButtonStyle.Secondary)
            );
          }
          components.push(row);
        }
      }

      await (channel as TextChannel | DMChannel).send({
        content: chunks[i],
        ...(components.length ? { components } : {}),
      });
    }
    void ephemeral;
  }

  private async sendApprovalButtons(
    channel: Message['channel'],
    requestingUserId: string,
    approvalId: string,
    title: string
  ): Promise<void> {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`discord_approval:approve:${approvalId}:${requestingUserId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`discord_approval:reject:${approvalId}:${requestingUserId}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger)
    );
    await (channel as TextChannel | DMChannel).send({
      content: `Proposed action: **${title}**\n\nNothing changes until you approve.`,
      components: [row],
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const discordBotService = new DiscordBotService();
module.exports = Object.assign(discordBotService, {
  DiscordBotService,
  parseDiscordUsers,
  internals: {
    parseJsonObject,
    extractDocumentIds,
    cleanAnswerCitations,
    chunkDiscordText,
    sanitizedFilename,
    SNOWFLAKE_RE,
    DISCORD_CDN_RE,
    isAllowedDiscordCdnUrl,
    cleanDiscordMention,
  },
});
