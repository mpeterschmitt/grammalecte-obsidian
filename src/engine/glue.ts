/**
 * Appended after the Grammalecte sources and evaluated in the same scope, this
 * returns the small API the plugin drives the engine with.
 *
 * The whole bundle runs inside `new Function("process", "require", "self", …)`,
 * so `process` and `require` read as undefined and the engine takes its
 * browser code path even inside Electron.
 */
export const ENGINE_GLUE = String.raw`
"use strict";

var __data = {};
var __spellChecker = null;
var __optionsKey = "";

function __loadFile (path) {
	var name = String(path).split("/").pop();
	return Object.prototype.hasOwnProperty.call(__data, name) ? __data[name] : null;
}

function __init (data) {
	__data = data;
	helpers.loadFile = __loadFile;
	conj.init(__loadFile("conj_data.json"));
	phonet.init(__loadFile("phonet_data.json"));
	mfsp.init(__loadFile("mfsp_data.json"));
	gc_engine.load("JavaScript", "aHSL", "");
	__spellChecker = gc_engine.getSpellChecker();
	if (!__spellChecker) {
		throw new Error("Grammalecte engine loaded but no spell checker is available.");
	}
	// The parsed structures are kept by the engine; drop the raw JSON strings.
	__data = {};
	return gc_engine.version || "unknown";
}

function __setOptions (gcOptions) {
	var key = JSON.stringify(gcOptions || {});
	if (key === __optionsKey) {
		return;
	}
	__optionsKey = key;
	gc_engine.resetOptions();
	if (gcOptions && Object.keys(gcOptions).length > 0) {
		gc_engine.setOptions(helpers.objectToMap(gcOptions));
	}
}

function __check (text, options) {
	__setOptions(options.gcOptions);
	var results = [];
	var offset = 0;
	var paragraphs = text.normalize("NFC").split("\n");
	for (var i = 0; i < paragraphs.length; i++) {
		var paragraph = paragraphs[i];
		if (paragraph.trim() !== "") {
			var grammar = options.grammar ? gc_engine.parse(paragraph, "FR", false, null, false) : [];
			var spelling = options.spelling ? __spellChecker.parseParagraph(paragraph) : [];
			if (grammar.length > 0 || spelling.length > 0) {
				results.push({ offset: offset, grammar: grammar, spelling: spelling });
			}
		}
		offset += paragraph.length + 1;
	}
	return results;
}

function __suggest (word) {
	var suggestions = [];
	for (var group of __spellChecker.suggest(word)) {
		suggestions = suggestions.concat(group);
	}
	return suggestions;
}

return { init: __init, check: __check, suggest: __suggest };
`;

/** Worker bootstrap: builds the engine from sources sent by the main thread. */
export const ENGINE_WORKER = String.raw`
"use strict";
var __api = null;

self.onmessage = function (event) {
	var msg = event.data;
	try {
		var result = null;
		if (msg.action === "load") {
			var body = msg.sources.join("\n;\n");
			__api = new Function("process", "require", "self", body)(undefined, undefined, self);
			result = __api.init(msg.data);
		} else if (msg.action === "check") {
			result = __api.check(msg.text, msg.options);
		} else if (msg.action === "suggest") {
			result = __api.suggest(msg.word);
		} else {
			throw new Error("Unknown action: " + msg.action);
		}
		self.postMessage({ id: msg.id, ok: true, result: result });
	} catch (error) {
		self.postMessage({ id: msg.id, ok: false, error: String((error && error.message) || error) });
	}
};
`;
