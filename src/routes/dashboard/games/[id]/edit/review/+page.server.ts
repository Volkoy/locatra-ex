import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {

    const { session } = await safeGetSession();
    
    if (!session) {
        throw redirect(303, '/auth');
    }

    // Fetch game data
    const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('game_id', params.id)
        .eq('owner_id', session.user.id)
        .single();

    if (gameError || !game) {
        throw redirect(303, '/dashboard');
    }

    // Use RPC function to get location coordinates from PostGIS
    let locationData = null;
    if (game.id) {
        const { data: locationResult } = await supabase
            .rpc('get_game_location', { game_id_param: game.id });
        
        if (locationResult && typeof locationResult === 'object') {
            const coords = locationResult as { longitude: number; latitude: number };
            locationData = {
                lng: coords.longitude,
                lat: coords.latitude,
                address: ''
            };
        }
    }

    // Fetch characters
    const { data: characters } = await supabase
        .from('characters')
        .select('*')
        .eq('game_id', game.id)
        .order('created_at', { ascending: true });

    // Use RPC function to get POIs with location coordinates from PostGIS
    const { data: poisWithLocation } = await supabase
        .rpc('get_game_pois_with_location', { game_id_param: game.id });

    // Fetch Cards
    const { data: cards } = await supabase
        .from('cards')
        .select('*')
        .eq('game_id', game.id)
        .order('created_at', { ascending: true });

    // Fetch AI Config
    const { data: aiConfig } = await supabase
        .from('ai_companion_configs')
        .select('*')
        .eq('game_id', game.id)
        .single();

    return {
        game,
        locationData,
        characters: characters || [],
        pois: poisWithLocation || [],
        cards: cards || [],
        aiConfig: aiConfig || null
    };
};

export const actions: Actions = {
    publish: async ({ params, locals: { supabase, safeGetSession } }) => {
        const { session } = await safeGetSession();
        
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

        // Validation constants
        const MIN_CHARACTERS = 2;
        const MIN_POIS = 6;
        const MIN_CARDS = 10;
        const ALL_HERO_STEPS = 6;

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
            .select('id')
            .eq('game_id', game.id);

        if (charsError || !characters || characters.length < MIN_CHARACTERS) {
            validationErrors.push(`At least ${MIN_CHARACTERS} characters are required`);
        }

        // Validate POIs
        const { data: pois, error: poisError } = await supabase
            .from('pois')
            .select('id')
            .eq('game_id', game.id);

        if (poisError || !pois || pois.length < MIN_POIS) {
            validationErrors.push(`At least ${MIN_POIS} POIs are required`);
        }

        // Validate cards and hero's journey steps
        const { data: cards, error: cardsError } = await supabase
            .from('cards')
            .select('id, hero_steps')
            .eq('game_id', game.id);

        if (cardsError || !cards || cards.length < MIN_CARDS) {
            validationErrors.push(`At least ${MIN_CARDS} cards are required`);
        }

        // Validate all 6 hero's journey steps are covered
        if (cards && cards.length >= MIN_CARDS) {
            const allSteps = new Set<string>();
            cards.forEach(card => {
                card.hero_steps?.forEach((step: string) => allSteps.add(step));
            });

            if (allSteps.size < ALL_HERO_STEPS) {
                validationErrors.push(`All ${ALL_HERO_STEPS} hero's journey steps must be covered`);
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
    }
};
