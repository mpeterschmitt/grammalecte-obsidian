import { ENGINE_GLUE, ENGINE_WORKER } from "./glue";

export interface EngineCheckOptions {
	grammar: boolean;
	spelling: boolean;
	gcOptions: Record<string, boolean>;
}

export interface EngineParagraphResult {
	offset: number;
	grammar: unknown[];
	spelling: unknown[];
}

interface Pending {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
}

/**
 * Runs the Grammalecte JavaScript engine inside a Web Worker built from a blob,
 * so checking never blocks the interface.
 */
export class EngineRunner {
	private worker: Worker | null = null;
	private workerUrl: string | null = null;
	private pending = new Map<number, Pending>();
	private nextId = 1;
	version = "unknown";

	/** True when the engine is loaded and ready. */
	get isLoaded(): boolean {
		return this.worker !== null;
	}

	async load(sources: string[], data: Record<string, string>): Promise<void> {
		const body = [...sources, ENGINE_GLUE];
		try {
			await this.loadInWorker(body, data);
		} catch (error) {
			this.disposeWorker();
			const reason = error instanceof Error ? error.message : String(error);
			throw new Error(
				`The Grammalecte engine could not start (${reason}). Try a Grammalecte server instead.`,
			);
		}
	}

	private loadInWorker(body: string[], data: Record<string, string>): Promise<void> {
		const blob = new Blob([ENGINE_WORKER], { type: "text/javascript" });
		this.workerUrl = URL.createObjectURL(blob);
		const worker = new Worker(this.workerUrl);
		this.worker = worker;
		worker.onmessage = (event: MessageEvent) => this.onWorkerMessage(event);
		worker.onerror = (event) => {
			const error = new Error(event.message || "Grammalecte worker failed.");
			for (const pending of this.pending.values()) pending.reject(error);
			this.pending.clear();
		};
		return this.post<string>("load", { sources: body, data }).then((version) => {
			this.version = version;
		});
	}

	private onWorkerMessage(event: MessageEvent): void {
		const { id, ok, result, error } = event.data as {
			id: number;
			ok: boolean;
			result: unknown;
			error?: string;
		};
		const pending = this.pending.get(id);
		if (!pending) return;
		this.pending.delete(id);
		if (ok) pending.resolve(result);
		else pending.reject(new Error(error ?? "Grammalecte engine error."));
	}

	private post<T>(action: string, payload: Record<string, unknown>): Promise<T> {
		const worker = this.worker;
		if (!worker) return Promise.reject(new Error("Grammalecte worker is not running."));
		const id = this.nextId++;
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
			worker.postMessage({ id, action, ...payload });
		});
	}

	check(text: string, options: EngineCheckOptions): Promise<EngineParagraphResult[]> {
		return this.post<EngineParagraphResult[]>("check", { text, options });
	}

	suggest(word: string): Promise<string[]> {
		return this.post<string[]>("suggest", { word });
	}

	unload(): void {
		this.disposeWorker();
	}

	private disposeWorker(): void {
		this.worker?.terminate();
		this.worker = null;
		if (this.workerUrl) {
			URL.revokeObjectURL(this.workerUrl);
			this.workerUrl = null;
		}
		this.pending.clear();
	}
}
