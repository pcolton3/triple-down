import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { TEE_TIME_SCHEMA, cleanTeeTimeResult } from '@/lib/assistant/tee-times';
import { EMAIL_REPLY_SCHEMA, ORGANIZER_REPLY_SCHEMA, PLANNER_REPLY_SCHEMA, type AssistantReply, type PlannerReply } from '@/lib/assistant/changes';
import { eventContext, plannerContext, systemPrompt, type AssistantMode } from '@/lib/assistant/prompt';
import { loadGolfEvent, loadRoster, loadSignups } from '@/lib/events/golf-events';
import { supabase } from '@/lib/supabase/client';

export const runtime = 'nodejs';
// Tee-time searches read several course pages; give them room.
export const maxDuration = 300;

const MODEL = 'claude-opus-5-5';
// Claude Opus 5.5 list prices in dollars per million tokens, for the app's own monthly cap.
const PRICE = { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 };
const MAX_TURNS = 16;
const MAX_CHARS = 2000;

type ChatTurn = { role: 'user' | 'assistant'; content: string };

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function cleanHistory(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const turns = value
    .filter((turn): turn is ChatTurn => Boolean(turn) && (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string')
    .map((turn) => ({ role: turn.role, content: turn.content.trim().slice(0, turn.role === 'user' ? MAX_CHARS : MAX_CHARS * 2) }))
    .filter((turn) => turn.content);
  const recent = turns.slice(-MAX_TURNS);
  while (recent.length && recent[0].role !== 'user') recent.shift();
  if (!recent.length || recent[recent.length - 1].role !== 'user') return null;
  // Merge accidental repeats so roles alternate.
  return recent.reduce<ChatTurn[]>((merged, turn) => {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) last.content = `${last.content}\n\n${turn.content}`;
    else merged.push({ ...turn });
    return merged;
  }, []);
}

// The Vercel project stores the key as TripleTrackClaudeAI; ANTHROPIC_API_KEY also works.
function apiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.TripleTrackClaudeAI || '';
}

