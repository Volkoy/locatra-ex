export const steps = ['general','characters','pois','cards','ai'] as const;
export type Step = typeof steps[number];

export function nextStep(s: Step) {
  const i = steps.indexOf(s);
  return i >= 0 && i < steps.length-1 ? steps[i+1] : 'review';
}
