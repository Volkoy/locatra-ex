<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		Gamepad2,
		Plus,
		Trash2,
		SquarePen,
		MoreVertical,
		Eye,
		Upload,
		Download,
		EllipsisVertical
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();
	let games = $derived(data.games || []);

	const deleteGame = async (gameId: string, title: string) => {
		if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
			return;
		}

		const formData = new FormData();
		formData.append('gameId', gameId);

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (response.ok) {
			toast.success(`"${title}" deleted successfully`);
			await invalidateAll();
		} else {
			const errorMessage = result?.message || 'Failed to delete game';
			toast.error(errorMessage);
		}
	};

	const publishGame = async (gameId: string, title: string) => {
		const formData = new FormData();
		formData.append('gameId', gameId);

		const response = await fetch('?/publish', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (response.ok) {
			toast.success(`"${title}" published successfully`);
			await invalidateAll();
		} else {
			const errorMessage = result?.message || 'Failed to publish game';
			toast.error(errorMessage);

			// Show validation errors if present
			if (result?.validationErrors && result.validationErrors.length > 0) {
				result.validationErrors.forEach((error: string) => {
					toast.error(error);
				});
			}
		}
	};

	const unpublishGame = async (gameId: string, title: string) => {
		const formData = new FormData();
		formData.append('gameId', gameId);

		const response = await fetch('?/unpublish', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (response.ok) {
			toast.success(`"${title}" unpublished successfully`);
			await invalidateAll();
		} else {
			const errorMessage = result?.message || 'Failed to unpublish game';
			toast.error(errorMessage);
		}
	};

	const getStatusVariant = (status: string) => {
		if (status === 'published') return 'default';
		if (status === 'draft') return 'secondary';
		return 'outline';
	};

	const editGame = async (gameId: string, status: string, title: string) => {
		if (status === 'published') {
			if (
				!confirm(
					'Editing this game will set it to unpublished. You will need to publish it again after making changes. Do you want to continue?'
				)
			) {
				return;
			}
			await unpublishGame(gameId, title);
		}
		goto(`/dashboard/games/${gameId}/edit/general`);
	};
</script>

<main class="mx-auto h-screen p-6">
	<div class="mt-4 flex items-center justify-between">
		<h3 class="text-2xl font-bold">Your Games</h3>
		<Button href="/dashboard/games/new">
			<Plus class="h-4 w-4" /> Create new game
		</Button>
	</div>

	{#if games.length === 0}
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="icon">
					<Gamepad2 />
				</Empty.Media>
				<Empty.Title class="text-lg font-bold">No games</Empty.Title>
				<Empty.Description>
					You haven't created any games yet. Get started by creating your first game.
				</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button href="/dashboard/games/new">Create game</Button>
			</Empty.Content>
		</Empty.Root>
	{:else}
		<div class="mt-6 flex flex-wrap gap-4">
			{#each games as game}
				<div class="flex w-xs flex-col rounded-lg border">
					<div class="flex flex-grow flex-col">
						{#if game.image_url}
							<img
								src={game.image_url}
								alt="Cover"
								class="mb-4 aspect-video h-40 w-full object-cover"
							/>
						{:else}
							<div
								class="mb-4 flex aspect-video h-40 w-full items-center justify-center bg-gray-200"
							>
								<Gamepad2 class="h-12 w-12 text-gray-400" />
							</div>
						{/if}
						<div class="flex flex-grow flex-col px-4 pb-4">
							<div class="mb-2 flex items-start justify-between gap-2">
								<h4 class="text-xl font-semibold">{game.title || 'Untitled Game'}</h4>
								<Badge variant={getStatusVariant(game.status || 'draft')} class="capitalize">
									{game.status || 'draft'}
								</Badge>
							</div>
							<p class="mt-2 text-sm text-gray-600">{game.description || 'No description'}</p>
							<div class="mt-4 flex flex-wrap">
								{#each game.categories as category}
									<span
										class="mt-2 mr-2 w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
										>{category}</span
									>
								{/each}
							</div>
						</div>
					</div>
					<div class="mt-4 flex justify-end gap-2 p-4">
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								<Button variant="default" class="w-full">
									<EllipsisVertical class="h-4 w-4" />
									Actions
								</Button>
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="w-48">
								<DropdownMenu.Item
									onclick={() =>
										editGame(game.game_id, game.status || 'draft', game.title || 'Untitled Game')}
								>
									<SquarePen class="mr-2 h-4 w-4" />
									Edit
								</DropdownMenu.Item>
								<DropdownMenu.Item
									onclick={() => goto(`/dashboard/games/${game.game_id}/edit/review`)}
								>
									<Eye class="mr-2 h-4 w-4" />
									Review
								</DropdownMenu.Item>
								<DropdownMenu.Separator />
								{#if game.status === 'published'}
									<DropdownMenu.Item
										onclick={() => unpublishGame(game.game_id, game.title || 'Untitled Game')}
									>
										<Download class="mr-2 h-4 w-4" />
										Unpublish
									</DropdownMenu.Item>
								{:else}
									<DropdownMenu.Item
										onclick={() => publishGame(game.game_id, game.title || 'Untitled Game')}
									>
										<Upload class="mr-2 h-4 w-4" />
										Publish
									</DropdownMenu.Item>
								{/if}
								<DropdownMenu.Separator />
								<DropdownMenu.Item
									class="text-red-600 focus:text-red-600"
									onclick={() => deleteGame(game.game_id, game.title || 'Untitled Game')}
								>
									<Trash2 class="mr-2 h-4 w-4" />
									Delete
								</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>
