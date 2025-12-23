import { redirect, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ depends, locals: { supabase, session } }) => {
  depends('supabase:auth')
  if (!session) {
    throw redirect(303, '/auth')
  }

  const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching games:', error);
        return { games: [] };
    }

  return { games: games || [] };
}

export const actions = {
  delete: async ({ request, locals: { supabase, session } }) => {
    if (!session) {
      return fail(401, { message: 'Unauthorized' });
    }

    const formData = await request.formData();
    const gameId = formData.get('gameId');

    if (!gameId || typeof gameId !== 'string') {
      return fail(400, { message: 'Game ID is required' });
    }

    const { error } = await supabase
      .from('games')
      .delete()
      .eq('game_id', gameId)
      .eq('owner_id', session.user.id);

    if (error) {
      console.error('Error deleting game:', error);
      return fail(500, { message: 'Failed to delete game' });
    }

    return { success: true };
  },

  publish: async ({ request, locals: { supabase, session } }) => {
    if (!session) {
      return fail(401, { message: 'Unauthorized' });
    }

    const formData = await request.formData();
    const gameId = formData.get('gameId');

    if (!gameId || typeof gameId !== 'string') {
      return fail(400, { message: 'Game ID is required' });
    }

    // Fetch game and verify ownership
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('game_id', gameId)
      .eq('owner_id', session.user.id)
      .single();

    if (gameError || !game) {
      return fail(404, { message: 'Game not found' });
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
        message: 'Cannot publish: Game validation failed',
        validationErrors 
      });
    }

    const { error } = await supabase
      .from('games')
      .update({ 
        status: 'published',
        visibility: 'public'
      })
      .eq('game_id', gameId)
      .eq('owner_id', session.user.id);

    if (error) {
      console.error('Error publishing game:', error);
      return fail(500, { message: 'Failed to publish game' });
    }

    return { success: true };
  },

  unpublish: async ({ request, locals: { supabase, session } }) => {
    if (!session) {
      return fail(401, { message: 'Unauthorized' });
    }

    const formData = await request.formData();
    const gameId = formData.get('gameId');

    if (!gameId || typeof gameId !== 'string') {
      return fail(400, { message: 'Game ID is required' });
    }

    const { error } = await supabase
      .from('games')
      .update({ 
        status: 'draft',
        visibility: 'private'
      })
      .eq('game_id', gameId)
      .eq('owner_id', session.user.id);

    if (error) {
      console.error('Error unpublishing game:', error);
      return fail(500, { message: 'Failed to unpublish game' });
    }

    return { success: true };
  }
} satisfies Actions;