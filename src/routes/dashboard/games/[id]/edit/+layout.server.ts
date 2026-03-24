import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

type ValidationCheck = {
    label: string;
    status: "complete" | "incomplete" | "warning";
    description: string;
};

type SectionValidation = {
    sectionKey: string;
    status: "error" | "warning" | "success";
    checks: ValidationCheck[];
};

export const load: LayoutServerLoad = async (
    { params, locals: { getSession, supabase } },
) => {
    const session = await getSession();

    if (!session) {
        throw redirect(303, "/auth");
    }

    // Verify game ownership and get internal ID
    const { data: game, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("game_id", params.id)
        .eq("owner_id", session.user.id)
        .single();

    if (gameError || !game) {
        throw redirect(303, "/dashboard");
    }

    // Load all game data in parallel
    const [
        { data: characters },
        { data: pois },
        { data: cards },
        { data: aiConfig },
    ] = await Promise.all([
        supabase.from("characters").select("*").eq("game_id", game.id),
        supabase.from("pois").select("*").eq("game_id", game.id),
        supabase.from("cards").select("*").eq("game_id", game.id),
        supabase.from("ai_companion_configs").select("*").eq("game_id", game.id)
            .single(),
    ]);

    // Compute validation for each section
    const validations = computeValidations({
        game,
        characters: characters || [],
        pois: pois || [],
        cards: cards || [],
        aiConfig: aiConfig || null,
    });

    return {
        session,
        user: session.user,
        game,
        characters: characters || [],
        pois: pois || [],
        cards: cards || [],
        aiConfig: aiConfig || null,
        validations,
    };
};

function computeValidations(data: {
    game: Record<string, unknown>;
    characters: Record<string, unknown>[];
    pois: Record<string, unknown>[];
    cards: Record<string, unknown>[];
    aiConfig: Record<string, unknown> | null;
}): Record<string, SectionValidation> {
    const validations: Record<string, SectionValidation> = {};

    // General Information validation
    const generalChecks: ValidationCheck[] = [
        {
            label: "Game Title",
            status: data.game.title ? "complete" : "incomplete",
            description: "Required",
        },
        {
            label: "Game Description",
            status: data.game.description ? "complete" : "incomplete",
            description: "Required",
        },
        {
            label: "Game Location",
            status: data.game.location ? "complete" : "incomplete",
            description: "Required",
        },
        {
            label: "Cover Image",
            status: data.game.image_url ? "complete" : "warning",
            description: "Recommended",
        },
        {
            label: "Categories",
            status: Array.isArray(data.game.categories) &&
                    data.game.categories.length > 0
                ? "complete"
                : "warning",
            description: "At least one recommended",
        },
    ];
    validations["General Information"] = {
        sectionKey: "General Information",
        status: getSectionStatus(generalChecks),
        checks: generalChecks,
    };

    // Characters validation
    const charCount = data.characters.length;
    const humanChars =
        data.characters.filter((c: Record<string, unknown>) =>
            c.category === "human"
        ).length;
    const nonHumanChars =
        data.characters.filter((c: Record<string, unknown>) =>
            c.category === "non-human"
        ).length;
    const charsWithoutImages =
        data.characters.filter((c: Record<string, unknown>) => !c.image_url)
            .length;

    const characterChecks: ValidationCheck[] = [
        {
            label: "Minimum Characters",
            status: charCount >= 2 ? "complete" : "incomplete",
            description: `At least 2 required (${charCount} created)`,
        },
        {
            label: "Human Character",
            status: humanChars >= 1 ? "complete" : "incomplete",
            description: `At least 1 human required (${humanChars} created)`,
        },
        {
            label: "Non-Human Character",
            status: nonHumanChars >= 1 ? "complete" : "incomplete",
            description:
                `At least 1 non-human required (${nonHumanChars} created)`,
        },
    ];

    if (charCount > 0) {
        characterChecks.push({
            label: "Character Images",
            status: charsWithoutImages === 0 ? "complete" : "warning",
            description: `${
                charCount - charsWithoutImages
            }/${charCount} have images`,
        });
    }

    validations["Characters"] = {
        sectionKey: "Characters",
        status: getSectionStatus(characterChecks),
        checks: characterChecks,
    };

    // POIs validation
    const poiCount = data.pois.length;
    const poisWithoutImages =
        data.pois.filter((p: Record<string, unknown>) => !p.image_url).length;
    const poisWithoutDescription =
        data.pois.filter((p: Record<string, unknown>) =>
            !p.description || (p.description as string).trim() === ""
        ).length;
    const poisWithoutType =
        data.pois.filter((p: Record<string, unknown>) => !p.type).length;

    const poiChecks: ValidationCheck[] = [
        {
            label: "Minimum POIs",
            status: poiCount >= 6 ? "complete" : "incomplete",
            description: `At least 6 required (${poiCount} created)`,
        },
    ];

    if (poiCount > 0) {
        poiChecks.push({
            label: "POI Images",
            status: poisWithoutImages === 0 ? "complete" : "warning",
            description: `${
                poiCount - poisWithoutImages
            }/${poiCount} have images`,
        });

        if (poisWithoutDescription > 0) {
            poiChecks.push({
                label: "POI Descriptions",
                status: "warning",
                description: `${poisWithoutDescription} POI${
                    poisWithoutDescription > 1 ? "s" : ""
                } missing descriptions`,
            });
        }

        if (poisWithoutType > 0) {
            poiChecks.push({
                label: "POI Types",
                status: "warning",
                description: `${poisWithoutType} POI${
                    poisWithoutType > 1 ? "s" : ""
                } missing type`,
            });
        }
    }

    validations["Points of Interest"] = {
        sectionKey: "Points of Interest",
        status: getSectionStatus(poiChecks),
        checks: poiChecks,
    };

    // Cards validation — coverage-based: every hero step must have ≥1 card for each character type
    const heroSteps = [
        "call_to_adventure",
        "crossing_the_threshold",
        "meeting_the_mentor",
        "trials_and_growth",
        "death_and_transformation",
        "change_and_return",
    ];

    const cardCount = data.cards.length;

    // Build per-step coverage maps for human and non-human players
    const humanCoverageMap: Record<string, number> = {};
    const nonHumanCoverageMap: Record<string, number> = {};

    data.cards.forEach((card: Record<string, unknown>) => {
        if (!Array.isArray(card.hero_steps)) return;
        const cat = card.character_category as string;
        const coversHuman = cat === "human" || cat === "both";
        const coversNonHuman = cat === "non-human" || cat === "both";
        card.hero_steps.forEach((step: string) => {
            if (coversHuman) humanCoverageMap[step] = (humanCoverageMap[step] || 0) + 1;
            if (coversNonHuman) nonHumanCoverageMap[step] = (nonHumanCoverageMap[step] || 0) + 1;
        });
    });

    const humanMissingSteps = heroSteps.filter((s) => !humanCoverageMap[s]);
    const nonHumanMissingSteps = heroSteps.filter((s) => !nonHumanCoverageMap[s]);
    const humanThinSteps = heroSteps.filter((s) => humanCoverageMap[s] === 1);
    const nonHumanThinSteps = heroSteps.filter((s) => nonHumanCoverageMap[s] === 1);

    const generalTypesUsed = new Set<string>();
    let poiSpecificCount = 0;
    data.cards.forEach((card: Record<string, unknown>) => {
        if (card.card_category === "general" && card.type) {
            generalTypesUsed.add(card.type as string);
        }
        if (card.card_category === "poi_specific") poiSpecificCount++;
    });

    const formatSteps = (steps: string[]) =>
        steps.map((s) => s.replace(/_/g, " ")).join(", ");

    const cardChecks: ValidationCheck[] = [
        // Required: human player coverage
        {
            label: "Human Player Coverage",
            status: humanMissingSteps.length === 0 ? "complete" : "incomplete",
            description: humanMissingSteps.length === 0
                ? "All 6 journey steps covered for human players"
                : `Steps missing for human players: ${formatSteps(humanMissingSteps)}`,
        },
        // Required: non-human player coverage
        {
            label: "Non-Human Player Coverage",
            status: nonHumanMissingSteps.length === 0 ? "complete" : "incomplete",
            description: nonHumanMissingSteps.length === 0
                ? "All 6 journey steps covered for non-human players"
                : `Steps missing for non-human players: ${formatSteps(nonHumanMissingSteps)}`,
        },
        // Recommended: general card type variety
        {
            label: "General Card Variety",
            status: generalTypesUsed.size >= 3
                ? "complete"
                : cardCount === 0
                ? "incomplete"
                : "warning",
            description: `${generalTypesUsed.size}/5 types used in general cards (3+ recommended)`,
        },
        // Recommended: some POI-specific cards
        {
            label: "POI-Specific Cards",
            status: poiSpecificCount > 0 ? "complete" : "warning",
            description: poiSpecificCount > 0
                ? `${poiSpecificCount} POI-specific card${poiSpecificCount > 1 ? "s" : ""}`
                : "Add POI-specific cards for location variety",
        },
        // Recommended: minimum total card count
        {
            label: "Recommended Card Count",
            status: cardCount >= 10 ? "complete" : cardCount > 0 ? "warning" : "incomplete",
            description: `${cardCount}/10 cards created (10+ recommended)`,
        },
    ];

    // Recommended: step depth (only add if required checks pass, to avoid piling on)
    if (humanMissingSteps.length === 0 && nonHumanMissingSteps.length === 0) {
        if (humanThinSteps.length > 0 || nonHumanThinSteps.length > 0) {
            cardChecks.push({
                label: "Step Depth",
                status: "warning",
                description: "Some steps have only 1 card — 2+ recommended per step per character type",
            });
        }
    }

    validations["Card Prompts"] = {
        sectionKey: "Card Prompts",
        status: getSectionStatus(cardChecks),
        checks: cardChecks,
    };

    // AI Companion validation
    const aiChecks: ValidationCheck[] = [
        {
            label: "Companion Name",
            status: data.aiConfig?.name ? "complete" : "incomplete",
            description: "Required",
        },
        {
            label: "Tone of Voice",
            status: data.aiConfig?.tone ? "complete" : "incomplete",
            description: "Required",
        },
        {
            label: "Personality Type",
            status: data.aiConfig?.personality ? "complete" : "incomplete",
            description: "Required",
        },
        {
            label: "Relationship with Player",
            status: data.aiConfig?.relationship ? "complete" : "incomplete",
            description: "Required",
        },
        {
            label: "Formality Level",
            status: data.aiConfig?.formality !== null && data.aiConfig?.formality !== undefined ? "complete" : "incomplete",
            description: "Required",
        },
        {
            label: "Humor Level",
            status: data.aiConfig?.humor_level !== null && data.aiConfig?.humor_level !== undefined ? "complete" : "incomplete",
            description: "Required",
        },
        {
            label: "Avatar Image",
            status: data.aiConfig?.avatar_url ? "complete" : "warning",
            description: "Optional",
        },
        {
            label: "Additional Instructions",
            status: data.aiConfig?.additional_context ? "complete" : "warning",
            description: "Optional",
        },
    ];

    validations["AI Companion"] = {
        sectionKey: "AI Companion",
        status: getSectionStatus(aiChecks),
        checks: aiChecks,
    };

    return validations;
}

function getSectionStatus(
    checks: ValidationCheck[],
): "error" | "warning" | "success" {
    const hasIncomplete = checks.some((c) => c.status === "incomplete");
    const hasWarning = checks.some((c) => c.status === "warning");

    if (hasIncomplete) return "error";
    if (hasWarning) return "warning";
    return "success";
}
