import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			// The real API is only available inside Obsidian.
			obsidian: new URL("./tests/stubs/obsidian.ts", import.meta.url).pathname,
		},
	},
});
