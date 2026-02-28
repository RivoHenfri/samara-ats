/**
 * exportCandidateBrief.js
 *
 * Client-side PDF generation for the Candidate Brief.
 * Uses html2pdf.js to convert the CandidateBrief DOM element to a PDF.
 */

/**
 * Export the candidate brief as a downloadable PDF.
 *
 * @param {HTMLElement} element - The CandidateBrief DOM element to capture
 * @param {string} candidateName - Used in the filename
 * @param {string} roleName - Used in the filename
 */
export async function exportBriefAsPDF(element, candidateName, roleName) {
  // Dynamically import html2pdf.js to avoid bundling it if unused
  const html2pdf = (await import('html2pdf.js')).default

  const safeName = (candidateName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_')
  const safeRole = (roleName || 'Role').replace(/[^a-zA-Z0-9]/g, '_')

  const options = {
    margin: [10, 10, 10, 10],
    filename: `${safeName}_${safeRole}_Brief.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    },
    pagebreak: { mode: 'avoid-all', before: '.page-break' },
  }

  await html2pdf().set(options).from(element).save()
}
