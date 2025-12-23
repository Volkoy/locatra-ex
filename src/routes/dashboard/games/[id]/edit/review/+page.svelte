<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import {
		MapPin,
		Users,
		CreditCard,
		MessageCircle,
		SquarePen,
		Play,
		Save,
		Globe,
		Sparkles,
		TriangleAlert,
		CircleCheck,
		Image
	} from 'lucide-svelte';

	let { data, params } = $props();

	const MIN_CHARACTERS = 2;
	const MIN_POIS = 6;
	const MIN_CARDS = 10;
	const MIN_GENERAL_CARDS = 5;
	const MIN_CARD_TYPES = 3;
	const RECOMMENDED_CARD_TYPES = 4;
	const ALL_HERO_STEPS = 6;
	const MIN_CARDS_PER_STEP = 2;

	// Validation checks
	const validation = $derived.by(() => {
		const issues = [];
		const warnings = [];

		// General Info validation
		if (!data.game.title || data.game.title.trim() === '') {
			issues.push({
				section: 'General Information',
				message: 'Game title is required',
				link: 'general'
			});
		}
		if (!data.game.description || data.game.description.trim() === '') {
			issues.push({
				section: 'General Information',
				message: 'Game description is required',
				link: 'general'
			});
		}
		if (!data.game.location) {
			issues.push({
				section: 'General Information',
				message: 'Game location is required',
				link: 'general'
			});
		}
		if (!data.game.image_url) {
			warnings.push({
				section: 'General Information',
				message: 'Cover image is recommended',
				link: 'general'
			});
		}
		if (!data.game.categories || data.game.categories.length === 0) {
			warnings.push({
				section: 'General Information',
				message: 'At least one category is recommended',
				link: 'general'
			});
		}

		// Characters validation
		if (data.characters.length < MIN_CHARACTERS) {
			issues.push({
				section: 'Characters',
				message: `At least ${MIN_CHARACTERS} characters are required (${data.characters.length} created)`,
				link: 'characters'
			});
		}

		// Check character types diversity
		const humanChars = data.characters.filter((c) => c.category === 'human').length;
		const nonHumanChars = data.characters.filter((c) => c.category === 'non-human').length;
		if (data.characters.length >= MIN_CHARACTERS && (humanChars === 0 || nonHumanChars === 0)) {
			warnings.push({
				section: 'Characters',
				message: 'Consider adding both human and non-human characters for variety',
				link: 'characters'
			});
		}

		// Check for missing character images
		const charsWithoutImages = data.characters.filter((c) => !c.image_url).length;
		if (charsWithoutImages > 0) {
			warnings.push({
				section: 'Characters',
				message: `${charsWithoutImages} character${charsWithoutImages > 1 ? 's' : ''} missing image${charsWithoutImages > 1 ? 's' : ''}`,
				link: 'characters'
			});
		}

		// POIs validation
		if (data.pois.length < MIN_POIS) {
			issues.push({
				section: 'Points of Interest',
				message: `At least ${MIN_POIS} POIs are required (${data.pois.length} created)`,
				link: 'pois'
			});
		}

		// Check POI types diversity
		const poiTypes = new Set(data.pois.map((p) => p.type));
		if (poiTypes.size < 3 && data.pois.length >= MIN_POIS) {
			warnings.push({
				section: 'Points of Interest',
				message: 'Consider using at least 3 different POI types for variety',
				link: 'pois'
			});
		}

		// Check for missing POI images
		const poisWithoutImages = data.pois.filter((p) => !p.image_url).length;
		if (poisWithoutImages > 0) {
			warnings.push({
				section: 'Points of Interest',
				message: `${poisWithoutImages} POI${poisWithoutImages > 1 ? 's' : ''} missing image${poisWithoutImages > 1 ? 's' : ''}`,
				link: 'pois'
			});
		}

		// Cards validation
		if (data.cards.length < MIN_CARDS) {
			issues.push({
				section: 'Card Prompts',
				message: `At least ${MIN_CARDS} cards are required (${data.cards.length} created)`,
				link: 'cards'
			});
		}

		// Count general cards (card_category === 'general' or no poi_id)
		const generalCards = data.cards.filter(
			(c) => c.card_category === 'general' || !c.poi_id
		).length;

		if (generalCards < MIN_GENERAL_CARDS && data.cards.length >= MIN_CARDS) {
			warnings.push({
				section: 'Card Prompts',
				message: `At least ${MIN_GENERAL_CARDS} general cards recommended (${generalCards} created)`,
				link: 'cards'
			});
		}

		// Check card types diversity
		const cardTypes = new Set(data.cards.map((c) => c.type));
		if (cardTypes.size < MIN_CARD_TYPES && data.cards.length >= MIN_CARDS) {
			warnings.push({
				section: 'Card Prompts',
				message: `Use at least ${MIN_CARD_TYPES} different card types (${cardTypes.size} used)`,
				link: 'cards'
			});
		}

		if (
			cardTypes.size < RECOMMENDED_CARD_TYPES &&
			cardTypes.size >= MIN_CARD_TYPES &&
			data.cards.length >= MIN_CARDS
		) {
			warnings.push({
				section: 'Card Prompts',
				message: `Consider using ${RECOMMENDED_CARD_TYPES}+ card types for more variety`,
				link: 'cards'
			});
		}

		// Check hero's journey coverage - ALL 6 STEPS REQUIRED
		const allSteps = new Set();
		const stepCounts = {};

		data.cards.forEach((card) => {
			card.hero_steps?.forEach((step) => {
				allSteps.add(step);
				stepCounts[step] = (stepCounts[step] || 0) + 1;
			});
		});

		// CRITICAL: All 6 hero's journey steps must be covered
		if (allSteps.size < ALL_HERO_STEPS) {
			const missingSteps = Object.keys(allJourneySteps).filter((step) => !allSteps.has(step));
			issues.push({
				section: 'Card Prompts',
				message: `All ${ALL_HERO_STEPS} hero's journey steps must be covered (missing: ${missingSteps.length})`,
				link: 'cards'
			});
		}

		// Check each step has minimum cards for accordion progression
		if (allSteps.size === ALL_HERO_STEPS) {
			const stepsWithFewCards = Object.entries(stepCounts)
				.filter(([_, count]) => count < MIN_CARDS_PER_STEP)
				.map(([step, count]) => `${allJourneySteps[step]} (${count})`);

			if (stepsWithFewCards.length > 0) {
				warnings.push({
					section: 'Card Prompts',
					message: `Some journey steps have < ${MIN_CARDS_PER_STEP} cards: ${stepsWithFewCards.join(', ')}`,
					link: 'cards'
				});
			}
		}

		// Check POI card distribution
		if (data.pois.length >= MIN_POIS && data.cards.length >= MIN_CARDS) {
			const poisWithCards = new Set(data.cards.filter((c) => c.poi_id).map((c) => c.poi_id)).size;

			const poisWithoutCards = data.pois.length - poisWithCards;
			if (poisWithoutCards > data.pois.length * 0.5) {
				warnings.push({
					section: 'Card Prompts',
					message: `${poisWithoutCards} POI${poisWithoutCards > 1 ? 's' : ''} have no specific cards`,
					link: 'cards'
				});
			}
		}

		// Check card distribution balance (general vs POI-specific)
		if (data.cards.length >= MIN_CARDS) {
			const generalRatio = generalCards / data.cards.length;

			if (generalRatio > 0.8) {
				warnings.push({
					section: 'Card Prompts',
					message: 'Too many general cards - consider adding more POI-specific cards',
					link: 'cards'
				});
			} else if (generalRatio < 0.2) {
				warnings.push({
					section: 'Card Prompts',
					message: 'Too many POI-specific cards - add more general cards for flexibility',
					link: 'cards'
				});
			}
		}

		// AI Companion validation
		if (!data.aiConfig) {
			issues.push({
				section: 'AI Companion',
				message: 'AI companion configuration is required',
				link: 'ai'
			});
		} else {
			// Check all required fields
			if (!data.aiConfig.name || data.aiConfig.name.trim() === '') {
				issues.push({
					section: 'AI Companion',
					message: 'AI companion name is required',
					link: 'ai'
				});
			}

			if (!data.aiConfig.tone) {
				issues.push({
					section: 'AI Companion',
					message: 'Tone must be selected',
					link: 'ai'
				});
			}

			if (!data.aiConfig.personality) {
				issues.push({
					section: 'AI Companion',
					message: 'Personality must be selected',
					link: 'ai'
				});
			}

			if (!data.aiConfig.relationship) {
				issues.push({
					section: 'AI Companion',
					message: 'Relationship must be selected',
					link: 'ai'
				});
			}

			if (data.aiConfig.humor_level === undefined || data.aiConfig.humor_level === null) {
				issues.push({
					section: 'AI Companion',
					message: 'Humor level must be set',
					link: 'ai'
				});
			}

			if (data.aiConfig.formality === undefined || data.aiConfig.formality === null) {
				issues.push({
					section: 'AI Companion',
					message: 'Formality level must be set',
					link: 'ai'
				});
			}

			// Recommendations
			if (!data.aiConfig.avatar_url) {
				warnings.push({
					section: 'AI Companion',
					message: 'Avatar image is recommended',
					link: 'ai'
				});
			}

			if (!data.aiConfig.additional_context || data.aiConfig.additional_context.length < 50) {
				warnings.push({
					section: 'AI Companion',
					message: 'Additional context (50+ chars) is recommended',
					link: 'ai'
				});
			}
		}

		return {
			issues,
			warnings,
			isValid: issues.length === 0
		};
	});

	// Parse location data
	const locationData = $derived.by(() => {
		if (!data.game.location) return null;

		return data.locationData;
	});

	const allJourneySteps = {
		call_to_adventure: 'Call to Adventure',
		crossing_the_threshold: 'Crossing the Threshold',
		meeting_the_mentor: 'Meeting the Mentor',
		trials_and_growth: 'Trials and Growth',
		death_and_transformation: 'Death and Transformation',
		change_and_return: 'Change and Return'
	};
