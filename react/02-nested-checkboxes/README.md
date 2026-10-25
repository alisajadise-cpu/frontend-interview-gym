# 02 · Nested Checkboxes (tri-state tree)

**Difficulty:** Hard · **Time:** 40–50 min · **Similar to:** GreatFrontEnd *Nested Checkboxes*, Gmail label picker, file-permission trees, e-commerce category filters

## Why companies ask this

Everyone can render one checkbox. A tree of checkboxes tests whether you **model state correctly**. The strong answer stores only the **leaf** selection and **derives** every parent's state from it. Weak answers store a `checked` flag on every node and then fight to keep parents and children in sync. Interviewers also check the `indeterminate` state, which you can't set with an HTML attribute (only with a DOM property), and accessibility.

## Task

Build `<CheckboxTree />` in `index.tsx`.

```tsx
const nodes: TreeNode[] = [
  { id: 'fruits', label: 'Fruits', children: [
    { id: 'apple', label: 'Apple' },
    { id: 'citrus', label: 'Citrus', children: [
      { id: 'orange', label: 'Orange' },
      { id: 'lemon', label: 'Lemon' },
    ] },
  ] },
  { id: 'bread', label: 'Bread' },
];

<CheckboxTree
  nodes={nodes}
  defaultChecked={['orange']}          // optional: initially checked LEAF ids
  onChange={(leafIds) => console.log(leafIds)}
/>
```

## Requirements

1. Render every node as a checkbox whose accessible name is its `label`. A node is a **leaf** when it has no children (or an empty `children` array).
2. The tree can be **any depth**.
3. Store only the set of checked **leaf** ids. Don't store parent state: derive it.
4. A parent is **checked** when all of its leaf descendants are checked.
5. A parent is **indeterminate** when some, but not all, of its leaf descendants are checked. Set **both** `input.indeterminate = true` **and** `aria-checked="mixed"`. Indeterminate parents are not `checked`.
6. Clicking a parent that is fully checked unchecks all of its descendants. Clicking a parent that is unchecked or indeterminate checks all of its descendants.
7. `defaultChecked` sets the initial checked leaves. Parents are derived from it on the first render.
8. After every user change, call `onChange(checkedLeafIds)` with the ids **in tree order** (depth-first, top to bottom), not in click order.
9. Each parent has a toggle button with `aria-label="Toggle <label>"` and `aria-expanded`. All parents start **expanded**. A collapsed parent doesn't render its children. Checked state is kept while collapsed.
10. Children are rendered inside a `<ul role="group" aria-label="<parent label>">`.

## Edge cases interviewers probe

- Performance with 10,000 nodes. Recomputing "are all leaves checked?" for every parent on every render is O(n × depth). How would you compute all parent states in **one** post-order pass?
- What should happen to a parent with an empty `children` array?
- Why `indeterminate` must be set in an effect or ref callback: there's no HTML attribute for it.

## Follow-ups

- Make it **controlled** (`checked` + `onChange` props) as well as uncontrolled. How do libraries support both?
- Keyboard navigation for a real `role="tree"` (WAI-ARIA tree view pattern): arrow keys, Home/End, type-ahead.
- Lazy-loading children from the server: what does "checked" mean for children you haven't loaded yet?

## Run

```bash
npm test react/02-nested-checkboxes
npm run test:solution react/02-nested-checkboxes
npm run dev   # then open "react / 02-nested-checkboxes"
```
