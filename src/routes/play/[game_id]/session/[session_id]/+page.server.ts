import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import type { Database } from "$lib/database.types";

const HERO_STEP_ORDER = [
	"call_to_adventure",
	"crossing_the_threshold",
	"meeting_the_mentor",
	"trials_and_growth",
	"death_and_transformation",
	"change_and_return",
] as const;

type HeroStep = (typeof HERO_STEP_ORDER)[number];

type CardRow = {
	id: number;
	character_category: string;
	card_category: string;
	hero_steps: string[];
	poi_id: number | null;
	title: string | null;
	prompt: string | null;
	type: string | null;
};

function selectCard(
	cards: CardRow[],
	currentHeroStep: string | null,
	characterCategory: string,
	poiId: number,
	usedCardIds: number[],
): CardRow | null {
	const available = cards.filter((c) => !usedCardIds.includes(c.id));
	const catMatch = (c: CardRow) =>
		c.character_category === characterCategory ||
		c.character_category === "both";
	const stepMatch = (c: CardRow) =>
		currentHeroStep &&
		Array.isArray(c.hero_steps) &&
		c.hero_steps.includes(currentHeroStep);

	const pools = [
		available.filter(
			(c) =>
				c.card_category === "poi_specific" &&
				c.poi_id === poiId &&
				stepMatch(c) &&
				catMatch(c),
		),
		available.filter((c) =>
			c.card_category === "general" && stepMatch(c) && catMatch(c)
		),
		available.filter((c) =>
			c.card_category === "poi_specific" && c.poi_id === poiId
		),
		available.filter((c) => catMatch(c)),
		available,
	];

	const pool = pools.find((p) => p.length > 0) ?? [];
	return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { supabase } = locals;
	const session = await locals.getSession();

	if (!session) {
		redirect(302, `/play/${params.game_id}`);
	}

	// Fetch session with related data
	const { data: gameSession } = await supabase
		.from("game_sessions")
		.select("*, characters(*), games(*)")
		.eq("session_id", params.session_id)
		.single();

	if (!gameSession) {
		error(404, "Session not found");
	}

	if (gameSession.player_id !== session.user.id) {
		error(403, "Access denied");
	}

	// Completed sessions can still be viewed as a story sheet

	// Fetch game location
	let gameLocation: { longitude: number; latitude: number } | null = null;
	const { data: locationResult } = await supabase.rpc("get_game_location", {
		game_id_param: gameSession.game_id,
	});
	if (locationResult && typeof locationResult === "object") {
		gameLocation = locationResult as {
			longitude: number;
			latitude: number;
		};
	}

	// Fetch POIs for player
	const { data: pois } = await supabase.rpc("get_game_pois_for_player", {
		game_id_param: gameSession.game_id,
	});

	// RPC currently omits radius, so enrich with canonical values from pois table.
	const { data: poiRadii } = await supabase
		.from("pois")
		.select("id, radius")
		.eq("game_id", gameSession.game_id);

	const radiusById = new Map((poiRadii ?? []).map((p) => [p.id, p.radius]));
	const poisWithRadius = (pois ?? []).map((poi) => ({
		...poi,
		radius: radiusById.get(poi.id) ?? null,
	}));

	// Fetch story segments
	const { data: segments } = await supabase
		.from("story_segments")
		.select("*")
		.eq("session_id", gameSession.id)
		.order("segment_order");

	// Fetch cards
	const { data: cards } = await supabase
		.from("cards")
		.select("*")
		.eq("game_id", gameSession.game_id);

	// Fetch AI companion config
	const { data: companion } = await supabase
		.from("ai_companion_configs")
		.select("name, avatar_url")
		.eq("game_id", gameSession.game_id)
		.maybeSingle();

	const allSegments = segments ?? [];
	const visitedPoiIds = [
		...new Set(allSegments.filter((s) => s.poi_id).map((s) => s.poi_id)),
	];
	const hasIntroduction = allSegments.some((s) =>
		s.segment_type === "introduction"
	);

	return {
		session: gameSession,
		pois: poisWithRadius,
		segments: allSegments,
		cards: cards ?? [],
		visitedPoiIds,
		hasIntroduction,
		gameLocation,
		companion: companion ?? null,
		game_id: params.game_id,
		session_id: params.session_id,
	};
};

