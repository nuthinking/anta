# Principles

Anta is a component system for technical products: consoles, developer tools,
and data-heavy applications. These principles decide what Anta includes and
what it leaves to your application.

## Build for technical products

Anta starts from screens that show a large amount of data and change while
people read them, such as logs, traces, test results, and metrics.

- [Virtual scroll](./packages/virtual-scroll.md) shows lists of any length, follows a
  growing list, and marks rows on the scrollbar.
- [Plot](./packages/plot.md) draws on canvas and supports tooltips, selection, zoom, and pan.
- The [faceted filter](./components/select-faceted.md) filters a result set by several
  categories.
- [Capture](./components/capture.md) gives custom tables and plots wheel, pan, and pointer
  input.

Anta requires Chrome or Edge 135, Safari 17.4, or Firefox 136, or later, and
ships no baseline polyfills. Check [browser support](./install-config.md#browser-support)
before you adopt Anta for people on older browsers.

## Serve great design

The look of a product belongs to its designer. Anta defines behavior, keyboard
interaction, and accessibility semantics. Color, typography, shape, and density
stay open.

- Anta works without a theme. A theme is one optional stylesheet.
- Six [color seeds](./theming.md#color-seeds) recolor Anta's components.
- Anta's styles sit in cascade layers, so regular application CSS overrides
  them without `!important`.
- Color and typography use shared tokens. Shape and spacing belong to each
  component, and each component page documents the supported selectors and
  parts in its Styling section.

The package includes two example themes, Antune and Antithesis. See
[Theming](./theming.md) for their licenses and for the tokens a theme can set.

## Leave the DOM to the application

Web components in `@antadesign/anta` never mutate their own attributes. A
renderer finds each element as it wrote it. State that an element computes
reaches CSS through `:state()` selectors.

- The same components work in React, Preact, server-rendered HTML, and plain
  HTML.
- A renderer can run in a worker. See
  [server and worker rendering](./install-config.md#server-and-worker-rendering).
- Virtual scroll keeps scrolling, row measurement, and scrollbars on the
  browser thread while rows render in a worker, so scrolling does not wait for
  the rows.

## Test with generated states and actions

Button, Input, Select, Dialog, Plot, and other controls run in a property-based
test campaign. It uses two open-source testing tools from
[Antithesis](https://antithesis.com/).

- [Hegel](https://hegel.dev/) generates the application state. It mounts and
  unmounts components and changes their props.
- [Bombadil](https://bombadil.bot/) acts on the page with clicks, typing,
  scrolling, keyboard actions, and drags.

Properties beside each component check state agreement with the application,
disabled behavior, transitions, and preservation of state across unrelated
actions. A passing campaign reports no violated property in the sequences it
explored. It does not prove that every property was exercised.

The [fixture guide](https://github.com/antithesishq/anta/blob/main/fixtures/README.md)
lists the components, the props that vary, and the commands.
