<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import ValidationChecklist from './validation-checklist.svelte';
	import type { Component } from 'svelte';
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
		Upload,
		X,
		ArrowRight,
		Save,
		ArrowLeft
	} from 'lucide-svelte';
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
		icon: Component;
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

	const { form: formData, errors, enhance, delayed, tainted } = form;

	let selectedPresetId = $state<string>('wise-guide');
	let avatarInput: HTMLInputElement;
	let avatarPreview = $state<string | undefined>($formData.avatar_url || undefined);
	let isUploadingImage = $state(false);
	let imageTimestamp = $state(Date.now());

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
			avatarPreview = undefined;
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

	const handleAvatarUpload = (event: Event) => {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			if (!file.type.startsWith('image/')) {
				toast.error('Please select an image file');
				return;
			}

			if (file.size > 10 * 1024 * 1024) {
				toast.error('Image must be less than 10MB');
				return;
			}

			const oldImageUrl = $formData.avatar_url;

			// Show preview immediately
			const reader = new FileReader();
			reader.onload = (e) => {
				avatarPreview = e.target?.result as string;
			};
			reader.readAsDataURL(file);

			// Upload to Supabase
			uploadImageToSupabase(file, oldImageUrl);
		}
	};

	async function uploadImageToSupabase(file: File, oldImageUrl?: string | null) {
		isUploadingImage = true;
		try {
			if (!session) {
				toast.error('You must be logged in to upload images');
				return;
			}

			const fileExt = file.name.split('.').pop();
			const fileName = `ai-companion-${Date.now()}.${fileExt}`;
			const filePath = `${session.user.id}/${params.id}/ai-companion/${fileName}`;

			// Delete old image if exists
			if (oldImageUrl && oldImageUrl.trim() !== '') {
				try {
					const urlWithoutParams = oldImageUrl.split('?')[0];
					const url = new URL(urlWithoutParams);
					const pathParts = url.pathname.split('/');
					const oldPath = pathParts.slice(-4).join('/');

					await supabase.storage.from('game-images').remove([oldPath]);
				} catch (error) {
					console.warn('Error deleting old image:', error);
				}
			}

			const { error } = await supabase.storage.from('game-images').upload(filePath, file, {
				cacheControl: '3600',
				upsert: true
			});

			if (error) {
				console.error('Upload error:', error);
				toast.error('Failed to upload image: ' + error.message);
				return;
			}

			const {
				data: { publicUrl }
			} = supabase.storage.from('game-images').getPublicUrl(filePath);

			$formData.avatar_url = publicUrl;
			imageTimestamp = Date.now();
			avatarPreview = `${publicUrl}?t=${imageTimestamp}`;
			toast.success('Avatar uploaded successfully');
		} catch (error) {
			console.error('Upload error:', error);
			toast.error('Failed to upload image');
		} finally {
			isUploadingImage = false;
		}
	}

	const removeAvatar = async () => {
		if (isUploadingImage) return;

		const oldImageUrl = $formData.avatar_url;

		// Delete from storage if exists
		if (oldImageUrl && oldImageUrl.trim() !== '') {
			try {
				const urlWithoutParams = oldImageUrl.split('?')[0];
				const url = new URL(urlWithoutParams);
				const pathParts = url.pathname.split('/');
				const oldPath = pathParts.slice(-4).join('/');

				await supabase.storage.from('game-images').remove([oldPath]);
				toast.success('Avatar removed');
			} catch (error) {
				console.warn('Error deleting image:', error);
			}
		}

		avatarPreview = undefined;
		$formData.avatar_url = '';
		if (avatarInput) {
			avatarInput.value = '';
		}
	};

	// Sync avatarPreview with formData
	$effect(() => {
		avatarPreview = $formData.avatar_url || undefined;
	});

	const validationChecks = $derived.by(
		(): Array<{
			label: string;
			status: 'complete' | 'incomplete' | 'warning';
			description: string;
		}> => {
			return [
				{
					label: 'Companion name',
					status: ($formData.name ? 'complete' : 'incomplete') as 'complete' | 'incomplete',
					description: 'Required'
				},
				{
					label: 'Tone',
					status: ($formData.tone ? 'complete' : 'incomplete') as 'complete' | 'incomplete',
					description: 'Required'
				},
				{
					label: 'Personality',
					status: ($formData.personality ? 'complete' : 'incomplete') as 'complete' | 'incomplete',
					description: 'Required'
				},
				{
					label: 'Relationship',
					status: ($formData.relationship ? 'complete' : 'incomplete') as 'complete' | 'incomplete',
					description: 'Required'
				},
				{
					label: 'Humor level',
					status: ($formData.humor_level !== undefined && $formData.humor_level !== null
						? 'complete'
						: 'incomplete') as 'complete' | 'incomplete',
					description: 'Required'
				},
				{
					label: 'Formality level',
					status: ($formData.formality !== undefined && $formData.formality !== null
						? 'complete'
						: 'incomplete') as 'complete' | 'incomplete',
					description: 'Required'
				},
				{
					label: 'Avatar image',
					status: ($formData.avatar_url ? 'complete' : 'warning') as 'complete' | 'warning',
					description: 'Recommended'
				},
				{
					label: 'Additional context',
					status: ($formData.additional_context ? 'complete' : 'warning') as 'complete' | 'warning',
					description: 'Recommended'
				}
			];
		}
	);
