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

const SEGMENT_TYPE_LABELS: Record<string, string> = {
	introduction: 'Introduction',
	call_to_adventure: 'Call to Adventure',
	crossing_the_threshold: 'Crossing the Threshold',
	meeting_the_mentor: 'Meeting the Mentor',
	trials_and_growth: 'Trials & Growth',
	death_and_transformation: 'Death & Transformation',
	change_and_return: 'Change & Return',
	deepening: 'Deepening',
	reflection: 'Reflection'
};

const GLOBAL_SYSTEM_PROMPT = `You are an AI companion guiding a player through a location-based storytelling experience inspired by the Hero's Journey. You have access to the player's story so far, the game's locations and characters, and their current stage in the journey.

GROUNDING — THIS IS THE MOST IMPORTANT RULE:
You must ONLY refer to places, characters, history, and facts that are explicitly provided to you in this prompt. Do not invent locations, historical events, people, or cultural details that are not in the provided context. If you do not have specific information about something, speak in general atmospheric or emotional terms rather than fabricating details. Saying less is always better than making something up.

CORE PRINCIPLES:
- The player is the author and hero of their own story. Your role is to enrich, inspire, and support — never to write their story for them or suggest what should happen next.
- Use only the location descriptions, historical context, character details, and game information provided below to inform what you say about places and people.
- Be genuinely curious about the player's story and reflect it back to them thoughtfully.
- Keep responses short: 2–4 sentences maximum. You are a companion, not a lecturer.
- Be warm, present, and in character at all times.

WHAT YOU CAN DO:
- Share atmosphere or context about a nearby location using only the information provided — never invented facts.
- Ask a single open-ended question to invite reflection on the story being written.
- Acknowledge and briefly react to what the player has written, showing you are paying attention.
- Connect the current Hero's Journey stage to the player's experience at this location.
- Reference the game's characters by name if it helps ground the conversation.

WHAT YOU MUST NOT DO:
- Do not invent place names, historical facts, legends, people, or events not in the provided context.
- Do not write story content on behalf of the player or suggest specific plot events.
- Do not ask multiple questions at once.
- Do not give long explanations or history lectures.
- Do not break the immersive, in-character tone.
- If you are unsure about a detail, stay vague and atmospheric rather than guessing.`;

