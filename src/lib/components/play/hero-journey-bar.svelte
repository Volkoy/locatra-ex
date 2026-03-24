<script lang="ts">
	const HERO_STEPS = [
		{ key: 'call_to_adventure', label: 'Call to Adventure' },
		{ key: 'crossing_the_threshold', label: 'Crossing the Threshold' },
		{ key: 'meeting_the_mentor', label: 'Meeting the Mentor' },
		{ key: 'trials_and_growth', label: 'Trials & Growth' },
		{ key: 'death_and_transformation', label: 'Death & Transformation' },
		{ key: 'change_and_return', label: 'Change & Return' }
	];

	let {
		currentStep = null,
		completedSteps = []
	}: {
		currentStep: string | null;
		completedSteps: string[];
	} = $props();

	function getStepStatus(key: string): 'completed' | 'current' | 'upcoming' {
		if (completedSteps.includes(key)) return 'completed';
		if (key === currentStep) return 'current';
		return 'upcoming';
	}
</script>

<div class="flex items-center gap-1">
	{#each HERO_STEPS as step, i (step.key)}
		{@const status = getStepStatus(step.key)}
		<div class="group relative flex-1" title={step.label}>
			<div
				class="h-2 rounded-full transition-all {status === 'completed'
					? 'bg-foreground'
					: status === 'current'
						? 'bg-foreground/40'
						: 'bg-muted'}"
			></div>
		</div>
		{#if i < HERO_STEPS.length - 1}
			<div class="w-1"></div>
		{/if}
	{/each}
</div>
