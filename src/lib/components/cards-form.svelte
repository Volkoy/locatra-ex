<script lang="ts">
	import {
		BookDashed,
		Plus,
		Sparkles,
		Leaf,
		BookOpen,
		Eye,
		Footprints,
		Landmark,
		MapPin,
		Trash2,
		SquarePen,
		ArrowRight,
		ArrowLeft,
		Globe,
		CopyPlus,
		ChevronDown
	} from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { superForm } from 'sveltekit-superforms';
	import type { Database } from '$lib/database.types';

	type Card = Database['public']['Tables']['cards']['Row'];
	import { cardSchema } from '$lib/zod/schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { invalidateAll, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';

	let { data, params } = $props();

	const types = [
		{ value: 'nature', label: 'Nature' },
		{ value: 'history', label: 'History' },
		{ value: 'sense', label: 'Sense' },
		{ value: 'action', label: 'Action' },
		{ value: 'landmark', label: 'Landmark' }
	];

	const allJourneySteps = [
		{
			value: 'call_to_adventure',
			label: 'Call to Adventure',
			description:
				'The player is invited into the story world and begins to sense that something extraordinary awaits.'
		},
		{
			value: 'crossing_the_threshold',
			label: 'Crossing the Threshold',
			description:
				'The player commits to the journey, leaving the familiar behind and entering unknown territory.'
		},
		{
			value: 'meeting_the_mentor',
			label: 'Meeting the Mentor',
			description:
				'The player encounters guidance — a person, place, or discovery — that equips them for challenges ahead.'
		},
		{
			value: 'trials_and_growth',
			label: 'Trials and Growth',
			description:
				'The player faces obstacles and setbacks that test their resolve and push them to grow.'
		},
		{
			value: 'death_and_transformation',
			label: 'Death and Transformation',
			description:
				'A moment of crisis or deep change — the player must let go of something old to become something new.'
		},
		{
			value: 'change_and_return',
			label: 'Change and Return',
			description:
				'The player returns transformed, carrying new wisdom and a changed perspective on the world.'
		}
	];

	const characterTypes = [
		{ value: 'both', label: 'All Characters' },
		{ value: 'human', label: 'Human Only' },
		{ value: 'non-human', label: 'Non-Human Only' }
	];

	let cards = $derived(data.cards || []);
	let pois = $derived(data.pois || []);
	let isFormOpen = $state(false);
	let editingCard = $state<Card | null>(null);
	let isGeneratingAI = $state(false);
	let searchQuery = $state('');
	let sortBy = $state<'title' | 'type' | 'hero_steps' | 'created_at'>('created_at');

	const form = superForm(data.form, {
		validators: zod4Client(cardSchema),
		dataType: 'json',
		resetForm: true,
		onUpdated: ({ form }) => {
			if (form.valid) {
				const action = editingCard ? 'updated' : 'created';
				toast.success(`Card ${action} successfully!`);
				isFormOpen = false;
				editingCard = null;
				invalidateAll();
			}
		}
	});

	const { form: formData, enhance, delayed } = form;

	let filteredCards = $derived.by(() => {
		let filtered = cards.filter(
			(card: Card) =>
				(card.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
				(card.prompt ?? '').toLowerCase().includes(searchQuery.toLowerCase())
		);

		return filtered.sort((a: Card, b: Card) => {
			if (sortBy === 'title') {
				return (a.title ?? '').localeCompare(b.title ?? '');
			} else if (sortBy === 'type') {
				return a.type.localeCompare(b.type);
			} else if (sortBy === 'created_at') {
				return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
			} else {
				return (a.hero_steps[0] || '').localeCompare(b.hero_steps[0] || '');
			}
		});
	});

	const openCreateForm = () => {
		editingCard = null;
		$formData.id = undefined;
		$formData.title = '';
		$formData.prompt = '';
		$formData.type = '';
		$formData.hero_steps = [];
		$formData.character_category = '';
		$formData.card_category = 'general';
		$formData.keywords = '';
		$formData.poi_id = null;
		isFormOpen = true;
	};

	const openEditForm = (card: Card) => {
		editingCard = card;
		$formData.id = card.id;
		$formData.title = card.title;
		$formData.prompt = card.prompt;
		$formData.type = card.type;
		$formData.hero_steps = card.hero_steps;
		$formData.character_category = card.character_category;
		$formData.card_category = card.card_category || 'general';
		$formData.keywords = card.keywords || '';
		$formData.poi_id = card.poi_id || null;
		isFormOpen = true;
	};

	const generateAIContent = async () => {
		if (!$formData.type || $formData.hero_steps.length === 0) {
			toast.error('Please select a type and at least one journey step');
			return;
		}

		if ($formData.card_category === 'poi_specific' && !$formData.poi_id) {
			toast.error('Please select a POI for POI-specific cards');
			return;
		}

		if ($formData.card_category === 'general' && !$formData.keywords) {
			toast.error('Please enter keywords for general cards');
			return;
		}

		isGeneratingAI = true;
		try {
			const response = await fetch('/api/generate-card', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: $formData.type,
					journeySteps: $formData.hero_steps,
					characterType: $formData.character_category,
					cardCategory: $formData.card_category,
					keywords: $formData.keywords,
					poiId: $formData.poi_id,
					existingTitle: $formData.title || null,
					existingPrompt: $formData.prompt || null,
					gameId: data.gameId ?? null
				})
			});

			if (!response.ok) throw new Error('Failed to generate content');

			const { title, prompt } = (await response.json()) as { title: string; prompt: string };
			$formData.title = title;
			$formData.prompt = prompt;
			toast.success('Content generated!');
		} catch (error) {
			console.error('AI generation error:', error);
			toast.error('Failed to generate content');
		} finally {
			isGeneratingAI = false;
		}
	};

	async function deleteCard(id: number) {
		if (!confirm('Are you sure you want to delete this card?')) return;

		const formDataDel = new FormData();
		formDataDel.append('cardId', id.toString());

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formDataDel
		});

		if (response.ok) {
			toast.success('Card deleted successfully!');
			await invalidateAll();
		} else {
			toast.error('Failed to delete card');
		}
	}

	const getCardHeaderBg = (type: string) => {
		switch (type) {
			case 'nature':
				return 'bg-nature-green';
			case 'history':
				return 'bg-history-yellow';
			case 'sense':
				return 'bg-purple-600';
			case 'action':
				return 'bg-sense-red';
			case 'landmark':
				return 'bg-landmark-green';
			default:
				return 'bg-gray-600';
		}
	};

	const getCardPaleBg = (type: string) => {
		switch (type) {
			case 'nature':
				return 'bg-nature-green/10';
			case 'history':
				return 'bg-history-yellow/10';
			case 'sense':
				return 'bg-purple-600/10';
			case 'action':
				return 'bg-sense-red/10';
			case 'landmark':
				return 'bg-landmark-green/10';
			default:
				return 'bg-gray-100';
		}
	};

	const getCardTextColor = (type: string) => {
		switch (type) {
			case 'nature':
				return 'text-nature-green';
			case 'history':
				return 'text-history-yellow';
			case 'sense':
				return 'text-purple-600';
			case 'action':
				return 'text-sense-red';
			case 'landmark':
				return 'text-landmark-green';
			default:
				return 'text-gray-700';
		}
	};

	let expandedCards = $state<Record<number, boolean>>({});

	async function duplicateCard(id: number) {
		const fd = new FormData();
		fd.append('cardId', id.toString());
		const res = await fetch('?/duplicate', { method: 'POST', body: fd });
		if (res.ok) {
			toast.success('Card duplicated!');
			await invalidateAll();
		} else {
			toast.error('Failed to duplicate card');
		}
	}

	const getCardIcon = (type: string) => {
		switch (type) {
			case 'nature':
				return Leaf;
			case 'history':
				return BookOpen;
			case 'sense':
				return Eye;
			case 'action':
				return Footprints;
			case 'landmark':
				return Landmark;
			default:
				return BookDashed;
		}
	};

	const getJourneyStepLabel = (step: string) => {
		return allJourneySteps.find((s) => s.value === step)?.label || step;
	};

	function selectAllSteps() {
		$formData.hero_steps = allJourneySteps.map((s) => s.value);
	}

	function deselectAllSteps() {
		$formData.hero_steps = [];
	}

	function addStep(value: string) {
		$formData.hero_steps = [...$formData.hero_steps, value];
	}

	function removeStep(value: string) {
		$formData.hero_steps = $formData.hero_steps.filter((i: string) => i !== value);
	}

	beforeNavigate(() => {
		isFormOpen = false;
		editingCard = null;
	});

	onDestroy(() => {
		isFormOpen = false;
		editingCard = null;
	});
