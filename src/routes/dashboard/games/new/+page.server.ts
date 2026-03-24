import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';

const SEED_CARDS = [
	{
		hero_steps: ['call_to_adventure'],
		type: 'nature',
		title: 'The World Around You',
		prompt:
			'Look around you. What do you see, hear, and feel in this place? Describe the environment as if encountering it for the very first time, through fresh eyes. What calls to you here?',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['call_to_adventure'],
		type: 'history',
		title: 'Echoes of the Past',
		prompt:
			'Every place carries the weight of what came before. What stories might this site hold? Imagine the people who stood here before you and write the first line of your character\'s connection to this place.',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['crossing_the_threshold'],
		type: 'action',
		title: 'The First Step',
		prompt:
			'Your journey has truly begun. What does your character do to mark this moment? Describe a small but meaningful action that signals they have committed to what lies ahead.',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['crossing_the_threshold'],
		type: 'landmark',
		title: 'A Landmark Moment',
		prompt:
			'You have passed a point of no return. Describe what your character notices about their surroundings as they leave the familiar behind. What landmark signals that everything has changed?',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['meeting_the_mentor'],
		type: 'history',
		title: 'Wisdom from Before',
		prompt:
			'Knowledge often arrives through unexpected channels. Your character discovers something — an object, a sign, a story — that teaches them something essential. What is it, and what do they learn?',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['meeting_the_mentor'],
		type: 'sense',
		title: 'A Voice You Trust',
		prompt:
			'Guidance does not always come in words. Describe a moment when your character encounters something — a sound, a scent, a feeling — that gives them clarity about their path.',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['trials_and_growth'],
		type: 'action',
		title: 'The Obstacle',
		prompt:
			'Your character faces a challenge at this location. What stands in their way? Describe the obstacle and how your character attempts to overcome it through effort and ingenuity.',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['trials_and_growth'],
		type: 'nature',
		title: 'Finding Strength in Nature',
		prompt:
			'The natural world mirrors inner struggles. Observe your surroundings. What do you see in this environment that reflects what your character is going through? How does this place give them strength?',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['death_and_transformation'],
		type: 'sense',
		title: 'Letting Go',
		prompt:
			'Transformation requires releasing something. What must your character leave behind — a belief, a habit, a fear — in order to grow? Describe the moment of release and how it feels in this place.',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['death_and_transformation'],
		type: 'landmark',
		title: 'The Point of No Return',
		prompt:
			'Your character stands at a threshold of change. Describe how this location reflects their inner transformation. What does the space around them say about who they are becoming?',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['change_and_return'],
		type: 'nature',
		title: 'Seeing with New Eyes',
		prompt:
			'You are returning, but you are changed. Look at your surroundings again. What do you notice now that you could not have seen at the beginning of your journey?',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	},
	{
		hero_steps: ['change_and_return'],
		type: 'history',
		title: 'The Story You Carry',
		prompt:
			'Every journey creates a story worth telling. What will your character carry forward from this experience? Write the final entry in their journey — the lesson, the memory, the change that will stay with them.',
		character_category: 'both',
		card_category: 'general',
		keywords: null,
		poi_id: null
	}
];

export const actions = {
	default: async ({ locals: { supabase, getSession } }) => {
		const session = await getSession();

		if (!session) {
			return fail(401, { message: 'Unauthorized' });
		}

		const { data: newGame, error } = await supabase
			.from('games')
			.insert({
				owner_id: session.user.id,
				status: 'draft',
				visibility: 'private'
			})
			.select('game_id, id')
			.single();

		if (error) {
			console.error('Error creating game:', error);
			return fail(500, { message: 'Failed to create game' });
		}

		const seedCards = SEED_CARDS.map((card) => ({ ...card, game_id: newGame.id }));
		const { error: seedError } = await supabase.from('cards').insert(seedCards);
		if (seedError) {
			console.error('Warning: failed to seed default cards:', seedError);
		}

		throw redirect(303, `/dashboard/games/${newGame.game_id}/edit/general`);
	}
} satisfies Actions;
