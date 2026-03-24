<script lang="ts">
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import {
		FileText,
		Users,
		MapPin,
		CreditCard,
		Bot,
		CircleCheckBig,
		LogOut,
		ChevronsUpDown,
		ArrowLeft,
		CircleCheck as CircleCheckIcon,
		CircleX,
		ChevronRight,
		CircleAlert
	} from 'lucide-svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import logo from '$lib/assets/logo-light.svg';
	import favicon from '$lib/assets/favicon.svg';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ValidationChecklist from '$lib/components/validation-checklist.svelte';
	import { cn } from '$lib/utils.js';
	import type { LayoutData } from './$types';
	import { goto } from '$app/navigation';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	let rightSidebarCollapsed = $state(false);
	let isLargeScreen = $state(true); // Default to true for SSR

	$effect(() => {
		if (typeof window !== 'undefined') {
			isLargeScreen = window.innerWidth >= 1024;
			const handleResize = () => {
				isLargeScreen = window.innerWidth >= 1024;
			};
			window.addEventListener('resize', handleResize);
			return () => window.removeEventListener('resize', handleResize);
		}
	});

	const userEmail = $derived(data.user?.email || '');
	const userName = $derived(data.user?.user_metadata?.name || userEmail.split('@')[0] || 'User');
	const userImage = $derived(data.user?.user_metadata?.avatar_url || '');
	const userInitials = $derived(
		userName
			.split(' ')
			.map((part: string) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase() || 'U'
	);

	async function handleLogout() {
		const supabase = page.data.supabase;
		await supabase.auth.signOut();
		goto('/auth');
	}

	const steps = [
		{
			label: 'General Information',
			description: 'Edit general information about the game',
			step: 1,
			slug: 'general',
			icon: FileText,
			sectionKey: 'General Information'
		},
		{
			label: 'Characters',
			description: 'Edit characters in the game',
			step: 2,
			slug: 'characters',
			icon: Users,
			sectionKey: 'Characters'
		},
		{
			label: 'Points of Interest',
			description: 'Edit points of interest in the game',
			step: 3,
			slug: 'pois',
			icon: MapPin,
			sectionKey: 'Points of Interest'
		},
		{
			label: 'Card prompts',
			description: 'Edit card prompts for the game',
			step: 4,
			slug: 'cards',
			icon: CreditCard,
			sectionKey: 'Card Prompts'
		},
		{
			label: 'AI companion',
			description: 'Edit AI companion settings',
			step: 5,
			slug: 'ai',
			icon: Bot,
			sectionKey: 'AI Companion'
		},
		{
			label: 'Review & Publish',
			description: 'Review and publish the game',
			step: 6,
			slug: 'review',
			icon: CircleCheckBig,
			sectionKey: 'Review'
		}
	];

	let currentStep: number = $derived.by(() => {
		const path = page.url.pathname;
		const step = steps.find((s) => path.endsWith(s.slug));
		return step ? step.step : 1;
	});

	let currentStepData = $derived.by(() => {
		return steps.find((s) => s.step === currentStep) || steps[0];
	});

	const gameName = $derived.by(() => {
		return data.game?.title || 'Untitled Game';
	});

	// Get validation status from server-computed data
	function getSectionStatus(sectionKey: string): 'error' | 'warning' | 'success' | null {
		return data.validations?.[sectionKey]?.status || null;
	}

	function getStepUrl(slug: string) {
		const gameId = page.params.id;
		return `/dashboard/games/${gameId}/edit/${slug}`;
	}

	// Generate validation checklist data
	type CheckItem = {
		label: string;
		status: 'complete' | 'incomplete' | 'warning';
		description?: string;
	};

	// All validation checks (from server)
	const validationChecks = $derived.by((): CheckItem[] => {
		if (!data.validations) return [];

		// Combine all checks from all sections
		return Object.values(data.validations).flatMap((section) => section.checks);
	});

	// Get checks for current section only
	const currentSectionChecks = $derived.by((): CheckItem[] => {
		if (!data.validations) return [];

		// For Review page, show all checks
		if (currentStepData.sectionKey === 'Review') {
			return validationChecks;
		}

		// Otherwise, return checks for current section
		return data.validations[currentStepData.sectionKey]?.checks || [];
	});

	// Summary for current section
	const currentSectionSummary = $derived.by(() => {
		const complete = currentSectionChecks.filter((c) => c.status === 'complete').length;
		const incomplete = currentSectionChecks.filter((c) => c.status === 'incomplete').length;
		const warnings = currentSectionChecks.filter((c) => c.status === 'warning').length;
		return { complete, incomplete, warnings, total: currentSectionChecks.length };
	});
</script>

<Toaster position="bottom-left" closeButton />

<div class="flex h-screen w-full">
	<!-- Left Sidebar -->
	<Sidebar.Provider>
		<Sidebar.Root collapsible="icon">
			<Sidebar.Header>
				<div class="flex items-center justify-center">
					<img
						src={logo}
						alt="PathWriter"
						class="w-full px-8 group-data-[collapsible=icon]:hidden"
					/>
					<img
						src={favicon}
						alt="PathWriter"
						class="hidden h-7 w-7 group-data-[collapsible=icon]:block"
					/>
				</div>
			</Sidebar.Header>
			<Sidebar.Content class="group-data-[collapsible=icon]:px-0">
				<Sidebar.Group>
					<Sidebar.GroupLabel>Game Creation Steps</Sidebar.GroupLabel>
					<Sidebar.Menu
						class="gap-1 group-data-[collapsible=icon]:gap-3 group-data-[collapsible=icon]:px-0"
					>
						{#each steps as step (step.slug)}
							{@const status = getSectionStatus(step.sectionKey)}
							{@const Icon = step.icon}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									isActive={step.step === currentStep}
									tooltipContent={step.label}
									size="lg"
								>
									{#snippet child({ props })}
										<a
											href={getStepUrl(step.slug)}
											{...props}
											class={cn(
												props.class as string,
												'flex w-full items-center gap-3 px-3 py-4',
												'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent! group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:hover:bg-transparent!',
												step.step === currentStep
													? '!bg-dark-green !text-white'
													: 'hover:bg-secondary hover:text-secondary-foreground'
											)}
										>
											<div class="relative flex-shrink-0">
												<div
													class={cn(
														'flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground',
														step.step === currentStep
															? 'group-data-[collapsible=icon]:bg-dark-green'
															: 'group-data-[collapsible=icon]:bg-primary-foreground'
													)}
												>
													<Icon
														class={cn(
															'h-5 w-5 text-dark-green',
															step.step === currentStep
																? 'group-data-[collapsible=icon]:text-primary-foreground'
																: 'group-data-[collapsible=icon]:text-dark-green'
														)}
														strokeWidth={2.25}
													/>
												</div>
												{#if status}
													<div
														class={`absolute -top-0 -right-0 h-2.5 w-2.5 rounded-full ${
															status === 'error'
																? 'bg-red-500'
																: status === 'warning'
																	? 'bg-yellow-500'
																	: 'bg-green-500'
														}`}
													></div>
												{/if}
											</div>
											<div
												class="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden"
											>
												<span class="truncate">{step.label}</span>
												<span class="text-xs opacity-60">{step.description}</span>
											</div>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Content>

			<Sidebar.Footer>
				<div class="flex flex-col gap-2">
					<Button
						variant="outline"
						class="w-full justify-start text-dark-green group-data-[collapsible=icon]:justify-center"
						href="/dashboard"
					>
						<ArrowLeft class="h-4 w-4" />
						<span class="group-data-[collapsible=icon]:hidden">Return to Dashboard</span>
					</Button>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="flex w-full cursor-pointer items-center gap-2 rounded-md border border-white/25 bg-dark-green p-2 text-start transition group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:p-0 hover:bg-light-green/50 group-data-[collapsible=icon]:hover:bg-transparent"
								>
									<Avatar.Root class="h-8 w-8 flex-shrink-0 rounded-lg">
										{#if userImage}
											<img src={userImage} alt={userName} class="h-8 w-8 rounded-lg object-cover" />
										{:else}
											<Avatar.Fallback class="rounded-lg">{userInitials}</Avatar.Fallback>
										{/if}
									</Avatar.Root>
									<div
										class="flex min-w-0 flex-1 flex-col text-sm leading-tight group-data-[collapsible=icon]:hidden"
									>
										<span class="max-w-[8rem] truncate font-medium">{userName}</span>
										<span class="truncate text-xs text-white">{userEmail}</span>
									</div>
									<ChevronsUpDown
										class="ml-auto h-4 w-4 shrink-0 text-white group-data-[collapsible=icon]:hidden"
									/>
								</button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="min-w-48 rounded-lg"
							side="right"
							align="end"
							sideOffset={4}
						>
							<DropdownMenu.Item onSelect={handleLogout}>
								<LogOut class="h-4 w-4" />
								Log out
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</Sidebar.Footer>

			<Sidebar.Rail />
		</Sidebar.Root>

		<Sidebar.Inset class="flex flex-1 flex-col">
			<!-- Header with Breadcrumbs and Sidebar Toggle -->
			<header class="flex h-16 items-center justify-between gap-4 border-b bg-background px-6">
				<div class="flex items-center gap-4">
					<Sidebar.Trigger class="flex-shrink-0" />
					<Breadcrumb.Root>
						<Breadcrumb.List>
							<Breadcrumb.Item>
								<Breadcrumb.Link href="/dashboard" class="text-sm">Dashboard</Breadcrumb.Link>
							</Breadcrumb.Item>
							<Breadcrumb.Separator>
								<ChevronRight class="h-4 w-4" />
							</Breadcrumb.Separator>
							<Breadcrumb.Item>
								<Breadcrumb.Page class="max-w-[200px] truncate text-sm font-medium"
									>{gameName}</Breadcrumb.Page
								>
							</Breadcrumb.Item>
							<Breadcrumb.Separator>
								<ChevronRight class="h-4 w-4" />
							</Breadcrumb.Separator>
							<Breadcrumb.Item>
								<Breadcrumb.Page class="text-sm">{currentStepData.label}</Breadcrumb.Page>
							</Breadcrumb.Item>
						</Breadcrumb.List>
					</Breadcrumb.Root>
				</div>
				<!-- Right Sidebar Toggle Button -->
				<Button
					variant="ghost"
					size="icon"
					class="flex-shrink-0"
					onclick={() => (rightSidebarCollapsed = !rightSidebarCollapsed)}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="transition-transform duration-200"
						style="transform: rotate({rightSidebarCollapsed ? 180 : 0}deg)"
					>
						<path d="m9 18 6-6-6-6" />
					</svg>
				</Button>
			</header>

			<!-- Main Content -->
			<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
				{@render children()}
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>

	<!-- Right Sidebar - Validation Checklist -->
	{#if !rightSidebarCollapsed || isLargeScreen}
		<div
			class="absolute top-0 right-0 z-40 flex h-full flex-col border-l bg-background transition-all duration-300 lg:relative lg:z-auto"
			style="width: {rightSidebarCollapsed ? '4rem' : '20rem'}"
			transition:fly={{ x: 320, duration: 300 }}
		>
			<!-- Content -->
			<div class="flex-1 overflow-y-auto">
				{#if rightSidebarCollapsed}
					<!-- Icon summary when collapsed -->
					<div class="flex flex-col items-center gap-4 p-4">
						{#if currentSectionSummary.incomplete > 0}
							<div class="flex flex-col items-center gap-1">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100"
									title="{currentSectionSummary.incomplete} incomplete"
								>
									<CircleX class="h-6 w-6 text-red-600" />
								</div>
								<span class="text-xs font-medium text-red-600"
									>{currentSectionSummary.incomplete}</span
								>
							</div>
						{/if}

						{#if currentSectionSummary.warnings > 0}
							<div class="flex flex-col items-center gap-1">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100"
									title="{currentSectionSummary.warnings} warnings"
								>
									<CircleAlert class="h-6 w-6 text-yellow-600" />
								</div>
								<span class="text-xs font-medium text-yellow-600"
									>{currentSectionSummary.warnings}</span
								>
							</div>
						{/if}

						<div class="flex flex-col items-center gap-1">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100"
								title="{currentSectionSummary.complete} complete"
							>
								<CircleCheckIcon class="h-6 w-6 text-green-600" />
							</div>
							<span class="text-xs font-medium text-green-600"
								>{currentSectionSummary.complete}</span
							>
						</div>
					</div>
				{:else}
					<!-- Full checklist when expanded -->
					<div class="p-4">
						<ValidationChecklist
							title={`${currentStepData.label} Validation`}
							checks={currentSectionChecks}
						/>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Mobile Backdrop -->
	{#if !rightSidebarCollapsed && !isLargeScreen}
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button
			class="fixed inset-0 z-30 bg-black/50"
			onclick={() => (rightSidebarCollapsed = true)}
			type="button"
		></button>
	{/if}
</div>
