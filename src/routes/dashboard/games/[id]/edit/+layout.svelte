<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, Check, X } from 'lucide-svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	let { children } = $props();

	function stepUrl(step: string) {
		return `/dashboard/games/1/edit/${step}`;
	}

	const steps = [
		{
			label: 'General Information',
			description: 'Edit general information about the game',
			step: 1,
			slug: 'general'
		},
		{
			label: 'Characters',
			description: 'Edit characters in the game',
			step: 2,
			slug: 'characters'
		},
		{
			label: 'Points of Interest',
			description: 'Edit points of interest in the game',
			step: 3,
			slug: 'pois'
		},
		{
			label: 'Card prompts',
			description: 'Edit card prompts for the game',
			step: 4,
			slug: 'cards'
		},
		{ label: 'AI companion', description: 'Edit AI companion settings', step: 5, slug: 'ai' },
		{
			label: 'Review & Publish',
			description: 'Review and publish the game',
			step: 6,
			slug: 'review'
		}
	];

	let currentStep: number = $derived.by(() => {
		const path = page.url.pathname;
		const step = steps.find((s) => path.endsWith(s.slug));
		return step ? step.step : 1;
	});

	function getStepUrl(slug: string) {
		const gameId = page.params.id;
		return `/dashboard/games/${gameId}/edit/${slug}`;
	}
</script>

<Toaster position="bottom-left" closeButton />
<div class="relative flex min-h-screen flex-col gap-2 bg-gray-50 p-2 md:flex-row">
	<aside class="z-30 h-fit w-96 gap-2 rounded-lg border border-gray-300 bg-white p-4">
		<h2 class="text-lg font-bold">Create Game</h2>
		<p class="mb-2 justify-end text-gray-600">Follow the steps below to create your game.</p>
		<nav>
			<p class="mb-2 text-sm text-gray-600">Step {currentStep} of {steps.length}</p>
			<ul class="relative flex flex-col space-y-8">
				{#each steps as step, i}
					<!-- Step -->
					<li class="relative flex items-center last:mb-0">
						<!-- Line -->
						{#if i < steps.length - 1}
							<span
								class={`absolute top-16 left-[26px] z-0 h-8 w-1 ${
									step.step < currentStep ? 'bg-black' : 'bg-gray-300'
								}`}
							></span>
						{/if}
						<a
							href={getStepUrl(step.slug)}
							class="z-10 flex w-full items-center rounded-lg p-2 transition-colors hover:bg-gray-50 hover:outline hover:outline-gray-400"
						>
							<!-- Step Circle -->
							<span
								class={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
									step.step === currentStep
										? 'bg-black text-white'
										: step.step < currentStep
											? 'bg-black text-white'
											: 'bg-gray-300 text-gray-600'
								} `}
							>
								{step.step}
							</span>
							<!-- Step Label -->
							<div class="grid">
								<span
									class={`ml-4 text-lg ${
										step.step === currentStep
											? 'font-bold'
											: step.step < currentStep
												? ''
												: 'text-gray-700'
									}`}
								>
									{step.label}
								</span>
								<span class="ml-4 text-sm font-medium text-gray-500">
									{step.description}
								</span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<div class="mt-6 border-t pt-4">
			<Button variant="default" class="w-full" href="/dashboard">
				<ArrowLeft class="h-4 w-4" />
				Return to Dashboard
			</Button>
		</div>
	</aside>
	<main class="flex-1">
		{@render children()}
	</main>
</div>
