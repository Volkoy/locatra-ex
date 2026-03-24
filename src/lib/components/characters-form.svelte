<script lang="ts">
	import { ArrowLeft, ArrowRight, Plus, SquarePen, Trash2, UserRound } from 'lucide-svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import ImageUpload from './image-upload.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { superForm } from 'sveltekit-superforms';
	import { characterSchema } from '$lib/zod/schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { invalidateAll, beforeNavigate } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Spinner from './ui/spinner/spinner.svelte';

	let { data, params, supabase, session } = $props();

	type Character = {
		id: string;
		name: string;
		summary: string;
		image_url?: string;
		category: 'human' | 'non-human';
		bg_color: string;
		text_color: string;
	};

	let characters = $derived<Character[]>(data.characters || []);
	let isFormOpen = $state(false);
	let editingCharacter = $state<Character | null>(null);
	let previewImageSrc = $state<string | null>(null);

	// Search and sort state
	let searchQuery = $state('');
	let sortBy = $state<'name' | 'category'>('name');

	const form = superForm(data.form, {
		validators: zod4Client(characterSchema),
		dataType: 'json',
		resetForm: true,
		onUpdated: ({ form }) => {
			if (form.valid) {
				const action = editingCharacter ? 'updated' : 'created';
				toast.success(`Character ${action} successfully!`);
				isFormOpen = false;
				editingCharacter = null;
				invalidateAll(); // Refresh the character list
			}
		}
	});

	const { form: formData, enhance, delayed } = form;

	// Filtered and sorted characters
	let filteredCharacters = $derived.by(() => {
		const items = characters ?? [];
		let filtered = items.filter(
			(char) =>
				char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				char.summary.toLowerCase().includes(searchQuery.toLowerCase())
		);

		return filtered.sort((a, b) => {
			if (sortBy === 'name') {
				return a.name.localeCompare(b.name);
			} else {
				return a.category.localeCompare(b.category);
			}
		});
	});

	const openCreateForm = () => {
		editingCharacter = null;
		$formData.id = undefined;
		$formData.name = '';
		$formData.summary = '';
		$formData.image_url = '';
		$formData.category = 'human';
		$formData.bg_color = '#ffffff';
		$formData.text_color = '#000000';
		previewImageSrc = null;
		isFormOpen = true;
	};

	const openEditForm = (character: Character) => {
		editingCharacter = character;
		$formData.id = character.id;
		$formData.name = character.name;
		$formData.summary = character.summary;
		$formData.image_url = character.image_url || '';
		$formData.category = character.category;
		$formData.bg_color = character.bg_color || '#ffffff';
		$formData.text_color = character.text_color || '#000000';
		previewImageSrc = character.image_url || null;
		isFormOpen = true;
	};

	async function deleteCharacter(id: string) {
		if (!confirm('Are you sure you want to delete this character?')) return;

		const formData = new FormData();
		formData.append('characterId', id);

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			toast.success('Character deleted successfully!');
			invalidateAll();
		} else {
			toast.error('Failed to delete character');
		}
	}

	beforeNavigate(() => {
		// Ensure the portal-based sheet is closed before leaving this route.
		isFormOpen = false;
		editingCharacter = null;
	});

	onDestroy(() => {
		// Defensive cleanup in case unmount happens while the sheet is open.
		isFormOpen = false;
		editingCharacter = null;
	});
</script>

