<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { MapPin, BookOpen, Pencil } from 'lucide-svelte';

	let { data } = $props();
	let { isAuthenticated } = $derived(data);

	function handleCreateClick() {
		if (isAuthenticated) {
			goto('/dashboard');
		} else {
			goto('/auth');
		}
	}
</script>

<svelte:head>
	<title>PathWriter</title>
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-primary-foreground">
	<!-- Background decoration -->
	<div class="pointer-events-none absolute inset-0">
		<div class="absolute -top-32 -right-32 size-[28rem] rounded-full bg-sense-red/10 blur-3xl"></div>
		<div class="absolute top-1/2 left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-history-yellow/8 blur-3xl"></div>
		<div class="absolute -bottom-32 -left-32 size-[28rem] rounded-full bg-dark-green/8 blur-3xl"></div>
	</div>

	<!-- Hero -->
	<section class="relative flex flex-col items-center justify-center px-4 py-28 text-center">
		<div class="mx-auto max-w-3xl space-y-8">
			<!-- Badge -->
			<div class="flex justify-center">
				<span class="inline-flex items-center gap-2 rounded-full border border-dark-green/30 bg-white px-4 py-1.5 text-sm font-medium text-dark-green shadow-sm">
					<MapPin class="size-3.5" />
					Location-aware storytelling
				</span>
			</div>

			<!-- Headline -->
			<h1 class="text-5xl font-bold leading-tight text-balance md:text-7xl">
				Location-based storytelling for
				<span class="relative inline-block">
					<span class="relative z-10 text-dark-green">heritage sites</span>
					<span class="absolute bottom-1 left-0 z-0 h-3 w-full rounded bg-dark-green/15"></span>
				</span>
			</h1>

			<!-- Subheading -->
			<p class="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground">
				Create immersive narrative games tied to real places. Play as characters, discover points of
				interest, and bring history to life through location-aware storytelling.
			</p>

			<!-- CTAs -->
			<div class="flex flex-wrap justify-center gap-3 pt-2">
				<Button variant="outline" size="lg" href="/play" class="gap-2 rounded-full px-6">
					<BookOpen class="size-4" />
					Play games
				</Button>
				<Button size="lg" onclick={handleCreateClick} class="gap-2 rounded-full px-6">
					<Pencil class="size-4" />
					Create a game
				</Button>
			</div>
		</div>
	</section>

	<!-- Feature sections -->
	<div class="mx-auto max-w-4xl space-y-6 px-4 pb-24">
		<!-- Play + Stories -->
		<div class="rounded-2xl border border-dark-green bg-white shadow-sm">
			<div class="flex items-start gap-5 p-8">
				<div
					class="flex size-12 shrink-0 items-center justify-center rounded-full bg-dark-green text-white"
				>
					<MapPin class="size-5" />
				</div>
				<div class="space-y-2">
					<h2 class="text-xl font-bold">Play location-based games</h2>
					<p class="leading-relaxed text-muted-foreground">
						Explore heritage sites through immersive storytelling. Discover points of interest,
						embody characters, and uncover the rich history of real locations around you.
					</p>
				</div>
			</div>
			<div class="flex items-start gap-5 border-t border-dark-green/20 p-8">
				<div
					class="flex size-12 shrink-0 items-center justify-center rounded-full bg-dark-green text-white"
				>
					<BookOpen class="size-5" />
				</div>
				<div class="space-y-2">
					<h2 class="text-xl font-bold">Read player stories</h2>
					<p class="leading-relaxed text-muted-foreground">
						Every playthrough generates a unique story. Read narratives written by other players as
						they journeyed through the same sites from different perspectives.
					</p>
				</div>
			</div>
			<div class="px-8 pb-8">
				<Button variant="outline" href="/play">Browse games</Button>
			</div>
		</div>

		<!-- Create -->
		<div class="rounded-2xl border border-dark-green bg-white p-8 shadow-sm">
			<div class="flex items-start gap-5">
				<div
					class="flex size-12 shrink-0 items-center justify-center rounded-full bg-dark-green text-white"
				>
					<Pencil class="size-5" />
				</div>
				<div class="space-y-2">
					<h2 class="text-xl font-bold">Create your own game</h2>
					<p class="leading-relaxed text-muted-foreground">
						Design locative storytelling experiences with our creation tool. Add characters, define
						points of interest, craft narrative cards, and publish your game for players to explore.
					</p>
					<Button class="mt-2" onclick={handleCreateClick}>Get started</Button>
				</div>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<footer class="border-t border-dark-green py-6 text-center text-sm text-muted-foreground">
		<p>PathWriter — Master's Thesis Project {new Date().getFullYear()}</p>
	</footer>
</div>
