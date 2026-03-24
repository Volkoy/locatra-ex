<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import {
		Brain,
		Compass,
		Sparkles,
		BookOpen,
		User,
		Smile,
		Volume2,
		MessageCircle,
		HatGlasses,
		ArrowRight,
		Save,
		ArrowLeft
	} from 'lucide-svelte';
	import ImageUpload from '$lib/components/image-upload.svelte';
	import { superForm } from 'sveltekit-superforms';
	import { aiCompanionSchema } from '$lib/zod/schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';

	let { data, params, supabase, session } = $props();

	type Tone = 'enthusiastic' | 'calm' | 'mysterious' | 'professional' | 'playful' | 'serious';
	type Personality = 'mentor' | 'friend' | 'sage' | 'explorer' | 'historian' | 'storyteller';
	type Relationship = 'guide' | 'companion' | 'rival' | 'mysterious-ally';

	type AISettings = {
		name: string;
		avatar_url?: string;
		tone: Tone;
		personality: Personality;
		relationship: Relationship;
		humor_level: number;
		formality: number;
	};

	type Preset = {
		id: string;
		name: string;
		description: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: any;
		settings: AISettings;
	};

	const presets: Preset[] = [
		{
			id: 'wise-guide',
			name: 'The Wise Guide',
			description: 'A calm mentor who provides comprehensive knowledge and supportive guidance',
			icon: BookOpen,
			settings: {
				name: 'Sage',
				tone: 'calm',
				personality: 'mentor',
				relationship: 'guide',
				humor_level: 0,
				formality: 2
			}
		},
		{
			id: 'curious-explorer',
			name: 'The Curious Explorer',
			description: 'An enthusiastic companion who loves adventure and discovery',
			icon: Compass,
			settings: {
				name: 'Luna',
				tone: 'enthusiastic',
				personality: 'explorer',
				relationship: 'companion',
				humor_level: 2,
				formality: 0
			}
		},
		{
			id: 'mysterious-owl',
			name: 'The Mysterious Owl',
			description: 'An enigmatic sage who speaks in riddles and subtle hints',
			icon: HatGlasses,
			settings: {
				name: 'The Keeper',
				tone: 'mysterious',
				personality: 'storyteller',
				relationship: 'mysterious-ally',
				humor_level: 0,
				formality: 2
			}
		}
	];

	const form = superForm(data.form, {
		validators: zod4Client(aiCompanionSchema),
		dataType: 'json',
		resetForm: false,
		onUpdated: ({ form }) => {
			if (form.valid) {
				toast.success('AI companion saved!');
			}
		}
	});

	const { form: formData, enhance, delayed, tainted } = form;

	const detectPreset = () =>
		presets.find(
			(p) =>
				$formData.name === p.settings.name &&
				$formData.tone === p.settings.tone &&
				$formData.personality === p.settings.personality &&
				$formData.relationship === p.settings.relationship &&
				$formData.humor_level === p.settings.humor_level &&
				$formData.formality === p.settings.formality
		)?.id ?? 'wise-guide';
	let selectedPresetId = $state<string>(detectPreset());
	const isCustom = $derived.by(() => {
		const preset = presets.find((p) => p.id === selectedPresetId);

		if (!preset) return true;

		return (
			$formData.name !== preset.settings.name ||
			$formData.tone !== preset.settings.tone ||
			$formData.personality !== preset.settings.personality ||
			$formData.relationship !== preset.settings.relationship ||
			$formData.humor_level !== preset.settings.humor_level ||
			$formData.formality !== preset.settings.formality
		);
	});

	const selectPreset = (presetId: string) => {
		const preset = presets.find((p) => p.id === presetId);
		if (preset) {
			selectedPresetId = presetId;
			$formData.name = preset.settings.name;
			$formData.tone = preset.settings.tone;
			$formData.personality = preset.settings.personality;
			$formData.relationship = preset.settings.relationship;
			$formData.humor_level = preset.settings.humor_level;
			$formData.formality = preset.settings.formality;
			$formData.avatar_url = '';
		}
	};

	const toneOptions = [
		{ value: 'enthusiastic', label: 'Enthusiastic' },
		{ value: 'calm', label: 'Calm' },
		{ value: 'mysterious', label: 'Mysterious' },
		{ value: 'professional', label: 'Professional' },
		{ value: 'playful', label: 'Playful' },
		{ value: 'serious', label: 'Serious' }
	];

	const personalityOptions = [
		{ value: 'mentor', label: 'Mentor' },
		{ value: 'friend', label: 'Friend' },
		{ value: 'sage', label: 'Sage' },
		{ value: 'explorer', label: 'Explorer' },
		{ value: 'historian', label: 'Historian' },
		{ value: 'storyteller', label: 'Storyteller' }
	];

	const relationshipOptions = [
		{ value: 'guide', label: 'Guide' },
		{ value: 'companion', label: 'Companion' },
		{ value: 'rival', label: 'Rival' },
		{ value: 'mysterious-ally', label: 'Mysterious Ally' }
	];