export const actions: Actions = {
	unlockPoi: async ({ request, params, locals }) => {
		const { supabase } = locals;
		const session = await locals.getSession();
		if (!session) return fail(401, { message: "Unauthorized" });

		const form = await request.formData();
		const poi_id = Number(form.get("poi_id"));
		const user_lng = parseFloat(form.get("user_lng") as string);
		const user_lat = parseFloat(form.get("user_lat") as string);

		// Get session
		const { data: gameSession } = await supabase
			.from("game_sessions")
			.select("*")
			.eq("session_id", params.session_id)
			.eq("player_id", session.user.id)
			.single();

		if (!gameSession) return fail(403, { message: "Session not found" });

		// Check not already visited
		const { data: existingSegment } = await supabase
			.from("story_segments")
			.select("id")
			.eq("session_id", gameSession.id)
			.eq("poi_id", poi_id)
			.maybeSingle();

		if (existingSegment) {
			return fail(400, { message: "POI already visited" });
		}

		// GPS proximity check
		if (
			gameSession.play_mode === "gps" && !isNaN(user_lng) &&
			!isNaN(user_lat)
		) {
			const { data: poi } = await supabase
				.from("pois")
				.select("radius")
				.eq("id", poi_id)
				.single();
			const { data: withinRange } = await supabase.rpc(
				"check_poi_proximity",
				{
					poi_id_param: poi_id,
					user_lng,
					user_lat,
					radius_meters: poi?.radius ?? 50,
				},
			);
			if (!withinRange) {
				return fail(400, { message: "Not close enough to POI" });
			}
		}

		// Fetch cards, segments, character info for card selection
		const { data: cards } = await supabase
			.from("cards")
			.select("*")
			.eq("game_id", gameSession.game_id);

		const { data: segments } = await supabase
			.from("story_segments")
			.select("card_id, poi_id")
			.eq("session_id", gameSession.id);

		const { data: character } = gameSession.character_id
			? await supabase
				.from("characters")
				.select("category")
				.eq("character_id", gameSession.character_id)
				.single()
			: { data: null };

		const { data: pois } = await supabase.rpc("get_game_pois_for_player", {
			game_id_param: gameSession.game_id,
		});

		const usedCardIds = (segments ?? [])
			.filter((s) => s.card_id !== null)
			.map((s) => s.card_id as number);

		const card = selectCard(
			cards ?? [],
			gameSession.current_hero_step,
			character?.category ?? "human",
			poi_id,
			usedCardIds,
		);

		// Compute canDeepen
		const visitedCount = (segments ?? []).filter((s) => s.poi_id).length;
		const totalPois = (pois ?? []).length;
		const remaining = totalPois - visitedCount - 1; // after this visit
		const currentStepIdx = gameSession.current_hero_step
			? HERO_STEP_ORDER.indexOf(gameSession.current_hero_step as HeroStep)
			: -1;
		const remainingSteps = currentStepIdx === -1 ? 6 : 5 - currentStepIdx;
		const canDeepen = remaining > remainingSteps && currentStepIdx >= 0;

		return { card, canDeepen, poi_id };
	},

	saveSegment: async ({ request, params, locals }) => {
		const { supabase } = locals;
		const session = await locals.getSession();
		if (!session) return fail(401, { message: "Unauthorized" });

		const form = await request.formData();
		const content = (form.get("content") as string)?.trim();
		const segment_type = (form.get("segment_type") as string) || "step";
		const card_id = form.get("card_id")
			? Number(form.get("card_id"))
			: null;
		const poi_id = Number(form.get("poi_id"));

		if (!content) return fail(400, { message: "Content is required" });
		if (!poi_id) return fail(400, { message: "POI is required" });

		const { data: gameSession } = await supabase
			.from("game_sessions")
			.select("*")
			.eq("session_id", params.session_id)
			.eq("player_id", session.user.id)
			.single();

		if (!gameSession) return fail(403, { message: "Session not found" });

		const { data: existingSegments } = await supabase
			.from("story_segments")
			.select("id")
			.eq("session_id", gameSession.id);

		const segmentOrder = (existingSegments ?? []).length;
		const heroStep = gameSession.current_hero_step;

		let nextHeroStep: string | null = heroStep;
		if (segment_type !== "deepening" && heroStep) {
			const idx = HERO_STEP_ORDER.indexOf(heroStep as HeroStep);
			nextHeroStep = HERO_STEP_ORDER[idx + 1] ?? null;
		}

		const { error: insertError } = await supabase.from("story_segments")
			.insert({
				session_id: gameSession.id,
				poi_id,
				card_id,
				hero_step: heroStep as
					| Database["public"]["Enums"]["hero_steps"]
					| null,
				segment_type:
					segment_type as Database["public"]["Enums"]["segment_type"],
				content,
				segment_order: segmentOrder,
			});

		if (insertError) {
			return fail(500, { message: "Failed to save story segment" });
		}

		await supabase
			.from("game_sessions")
			.update({
				current_hero_step: nextHeroStep as
					| Database["public"]["Enums"]["hero_steps"]
					| null,
			})
			.eq("id", gameSession.id);

		return {
			success: true,
			completed: nextHeroStep === null,
			nextStep: nextHeroStep ?? null,
		};
	},

	saveIntroduction: async ({ request, params, locals }) => {
		const { supabase } = locals;
		const session = await locals.getSession();
		if (!session) return fail(401, { message: "Unauthorized" });

		const form = await request.formData();
		const content = (form.get("content") as string)?.trim();

		if (!content) return fail(400, { message: "Content is required" });

		const { data: gameSession } = await supabase
			.from("game_sessions")
			.select("id, game_id")
			.eq("session_id", params.session_id)
			.eq("player_id", session.user.id)
			.single();

		if (!gameSession) return fail(403, { message: "Session not found" });

		const { data: existingSegments } = await supabase
			.from("story_segments")
			.select("id")
			.eq("session_id", gameSession.id);

		const order = (existingSegments ?? []).length;

		await supabase.from("story_segments").insert({
			session_id: gameSession.id,
			segment_type: "introduction",
			content,
			segment_order: order,
		});

		await supabase
			.from("game_sessions")
			.update({ status: "active", current_hero_step: HERO_STEP_ORDER[0] })
			.eq("id", gameSession.id);

		return { success: true };
	},

	saveReflection: async ({ request, params, locals }) => {
		const { supabase } = locals;
		const session = await locals.getSession();
		if (!session) return fail(401, { message: "Unauthorized" });

		const form = await request.formData();
		const content = (form.get("content") as string)?.trim();
		if (!content) return fail(400, { message: "Content is required" });

		const { data: gameSession } = await supabase
			.from("game_sessions")
			.select("id")
			.eq("session_id", params.session_id)
			.eq("player_id", session.user.id)
			.single();

		if (!gameSession) return fail(403, { message: "Session not found" });

		const { data: existingSegments } = await supabase
			.from("story_segments")
			.select("id")
			.eq("session_id", gameSession.id);

		await supabase.from("story_segments").insert({
			session_id: gameSession.id,
			segment_type: "reflection",
			content,
			segment_order: (existingSegments ?? []).length,
		});

		await supabase
			.from("game_sessions")
			.update({
				status: "completed",
				completed_at: new Date().toISOString(),
			})
			.eq("id", gameSession.id);

		return { success: true };
	},
};
