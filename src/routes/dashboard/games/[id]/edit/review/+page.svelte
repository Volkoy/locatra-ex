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
	import CharacterCard from '$lib/components/character-card.svelte';
	import PoiCard from '$lib/components/poi-card.svelte';
	import CardPromptCard from '$lib/components/card-prompt-card.svelte';

	let { data, params, form } = $props();

	// Map section keys to URL slugs
	const sectionSlugs: Record<string, string> = {
		'General Information': 'general',
		Characters: 'characters',
		'Points of Interest': 'pois',
		'Card Prompts': 'cards',
		'AI Companion': 'ai'
	};

	// Get validation from server data
	const validation = $derived.by(() => {
		const issues: Array<{ section: string; message: string; link: string }> = [];
		const warnings: Array<{ section: string; message: string; link: string }> = [];

		if (!data.validations) {
			return { issues, warnings, isValid: true };
		}

		Object.entries(data.validations).forEach(([sectionKey, sectionValidation]) => {
			const link = sectionSlugs[sectionKey] || 'general';

			sectionValidation.checks.forEach((check) => {
				if (check.status === 'incomplete') {
					issues.push({
						section: sectionKey,
						message: `${check.label}: ${check.description}`,
						link
					});
				} else if (check.status === 'warning') {
					warnings.push({
						section: sectionKey,
						message: `${check.label}: ${check.description}`,
						link
					});
				}
			});
		});

		return { issues, warnings, isValid: issues.length === 0 };
	});

	const groupedIssues = $derived.by(() => {
		const grouped: Record<string, { link: string; messages: string[] }> = {};
		validation.issues.forEach((issue) => {
			if (!grouped[issue.section]) grouped[issue.section] = { link: issue.link, messages: [] };
			grouped[issue.section].messages.push(issue.message);
		});
		return grouped;
	});

	const groupedWarnings = $derived.by(() => {
		const grouped: Record<string, { link: string; messages: string[] }> = {};
		validation.warnings.forEach((warning) => {
			if (!grouped[warning.section])
				grouped[warning.section] = { link: warning.link, messages: [] };
			grouped[warning.section].messages.push(warning.message);
		});
		return grouped;
	});

	const isPublished = $derived(
		data.game.status === 'published' && data.game.visibility === 'public'
	);
</script>

