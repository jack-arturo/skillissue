/**
 * EmDash Live Config
 *
 * This file defines your content collections using EmDash's loader.
 * It replaces Astro's content collections for CMS-managed content.
 */

import { defineLiveCollection } from "astro:content";
import { emdashLoader } from "emdash/runtime";

// Posts collection - loaded from EmDash CMS
export const collections = {
	_emdash: defineLiveCollection({ loader: emdashLoader() }),
};
