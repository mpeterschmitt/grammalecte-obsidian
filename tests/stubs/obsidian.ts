/** Minimal stand-in for the parts of the Obsidian API used in tests. */
export interface RequestUrlParam {
	url: string;
	method?: string;
	contentType?: string;
	body?: string;
	throw?: boolean;
}

export async function requestUrl(param: RequestUrlParam) {
	const response = await fetch(param.url, {
		method: param.method ?? "GET",
		headers: param.contentType ? { "Content-Type": param.contentType } : undefined,
		body: param.body,
	});
	const text = await response.text();
	return {
		status: response.status,
		text,
		get json() {
			return JSON.parse(text) as unknown;
		},
	};
}
