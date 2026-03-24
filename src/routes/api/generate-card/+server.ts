import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Groq from 'groq-sdk';
import { GROQ_API_KEY } from '$env/static/private';
import { z } from 'zod';

const groq = new Groq({ apiKey: GROQ_API_KEY });

const journeyStepDescriptions: Record<string, string> = {
	call_to_adventure:
		'An event or challenge that disrupts the ordinary world and invites the hero to embark on a journey.',
	crossing_threshold:
		'The hero commits to the adventure and enters the special world, leaving the familiar behind.',
	meeting_mentor:
		'The hero encounters a wise figure who provides guidance, training, or magical gifts for the journey ahead.',
	trials_and_growth:
		'The hero faces challenges, makes friends, identifies foes, and grows through experiences while learning the rules of the special world.',
	death_and_transformation:
		'The hero faces their greatest fear or most difficult challenge, often a life-or-death moment that leads to profound transformation or rebirth.',
	change_and_return:
		'The hero returns to the ordinary world transformed, bringing newfound wisdom, treasure, or the power to help others.'
};

export const POST: RequestHandler = async ({ request, locals: { getSession, supabase } }) => {
	const session = await getSession();

	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const {
			type,
			journeySteps,
			characterType,
			cardCategory,
			keywords,
			poiId,
			existingTitle,
			existingPrompt,
			gameId
		} = await request.json();

		const journeyStepDetails = journeySteps
			.map((step: string) => {
				const name = step.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
				const description = journeyStepDescriptions[step] || '';
				return `${name}: ${description}`;
			})
			.join('\n');

		const characterTypeText =
			characterType === 'both'
				? 'all characters'
				: characterType === 'human'
					? 'human characters only'
					: 'non-human characters only';

		const promptSchema = z.object({
			title: z.string().max(50),
			prompt: z.string().max(300)
		});

		// Fetch existing cards for style context and deduplication
		let existingCardsContext = '';
		if (gameId) {
			const { data: existingCards } = await supabase
				.from('cards')
				.select('title, prompt')
				.eq('game_id', gameId);

			if (existingCards && existingCards.length > 0) {
				const cardList = existingCards
					.map((c: { title: string; prompt: string }, i: number) => `${i + 1}. "${c.title}" — "${c.prompt}"`)
					.join('\n');
				existingCardsContext = `\n\nEXISTING CARDS FOR THIS GAME (style reference — do NOT repeat):
${cardList}

Study the writing style, tone, and vocabulary of these cards. Your new card must feel stylistically consistent with them. The title and prompt must be entirely different from every entry above.`;
			}
		}

		// POI or keyword context
		let contextInfo = '';
		if (cardCategory === 'poi_specific' && poiId) {
			const { data: poi, error } = await supabase
				.from('pois')
				.select('name, description, contextual_data, type, tags')
				.eq('id', poiId)
				.single();

			if (!error && poi) {
				contextInfo = `
POI Context:
- Location Name: ${poi.name}
- Description: ${poi.description || 'N/A'}
- Contextual Data: ${poi.contextual_data || 'N/A'}
- POI Type: ${poi.type}
- Tags: ${poi.tags?.join(', ') || 'N/A'}

Please create a card prompt that is specifically tailored to this location and its unique characteristics.`;
			}
		} else if (cardCategory === 'general' && keywords) {
			contextInfo = `
Keywords: ${keywords}
Please incorporate these keywords into the card prompt to guide the player's experience.`;
		}

		// Refinement context
		let existingContentInfo = '';
		if (existingTitle || existingPrompt) {
			existingContentInfo = `\n\nEXISTING CONTENT TO REFINE:`;
			if (existingTitle) existingContentInfo += `\n- Current Title: "${existingTitle}"`;
			if (existingPrompt) existingContentInfo += `\n- Current Prompt: "${existingPrompt}"`;
			existingContentInfo += `\n\nIMPORTANT: Refine and improve this content while maintaining its core theme. Do not create entirely new content from scratch. Preserve the main idea, enhance clarity and engagement, and ensure alignment with the selected card type and journey steps.`;
		}

		const userPrompt = `Generate a card prompt for a location-based storytelling game.
Card Type: ${type}

Hero's Journey Steps with Descriptions:
${journeyStepDetails}

Character perspective: ${characterTypeText}
${contextInfo}${existingContentInfo}${existingCardsContext}

STRICT REQUIREMENTS:
1. Title: Maximum 25 characters (including spaces and punctuation)
2. Prompt: Maximum 150 characters (including spaces and punctuation)

The prompt should be aligned with the Hero's Journey step(s) and the card type. Must be concise and engaging, encouraging players to immerse themselves in the narrative and interact with their surroundings.
${cardCategory === 'poi_specific' ? '- Specifically tied to the location' : '- General enough for multiple locations'}

Return ONLY a valid JSON object with this exact format:
{"title": "Your title (max 25 chars)", "prompt": "Your prompt (max 150 chars)"}`;

		const systemPrompt = `You are a specialized content creation assistant for a location-based storytelling game platform. Your role is to help game creators write compelling card titles and prompts that enhance the player experience.

Your expertise includes:
- Understanding the Hero's Journey narrative framework and its stages
- Creating prompts that align with specific journey steps or generalize across multiple steps when needed
- Crafting engaging, concise content that encourages player immersion and interaction with their physical surroundings
- Adapting tone and content based on character types (human, non-human, or both)
- Incorporating location-specific context or general keywords effectively
- Matching the writing style of existing cards while ensuring uniqueness
- Refining and improving existing content while preserving the creator's original vision and intent

When existing cards are provided, study their style, tone, and vocabulary to ensure consistency. Never repeat an existing title or prompt verbatim or near-verbatim.

Always respond with ONLY a valid JSON object — no markdown, no explanation, no extra text.`;

		const completion = await groq.chat.completions.create({
			model: 'llama-3.3-70b-versatile',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			max_tokens: 200,
			temperature: 0.8,
			response_format: { type: 'json_object' }
		});

		const raw = completion.choices[0]?.message?.content;
		if (!raw) throw new Error('Empty response from AI');

		const content = promptSchema.parse(JSON.parse(raw));
		return json(content);
	} catch (error) {
		console.error('AI generation error:', error);
		return json({ error: 'Failed to generate content' }, { status: 500 });
	}
};