const DEFAULT_COMPANION_PROMPT =
	'You are a knowledgeable and warm guide for a heritage site storytelling experience. Help the player connect with their surroundings and their inner journey.';

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.getSession();
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { sessionId, messages, nearbyPoiId, currentHeroStep, currentCard, proactive } = await request.json();

		const { supabase } = locals;

		// Verify session ownership and get session data
		const { data: gameSession } = await supabase
			.from('game_sessions')
			.select('id, game_id, player_id, character_name, character_id, characters(name, summary)')
			.eq('session_id', sessionId)
			.single();

		if (!gameSession || gameSession.player_id !== session.user.id) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		// Fetch all context in parallel
		const [
			{ data: companion },
			{ data: game },
			{ data: characters },
			{ data: pois },
			{ data: segments },
			{ data: poi }
		] = await Promise.all([
			supabase
				.from('ai_companion_configs')
				.select('name, system_prompt')
				.eq('game_id', gameSession.game_id)
				.maybeSingle(),
			supabase
				.from('games')
				.select('title, description')
				.eq('id', gameSession.game_id)
				.single(),
			supabase
				.from('characters')
				.select('name, summary, category')
				.eq('game_id', gameSession.game_id),
			supabase
				.from('pois')
				.select('name, description, contextual_data, type')
				.eq('game_id', gameSession.game_id),
			supabase
				.from('story_segments')
				.select('segment_type, hero_step, content, card_id')
				.eq('session_id', gameSession.id)
				.order('segment_order'),
			nearbyPoiId
				? supabase
						.from('pois')
						.select('name, description, contextual_data')
						.eq('id', nearbyPoiId)
						.single()
				: Promise.resolve({ data: null })
		]);

		// Fetch cards drawn in this session
		const drawnCardIds = (segments ?? []).map((s) => s.card_id).filter((id): id is number => id !== null);
		const { data: drawnCards } = drawnCardIds.length > 0
			? await supabase.from('cards').select('id, title, prompt').in('id', drawnCardIds)
			: { data: [] };
		const cardMap = new Map((drawnCards ?? []).map((c) => [c.id, c]));

		// ── Build system prompt ──────────────────────────────────────────────────

		let systemPrompt = GLOBAL_SYSTEM_PROMPT;

		// Author's companion persona
		systemPrompt += `\n\n---\nCOMPANION PERSONA (set by the game author):\n${companion?.system_prompt ?? DEFAULT_COMPANION_PROMPT}`;

		// Game info
		if (game) {
			systemPrompt += `\n\n---\nGAME: "${game.title}"`;
			if (game.description) systemPrompt += `\n${game.description}`;
		}

		// All characters in this game
		if (characters && characters.length > 0) {
			const charList = characters
				.map((c) => `- ${c.name} (${c.category})${c.summary ? `: ${c.summary}` : ''}`)
				.join('\n');
			systemPrompt += `\n\n---\nCHARACTERS IN THIS GAME:\n${charList}`;
		}

		// All POIs in this game (so companion knows every location that exists)
		if (pois && pois.length > 0) {
			const poiList = pois
				.map((p) => {
					let entry = `- ${p.name}`;
					if (p.type) entry += ` [${p.type}]`;
					if (p.description) entry += `: ${p.description}`;
					if (p.contextual_data) entry += ` (${p.contextual_data})`;
					return entry;
				})
				.join('\n');
			systemPrompt += `\n\n---\nLOCATIONS IN THIS GAME (these are the only real places you may reference):\n${poiList}`;
		}

		// Story written so far (with the card prompt that inspired each segment)
		if (segments && segments.length > 0) {
			const storyText = segments
				.map((s) => {
					const label = s.hero_step
						? (SEGMENT_TYPE_LABELS[s.hero_step] ?? s.hero_step)
						: (SEGMENT_TYPE_LABELS[s.segment_type] ?? s.segment_type);
					const card = s.card_id ? cardMap.get(s.card_id) : null;
					let entry = `[${label}]`;
					if (card?.prompt) {
						entry += `\nCard prompt given to player: "${card.title ? card.title + ' — ' : ''}${card.prompt}"`;
					}
					entry += `\nPlayer wrote: ${s.content}`;
					return entry;
				})
				.join('\n\n');
			systemPrompt += `\n\n---\nSTORY WRITTEN SO FAR:\n${storyText}`;
		}

		// Current hero's journey stage
		if (currentHeroStep && HERO_STEP_LABELS[currentHeroStep]) {
			systemPrompt += `\n\n---\nCURRENT JOURNEY STAGE: ${HERO_STEP_LABELS[currentHeroStep]}`;
		}

		// Card prompt the player is currently working with
		if (currentCard?.prompt) {
			systemPrompt += `\n\n---\nCURRENT CARD PROMPT (the player has just drawn this and is about to write):\n"${currentCard.title ? currentCard.title + ' — ' : ''}${currentCard.prompt}"\nBe aware of this prompt when responding — you can reference it to help the player reflect, but do not write their story for them.`;
		}

		// Current location (the POI the player is at right now)
		if (poi) {
			systemPrompt += `\n\n---\nCURRENT LOCATION: The player is near "${poi.name}".`;
			if (poi.description) systemPrompt += ` ${poi.description}`;
			if (poi.contextual_data) systemPrompt += ` Historical/cultural context: ${poi.contextual_data}`;
		}

		// Player identity
		const characterDetails = gameSession.characters as { name: string; summary: string | null } | null;
		const playerLabel = characterDetails?.name
			? `${gameSession.character_name} (playing as ${characterDetails.name})`
			: gameSession.character_name;

const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
			{ role: 'system', content: systemPrompt }
		];

		if (proactive) {
			const storyContext = segments && segments.length > 0
				? ' They have already written parts of their story — acknowledge the journey so far if relevant.'
				: '';
			chatMessages.push({
				role: 'user',
				content: `[System: ${playerLabel} has just arrived at this location.${storyContext} Proactively greet them with something brief and evocative, grounded only in the provided location and game context. 2–3 sentences max. Do not mention receiving a system message.]`
			});
		} else {
			chatMessages.push(...messages);
		}

		const completion = await groq.chat.completions.create({
			model: 'llama-3.1-8b-instant',
			messages: chatMessages,
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