</script>

<div class="mx-auto w-full flex-1">
	<div class="grid grid-cols-1 gap-2 lg:grid-cols-3">
		<!-- Main Content -->
		<div class="lg:col-span-2">
			<form method="POST" action="?/save" use:enhance>
				<div class="space-y-8 rounded-lg border border-gray-300 bg-white p-6">
					<div class="mb-6">
						<h2 class="text-2xl font-semibold">AI Companion</h2>
						<p class="text-gray-600">Configure your AI companion's personality and behavior</p>
					</div>
					<div>
						<h3 class="mb-4 text-lg font-medium">Choose a Preset</h3>
						<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
							{#each presets as preset}
								{@const Icon = preset.icon}
								<button
									type="button"
									onclick={() => selectPreset(preset.id)}
									class="relative flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-all hover:border-primary {selectedPresetId ===
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
									<div>
										<h4 class="font-semibold">{preset.name}</h4>
										<p class="mt-1 text-sm text-gray-600">{preset.description}</p>
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
								class="relative flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center {isCustom
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
									<h4 class="font-semibold">Custom</h4>
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
									<Input
										{...props}
										bind:value={$formData.name}
										placeholder="Enter companion name"
									/>
								{/snippet}
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>

						<!-- Avatar Upload -->
						<Form.Field {form} name="avatar_url">
							<Form.Control>
								{#snippet children({ props })}
									<Form.Label>
										<div class="flex items-center gap-2">
											<Upload class="h-4 w-4" />
											Avatar (Optional)
										</div>
									</Form.Label>
									<div class="flex items-center gap-3">
										{#if avatarPreview}
											<div class="relative">
												<img
													src={avatarPreview}
													alt="Avatar preview"
													class="h-16 w-16 rounded-full object-cover"
												/>
												{#if isUploadingImage}
													<div
														class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50"
													>
														<svg
															class="h-6 w-6 animate-spin text-white"
															xmlns="http://www.w3.org/2000/svg"
															fill="none"
															viewBox="0 0 24 24"
														>
															<circle
																class="opacity-25"
																cx="12"
																cy="12"
																r="10"
																stroke="currentColor"
																stroke-width="4"
															></circle>
															<path
																class="opacity-75"
																fill="currentColor"
																d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
															></path>
														</svg>
													</div>
												{/if}
												<Button
													type="button"
													onclick={removeAvatar}
													disabled={isUploadingImage}
													class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 p-0 text-white hover:bg-red-600"
												>
													<X class="h-3 w-3" />
												</Button>
											</div>
										{:else}
											<div
												class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400"
											>
												<User class="h-8 w-8" />
											</div>
										{/if}
										<input
											bind:this={avatarInput}
											type="file"
											accept="image/*"
											onchange={handleAvatarUpload}
											id="avatar-upload"
											class="hidden"
											disabled={isUploadingImage}
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => avatarInput?.click()}
											disabled={isUploadingImage}
										>
											<Upload class="mr-2 h-4 w-4" />
											{isUploadingImage ? 'Uploading...' : 'Upload Image'}
										</Button>
									</div>
								{/snippet}
							</Form.Control>
							<Form.FieldErrors />
						</Form.Field>

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
											{#each toneOptions as tone}
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
											{#each personalityOptions as personality}
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
											{#each relationshipOptions as relationship}
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
										This information will be added to the system prompt to customize the AI's
										behavior further.
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
						<div class="flex gap-4">
							<Button type="submit" size="lg" disabled={$delayed}>
								{#if $delayed}
									<span class="flex items-center gap-2">
										<Spinner class="h-4 w-4" />
										Saving...
									</span>
								{:else}
									<Save /> Save AI Companion
								{/if}
							</Button>
							<Button
								type="button"
								size="lg"
								href={`/dashboard/games/${params.id}/edit/review`}
								disabled={Object.keys($tainted || {}).length > 0 || $delayed}
							>
								Next <ArrowRight />
							</Button>
						</div>
					</div>
				</div>
			</form>
		</div>

		<!-- Validation Checklist Sidebar -->
		<div class="lg:col-span-1">
			<ValidationChecklist title="Validation Checklist" checks={validationChecks} />
		</div>
	</div>
</div>
