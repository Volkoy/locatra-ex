import { z } from 'zod';

export const generalInfoSchema = z.object({
    title: z.string().min(3, 'Title is required').max(100),
    description: z.string().min(3, 'Description is required').max(1000),
    location: z.object({
        lat: z.number(),
        lng: z.number()
    }).nullable().optional(),
    cover_image_url: z.url().optional().nullable().or(z.literal('')),
    categories: z.array(z.string()).default([])
});

export const characterSchema = z.object({
    id: z.number().optional(), 
    character_id: z.string().optional(), 
    game_id: z.number().optional(), 
    name: z.string().min(1, 'Name is required').max(100),
    summary: z.string().min(1, 'Summary is required').max(1000),
    slug: z.string().optional(),
    image_url: z.url().optional().nullable().or(z.literal('')),
    category: z.enum(['human', 'non-human'], {
        error: 'Category is required'
    })
});

export const poiSchema = z.object({
    id: z.number().optional(), 
    game_id: z.number().optional(), 
    name: z.string().min(3, 'Name is required').max(200),
    description: z.string().min(3, 'Description is required').max(1000),
    contextual_data: z.string().min(3, 'Contextual data is required').max(2000),
    image_url: z.url().optional().nullable().or(z.literal('')),
    type: z.enum(['nature', 'history', 'sense', 'action', 'landmark'], {
        error: 'Type is required'
    }),
    tags: z.array(z.string()).default([]),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
});

export const cardSchema = z.object({
    id: z.number().optional(),
    game_id: z.number().optional(),
    title: z.string().min(3, 'Title is required').max(200),
    prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(2000),
    type: z.enum(['nature', 'history', 'sense', 'action', 'landmark'], {
        error: 'Please select a card type'
    }),
    hero_steps: z.array(z.enum([
        'call_to_adventure',
        'crossing_the_threshold',
        'meeting_the_mentor',
        'trials_and_growth',
        'death_and_transformation',
        'change_and_return'
    ])).min(1, 'Select at least one journey step'),
    character_category: z.enum(['human', 'non-human', 'both'], {
        error: 'Please select a character type'
    }),
    card_category: z.enum(['general', 'poi_specific']).default('general'),
    keywords: z.string().optional(), // For general cards
    poi_id: z.number().optional().nullable() // For POI-specific cards
});

export const aiCompanionSchema = z.object({
    id: z.number().optional(),
    game_id: z.number().optional(),
    name: z.string().min(1, 'Name is required').max(100),
    avatar_url: z.string().url().optional().nullable().or(z.literal('')),
    tone: z.enum(['enthusiastic', 'calm', 'mysterious', 'professional', 'playful', 'serious'], {
        error: 'Please select a tone'
    }),
    personality: z.enum(['mentor', 'friend', 'sage', 'explorer', 'historian', 'storyteller'], {
        error: 'Please select a personality'
    }),
    relationship: z.enum(['guide', 'companion', 'rival', 'mysterious-ally'], {
        error: 'Please select a relationship'
    }),
    humor_level: z.number().min(0).max(2).default(0),
    formality: z.number().min(0).max(2).default(1),
    additional_context: z.string().max(2000).optional()
});

export type CardFormData = z.infer<typeof cardSchema>;
export type CharacterFormData = z.infer<typeof characterSchema>;
export type POIFormData = z.infer<typeof poiSchema>;
export type AICompanionFormData = z.infer<typeof aiCompanionSchema>;