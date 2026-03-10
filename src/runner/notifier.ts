// src/runner/notifier.ts
// Discord notifications for agent events — posts to #admin channel
import { Client, GatewayIntentBits, TextChannel } from 'discord.js'
import { config } from './config.js'

let channel: TextChannel | null = null

export async function initNotifier(): Promise<void> {
  if (!config.discordToken) {
    console.log('Discord notifier disabled (no token)')
    return
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] })
  await client.login(config.discordToken)

  const ch = await client.channels.fetch(config.discordChannel)
  if (ch?.isTextBased()) channel = ch as TextChannel
  console.log('Discord notifier connected')
}

export async function notify(message: string): Promise<void> {
  if (!channel) return
  await channel.send(message).catch(err => console.error('Discord notify error:', err))
}

// Convenience methods — concise emoji-prefixed one-liners
export const notifyNeedsInput = (name: string, question: string) =>
  notify(`🟡 ${name} needs input: "${question.slice(0, 100)}"`)

export const notifyError = (name: string, exitCode: number) =>
  notify(`🔴 ${name} errored: exit code ${exitCode}`)

export const notifyStalled = (name: string, minutes: number) =>
  notify(`⚠️ ${name} stalled (no output ${minutes} min)`)

export const notifyTimeout = (name: string, minutes: number) =>
  notify(`⏰ ${name} timed out after ${minutes} min (resumable)`)

export const notifyCompleted = (name: string, minutes: number) =>
  notify(`✅ ${name} completed in ${minutes} min`)

export const notifyPlanReady = (name: string) =>
  notify(`👁️ ${name} plan ready for review`)
