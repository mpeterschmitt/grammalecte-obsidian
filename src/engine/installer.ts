import { requestUrl, type App, type Plugin } from "obsidian";
import { unzipSync } from "fflate";
import { ADDON_API_URL, ENGINE_DIR, ENGINE_FILES } from "./files";

export type ProgressReporter = (message: string) => void;

function engineDir(plugin: Plugin): string {
	const dir = plugin.manifest.dir;
	if (!dir) throw new Error("Cannot locate the plugin folder.");
	return `${dir}/${ENGINE_DIR}`;
}

export function enginePath(plugin: Plugin, file: string): string {
	return `${engineDir(plugin)}/${file}`;
}

/** True when every file the engine needs is present in the plugin folder. */
export async function isEngineInstalled(plugin: Plugin): Promise<boolean> {
	const adapter = plugin.app.vault.adapter;
	for (const file of ENGINE_FILES) {
		if (!(await adapter.exists(enginePath(plugin, file)))) return false;
	}
	return true;
}

async function latestAddonUrl(): Promise<string> {
	const response = await requestUrl({ url: ADDON_API_URL });
	const addon = response.json as { current_version?: { file?: { url?: string } } };
	const url = addon.current_version?.file?.url;
	if (typeof url !== "string") {
		throw new Error("Could not find the Grammalecte add-on download URL.");
	}
	return url;
}

/**
 * Downloads the official Grammalecte browser add-on and extracts the engine
 * files the plugin needs into `<plugin folder>/engine`.
 */
export async function installEngine(plugin: Plugin, report: ProgressReporter = () => {}): Promise<void> {
	const adapter = plugin.app.vault.adapter;
	report("Looking up the latest Grammalecte release…");
	const url = await latestAddonUrl();
	report("Downloading the engine (~7 MB)…");
	const response = await requestUrl({ url });
	report("Extracting…");
	// Synchronous on purpose: fflate's async API builds a worker from bundled
	// source, which does not survive bundling; the archive is small enough.
	const files = unzipSync(new Uint8Array(response.arrayBuffer), {
		filter: (file) => (ENGINE_FILES as readonly string[]).includes(file.name),
	});
	const missing = ENGINE_FILES.filter((file) => !files[file]);
	if (missing.length > 0) {
		throw new Error(`The downloaded archive is missing ${missing.length} engine file(s).`);
	}
	for (const file of ENGINE_FILES) {
		const content = files[file];
		if (!content) continue;
		const path = enginePath(plugin, file);
		await ensureFolder(plugin.app, path);
		await adapter.writeBinary(path, toArrayBuffer(content));
	}
	report("Engine installed.");
}

export async function removeEngine(plugin: Plugin): Promise<void> {
	const adapter = plugin.app.vault.adapter;
	const dir = engineDir(plugin);
	if (await adapter.exists(dir)) {
		await adapter.rmdir(dir, true);
	}
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
	return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

async function ensureFolder(app: App, filePath: string): Promise<void> {
	const adapter = app.vault.adapter;
	const segments = filePath.split("/").slice(0, -1);
	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (!(await adapter.exists(current))) {
			await adapter.mkdir(current);
		}
	}
}