<div class="mx-auto w-full flex-1">
	<div class="space-y-6 rounded-lg border border-gray-300 bg-white p-6">
		<div class="mb-6">
			<h2 class="text-2xl font-semibold">Characters</h2>
			<p class="text-gray-600">
				Create characters that players can embody during the game. Players can choose from these
				characters when joining a game and write their story from the character's perspective.
			</p>
		</div>

		{#if characters.length === 0}
			<Empty.Root>
				<Empty.Header>
					<Empty.Media variant="icon">
						<UserRound />
					</Empty.Media>
					<Empty.Title>No Characters Yet</Empty.Title>
					<Empty.Description>
						Create your first character to get started. Characters offer unique perspectives and
						roles in your game's story.
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button size="lg" onclick={openCreateForm}>
						<Plus class="mr-2 h-5 w-5" />
						Create Character
					</Button>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<div class="flex gap-4">
				<Field.Field class="max-w-[320px]">
					<Field.Label for="search">Search Characters</Field.Label>
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
							{sortBy === 'name' ? 'Name' : 'Category'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="name">Name</Select.Item>
							<Select.Item value="category">Category</Select.Item>
						</Select.Content>
					</Select.Root>
				</Field.Field>
			</div>

			<!-- Character Grid -->
			<div class="flex flex-wrap gap-3">
				<!-- Add Character Card -->
				<button
					onclick={openCreateForm}
					class="group flex w-72 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 transition-all hover:cursor-pointer hover:border-primary hover:bg-gray-50"
				>
					<Plus class="h-6 w-6 text-gray-400 transition-colors group-hover:text-primary" />
					<span class="text-xs font-medium text-gray-500 transition-colors group-hover:text-primary"
						>Add Character</span
					>
				</button>

				<!-- Character Cards -->
				{#each filteredCharacters as character (character.id)}
					<div
						class="group inside-border relative flex aspect-[2/3] w-72 flex-col justify-between overflow-hidden rounded-xl border-8 border-white outline-2 outline-gray-200"
						style="background-color: {character.bg_color ||
							'#ffffff'}; color: {character.text_color || '#000000'}"
					>
						<!-- Image -->
						<div
							class="flex h-1/2 w-full shrink-0 items-center justify-center overflow-hidden"
							style="background-color: color-mix(in srgb, {character.bg_color ||
								'#ffffff'} 80%, #888)"
						>
							{#if character.image_url}
								<img
									src={character.image_url}
									alt="{character.name} avatar"
									class="h-full w-full object-cover"
								/>
							{:else}
								<UserRound class="h-16 w-16 opacity-30" />
							{/if}
						</div>

						<!-- Content -->
						<div class="flex w-full flex-col items-center gap-1 px-4 py-4 text-center">
							<span
								class="rounded-full px-2 py-0.5 text-xs font-semibold opacity-60"
								style="border: 1px solid currentColor"
							>
								{character.category === 'human' ? 'Human' : 'Non-Human'}
							</span>
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger class="w-full">
										<h3 class="mt-1 line-clamp-1 w-full text-base leading-tight font-bold">
											{character.name}
										</h3>
									</Tooltip.Trigger>
									<Tooltip.Content>{character.name}</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger class="w-full">
										<p class="line-clamp-3 w-full text-xs leading-relaxed opacity-70">
											{character.summary}
										</p>
									</Tooltip.Trigger>
									<Tooltip.Content class="max-w-xs">{character.summary}</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
						</div>

						<div class="flex w-full items-center gap-2 p-2">
							<Button size="sm" class="flex-1" onclick={() => openEditForm(character)}>
								<SquarePen class="h-4 w-4" /> Edit
							</Button>
							<Button size="sm" variant="destructive" onclick={() => deleteCharacter(character.id)}>
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					</div>
				{/each}
			</div>

			<!-- Empty Search State -->
			{#if filteredCharacters.length === 0}
				<div class="py-12 text-center">
					<p class="text-gray-500">No characters found matching "{searchQuery}"</p>
				</div>
			{/if}
		{/if}

		<div class="mt-8 flex w-full justify-end gap-4">
			<Button variant="outline" size="lg" href={`/dashboard/games/${params.id}/edit/general`}>
				<ArrowLeft /> Back
			</Button>
			<Button size="lg" href={`/dashboard/games/${params.id}/edit/pois`}>Next <ArrowRight /></Button
			>
		</div>
	</div>
</div>

<Sheet.Root bind:open={isFormOpen}>
	<Sheet.Content side="right" portalled={false} class="w-full overflow-y-auto sm:max-w-lg">
		<Sheet.Header>
			<Sheet.Title>{editingCharacter ? 'Edit Character' : 'Create New Character'}</Sheet.Title>
			<Sheet.Description>
				{editingCharacter
					? 'Update the character details below.'
					: 'Fill in the details to create a new character for your game.'}
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action="?/{editingCharacter ? 'update' : 'create'}"
			use:enhance
			class="space-y-6 p-4"
		>
			<Input type="hidden" name="id" bind:value={$formData.id} />

			<!-- Character Avatar -->
			<Form.Field {form} name="image_url">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="font-bold">Character Avatar</Form.Label>
						<Form.Description>
							Upload an image for the character (PNG, JPG, WEBP · max 50 MB — cropped to 1:1).
						</Form.Description>
						<ImageUpload
							aspectRatio={1}
							currentImageUrl={$formData.image_url}
							storagePath="{session.user.id}/{params.id}/characters/{editingCharacter?.id ?? 'new'}"
							{supabase}
							onPreview={(url) => {
								previewImageSrc = url;
							}}
							onUploaded={(url) => {
								$formData.image_url = url;
							}}
							onRemoved={() => {
								$formData.image_url = '';
								previewImageSrc = null;
							}}
						/>
						<input type="hidden" {...props} bind:value={$formData.image_url} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Character Name -->
			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="font-bold">Character Name</Form.Label>
						<Form.Description>The name of the character.</Form.Description>
						<Input
							{...props}
							bind:value={$formData.name}
							placeholder="e.g., Species name, Profession, Nickname"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Summary -->
			<Form.Field {form} name="summary">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="font-bold">Character Summary</Form.Label>
						<Form.Description>A brief description of the character.</Form.Description>
						<Textarea
							{...props}
							bind:value={$formData.summary}
							rows={4}
							placeholder="Describe the character's background, personality, and role in the story..."
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Category -->
			<Form.Field {form} name="category">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="font-bold">Category</Form.Label>
						<Form.Description>Choose if the character is human or non-human.</Form.Description>
						<Select.Root type="single" bind:value={$formData.category}>
							<Select.Trigger {...props} class="w-full">
								{$formData.category === 'human' ? 'Human' : 'Non-Human'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="human">Human</Select.Item>
								<Select.Item value="non-human">Non-Human</Select.Item>
							</Select.Content>
						</Select.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Card Colors -->
			<div class="space-y-3">
				<p class="text-sm font-bold">Card Colors</p>
				<div class="flex gap-4">
					<Form.Field {form} name="bg_color" class="flex-1">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label class="text-sm">Background</Form.Label>
								<div class="flex items-center gap-2">
									<input
										{...props}
										type="color"
										bind:value={$formData.bg_color}
										class="h-9 w-12 cursor-pointer rounded border p-0.5"
									/>
									<Input bind:value={$formData.bg_color} class="font-mono text-sm" />
								</div>
							{/snippet}
						</Form.Control>
					</Form.Field>
					<Form.Field {form} name="text_color" class="flex-1">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label class="text-sm">Text</Form.Label>
								<div class="flex items-center gap-2">
									<input
										{...props}
										type="color"
										bind:value={$formData.text_color}
										class="h-9 w-12 cursor-pointer rounded border p-0.5"
									/>
									<Input bind:value={$formData.text_color} class="font-mono text-sm" />
								</div>
							{/snippet}
						</Form.Control>
					</Form.Field>
				</div>
			</div>

			<!-- Card Preview -->
			<div class="space-y-2">
				<p class="text-sm font-bold">Preview</p>
				<div
					class="inside-border relative mx-auto flex aspect-[2/3] w-72 flex-col gap-4 overflow-hidden rounded-xl border-8 border-white outline-2 outline-gray-200"
					style="background-color: {$formData.bg_color}; color: {$formData.text_color}"
				>
					<!-- Image -->
					<div
						class="flex h-1/2 w-full shrink-0 items-center justify-center overflow-hidden"
						style="background-color: color-mix(in srgb, {$formData.bg_color} 80%, #888)"
					>
						{#if previewImageSrc}
							<img src={previewImageSrc} alt="preview" class="h-full w-full object-cover" />
						{:else}
							<UserRound class="h-16 w-16 opacity-30" />
						{/if}
					</div>
					<!-- Content -->
					<div class="flex w-full flex-col items-center gap-1 px-4 py-4 text-center">
						<span
							class="rounded-full px-2 py-0.5 text-xs font-semibold opacity-60"
							style="border: 1px solid currentColor"
						>
							{$formData.category === 'human' ? 'Human' : 'Non-Human'}
						</span>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger class="w-full">
									<h3 class="mt-1 line-clamp-1 w-full text-base leading-tight font-bold">
										{$formData.name || 'Character name'}
									</h3>
								</Tooltip.Trigger>
								<Tooltip.Content>{$formData.name || 'Character name'}</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger class="w-full">
									<p class="line-clamp-3 w-full text-xs leading-relaxed opacity-70">
										{$formData.summary || 'Character summary...'}
									</p>
								</Tooltip.Trigger>
								<Tooltip.Content class="max-w-xs"
									>{$formData.summary || 'Character summary...'}</Tooltip.Content
								>
							</Tooltip.Root>
						</Tooltip.Provider>
					</div>
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
							{editingCharacter ? 'Update Character' : 'Create Character'}
						{/if}
					</Button>
				</Sheet.Footer>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>
