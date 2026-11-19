// Small, dependency-free readers for the parts of a page the site needs before
// rendering it: its title, its description and, for an index, its links.

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

/** Inline Markdown to plain text: code spans, emphasis, links, HTML tags. */
export function plain(text) {
	return text
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/(\*\*|__)(.*?)\1/g, '$2')
		.replace(/(\*|_)(.*?)\1/g, '$2')
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
	return cut.slice(0, cut.lastIndexOf(' ')) + '…';
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
		for (const m of text.matchAll(/(?<!!)\[(?:[^\]\\]|\\.)*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
			items.push({ type: 'link', href: m[1] });
		}
	}
	return items;
}
