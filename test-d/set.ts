import { Osmotic, type Spec } from '../src/index.cjs';

const chain = new Osmotic();
chain.set({
	offers: ['.offer', { seller: '.seller', price: '.offer-price' }],
	nested: ['.offer', { shipping: ['.shipping li', { method: '.method' }], tags: ['.tag'] }],
});

const selectors: string[] = ['.tag'];
chain.set({ tags: selectors });

const list: Spec = ['.offer', { seller: '.seller' }];
void list;

// @ts-expect-error: the selector comes first
chain.set({ bad: [{ seller: '.seller' }] });

// @ts-expect-error: one field object per list
chain.set({ bad: ['.offer', { seller: '.seller' }, { price: '.offer-price' }] });
