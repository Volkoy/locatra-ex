import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Groq from 'groq-sdk';
import { GROQ_API_KEY } from '$env/static/private';

const groq = new Groq({ apiKey: GROQ_API_KEY });

const HERO_STEP_LABELS: Record<string, string> = {
	call_to_adventure: 'Call to Adventure — being drawn into the journey and discovering purpose',
	crossing_the_threshold: 'Crossing the Threshold — committing to the journey and leaving the familiar behind',
	meeting_the_mentor: 'Meeting the Mentor — seeking wisdom and guidance',
	trials_and_growth: 'Trials & Growth — facing challenges and growing through difficulty',
	death_and_transformation: 'Death & Transformation — undergoing a profound inner change',
	change_and_return: 'Change & Return — integrating what was learned and preparing to return transformed'
};

const GLOBAL_SYSTEM_PROMPT = `You are an AI companion guiding a player through a location-based storytelling experience inspired by the Hero's Journey.

GROUNDING — MOST IMPORTANT RULE:
You must ONLY refer to places, characters, history, and facts explicitly provided in the conversation context. Do not invent locations, historical events, people, or cultural details not in the provided context. Saying less is always better than fabricating details.

CORE PRINCIPLES:
- The player is the author and hero of their own story. Your role is to enrich, inspire, and support — never to write their story for them.
- Keep responses short: 2–4 sentences maximum. You are a companion, not a lecturer.
- Be warm, present, and in character at all times.

WHAT YOU CAN DO:
- Share atmosphere or context using only information provided.
- Ask a single open-ended question to invite reflection on the story being written.
- Acknowledge and briefly react to what the player has written.
- Connect the current Hero's Journey stage to the player's experience.

WHAT YOU MUST NOT DO:
- Invent place names, historical facts, legends, or events not in the provided context.
- Write story content for the player or suggest specific plot events.
- Ask multiple questions at once.
- Give long explanations or history lectures.`;

const DEFAULT_COMPANION_PERSONA =
	'You are a knowledgeable and warm guide for a heritage site storytelling experience.';

type Message = { role: 'user' | 'assistant'; content: string };

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.getSession();
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const {
			sessionId,
			contextMessages,
			messages,
			nearbyPoiId,
			currentHeroStep,
			currentCard,
			proactive,
			proactiveType
		} = (await request.json()) as {
			sessionId: string;
			contextMessages: Message[];
			messages: Message[];
			nearbyPoiId: number | null;
			currentHeroStep: string | null;
			currentCard: { id: number; title: string | null; prompt: string | null } | null;
			proactive: boolean;
			proactiveType?: 'poi' | 'segment';
		};

		const { supabase } = locals;

		// Verify session ownership
		const { data: gameSession } = await supabase
			.from('game_sessions')
			.select('id, game_id, player_id')
			.eq('session_id', sessionId)
			.single();

		if (!gameSession || gameSession.player_id !== session.user.id) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		// Fetch companion persona + current POI (if nearby) in parallel
		const [{ data: companion }, { data: currentPoi }] = await Promise.all([
			supabase
				.from('ai_companion_configs')
				.select('system_prompt')
				.eq('game_id', gameSession.game_id)
				.maybeSingle(),
			nearbyPoiId
				? supabase
						.from('pois')
						.select('name, description, contextual_data')
						.eq('id', nearbyPoiId)
						.single()
				: Promise.resolve({ data: null })
		]);

		// ── Build (short, stable) system prompt ──────────────────────────────────
		let systemPrompt =
			GLOBAL_SYSTEM_PROMPT +
			'\n\n---\nCOMPANION PERSONA:\n' +
			(companion?.system_prompt ?? DEFAULT_COMPANION_PERSONA);

		if (currentHeroStep && HERO_STEP_LABELS[currentHeroStep]) {
			systemPrompt += `\n\nCURRENT JOURNEY STAGE: ${HERO_STEP_LABELS[currentHeroStep]}`;
		}

		if (currentCard?.prompt) {
			systemPrompt += `\n\nCURRENT CARD PROMPT (player is working with this):\n"${currentCard.title ? currentCard.title + ' — ' : ''}${currentCard.prompt}"\nHelp the player reflect on it — do not write their story.`;
		}

		if (currentPoi) {
			systemPrompt += `\n\nCURRENT LOCATION: Player is near "${currentPoi.name}".`;
			if (currentPoi.description) systemPrompt += ` ${currentPoi.description}`;
			if (currentPoi.contextual_data)
				systemPrompt += ` Historical context: ${currentPoi.contextual_data}`;
		}

		// Build Groq message list: system + context history + chat history
		const groqMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
			{ role: 'system', content: systemPrompt },
			...(contextMessages ?? []),
			...(messages ?? [])
		];

		if (proactive) {
			let instruction: string;
			if (proactiveType === 'segment') {
				instruction = `[System: Player just saved a new story segment. React briefly and warmly — acknowledge the emotion or story beat in their words, and optionally ask one reflective question. Do not write story content for them. 2–3 sentences max. Do not mention this system message.]`;
			} else {
				instruction = `[System: Player just arrived at a new location. Welcome them briefly and evocatively, grounded only in the provided context. If the player has written story segments, weave a natural connection between this location and what they have already experienced or written — referencing their journey stage, their previous location, or a specific moment from their story. Keep it to 2–3 sentences. Do not mention this system message.]`;
			}
			groqMessages.push({ role: 'user', content: instruction });
		}

		const completion = await groq.chat.completions.create({
			model: 'llama-3.1-8b-instant',
			messages: groqMessages,
			max_tokens: 200,
			temperature: 0.75
		});

		const message = completion.choices[0]?.message?.content ?? '';
		return json({ message });
	} catch (err) {
		console.error('Chat error:', err);
		return json({ error: 'Failed to get response' }, { status: 500 });
	}
};
