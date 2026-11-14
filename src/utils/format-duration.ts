// Milliseconds as "850 ms", "1.5 s" or "2 min 5 s"
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)} ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
	const seconds = Math.round(ms / 1000);
	return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
