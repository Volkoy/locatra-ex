<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDown } from 'lucide-svelte';
	let { data } = $props();
	let { session } = $derived(data);

	function handleCreateClick() {
		if (session) {
			goto('/dashboard');
		} else {
			goto('/auth');
		}
	}

	function scrollToContent() {
		window.scrollTo({
			top: window.innerHeight,
			behavior: 'smooth'
		});
	}
</script>

<!-- Hero Section -->
<div class="relative flex min-h-[90vh] flex-col items-center justify-center px-4 pb-20 text-center">
	<div class="flex flex-col items-center">
		<h1
			class="mb-10 max-w-4xl text-5xl leading-tight font-bold text-balance drop-shadow md:text-6xl"
		>
			Create and Play locative storytelling games for heritage sites
		</h1>
		<div class="flex gap-8">
			<Button variant="outline" size="lg" disabled>Play games</Button>
			<Button size="lg" onclick={handleCreateClick}>Create games</Button>
		</div>
	</div>

	<!-- Scroll Indicator -->
	<button
		onclick={scrollToContent}
		class="absolute bottom-8 animate-bounce"
		aria-label="Scroll to content"
	>
		<ChevronDown class="h-8 w-8 text-gray-600" />
	</button>
</div>

<!-- Playing Games Section -->
<section class="px-4 py-16 md:px-8 lg:px-16">
	<div class="mx-auto flex max-w-7xl flex-col items-center gap-8 md:flex-row">
		<div class="order-2 space-y-4 md:order-1">
			<h2 class="text-3xl font-bold md:text-4xl">Playing Games</h2>
			<p class="text-lg text-gray-600">
				Explore heritage sites through immersive location-based storytelling experiences. Create
				stories from perspectives of characters, discover points of interest, and uncover the rich
				history of locations around you through engaging gameplay.
			</p>
			<Button variant="default" href="/guides/playing">Learn More</Button>
		</div>
		<div class="order-1 flex w-full items-center justify-center md:order-2">
			<div
				class="aspect-video w-full rounded-xl bg-gradient-to-br from-blue-100 to-purple-100"
			></div>
		</div>
	</div>
</section>

<!-- Creating Games Section -->
<section class="px-4 py-16 md:px-8 lg:px-16">
	<div class="mx-auto flex max-w-7xl flex-col items-center gap-8 md:flex-row">
		<div class="order-1 flex w-full items-center justify-center">
			<div
				class="aspect-video w-full rounded-xl bg-gradient-to-br from-green-100 to-teal-100"
			></div>
		</div>
		<div class="order-2 space-y-4">
			<h2 class="text-3xl font-bold md:text-4xl">Creating Games</h2>
			<p class="text-lg text-gray-600">
				Design your own locative storytelling experiences with our creation tool. Add characters,
				define points of interest, craft engaging narratives, and bring heritage sites to life for
				players around the world.
			</p>
			<Button variant="default" href="/guides/creating">Learn More</Button>
		</div>
	</div>
</section>

<!-- Footer -->
<footer class="border-t py-6 text-center text-sm text-gray-600">
	<p>PathWritter - Master's Thesis Project {new Date().getFullYear()}</p>
</footer>