</script>

<div class="mx-auto w-full flex-1">
	<div class="space-y-6 rounded-lg border border-gray-300 bg-white p-6">
		<div class="mb-6">
			<h2 class="text-2xl font-semibold">Card Prompts</h2>
			<p class="text-gray-600">
				Cards guide your players' stories by presenting challenges, reflections, and prompts that
				help them write meaningful story segments. Each card shapes their journey and inspires the
				narrative fragments they create.
			</p>
		</div>

		{#if cards.length === 0}
			<Empty.Root>
				<Empty.Header>
					<Empty.Media variant="icon">
						<BookDashed />
					</Empty.Media>
					<Empty.Title>No Cards Yet</Empty.Title>
					<Empty.Description>
						Create your first card prompt to guide players through their journey.
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button onclick={openCreateForm}>
						<Plus class="mr-2 h-4 w-4" />
						Create Card
					</Button>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<div class="flex gap-4">
				<Field.Field class="max-w-[320px]">
					<Field.Label for="search">Search Cards</Field.Label>
					<Input
						id="search"
						type="text"
						placeholder="Search by name or summary..."
						bind:value={searchQuery}
					/>
				</Field.Field>
				<Field.Field orientation="responsive" class="max-w-[180px]">
					<Field.Label for="sort">Sort By</Field.Label>
					<Select.Root type="single" bind:value={sortBy}>
						<Select.Trigger id="sort">
							{sortBy === 'title'
								? 'Title'
								: sortBy === 'type'
									? 'Type'
									: sortBy === 'created_at'
										? 'Most Recent'
										: 'Journey Step'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="created_at">Most Recent</Select.Item>
							<Select.Item value="title">Title</Select.Item>
							<Select.Item value="type">Type</Select.Item>
							<Select.Item value="hero_steps">Journey Step</Select.Item>
						</Select.Content>
					</Select.Root>
				</Field.Field>
			</div>

			<!-- Cards Grid -->
			<div class="flex flex-wrap gap-5">
				<!-- Create new card button -->
				<div class="flex w-72 flex-col gap-2">
					<button
						onclick={openCreateForm}
						class="group flex aspect-[2/3] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-4 transition-colors hover:cursor-pointer hover:border-primary hover:bg-gray-50"
					>
						<div
							class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-primary/10"
						>
							<Plus class="h-6 w-6 text-gray-400 transition-colors group-hover:text-primary" />
						</div>
						<span
							class="text-center text-sm font-medium text-gray-600 transition-colors group-hover:text-primary"
							>Create New Card</span
						>
					</button>
				</div>

				{#each filteredCards as card (card.id)}
					{@const Icon = getCardIcon(card.type)}
					{@const headerBg = getCardHeaderBg(card.type)}
					{@const paleBg = getCardPaleBg(card.type)}
					{@const textColor = getCardTextColor(card.type)}
					<div class="flex w-72 flex-col gap-2">
						<!-- Portrait card -->
						<div
							class="flex aspect-[2/3] flex-col overflow-hidden rounded-xl border-8 border-white shadow-md outline outline-2 outline-gray-200 transition-shadow hover:shadow-xl"
						>
							<!-- Colored header -->
							<div class="flex flex-col items-center gap-2 p-4 {paleBg}">
								<div class="flex h-14 w-14 items-center justify-center rounded-full {headerBg}">
									<Icon class="h-8 w-8 text-white" />
								</div>
								<h3 class="line-clamp-3 text-center text-sm leading-tight font-bold {textColor}">
									{card.title}
								</h3>
							</div>
							<!-- White body -->
							<div class="flex-1 bg-white p-4 pt-8">
								<p class="line-clamp-[8] text-center text-sm leading-relaxed text-black">
									{card.prompt}
								</p>
							</div>
						</div>

						<!-- Action buttons -->
						<div class="grid grid-cols-3 gap-1">
							<Button size="sm" class="flex-1" onclick={() => openEditForm(card)}>
								<SquarePen class="h-3.5 w-3.5" />
							</Button>
							<Button size="sm" variant="outline" onclick={() => duplicateCard(card.id)}>
								<CopyPlus class="h-3.5 w-3.5" />
							</Button>
							<Button size="sm" variant="destructive" onclick={() => deleteCard(card.id)}>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
						</div>

						<!-- Metadata badges (collapsible) -->
						<button
							class="flex flex-wrap items-center gap-1"
							onclick={() => (expandedCards[card.id] = !expandedCards[card.id])}
						>
							<span
								class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 uppercase"
							>
								{card.type}
							</span>
							<span
								class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 uppercase"
							>
								{characterTypes.find((t) => t.value === card.character_category)?.label ??
									card.character_category}
							</span>
							{#if card.card_category === 'poi_specific'}
								<span
									class="flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 uppercase"
								>
									<MapPin class="h-2.5 w-2.5" />POI
								</span>
							{:else}
								<span
									class="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 uppercase"
								>
									<Globe class="h-2.5 w-2.5" />General
								</span>
							{/if}
							<ChevronDown
								class="ml-auto h-3 w-3 text-gray-400 transition-transform {expandedCards[card.id]
									? 'rotate-180'
									: ''}"
							/>
						</button>

						{#if expandedCards[card.id]}
							<div class="flex flex-wrap gap-1">
								{#each card.hero_steps as step (step)}
									<span
										class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
									>
										{getJourneyStepLabel(step)}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-8 flex w-full justify-end gap-4">
			<Button variant="outline" size="lg" href={`/dashboard/games/${params.id}/edit/pois`}>
				<ArrowLeft /> Back
			</Button>
			<Button size="lg" href={`/dashboard/games/${params.id}/edit/ai`}>
				Next <ArrowRight />
			</Button>
		</div>
	</div>
</div>

{#if page.url.pathname.endsWith('/cards')}
	<Sheet.Root bind:open={isFormOpen}>
		<Sheet.Content side="right" portalled={false} class="w-full overflow-y-auto pb-4 sm:max-w-lg">
			<Sheet.Header>
				<Sheet.Title>{editingCard ? 'Edit Card' : 'Create New Card'}</Sheet.Title>
				<Sheet.Description>
					{editingCard
						? 'Update the card details below.'
						: 'Fill in the details to create a new card prompt.'}
				</Sheet.Description>
			</Sheet.Header>

			<form
				method="POST"
				action="?/{editingCard ? 'update' : 'create'}"
				use:enhance
				class="space-y-6 px-4"
			>
				<!-- Card Category First -->
				<Form.Fieldset {form} name="card_category">
					<div class="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
						<Form.Legend class="font-semibold text-gray-900">Card Category</Form.Legend>
						<Tabs.Root bind:value={$formData.card_category}>
							<Tabs.List class="grid w-full grid-cols-2">
								<Tabs.Trigger value="general">General Card</Tabs.Trigger>
								<Tabs.Trigger value="poi_specific">POI-Specific</Tabs.Trigger>
							</Tabs.List>

							<Tabs.Content value="general" class="space-y-4 pt-4">
								<Form.Field {form} name="keywords">
									<Form.Control>
										{#snippet children({ props })}
											<Form.Label>Keywords</Form.Label>
											<Form.Description>
												Keywords that define this card's theme and context. The AI will use these to
												generate relevant prompts that can work across multiple locations in your
												game.
											</Form.Description>
											<Input
												{...props}
												bind:value={$formData.keywords}
												placeholder="e.g., nature, reflection, growth"
											/>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</Tabs.Content>

							<Tabs.Content value="poi_specific" class="space-y-4 pt-4">
								<Form.Field {form} name="poi_id">
									<Form.Control>
										{#snippet children({ props })}
											<Form.Label>Select POI</Form.Label>
											<Form.Description>
												This card will only appear at the selected location. The AI will use the
												POI's description, context, and tags to generate location-specific prompts.
											</Form.Description>
											<Select.Root type="single" bind:value={$formData.poi_id}>
												<Select.Trigger {...props} class="w-full">
													{$formData.poi_id
														? pois.find(
																(p: { id: number; name: string }) => p.id === $formData.poi_id
															)?.name
														: 'Select a POI'}
												</Select.Trigger>
												<Select.Content>
													{#each pois as poi (poi.id)}
														<Select.Item value={poi.id}>
															<div class="flex items-center gap-2">
																<MapPin class="h-4 w-4" />
																{poi.name}
															</div>
														</Select.Item>
													{/each}
												</Select.Content>
											</Select.Root>
											<input hidden bind:value={$formData.poi_id} />
										{/snippet}
									</Form.Control>
									<Form.FieldErrors />
								</Form.Field>
							</Tabs.Content>
						</Tabs.Root>
					</div>
				</Form.Fieldset>

				<!-- Card Settings Group -->
				<div class="space-y-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
					<h3 class="font-semibold text-gray-900">Card Settings</h3>

					<Form.Field {form} name="type">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>Card Type</Form.Label>
								<Form.Description>
									This defines the card's focus and how it engages players. Choose the type that
									best fits the card's purpose.
								</Form.Description>
								<Select.Root type="single" bind:value={$formData.type}>
									<Select.Trigger {...props} class="w-full">
										{$formData.type
											? types.find((t) => t.value === $formData.type)?.label
											: 'Select card type'}
									</Select.Trigger>
									<Select.Content>
										{#each types as type (type.value)}
											<Select.Item value={type.value}>{type.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<Form.Field {form} name="character_category">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>Character Type</Form.Label>
								<Form.Description>
									Specify which character perspectives this card applies to in the story.
								</Form.Description>
								<Select.Root type="single" bind:value={$formData.character_category}>
									<Select.Trigger {...props} class="w-full">
										{$formData.character_category
											? characterTypes.find((t) => t.value === $formData.character_category)?.label
											: 'Select character type'}
									</Select.Trigger>
									<Select.Content>
										{#each characterTypes as type (type.value)}
											<Select.Item value={type.value}>{type.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<input hidden bind:value={$formData.character_category} />
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<Form.Fieldset {form} name="hero_steps">
						<Form.Legend>Hero's Journey Steps</Form.Legend>
						<Form.Description
							>Choose which stages of the player's narrative arc this card should appear in.
							Selecting multiple steps makes the card appear across different moments in their
							journey.</Form.Description
						>
						<div class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
							<div class="flex items-center justify-between border-b border-gray-100 pb-2">
								<span class="text-xs text-gray-500"
									>{$formData.hero_steps?.length ?? 0}/{allJourneySteps.length} selected</span
								>
								<button
									type="button"
									class="text-xs font-medium text-primary hover:underline"
									onclick={$formData.hero_steps?.length === allJourneySteps.length
										? deselectAllSteps
										: selectAllSteps}
								>
									{$formData.hero_steps?.length === allJourneySteps.length
										? 'Deselect All'
										: 'Select All'}
								</button>
							</div>
							{#each allJourneySteps as step (step.value)}
								{@const checked = $formData.hero_steps?.includes(step.value)}
								<div class="flex items-start space-x-2">
									<Form.Control>
										{#snippet children({ props })}
											<Checkbox
												{...props}
												value={step.value}
												{checked}
												class="mt-0.5"
												onCheckedChange={(v) => {
													if (v) {
														addStep(step.value);
													} else {
														removeStep(step.value);
													}
												}}
											/>
											<div class="flex flex-col gap-0.5">
												<Form.Label
													for={`step-${step.value}`}
													class="cursor-pointer text-sm font-medium"
												>
													{step.label}
												</Form.Label>
												<p class="text-xs leading-snug text-gray-500">{step.description}</p>
											</div>
										{/snippet}
									</Form.Control>
								</div>
							{/each}
							<Form.FieldErrors />
						</div>
					</Form.Fieldset>
				</div>

				<!-- Title and Prompt Group -->
				<div class="space-y-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
					<div class="flex items-center justify-between">
						<h3 class="font-semibold text-gray-900">Card Content</h3>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={generateAIContent}
							disabled={isGeneratingAI}
							class="border-blue-300 bg-white hover:bg-blue-50"
						>
							{#if isGeneratingAI}
								<Spinner class="mr-1.5 h-3.5 w-3.5 text-blue-600" />
							{:else}
								<Sparkles class="mr-1.5 h-3.5 w-3.5 text-blue-600" />
							{/if}
							{#if isGeneratingAI}
								<span class="text-xs">Generating...</span>
							{:else}
								<span class="text-xs"
									>{$formData.title || $formData.prompt
										? 'Refine with AI'
										: 'Generate with AI'}</span
								>
							{/if}
						</Button>
					</div>

					<Form.Field {form} name="title">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>Card Title</Form.Label>
								<Input
									{...props}
									bind:value={$formData.title}
									placeholder="e.g., A Moment of Reflection"
								/>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<Form.Field {form} name="prompt">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>Card Prompt</Form.Label>
								<Textarea
									{...props}
									bind:value={$formData.prompt}
									rows={6}
									placeholder="Describe what the player should think about, do, or discover..."
								/>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
				</div>

				<Sheet.Footer class="flex flex-row justify-end gap-2">
					<Button type="button" variant="outline" onclick={() => (isFormOpen = false)}
						>Cancel</Button
					>
					<Button type="submit" disabled={$delayed}>
						{#if $delayed}
							<span class="flex items-center gap-2">
								<Spinner />
								Saving...
							</span>
						{:else}
							{editingCard ? 'Update Card' : 'Create Card'}
						{/if}
					</Button>
				</Sheet.Footer>
			</form>
		</Sheet.Content>
	</Sheet.Root>
{/if}
