// jsdom has no layout and no scrolling. The pages ask the browser to scroll the shown
// result tab into view (V16.4), so the call has to exist and do nothing here.

if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    // Nothing to scroll in a document without layout.
    return undefined;
  };
}
