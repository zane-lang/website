// Small, dependency-free readers for the parts of a page the site needs before
// rendering it: its title, its description and, for an index, its links.

/** decodeURIComponent, or the text unchanged when its %-escapes are malformed. */
export function safeDecode(text) {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
}

/** Splits Markdown into lines, marking those inside fenced code blocks. */
export function lines(markdown) {
	const out = [];
	let fence = null; // { char, length } of the open fence
	for (const text of markdown.split(/\r?\n/)) {
		const m = text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
		if (fence) {
			if (m && m[1][0] === fence.char && m[1].length >= fence.length && m[2].trim() === '') fence = null;
			out.push({ text, code: true });
		} else if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
			fence = { char: m[1][0], length: m[1].length };
			out.push({ text, code: true });
		} else {
			out.push({ text, code: false });
		}
	}
	return out;
}

/** A code span: a run of backticks, its text, and a run of the same length. */
const codeSpan = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g;

/** Inline Markdown to plain text: code spans, emphasis, links, HTML tags. */
export function plain(text) {
	// Code spans are set aside first, so that nothing inside them reads as emphasis.
	const spans = [];
	const held = text.replace(codeSpan, (_, _ticks, body) => `\u0000${spans.push(body.trim()) - 1}\u0000`);
	return held
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/\*\*(.*?)\*\*/g, '$1')
		.replace(/(?<![\p{L}\p{N}])__(.*?)__(?![\p{L}\p{N}])/gu, '$1')
		.replace(/\*(.*?)\*/g, '$1')
		.replace(/(?<![\p{L}\p{N}])_(.*?)_(?![\p{L}\p{N}])/gu, '$1')
		.replace(/\u0000(\d+)\u0000/g, (_, i) => spans[Number(i)])
		.replace(/\s+/g, ' ')
		.trim();
}

/** The text of the first level-one ATX heading, or undefined. */
export function titleOf(markdown) {
	for (const { text, code } of lines(markdown)) {
		if (code) continue;
		const m = text.match(/^ {0,3}#[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/);
		if (m) return plain(m[1]);
	}
	return undefined;
}

/**
 * The first paragraph after the title, as plain text: what the page is about.
 * Skips blockquotes, lists, tables, HTML blocks and headings.
 */
export function descriptionOf(markdown, maxLength = 200) {
	let seenTitle = false;
	let paragraph = [];
	for (const { text, code } of lines(markdown)) {
		if (!seenTitle) {
			if (!code && /^ {0,3}#[ \t]/.test(text)) seenTitle = true;
			continue;
		}
		if (code) {
			if (paragraph.length) break;
			continue;
		}
		if (text.trim() === '') {
			if (paragraph.length) break;
			continue;
		}
		if (!paragraph.length && /^ {0,3}([>#|<-]|\*\s|\d+[.)]\s|---)/.test(text)) continue;
		paragraph.push(text);
	}
	if (!paragraph.length) return undefined;
	const text = plain(paragraph.join(' '));
	if (text.length <= maxLength) return text;
	const cut = text.slice(0, maxLength);
	const lastSpace = cut.lastIndexOf(' ');
	return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

/**
 * An index page's outline: its `##` headings and its links, in order.
 * Returns items `{ type: 'group', title }` and `{ type: 'link', href }`.
 */
export function indexOutline(markdown) {
	const items = [];
	for (const { text, code } of lines(markdown)) {
		if (code) continue;
		const heading = text.match(/^ {0,3}##[ \t]+(.*?)[ \t]*#*[ \t]*$/);
		if (heading) {
			items.push({ type: 'group', title: plain(heading[1]) });
			continue;
		}
		// A link shown inside a code span is text, not a link.
		const prose = text.replace(codeSpan, (span) => ' '.repeat(span.length));
		for (const m of prose.matchAll(/(?<!!)\[(?:[^\]\\]|\\.)*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
			items.push({ type: 'link', href: m[1] });
		}
	}
	return items;
}
