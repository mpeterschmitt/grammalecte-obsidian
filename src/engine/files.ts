/** Paths inside the engine folder, in the order the engine must be evaluated. */
export const ENGINE_SCRIPTS = [
	"grammalecte/graphspell/helpers.js",
	"grammalecte/graphspell/str_transform.js",
	"grammalecte/graphspell/char_player.js",
	"grammalecte/graphspell/lexgraph_fr.js",
	"grammalecte/graphspell/ibdawg.js",
	"grammalecte/graphspell/spellchecker.js",
	"grammalecte/text.js",
	"grammalecte/graphspell/tokenizer.js",
	"grammalecte/fr/conj.js",
	"grammalecte/fr/mfsp.js",
	"grammalecte/fr/phonet.js",
	"grammalecte/fr/cregex.js",
	"grammalecte/fr/gc_options.js",
	"grammalecte/fr/gc_functions.js",
	"grammalecte/fr/gc_rules.js",
	"grammalecte/fr/gc_rules_graph.js",
	"grammalecte/fr/gc_engine.js",
] as const;

/** Data files loaded by the engine at init time, keyed by file name. */
export const ENGINE_DATA = [
	"grammalecte/fr/conj_data.json",
	"grammalecte/fr/phonet_data.json",
	"grammalecte/fr/mfsp_data.json",
	"grammalecte/graphspell/_dictionaries/fr-allvars.json",
] as const;

export const ENGINE_FILES = [...ENGINE_SCRIPTS, ...ENGINE_DATA];

/** Folder, relative to the plugin folder, where the engine is installed. */
export const ENGINE_DIR = "engine";

/** Mozilla add-on holding the official JavaScript build of Grammalecte. */
export const ADDON_API_URL = "https://addons.mozilla.org/api/v5/addons/addon/grammalecte-fr/";
