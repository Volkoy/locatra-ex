<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { enhance } from '$app/forms';
</script>

<div class="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center text-center">
	<h1 class="mb-4 text-4xl font-bold">Create a New Game</h1>
	<p class="mb-8 text-gray-600">
		Let's create an engaging locative storytelling experience. We'll guide you through setting up
		your game step by step.
	</p>
	<!-- Create new game in games table and redirect to general info page of the new id -->
	<form method="POST" use:enhance>
		<Button type="submit" size="lg" class="px-8 hover:cursor-pointer hover:bg-gray-700"
			>Start Creating</Button
		>
	</form>
</div>
