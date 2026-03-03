/**
 * exportCandidateBrief.js
 *
 * Exports the Candidate Brief as a PDF using the browser's native print engine.
 *
 * BLANK PAGE 1 PROBLEM:
 *   When we force ancestor flex containers to `display: block`, siblings of
 *   those ancestors (e.g. the 100vh sidebar) become tall block elements that
 *   push the brief content to page 2. We fix this by also hiding all siblings
 *   of every ancestor before printing, then restoring them afterwards.
 */
export function exportBriefAsPDF(element) {
  return new Promise((resolve) => {

    const taggedAncestors = []    // ancestors that get the CSS class
    const overflowFixes = []      // { el, overflow, overflowX, overflowY, maxHeight, height }
    const siblingFixes = []       // { el, display }

    // Walk up every ancestor from the brief wrapper to <html>
    let el = element.parentElement
    while (el && el !== document.documentElement) {

      // 1. Tag for the CSS rule that forces full width
      el.classList.add('brief-ancestor')
      taggedAncestors.push(el)

      // 2. Lift overflow / height clamps so content flows across pages
      overflowFixes.push({
        el,
        overflow: el.style.overflow,
        overflowX: el.style.overflowX,
        overflowY: el.style.overflowY,
        maxHeight: el.style.maxHeight,
        height: el.style.height,
      })
      el.style.overflow = 'visible'
      el.style.overflowX = 'visible'
      el.style.overflowY = 'visible'
      el.style.maxHeight = 'none'
      el.style.height = 'auto'

      // 3. Hide every sibling of this ancestor so they don't create blank pages.
      //    e.g. the sidebar (height: 100vh) would push content to page 2 once
      //    the parent flex row becomes a block container.
      if (el.parentElement) {
        for (const sibling of el.parentElement.children) {
          if (sibling !== el) {
            siblingFixes.push({ el: sibling, display: sibling.style.display })
            sibling.style.display = 'none'
          }
        }
      }

      el = el.parentElement
    }

    // Activate print CSS
    document.body.classList.add('printing-brief')

    requestAnimationFrame(() => {
      window.print()

      const cleanup = () => {
        // Remove print class
        document.body.classList.remove('printing-brief')

        // Remove ancestor CSS tags
        taggedAncestors.forEach(a => a.classList.remove('brief-ancestor'))

        // Restore sibling display values
        siblingFixes.forEach(({ el, display }) => { el.style.display = display })

        // Restore overflow / height on ancestors
        overflowFixes.forEach(({ el, overflow, overflowX, overflowY, maxHeight, height }) => {
          el.style.overflow = overflow
          el.style.overflowX = overflowX
          el.style.overflowY = overflowY
          el.style.maxHeight = maxHeight
          el.style.height = height
        })

        window.removeEventListener('afterprint', cleanup)
        resolve()
      }

      window.addEventListener('afterprint', cleanup)
    })
  })
}