</script>

<div class="mx-auto w-full max-w-5xl space-y-8 p-6">
	<!-- Header -->
	<div class="space-y-2">
		<h1 class="text-3xl font-bold">Review & Publish</h1>
		<p class="text-gray-600">
			Review your game configuration before playtesting or saving as a draft
		</p>
	</div>

	<!-- Validation Summary -->
	{#if validation.issues.length > 0}
		<Alert.Root variant="destructive">
			<TriangleAlert class="h-4 w-4" />
			<Alert.Title>Action Required</Alert.Title>
			<Alert.Description>
				<div class="mt-2 space-y-1">
					{#each validation.issues as issue}
						<div class="flex items-center justify-between gap-2">
							<span>{issue.section}: {issue.message}</span>
							<Button
								variant="link"
								size="sm"
								class="h-auto p-0 text-red-900"
								href={`/dashboard/games/${params.id}/edit/${issue.link}`}
							>
								Fix →
							</Button>
						</div>
					{/each}
				</div>
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if validation.warnings.length > 0 && validation.isValid}
		<Alert.Root>
			<TriangleAlert class="h-4 w-4" />
			<Alert.Title>Suggestions</Alert.Title>
			<Alert.Description>
				<div class="mt-2 space-y-1">
					{#each validation.warnings as warning}
						<div class="flex items-center justify-between gap-2">
							<span>{warning.section}: {warning.message}</span>
							<Button
								variant="link"
								size="sm"
								class="h-auto p-0"
								href={`/dashboard/games/${params.id}/edit/${warning.link}`}
							>
								Review →
							</Button>
						</div>
					{/each}
				</div>
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if validation.isValid && validation.warnings.length === 0}
		<Alert.Root class="border-green-200 bg-green-50">
			<CircleCheck class="h-4 w-4 text-green-600" />
			<Alert.Title class="text-green-900">Ready to Play!</Alert.Title>
			<Alert.Description class="text-green-800">
				Your game is complete and ready for playtesting.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- General Information Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
					<Globe class="h-5 w-5 text-blue-600" />
				</div>
				<h2 class="text-xl font-semibold">General Information</h2>
			</div>
			<Button variant="outline" size="sm" href={`/dashboard/games/${params.id}/edit/general`}>
				<SquarePen class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</div>

		<div class="space-y-4">
			{#if data.game.image_url}
				<div class="overflow-hidden rounded-lg">
					<img
						src={data.game.image_url}
						alt={data.game.title}
						class="aspect-video w-full object-cover"
					/>
				</div>
			{:else}
				<div class="flex aspect-video items-center justify-center rounded-lg bg-gray-100">
					<Image class="h-12 w-12 text-gray-400" />
				</div>
			{/if}

			<div>
				<h3 class="text-lg font-semibold text-gray-900">{data.game.title || 'Untitled Game'}</h3>
				<p class="mt-1 text-sm text-gray-600">
					{data.game.description || 'No description provided'}
				</p>
			</div>

			{#if locationData}
				<div class="space-y-2 text-sm">
					<div class="flex items-center gap-2 text-gray-700">
						<MapPin class="h-4 w-4 text-gray-500" />
						<span>{locationData.lat}, {locationData.lng}</span>
					</div>
				</div>
			{/if}

			{#if data.game.categories && data.game.categories.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each data.game.categories as category}
						<Badge variant="secondary">{category}</Badge>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Characters Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100">
					<Users class="h-5 w-5 text-pink-600" />
				</div>
				<div>
					<h2 class="text-xl font-semibold">Characters</h2>
					<p class="text-sm text-gray-600">
						{data.characters.length} character{data.characters.length !== 1 ? 's' : ''} created
						{#if data.characters.length < MIN_CHARACTERS}
							<span class="text-red-600">(minimum {MIN_CHARACTERS} required)</span>
						{/if}
					</p>
				</div>
			</div>
			<Button variant="outline" size="sm" href={`/dashboard/games/${params.id}/edit/characters`}>
				<SquarePen class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</div>

		{#if data.characters.length > 0}
			<div class="grid gap-3 md:grid-cols-2">
				{#each data.characters as character}
					<div class="flex gap-3 rounded-md border border-gray-100 p-4">
						{#if character.image_url}
							<img
								src={character.image_url}
								alt={character.name}
								class="h-16 w-16 rounded-lg object-cover"
							/>
						{:else}
							<div class="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
								<Users class="h-8 w-8 text-gray-400" />
							</div>
						{/if}
						<div class="flex-1">
							<div class="mb-1 flex items-start justify-between">
								<h3 class="font-medium text-gray-900">{character.name}</h3>
								<Badge variant="secondary" class="capitalize">{character.category}</Badge>
							</div>
							<p class="line-clamp-2 text-xs text-gray-600">{character.summary}</p>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="py-8 text-center text-gray-500">
				No characters created yet. Add at least {MIN_CHARACTERS} characters to continue.
			</div>
		{/if}
	</div>

	<!-- Points of Interest Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
					<MapPin class="h-5 w-5 text-green-600" />
				</div>
				<div>
					<h2 class="text-xl font-semibold">Points of Interest</h2>
					<p class="text-sm text-gray-600">
						{data.pois.length} location{data.pois.length !== 1 ? 's' : ''} created
						{#if data.pois.length < MIN_POIS}
							<span class="text-red-600">(minimum {MIN_POIS} required)</span>
						{/if}
					</p>
				</div>
			</div>
			<Button variant="outline" size="sm" href={`/dashboard/games/${params.id}/edit/pois`}>
				<SquarePen class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</div>

		{#if data.pois.length > 0}
			<div class="space-y-2">
				{#each data.pois as poi}
					<div class="flex items-start gap-3 rounded-md border border-gray-100 p-3">
						{#if poi.image_url}
							<img src={poi.image_url} alt={poi.name} class="h-16 w-16 rounded-lg object-cover" />
						{:else}
							<div class="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
								<MapPin class="h-8 w-8 text-gray-400" />
							</div>
						{/if}
						<div class="flex-1">
							<div class="mb-1 flex items-start justify-between">
								<div>
									<p class="font-medium text-gray-900">{poi.name}</p>
									<p class="text-xs text-gray-500">
										{poi.latitude} , {poi.longitude}
									</p>
								</div>
								<Badge variant="outline" class="capitalize">{poi.type}</Badge>
							</div>
							{#if poi.tags && poi.tags.length > 0}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each poi.tags.slice(0, 3) as tag}
										<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
											#{tag}
										</span>
									{/each}
									{#if poi.tags.length > 3}
										<span class="text-xs text-gray-500">+{poi.tags.length - 3} more</span>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="py-8 text-center text-gray-500">
				No POIs created yet. Add at least {MIN_POIS} points of interest to continue.
			</div>
		{/if}
	</div>

	<!-- Cards Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
					<CreditCard class="h-5 w-5 text-purple-600" />
				</div>
				<div>
					<h2 class="text-xl font-semibold">Card Prompts</h2>
					<p class="text-sm text-gray-600">
						{data.cards.length} card{data.cards.length !== 1 ? 's' : ''} created
						{#if data.cards.length < MIN_CARDS}
							<span class="text-red-600">(minimum {MIN_CARDS} required)</span>
						{/if}
					</p>
				</div>
			</div>
			<Button variant="outline" size="sm" href={`/dashboard/games/${params.id}/edit/cards`}>
				<SquarePen class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</div>

		{#if data.cards.length > 0}
			<div class="grid gap-3 md:grid-cols-2">
				{#each data.cards as card}
					<div class="rounded-md border border-gray-100 p-4">
						<div class="mb-2 flex items-start justify-between">
							<h3 class="font-medium text-gray-900">{card.title}</h3>
							<Badge variant="secondary" class="capitalize">{card.type}</Badge>
						</div>
						<p class="mb-2 line-clamp-2 text-xs text-gray-600">{card.prompt}</p>
						<div class="flex flex-wrap gap-1">
							{#each card.hero_steps?.slice(0, 2) || [] as step}
								<Badge variant="outline" class="text-xs">
									{allJourneySteps[step] || step}
								</Badge>
							{/each}
							{#if card.hero_steps && card.hero_steps.length > 2}
								<Badge variant="outline" class="text-xs">+{card.hero_steps.length - 2}</Badge>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="py-8 text-center text-gray-500">
				No cards created yet. Add at least {MIN_CARDS} card prompts to continue.
			</div>
		{/if}
	</div>

	<!-- AI Companion Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
					<MessageCircle class="h-5 w-5 text-orange-600" />
				</div>
				<h2 class="text-xl font-semibold">AI Companion</h2>
			</div>
			<Button variant="outline" size="sm" href={`/dashboard/games/${params.id}/edit/ai`}>
				<SquarePen class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</div>

		{#if data.aiConfig}
			<div class="flex items-start gap-4">
				{#if data.aiConfig.avatar_url}
					<img
						src={data.aiConfig.avatar_url}
						alt={data.aiConfig.name}
						class="h-16 w-16 rounded-full object-cover"
					/>
				{:else}
					<div
						class="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100"
					>
						<Sparkles class="h-8 w-8 text-blue-600" />
					</div>
				{/if}
				<div class="flex-1">
					<h3 class="text-lg font-semibold text-gray-900">{data.aiConfig.name}</h3>
					{#if data.aiConfig.additional_context}
						<p class="text-sm text-gray-600">{data.aiConfig.additional_context}</p>
					{/if}
					<div class="mt-2 flex flex-wrap gap-2">
						{#if data.aiConfig.formality !== undefined}
							<Badge variant="secondary">
								Formality: {data.aiConfig.formality === 0
									? 'Casual'
									: data.aiConfig.formality === 1
										? 'Balanced'
										: 'Formal'}
							</Badge>
						{/if}
						{#if data.aiConfig.humor_level !== undefined}
							<Badge variant="secondary">
								Humor: {data.aiConfig.humor_level === 0
									? 'Serious'
									: data.aiConfig.humor_level === 1
										? 'Subtle'
										: 'Playful'}
							</Badge>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<div class="py-8 text-center text-gray-500">
				No AI companion configured yet. Configure the AI companion to continue.
			</div>
		{/if}
	</div>

	<!-- Action Buttons -->
	<div class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-6 sm:flex-row">
		<Button href={`/dashboard/`} variant="outline" size="lg" class="flex-1">
			<Save class="mr-2 h-5 w-5" />
			Save as Draft
		</Button>
		<form method="POST" action="?/publish" class="flex-1">
			<Button type="submit" size="lg" class="w-full" disabled={!validation.isValid}>
				<Play class="mr-2 h-5 w-5" />
				Publish Game
			</Button>
		</form>
	</div>

	<!-- Back Button -->
	<div class="flex justify-center">
		<Button variant="ghost" href={`/dashboard/games/${params.id}/edit/ai`}>
			← Back to AI Configuration
		</Button>
	</div>
</div>
