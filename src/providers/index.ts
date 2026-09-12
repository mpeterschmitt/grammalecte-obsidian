import type { Plugin } from "obsidian";
import type { GrammalecteSettings } from "../settings";
import { serverUrl } from "../settings";
import type { Provider } from "../types";
import { JsProvider } from "./js";
import { ServerProvider } from "./server";

export function createProvider(plugin: Plugin, settings: GrammalecteSettings): Provider {
	if (settings.provider === "js") {
		return new JsProvider(plugin);
	}
	return new ServerProvider(serverUrl(settings), settings.provider);
}

export { JsProvider, ServerProvider };
