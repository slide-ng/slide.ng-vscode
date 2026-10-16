---
title: My talk
theme: default
---

# Hello {{ c.n() }}

---
layout: center
class: text-red-500
---

# Second

@let total = items.length;

@if (total > 5) {
Big number.
} @else if (total > 1) {
Some.
} @else {
Few.
}

@for (item of items; track item.id) {
- {{ item.name }}
}

<app-counter #c [start]="5" (picked)="x = $event" />

<div *ngIf="visible" slide-ng-click="+2">Reveal</div>

<div [slide-ng-click]="[2, 4]" slide-ng-after>Range</div>

::right::

Right side

---

```ts {monaco}
const a = 1;
```

```ts [title.ts] {2,3|5|all} {lines:true, startLine:5}
const b = 2;
const c = 3;
```

````md magic-move
```ts
const x = 1;
```
````

<<< ./snippets/example.ts#greet ts {1|2}

Inline `{{ not.a.binding }}` and a fence:

```ts
@if (nope) {
{{ nope }}
```

<!--
Speaker note [click] here, then [click:3].
-->