function centsFor(usage: Anthropic.Beta.BetaUsage) {
  const searches = (usage as { server_tool_use?: { web_search_requests?: number } | null }).server_tool_use?.web_search_requests ?? 0;
  return (
    ((usage.input_tokens * PRICE.input +
      (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      usage.output_tokens * PRICE.output) /
      1_000_000) *
      100 +
    searches * 1 // web search is $10 per 1,000 searches
  );
}

function apiFailure(error: unknown) {
  if (error instanceof Anthropic.RateLimitError) return fail(429, 'The assistant is busy. Try again in a minute.');
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return fail(503, "The assistant's API key isn't working.");
  if (error instanceof Anthropic.APIError) {
    console.error('assistant API error', error.status, error.message);
    const message = error.status === 400 && /credit balance|spend limit|usage limit/i.test(error.message) ? 'The assistant is out of credit for now.' : 'The assistant had a problem. Try again.';
    // The API's own message (no secrets in it) helps diagnose from the browser's network tab.
    return NextResponse.json({ error: message, detail: `${error.status}: ${error.message}`.slice(0, 500) }, { status: 502 });
  }
  console.error('assistant error', error);
  return fail(502, "Couldn't reach the assistant. Try again.");
}

export async function POST(request: NextRequest) {
  if (!apiKey()) return fail(503, "The assistant isn't set up yet.");

  let body: { code?: unknown; mode?: unknown; key?: unknown; messages?: unknown; today?: unknown; draft?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, 'Bad request.');
  }
  const mode: AssistantMode = body.mode === 'organizer' || body.mode === 'planner' || body.mode === 'email' || body.mode === 'teetimes' ? body.mode : 'player';
  const needsKey = mode === 'organizer' || mode === 'email' || mode === 'teetimes';
  // Planning happens before an event exists; those turns share one daily bucket.
  const code = mode === 'planner' ? 'NEWEVENT' : typeof body.code === 'string' ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) : '';
  const key = typeof body.key === 'string' ? body.key : '';
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const messages = cleanHistory(body.messages);
  if (!code || !messages) return fail(400, 'Bad request.');

  let context: string;
  if (mode === 'planner') {
    context = plannerContext(body.draft, today);
  } else {
    const event = await loadGolfEvent(code).catch(() => null);
    if (!event) return fail(404, 'Event not found.');
    try {
      // Organizer data only comes back for a valid organizer key; emails never go to the model.
      context = needsKey
        ? eventContext(event, today, { signups: await loadSignups(code, key) })
        : eventContext(event, today, { roster: await loadRoster(code) });
    } catch {
      return fail(needsKey ? 403 : 500, needsKey ? 'Organizer link is not valid.' : "Couldn't load the event.");
    }
  }

  // Daily limits and the monthly spend cap live in Supabase (supabase-assistant.sql).
  const { data: turn, error: turnError } = await supabase.rpc('assistant_take_turn', { p_code: code, p_mode: needsKey ? 'organizer' : mode });
  if (turnError) return fail(503, "The assistant isn't set up yet (run supabase-assistant.sql).");
  if (turn === 'monthly_cap') return fail(429, 'The assistant has hit its monthly limit. It will be back next month.');
  if (turn !== 'ok') return fail(429, "That's a lot of questions for one day. Try again tomorrow.");

  const schema = { organizer: ORGANIZER_REPLY_SCHEMA, planner: PLANNER_REPLY_SCHEMA, email: EMAIL_REPLY_SCHEMA, teetimes: TEE_TIME_SCHEMA, player: null }[mode];
  const tools: Anthropic.Beta.BetaToolUnion[] =
    mode === 'planner'
      ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }]
      : mode === 'teetimes'
        ? [
            { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
            { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5, max_content_tokens: 15000 },
          ]
        : [];
  const client = new Anthropic({ apiKey: apiKey() });
  const conversation: Anthropic.Beta.BetaMessageParam[] = [...messages];
  let response: Anthropic.Beta.BetaMessage | null = null;
  let cents = 0;
  try {
    // A web search can pause the turn; continue it a couple of times.
    for (let round = 0; round < (mode === 'teetimes' ? 5 : 3); round += 1) {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: mode === 'planner' || mode === 'teetimes' ? 16000 : 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [
          { type: 'text', text: systemPrompt(mode), cache_control: { type: 'ephemeral' } },
          { type: 'text', text: context },
        ],
        messages: conversation,
        ...(tools.length ? { tools } : {}),
        output_config: {
          effort: mode === 'player' || mode === 'email' ? 'low' : 'medium',
          ...(schema ? { format: { type: 'json_schema' as const, schema: schema as unknown as Record<string, unknown> } } : {}),
        },
      });
      cents += centsFor(response.usage);
      if (response.stop_reason !== 'pause_turn') break;
      conversation.push({ role: 'assistant', content: response.content });
    }
  } catch (error) {
    if (cents) await supabase.rpc('assistant_record_cost', { p_code: code, p_mode: needsKey ? 'organizer' : mode, p_cents: Math.round(cents * 100) / 100 });
    return apiFailure(error);
  }
  await supabase.rpc('assistant_record_cost', { p_code: code, p_mode: needsKey ? 'organizer' : mode, p_cents: Math.round(cents * 100) / 100 });
  if (!response) return fail(502, "Couldn't reach the assistant. Try again.");

  const empty = mode === 'planner' ? { draft: null } : { changes: [] };
  if (response.stop_reason === 'refusal') return NextResponse.json({ reply: "Sorry, I can't help with that one.", ...empty });
  if (response.stop_reason === 'max_tokens') return NextResponse.json({ reply: 'That answer got too long. Try asking for less at once.', ...empty });
  if (response.stop_reason === 'pause_turn') return NextResponse.json({ reply: 'That search took too long. Ask again, maybe a bit more specific?', ...empty });

  const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('').trim();
  const lost = 'Sorry, I lost my train of thought. Ask again?';
  if (mode === 'player') return NextResponse.json({ reply: text || lost, changes: [] } satisfies AssistantReply);

  if (mode === 'teetimes') {
    try {
      return NextResponse.json(cleanTeeTimeResult(JSON.parse(text)));
    } catch {
      return fail(502, 'The search came back garbled. Try again.');
    }
  }

  if (mode === 'email') {
    try {
      const parsed = JSON.parse(text) as { subject?: unknown; body?: unknown };
      return NextResponse.json({ subject: typeof parsed.subject === 'string' ? parsed.subject : '', body: typeof parsed.body === 'string' ? parsed.body : '' });
    } catch {
      return fail(502, 'The draft came back garbled. Try again.');
    }
  }

  try {
    const parsed = JSON.parse(text) as Partial<AssistantReply & PlannerReply>;
    const reply = typeof parsed.reply === 'string' ? parsed.reply : '';
    if (mode === 'planner') return NextResponse.json({ reply, draft: parsed.draft && typeof parsed.draft === 'object' ? parsed.draft : null } satisfies PlannerReply);
    return NextResponse.json({ reply, changes: Array.isArray(parsed.changes) ? parsed.changes : [] } satisfies AssistantReply);
  } catch {
    return NextResponse.json({ reply: text || lost, ...empty });
  }
}
