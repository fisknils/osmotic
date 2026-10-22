import {
	Osmotic,
	type Context,
	type FetchMiddleware,
	type FetchRequest,
	type InSlotOptions,
	type Page,
} from '../src/index.cjs';

const mw: FetchMiddleware = (req, next) => {
	req.attach?.('browser-page', { close: () => {} });
	req.onRelease?.(() => {});
	req.onRelease?.(async () => 'anything');
	// @ts-expect-error: keys are strings
	req.attach?.(1, 'value');
	// @ts-expect-error: onRelease takes a function
	req.onRelease?.('close');
	return next({ ...req, url: 'https://example.com/' });
};
void mw;

// Code that builds requests itself, such as tests for middleware, doesn't need the new members
const plain: FetchRequest = { url: 'https://example.com/', headers: {}, slot: { id: 0 } };
void plain;

const chain = new Osmotic();
const page: Page = chain.loadPage('<p>Hi</p>', 'https://example.com/');
const value: unknown = page.attached?.['browser-page'];
// @ts-expect-error: attached values are read-only
page.attached!['browser-page'] = 1;
// @ts-expect-error: loadPage() needs the page's URL
chain.loadPage('<p>Hi</p>');

const ctx: Context = { data: {}, ...page };
const fromCtx: Readonly<Record<string, unknown>> | undefined = ctx.attached;
void [value, fromCtx];

const id: Promise<number> = chain.inSlot((slot) => slot.id);
const text: Promise<string> = chain.inSlot(async () => 'done', {
	slot: { id: 0 },
	url: 'https://example.com/',
	priority: 1,
});
const options: InSlotOptions = {};
void [id, text, options];

// @ts-expect-error: fn gets a Slot
chain.inSlot((slot: string) => slot);
// @ts-expect-error: priority is a number
chain.inSlot(() => {}, { priority: 'high' });