</script>

<div class="mx-auto w-full flex-1">
	<form method="POST" action="?/save" use:enhance>
		<div class="space-y-8 rounded-lg border border-gray-300 bg-white p-6">
			<div class="mb-6">
				<h2 class="text-2xl font-semibold">AI Companion</h2>
				<p class="text-gray-600">Configure your AI companion's personality and behavior</p>
			</div>
			<div>
				<h3 class="mb-4 text-lg font-medium">Choose a Preset</h3>
				<div class="flex flex-wrap gap-4">
					{#each presets as preset (preset.id)}
						{@const Icon = preset.icon}
						<button
							type="button"
							onclick={() => selectPreset(preset.id)}
							class="relative flex max-w-72 flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-all hover:border-primary {selectedPresetId ===
								preset.id && !isCustom
								? 'border-primary bg-primary/5'
								: 'border-gray-200 bg-white'}"
						>
							<div
								class="flex h-16 w-16 items-center justify-center rounded-full {selectedPresetId ===
									preset.id && !isCustom
									? 'bg-primary/20 text-primary'
									: 'bg-gray-100 text-gray-600'}"
							>
								<Icon class="h-8 w-8" />
							</div>
							<div class="w-full">
								<h4 class="line-clamp-1 text-sm font-semibold">{preset.name}</h4>
								<p class="line-clamp-3 text-xs text-gray-600">{preset.description}</p>
							</div>
							{#if !isCustom && selectedPresetId === preset.id}
								<div
									class="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white"
								>
									<Sparkles class="h-4 w-4" />
								</div>
							{/if}
						</button>
					{/each}

					<!-- Custom Configuration Card -->
					<button
						type="button"
						disabled
						class="relative flex w-72 shrink-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 p-4 text-center {isCustom
							? 'border-primary bg-primary/5'
							: 'border-gray-200 bg-white opacity-60'}"
					>
						<div
							class="flex h-16 w-16 items-center justify-center rounded-full {isCustom
								? 'bg-primary/20 text-primary'
								: 'bg-gray-100 text-gray-600'}"
						>
							<Brain class="h-8 w-8" />
						</div>
						<div>
							<h4 class="text-sm font-semibold">Custom</h4>
							<p class="mt-1 text-sm text-gray-600">Personalized settings</p>
						</div>
						{#if isCustom}
							<div
								class="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white"
							>
								<Sparkles class="h-4 w-4" />
							</div>
						{/if}
					</button>
				</div>
			</div>

			<!-- Customization Panel -->
			<div class="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
				<h3 class="text-lg font-medium">Customize the Companion</h3>

				<!-- Name -->
				<Form.Field {form} name="name">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>
								<div class="flex items-center gap-2">
									<User class="h-4 w-4" />
									Companion Name
								</div>
							</Form.Label>
							<Input {...props} bind:value={$formData.name} placeholder="Enter companion name" />
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<!-- Avatar Upload -->
				<div class="space-y-2">
					<p class="text-sm font-medium">Avatar (Optional)</p>
					<p class="text-sm text-gray-500">PNG, JPG, WEBP · max 50 MB — cropped to circle</p>
					<div class="w-32">
						<ImageUpload
							currentImageUrl={$formData.avatar_url}
							storagePath={`${session?.user.id}/${params.id}/ai-companion`}
							{supabase}
							circular={true}
							hideHint={true}
							onUploaded={(url) => ($formData.avatar_url = url)}
							onRemoved={() => ($formData.avatar_url = '')}
						/>
					</div>
				</div>

				<!-- Tone -->
				<Form.Field {form} name="tone">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>
								<div class="flex items-center gap-2">
									<Volume2 class="h-4 w-4" />
									Tone of Voice
								</div>
							</Form.Label>
							<Select.Root type="single" bind:value={$formData.tone}>
								<Select.Trigger {...props} class="w-full">
									{toneOptions.find((t) => t.value === $formData.tone)?.label || 'Select tone'}
								</Select.Trigger>
								<Select.Content>
									{#each toneOptions as tone (tone.value)}
										<Select.Item value={tone.value}>{tone.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<!-- Personality -->
				<Form.Field {form} name="personality">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>
								<div class="flex items-center gap-2">
									<Smile class="h-4 w-4" />
									Personality Type
								</div>
							</Form.Label>
							<Select.Root type="single" bind:value={$formData.personality}>
								<Select.Trigger {...props} class="w-full">
									{personalityOptions.find((p) => p.value === $formData.personality)?.label ||
										'Select personality'}
								</Select.Trigger>
								<Select.Content>
									{#each personalityOptions as personality (personality.value)}
										<Select.Item value={personality.value}>{personality.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<!-- Relationship -->
				<Form.Field {form} name="relationship">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>
								<div class="flex items-center gap-2">
									<MessageCircle class="h-4 w-4" />
									Relationship with Player
								</div>
							</Form.Label>
							<Select.Root type="single" bind:value={$formData.relationship}>
								<Select.Trigger {...props} class="w-full">
									{relationshipOptions.find((r) => r.value === $formData.relationship)?.label ||
										'Select relationship'}
								</Select.Trigger>
								<Select.Content>
									{#each relationshipOptions as relationship (relationship.value)}
										<Select.Item value={relationship.value}>{relationship.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>

				<!-- Formality & Humor -->
				<div class="space-y-6">
					<!-- Formality -->
					<Form.Field {form} name="formality">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>Formality Level</Form.Label>
								<div class="grid grid-cols-3 gap-2">
									<button
										{...props}
										type="button"
										onclick={() => ($formData.formality = 0)}
										class="rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all {$formData.formality ===
										0
											? 'border-primary bg-primary/10 text-primary'
											: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}"
									>
										Casual
									</button>
									<button
										{...props}
										type="button"
										onclick={() => ($formData.formality = 1)}
										class="rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all {$formData.formality ===
										1
											? 'border-primary bg-primary/10 text-primary'
											: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}"
									>
										Balanced
									</button>
									<button
										{...props}
										type="button"
										onclick={() => ($formData.formality = 2)}
										class="rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all {$formData.formality ===
										2
											? 'border-primary bg-primary/10 text-primary'
											: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}"
									>
										Formal
									</button>
								</div>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<!-- Humor -->
					<Form.Field {form} name="humor_level">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label>Humor Level</Form.Label>
								<div class="grid grid-cols-3 gap-2">
									<button
										{...props}
										type="button"
										onclick={() => ($formData.humor_level = 0)}
										class="rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all {$formData.humor_level ===
										0
											? 'border-primary bg-primary/10 text-primary'
											: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}"
									>
										Serious
									</button>
									<button
										type="button"
										onclick={() => ($formData.humor_level = 1)}
										class="rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all {$formData.humor_level ===
										1
											? 'border-primary bg-primary/10 text-primary'
											: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}"
									>
										Subtle
									</button>
									<button
										type="button"
										onclick={() => ($formData.humor_level = 2)}
										class="rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all {$formData.humor_level ===
										2
											? 'border-primary bg-primary/10 text-primary'
											: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}"
									>
										Playful
									</button>
								</div>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>
				</div>

				<!-- Additional Context -->
				<Form.Field {form} name="additional_context">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Additional Instructions (Optional)</Form.Label>
							<Textarea
								{...props}
								bind:value={$formData.additional_context}
								rows={5}
								placeholder="Add any special instructions, background information, or specific behaviors you want the AI companion to have."
								class="resize-none"
							/>
							<Form.Description>
								This information will be added to the system prompt to customize the AI's behavior
								further.
							</Form.Description>
						{/snippet}
					</Form.Control>
					<Form.FieldErrors />
				</Form.Field>
			</div>

			<!-- Navigation Buttons -->
			<div class="mt-8 flex w-full justify-between gap-4">
				<Button
					type="button"
					variant="outline"
					size="lg"
					href={`/dashboard/games/${params.id}/edit/cards`}
				>
					<ArrowLeft /> Back
				</Button>
					{#if Object.keys($tainted || {}).length > 0}
					<Button type="submit" size="lg" disabled={$delayed}>
						{#if $delayed}
							<Spinner class="h-4 w-4" /> Saving...
						{:else}
							<Save /> Save Changes
						{/if}
					</Button>
				{:else}
					<Button type="button" size="lg" href={`/dashboard/games/${params.id}/edit/review`}>
						Next <ArrowRight />
					</Button>
				{/if}
			</div>
		</div>
	</form>
</div>