<div class="mx-auto w-full max-w-5xl space-y-8 p-6">
	<!-- Header -->
	<div class="flex items-start justify-between gap-4">
		<div class="space-y-2">
			<h1 class="text-3xl font-bold">Review & Publish</h1>
			<p class="text-gray-600">
				Review your game configuration before playtesting or saving as a draft
			</p>
		</div>
		{#if isPublished}
			<Badge class=" bg-dark-green text-white">
				<Globe class="mr-1 h-3 w-3" />
				<span class="uppercase">Live & Public</span>
			</Badge>
		{:else}
			<Badge variant="secondary" class="uppercase">Draft</Badge>
		{/if}
	</div>

	<!-- Validation Summary -->
	{#if validation.issues.length > 0}
		<Alert.Root variant="destructive">
			<TriangleAlert class="h-4 w-4" />
			<Alert.Title>Action Required</Alert.Title>
			<Alert.Description>
				<div class="mt-2 space-y-3">
					{#each Object.entries(groupedIssues) as [section, { link, messages }] (section)}
						<div class="space-y-1">
							<div class="flex items-start justify-between gap-2">
								<div class="flex-1">
									<p class="font-semibold text-red-900">{section}</p>
									<ul class="mt-1 space-y-0.5 text-sm">
										{#each messages as message (message)}
											<li class="text-red-800">• {message}</li>
										{/each}
									</ul>
								</div>
								<Button
									variant="link"
									size="sm"
									class="h-auto flex-shrink-0 p-0 text-red-900"
									href={`/dashboard/games/${params.id}/edit/${link}`}
								>
									Fix →
								</Button>
							</div>
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
				<div class="mt-2 space-y-3">
					{#each Object.entries(groupedWarnings) as [section, { link, messages }] (section)}
						<div class="space-y-1">
							<div class="flex items-start justify-between gap-2">
								<div class="flex-1">
									<p class="font-semibold">{section}</p>
									<ul class="mt-1 space-y-0.5 text-sm">
										{#each messages as message (message)}
											<li class="text-gray-700">• {message}</li>
										{/each}
									</ul>
								</div>
								<Button
									variant="link"
									size="sm"
									class="h-auto flex-shrink-0 p-0"
									href={`/dashboard/games/${params.id}/edit/${link}`}
								>
									Review →
								</Button>
							</div>
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

			{#if data.game.categories && data.game.categories.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each data.game.categories as category (category)}
						<Badge class="bg-dark-green/25 text-dark-green">{category}</Badge>
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
					</p>
				</div>
			</div>
			<Button variant="outline" size="sm" href={`/dashboard/games/${params.id}/edit/characters`}>
				<SquarePen class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</div>

		{#if data.characters.length > 0}
			<div class="flex flex-wrap gap-4">
				{#each data.characters as character (character.id)}
					<CharacterCard {character} />
				{/each}
			</div>
		{:else}
			<div class="py-8 text-center text-gray-500">No characters created yet.</div>
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
					</p>
				</div>
			</div>
			<Button variant="outline" size="sm" href={`/dashboard/games/${params.id}/edit/pois`}>
				<SquarePen class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</div>

		{#if data.pois.length > 0}
			<div class="flex flex-wrap gap-4">
				{#each data.pois as poi (poi.id)}
					<PoiCard {poi} />
				{/each}
			</div>
		{:else}
			<div class="py-8 text-center text-gray-500">No POIs created yet.</div>
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
					</p>
				</div>
			</div>
			<Button variant="outline" size="sm" href={`/dashboard/games/${params.id}/edit/cards`}>
				<SquarePen class="mr-2 h-4 w-4" />
				Edit
			</Button>
		</div>

		{#if data.cards.length > 0}
			<div class="flex flex-wrap gap-4">
				{#each data.cards as card (card.id)}
					<CardPromptCard {card} />
				{/each}
			</div>
		{:else}
			<div class="py-8 text-center text-gray-500">No cards created yet.</div>
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
						{#if data.aiConfig.tone}
							<Badge class="bg-dark-green/25 capitalize text-dark-green">{data.aiConfig.tone}</Badge>
						{/if}
						{#if data.aiConfig.personality}
							<Badge class="bg-dark-green/25 capitalize text-dark-green">{data.aiConfig.personality}</Badge>
						{/if}
						{#if data.aiConfig.formality !== undefined && data.aiConfig.formality !== null}
							<Badge class="bg-dark-green/25 text-dark-green">
								Formality: {data.aiConfig.formality === 0
									? 'Casual'
									: data.aiConfig.formality === 1
										? 'Balanced'
										: 'Formal'}
							</Badge>
						{/if}
						{#if data.aiConfig.humor_level !== undefined && data.aiConfig.humor_level !== null}
							<Badge class="bg-dark-green/25 text-dark-green">
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
			<div class="py-8 text-center text-gray-500">No AI companion configured yet.</div>
		{/if}
	</div>

	<!-- Form error -->
	{#if form?.error}
		<Alert.Root variant="destructive">
			<TriangleAlert class="h-4 w-4" />
			<Alert.Title>Error</Alert.Title>
			<Alert.Description>{form.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Action Buttons -->
	{#if isPublished}
		<div class="space-y-3 rounded-lg border border-dark-green/30 bg-dark-green/10 p-6">
			<div class="flex items-center gap-2 text-dark-green">
				<CircleCheck class="h-5 w-5 text-dark-green" />
				<p class="font-semibold">Your game is live and public</p>
			</div>
			<div class="flex flex-col gap-3 sm:flex-row">
				<Button
					href={`/play/${data.game.game_id}`}
					size="lg"
					class="flex-1 bg-dark-green hover:bg-dark-green/90"
				>
					<Globe class="mr-2 h-5 w-5" />
					View game
				</Button>
				<form method="POST" action="?/unpublish" class="flex-1">
					<Button
						type="submit"
						variant="outline"
						size="lg"
						class="w-full border-dark-green/40 text-dark-green hover:bg-dark-green/10"
					>
						Unpublish
					</Button>
				</form>
			</div>
		</div>
	{:else}
		<div class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-6 sm:flex-row">
			<Button href="/dashboard/" variant="outline" size="lg" class="flex-1">
				<Save class="mr-2 h-5 w-5" />
				Save as Draft
			</Button>
			<form method="POST" action="?/publish" class="flex-1">
				<Button type="submit" size="lg" class="w-full" disabled={!validation.isValid}>
					<Play class="mr-2 h-5 w-5" />
					Publish & Make Public
				</Button>
			</form>
		</div>
		{#if !validation.isValid}
			<p class="text-center text-sm text-muted-foreground">
				Fix the issues above before publishing.
			</p>
		{/if}
	{/if}

	<!-- Back Button -->
	<div class="flex justify-center">
		<Button variant="ghost" href={`/dashboard/games/${params.id}/edit/ai`}>
			← Back to AI Configuration
		</Button>
	</div>
</div>
