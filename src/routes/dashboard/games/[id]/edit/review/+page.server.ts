import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
    const { game, characters, pois, cards, aiConfig } = await parent();
    return { game, characters, pois, cards, aiConfig };
};

export const actions: Actions = {
    publish: async ({ params, locals: { supabase, getSession } }) => {
        const session = await getSession();
        
        if (!session) {
            return fail(401, { error: 'Unauthorized' });
        }

        // Fetch game and verify ownership
        const { data: game, error: gameError } = await supabase
            .from('games')
            .select('*')
            .eq('game_id', params.id)
            .eq('owner_id', session.user.id)
            .single();

        if (gameError || !game) {
            return fail(404, { error: 'Game not found' });
        }

        const validationErrors: string[] = [];

        // Validate general information
        if (!game.title || game.title.trim() === '') {
            validationErrors.push('Game title is required');
        }
        if (!game.description || game.description.trim() === '') {
            validationErrors.push('Game description is required');
        }
        if (!game.location) {
            validationErrors.push('Game location is required');
        }

        // Validate characters
        const { data: characters, error: charsError } = await supabase
            .from('characters')
            .select('id, category')
            .eq('game_id', game.id);

        if (charsError || !characters || characters.length < 2) {
            validationErrors.push('At least 2 characters are required');
        } else {
            const humanCount = characters.filter(c => c.category === 'human').length;
            const nonHumanCount = characters.filter(c => c.category === 'non-human').length;
            if (humanCount < 1) validationErrors.push('At least 1 human character is required');
            if (nonHumanCount < 1) validationErrors.push('At least 1 non-human character is required');
        }

        // Validate POIs
        const { data: pois, error: poisError } = await supabase
            .from('pois')
            .select('id')
            .eq('game_id', game.id);

        if (poisError || !pois || pois.length < 6) {
            validationErrors.push('At least 6 POIs are required');
        }

        // Validate cards — coverage-based: all 6 steps for both human and non-human
        const { data: cards, error: cardsError } = await supabase
            .from('cards')
            .select('id, hero_steps, character_category')
            .eq('game_id', game.id);

        if (cardsError || !cards) {
            validationErrors.push('Failed to load cards');
        } else {
            const heroSteps = [
                'call_to_adventure', 'crossing_the_threshold', 'meeting_the_mentor',
                'trials_and_growth', 'death_and_transformation', 'change_and_return'
            ];
            const humanCoverage = new Set<string>();
            const nonHumanCoverage = new Set<string>();
            cards.forEach(card => {
                const cat = card.character_category as string;
                const coversHuman = cat === 'human' || cat === 'both';
                const coversNonHuman = cat === 'non-human' || cat === 'both';
                (card.hero_steps as string[] ?? []).forEach(step => {
                    if (coversHuman) humanCoverage.add(step);
                    if (coversNonHuman) nonHumanCoverage.add(step);
                });
            });
            const humanMissing = heroSteps.filter(s => !humanCoverage.has(s));
            const nonHumanMissing = heroSteps.filter(s => !nonHumanCoverage.has(s));
            if (humanMissing.length > 0) {
                validationErrors.push(`Human player journey steps missing: ${humanMissing.map(s => s.replace(/_/g, ' ')).join(', ')}`);
            }
            if (nonHumanMissing.length > 0) {
                validationErrors.push(`Non-human player journey steps missing: ${nonHumanMissing.map(s => s.replace(/_/g, ' ')).join(', ')}`);
            }
        }

        // Validate AI companion configuration
        const { data: aiConfig, error: aiError } = await supabase
            .from('ai_companion_configs')
            .select('*')
            .eq('game_id', game.id)
            .single();

        if (aiError || !aiConfig) {
            validationErrors.push('AI companion configuration is required');
        } else {
            if (!aiConfig.name || aiConfig.name.trim() === '') {
                validationErrors.push('AI companion name is required');
            }
            if (!aiConfig.tone) {
                validationErrors.push('AI companion tone is required');
            }
            if (!aiConfig.personality) {
                validationErrors.push('AI companion personality is required');
            }
            if (!aiConfig.relationship) {
                validationErrors.push('AI companion relationship is required');
            }
            if (aiConfig.humor_level === undefined || aiConfig.humor_level === null) {
                validationErrors.push('AI companion humor level is required');
            }
            if (aiConfig.formality === undefined || aiConfig.formality === null) {
                validationErrors.push('AI companion formality is required');
            }
        }

        // If validation fails, return errors
        if (validationErrors.length > 0) {
            return fail(400, { 
                error: 'Validation failed',
                validationErrors 
            });
        }

        // Update game status to published and public
        const { error } = await supabase
            .from('games')
            .update({ 
                status: 'published',
                visibility: 'public'
            })
            .eq('game_id', params.id)
            .eq('owner_id', session.user.id);

        if (error) {
            return fail(500, { error: 'Failed to publish game' });
        }

        throw redirect(303, '/dashboard');
    },

    unpublish: async ({ params, locals: { supabase, getSession } }) => {
        const session = await getSession();

        if (!session) {
            return fail(401, { error: 'Unauthorized' });
        }

        const { error } = await supabase
            .from('games')
            .update({ status: 'draft', visibility: 'private' })
            .eq('game_id', params.id)
            .eq('owner_id', session.user.id);

        if (error) {
            return fail(500, { error: 'Failed to unpublish game' });
        }

        throw redirect(303, `/dashboard/games/${params.id}/edit/review`);
    }
};
