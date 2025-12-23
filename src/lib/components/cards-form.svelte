<script lang="ts">
	import {
		BookDashed,
		Plus,
		Sparkles,
		Leaf,
		BookOpen,
		Eye,
		Zap,
		Landmark,
		MapPin,
		Trash2,
		SquarePen,
		ArrowRight,
		ArrowLeft,
		Globe
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
	import ValidationChecklist from './validation-checklist.svelte';
	import { superForm } from 'sveltekit-superforms';
	import { cardSchema } from '$lib/zod/schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import SuperDebug from 'sveltekit-superforms';

	let { data, params } = $props();

	const types = [
		{ value: 'nature', label: 'Nature' },
		{ value: 'history', label: 'History' },
		{ value: 'sense', label: 'Sense' },
		{ value: 'action', label: 'Action' },
		{ value: 'landmark', label: 'Landmark' }
	];

	const allJourneySteps = [
		{ value: 'call_to_adventure', label: 'Call to Adventure' },
		{ value: 'crossing_the_threshold', label: 'Crossing the Threshold' },
		{ value: 'meeting_the_mentor', label: 'Meeting the Mentor' },
		{ value: 'trials_and_growth', label: 'Trials and Growth' },
		{ value: 'death_and_transformation', label: 'Death and Transformation' },
		{ value: 'change_and_return', label: 'Change and Return' }
	];

	const characterTypes = [
		{ value: 'both', label: 'All Characters' },
		{ value: 'human', label: 'Human Only' },
		{ value: 'non-human', label: 'Non-Human Only' }
	];

	let cards = $derived(data.cards || []);
	let pois = $derived(data.pois || []);
	let isFormOpen = $state(false);
	let editingCard = $state<any | null>(null);
	let isGeneratingAI = $state(false);
	let searchQuery = $state('');
	let sortBy = $state<'title' | 'type' | 'hero_steps'>('title');

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

	const { form: formData, errors, enhance, delayed } = form;

	let filteredCards = $derived.by(() => {
		let filtered = cards.filter(
			(card) =>
				card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				card.prompt.toLowerCase().includes(searchQuery.toLowerCase())
		);

		return filtered.sort((a, b) => {
			if (sortBy === 'title') {
				return a.title.localeCompare(b.title);
			} else if (sortBy === 'type') {
				return a.type.localeCompare(b.type);
			} else {
				return (a.hero_steps[0] || '').localeCompare(b.hero_steps[0] || '');
			}
		});
	});

	const MIN_CARDS = 10;
	const MIN_GENERAL_CARDS = 5;
	const MIN_CARD_TYPES = 3;
	const ALL_HERO_STEPS = 6;
	const MIN_CARDS_PER_STEP = 2;

	const validationChecks = $derived.by(
		(): Array<{
			label: string;
			status: 'complete' | 'incomplete' | 'warning';
			description: string;
		}> => {
			const generalCards = cards.filter(
				(c: any) => c.card_category === 'general' || !c.poi_id
			).length;
			const cardTypes = new Set(cards.map((c: any) => c.type));
			const allSteps = new Set();
			const stepCounts: Record<string, number> = {};

			cards.forEach((card: any) => {
				card.hero_steps?.forEach((step: string) => {
					allSteps.add(step);
					stepCounts[step] = (stepCounts[step] || 0) + 1;
				});
			});

			const missingSteps = ALL_HERO_STEPS - allSteps.size;
			const stepsWithFewCards = Object.entries(stepCounts).filter(
				([_, count]) => (count as number) < MIN_CARDS_PER_STEP
			).length;

			const poisWithCards = new Set(cards.filter((c: any) => c.poi_id).map((c: any) => c.poi_id))
				.size;
			const poisWithoutCards = pois.length - poisWithCards;
			const generalRatio = cards.length > 0 ? generalCards / cards.length : 0;

			return [
				{
					label: `At least ${MIN_CARDS} cards`,
					status: (cards.length >= MIN_CARDS ? 'complete' : 'incomplete') as
						| 'complete'
						| 'incomplete',
					description: `Required (${cards.length} created)`
				},
				{
					label: `At least ${MIN_GENERAL_CARDS} general cards`,
					status: (generalCards >= MIN_GENERAL_CARDS
						? 'complete'
						: generalCards > 0
							? 'warning'
							: 'incomplete') as 'complete' | 'incomplete' | 'warning',
					description: `Recommended (${generalCards} created)`
				},
				{
					label: `At least ${MIN_CARD_TYPES} card types`,
					status: (cardTypes.size >= MIN_CARD_TYPES
						? 'complete'
						: cardTypes.size > 0
							? 'warning'
							: 'incomplete') as 'complete' | 'incomplete' | 'warning',
					description: `${cardTypes.size} types used`
				},
				{
					label: "All 6 hero's journey steps",
					status: (allSteps.size === ALL_HERO_STEPS ? 'complete' : 'incomplete') as
						| 'complete'
						| 'incomplete',
					description: `Required (${allSteps.size}/${ALL_HERO_STEPS} covered)`
				},
				{
					label: 'Each step has 2+ cards',
					status: (allSteps.size === ALL_HERO_STEPS && stepsWithFewCards === 0
						? 'complete'
						: allSteps.size === ALL_HERO_STEPS
							? 'warning'
							: 'incomplete') as 'complete' | 'incomplete' | 'warning',
					description:
						stepsWithFewCards > 0
							? `${stepsWithFewCards} steps need more cards`
							: 'Well distributed'
				},
				{
					label: 'Card distribution balance',
					status: (cards.length >= MIN_CARDS && generalRatio >= 0.2 && generalRatio <= 0.8
						? 'complete'
						: cards.length >= MIN_CARDS
							? 'warning'
							: 'incomplete') as 'complete' | 'incomplete' | 'warning',
					description:
						generalRatio > 0.8
							? 'Too many general cards'
							: generalRatio < 0.2
								? 'Too many POI-specific cards'
								: 'Balanced'
				},
				{
					label: 'POI card coverage',
					status: (pois.length > 0 && poisWithoutCards <= pois.length * 0.5
						? 'complete'
						: 'warning') as 'complete' | 'warning',
					description:
						poisWithoutCards > 0
							? `${poisWithoutCards} POI${poisWithoutCards > 1 ? 's' : ''} without cards`
							: 'All POIs have cards'
				}
			];
		}
	);

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

	const openEditForm = (card: any) => {
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
					poiId: $formData.poi_id
				})
			});

			if (!response.ok) throw new Error('Failed to generate content');

			const { title, prompt } = await response.json();
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

	const getCardIcon = (type: string) => {
		switch (type) {
			case 'nature':
				return Leaf;
			case 'history':
				return BookOpen;
			case 'sense':
				return Eye;
			case 'action':
				return Zap;
			case 'landmark':
				return Landmark;
			default:
				return BookDashed;
		}
	};

	const getCardGradient = (type: string) => {
		switch (type) {
			case 'nature':
				return 'from-green-50 to-emerald-50';
			case 'history':
				return 'from-amber-50 to-yellow-50';
			case 'sense':
				return 'from-purple-50 to-pink-50';
			case 'action':
				return 'from-orange-50 to-red-50';
			case 'landmark':
				return 'from-blue-50 to-indigo-50';
			default:
				return 'from-gray-50 to-slate-50';
		}
	};

	const getJourneyStepLabel = (step: string) => {
		return allJourneySteps.find((s) => s.value === step)?.label || step;
	};

	function addStep(value: string) {
		$formData.hero_steps = [...$formData.hero_steps, value];
	}

	function removeStep(value: string) {
		$formData.hero_steps = $formData.hero_steps.filter((i) => i !== value);
	}
