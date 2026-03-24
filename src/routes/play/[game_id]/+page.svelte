<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, MapPin, Users, Map, BookOpen } from 'lucide-svelte';

	let { data } = $props();
	let { game, longitude, latitude, poiCount, characterCount, session, supabase } = $derived(data);

	let isSigningIn = $state(false);

	async function handlePlay(mode: 'gps' | 'remote') {
		isSigningIn = true;
		try {
			if (!session) {
				const { error } = await supabase.auth.signInAnonymously();
				if (error) {
					console.error('Anonymous sign-in failed:', error);
					isSigningIn = false;
					return;
				}
			}
			await goto(`/play/${game.game_id}/setup?mode=${mode}`);
		} catch (e) {
			console.error('Error starting game:', e);
		} finally {
			isSigningIn = false;
		}
	}
</script>

<div class="flex h-[calc(100svh-var(--app-nav-height,0px))] bg-primary-foreground">
	<div
		class="mx-4 my-4 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-dark-green bg-white shadow-lg md:mx-auto"
	>
		<!-- Back button -->
		<div>
			<div class="flex items-center gap-2 p-2">
				<Button variant="ghost" size="sm" href="/play" class="gap-1">
					<ArrowLeft class="h-4 w-4" />
					Back
				</Button>
			</div>
		</div>

		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
			<!-- Hero image -->
			<div class="aspect-video w-full">
				{#if game.image_url}
					<img
						src={game.image_url}
						alt={game.title}
						class="h-full w-full rounded-xl object-cover"
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center bg-muted">
						<Map class="h-16 w-16 text-muted-foreground/30" />
					</div>
				{/if}
			</div>

			<!-- Content -->
			<div class="flex flex-1 flex-col justify-between py-6">
				<div class="space-y-3">
					<div>
						<h1 class="text-2xl font-bold">{game.title}</h1>
						{#if latitude && longitude}
							<p class="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
								<MapPin class="h-3 w-3" />
								{latitude.toFixed(4)}, {longitude.toFixed(4)}
							</p>
						{/if}
					</div>

					{#if game.description}
						<p class="leading-relaxed text-muted-foreground">{game.description}</p>
					{/if}

					<!-- Game info -->
					<div class="rounded-lg border bg-muted/30 p-4">
						<h2 class="mb-3 font-semibold">More game info</h2>
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2 text-sm text-muted-foreground">
									<MapPin class="h-4 w-4" />
									Points of interest
								</div>
								<span class="text-sm font-medium">{poiCount}</span>
							</div>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2 text-sm text-muted-foreground">
									<Users class="h-4 w-4" />
									Characters
								</div>
								<span class="text-sm font-medium">{characterCount}</span>
							</div>
						</div>
					</div>
				</div>

				<!-- CTA buttons -->
				<div class="space-y-3 pt-2">
					<Button
						variant="outline"
						class="w-full"
						disabled={isSigningIn}
						onclick={() => handlePlay('remote')}
					>
						Play remotely
					</Button>
					<Button class="w-full" disabled={isSigningIn} onclick={() => handlePlay('gps')}>
						{isSigningIn ? 'Starting...' : 'Play using GPS'}
					</Button>
					<Button variant="ghost" class="w-full" href="/play/{game.game_id}/stories">
						<BookOpen class="size-4" />
						Read stories from other players
					</Button>
				</div>
			</div>
		</div>
	</div>
</div>