</script>

<div class="mx-auto w-full flex-1">
	<div class="grid grid-cols-1 gap-2 lg:grid-cols-3">
		<!-- Main Content -->
		<div class="lg:col-span-2">
			<div class="space-y-6 rounded-lg border border-gray-300 bg-white p-6">
				<div class="mb-6">
					<h2 class="text-2xl font-semibold">Card Prompts</h2>
					<p class="text-gray-600">Create card prompts that guide players through their journey.</p>
				</div>
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
								{sortBy === 'title' ? 'Title' : sortBy === 'type' ? 'Type' : 'Journey Step'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="title">Title</Select.Item>
								<Select.Item value="type">Type</Select.Item>
								<Select.Item value="hero_steps">Journey Step</Select.Item>
							</Select.Content>
						</Select.Root>
					</Field.Field>
				</div>

				<!-- Cards Grid -->
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					<button
						onclick={openCreateForm}
						class="group flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-6 transition-colors hover:cursor-pointer hover:border-primary hover:bg-gray-50"
					>
						<div
							class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-primary/10"
						>
							<Plus class="h-8 w-8 text-gray-400 transition-colors group-hover:text-primary" />
						</div>
						<span class="font-medium text-gray-600 transition-colors group-hover:text-primary"
							>Create New Card</span
						>
					</button>

					{#each filteredCards as card (card.id)}
						{@const Icon = getCardIcon(card.type)}
						<div
							class="relative flex aspect-[3/4] flex-col overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br {getCardGradient(
								card.type
							)}"
						>
							<!-- Background Icon -->
							<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5">
								<Icon class="h-32 w-32" strokeWidth={1.5} />
							</div>

							<!-- Card Content -->
							<div class="relative z-10 flex flex-1 flex-col p-4">
								<!-- Badges -->
								<div class="mb-3 flex flex-wrap gap-2">
									<span
										class="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 capitalize"
									>
										{card.type}
									</span>
									<span
										class="rounded-full bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700"
									>
										{characterTypes.find((t) => t.value === card.character_category)?.label ||
											card.character_category}
									</span>
									{#if card.card_category === 'poi_specific'}
										<span
											class="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700"
										>
											<MapPin class="h-3 w-3" />
											POI
										</span>
									{:else}
										<span
											class="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700"
										>
											<Globe class="h-3 w-3" />General
										</span>
									{/if}
								</div>

								<!-- Card Title -->
								<h3 class="mb-3 line-clamp-2 text-lg leading-tight font-bold text-gray-900">
									{card.title}
								</h3>

								<!-- Card Prompt -->
								<p
									class="line-clamp-3 flex-1 overflow-scroll text-sm leading-relaxed text-gray-600"
								>
									{card.prompt}
								</p>

								<!-- Journey Steps -->
								<div class="mb-4 flex flex-wrap gap-1">
									{#each card.hero_steps.slice(0, 2) as step}
										<span
											class="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700"
										>
											{getJourneyStepLabel(step)}
										</span>
									{/each}
									{#if card.hero_steps.length > 2}
										<span
											class="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700"
										>
											+{card.hero_steps.length - 2}
										</span>
									{/if}
								</div>

								<!-- Action Buttons -->
								<div class="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										class="flex-1 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
										onclick={() => deleteCard(card.id)}
									>
										<Trash2 class="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="default"
										size="sm"
										class="flex-[2]"
										onclick={() => openEditForm(card)}
									>
										<SquarePen class="mr-1.5 h-3.5 w-3.5" />
										Edit
									</Button>
								</div>
							</div>
						</div>
					{/each}
				</div>

				{#if cards.length === 0}
					<div class="flex flex-col items-center gap-4 py-12 text-center">
						<p class="text-gray-500">
							No cards created yet. Click "Create New Card" to get started.
						</p>
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

		<!-- Validation Checklist Sidebar -->
		<div class="lg:col-span-1">
			<ValidationChecklist title="Validation Checklist" checks={validationChecks} />
		</div>
	</div>
</div>

<Sheet.Root bind:open={isFormOpen}>
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-lg">
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
			<Form.Field {form} name="type">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Card Type</Form.Label>
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
						<Select.Root type="single" bind:value={$formData.character_category}>
							<Select.Trigger {...props} class="w-full">
								{$formData.character_category
									? characterTypes.find((t) => t.value === $formData.character_category)?.label
									: 'Select character type'}
							</Select.Trigger>
							<Select.Content>
								{#each characterTypes as type}
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
				<Form.Description>Select one or more journey steps</Form.Description>
				<div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
					{#each allJourneySteps as step (step.value)}
						{@const checked = $formData.hero_steps?.includes(step.value)}
						<div class="flex items-center space-x-2">
							<Form.Control>
								{#snippet children({ props })}
									<Checkbox
										{...props}
										value={step.value}
										{checked}
										onCheckedChange={(v) => {
											if (v) {
												addStep(step.value);
											} else {
												removeStep(step.value);
											}
										}}
									/>
									<Form.Label for={`step-${step.value}`} class="cursor-pointer text-sm font-medium">
										{step.label}
									</Form.Label>
								{/snippet}
							</Form.Control>
						</div>
					{/each}
					<Form.FieldErrors />
				</div>
			</Form.Fieldset>

			<!-- Tabs for General vs POI-Specific Cards -->
			<Form.Fieldset {form} name="card_category">
				<div class="space-y-4">
					<Form.Legend>Card Category</Form.Legend>
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
											Enter keywords separated by commas (e.g., nature, reflection, growth)
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
											Choose which POI this card is specifically for
										</Form.Description>
										<Select.Root type="single" bind:value={$formData.poi_id}>
											<Select.Trigger {...props} class="w-full">
												{$formData.poi_id
													? pois.find((p) => p.id === $formData.poi_id)?.name
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

			<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
				<div class="mb-2 flex items-center gap-2">
					<Sparkles class="h-5 w-5 text-blue-600" />
					<span class="font-semibold text-blue-900">AI Assistant</span>
				</div>
				<p class="mb-3 text-sm text-blue-700">
					Let AI generate a title and prompt based on the selected settings.
				</p>
				<Button
					type="button"
					variant="outline"
					onclick={generateAIContent}
					disabled={isGeneratingAI}
					class="w-full border-blue-300 bg-white hover:bg-blue-50"
				>
					{#if isGeneratingAI}
						<span class="flex items-center gap-2">
							<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
									fill="none"
								/>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
							Generating...
						</span>
					{:else}
						<span class="flex items-center gap-2">
							<Sparkles class="h-4 w-4" />
							Generate with AI
						</span>
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

			<Sheet.Footer class="flex flex-row justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (isFormOpen = false)}>Cancel</Button>
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
