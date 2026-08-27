/* ONE IMAGE LIGHTBOX, FOR FOUR PAGES.
 *
 * The owner, 27 August 2026: "anywhere we upload a brand logo, or show logo can
 * we [make] it so if you click it, the logo will pop up bigger to view it larger
 * just like the flyers".
 *
 * "JUST LIKE THE FLYERS" IS LITERAL HERE. This is the flyer overlay that has
 * been on /card-shows.html since 26 August, lifted out of build-shows.mjs
 * unchanged in behaviour and renamed off `flyer-`, because it now opens show
 * logos, shop logos, vendor logos and creator logos as well as flyers. Copying
 * it into three more builders was the alternative and it is how the socials
 * links grew a second system a week ago: four copies of a focus trap diverge,
 * and the copy that goes wrong is the one nobody opens.
 *
 * WHY NOT <dialog>. Its ::backdrop, inertness and focus handling would replace
 * most of what is below, and it is well supported now. This did not switch
 * because the switch is untestable from here in the browsers that matter and
 * the current code is measured and shipped. Worth doing on purpose, not as a
 * side effect of a rename.
 *
 * THE CLASS PREFIX IS `img-lb` AND IT WAS CHOSEN BY GREPPING, NOT BY TASTE.
 * `lb` is already three different components on this site and `.lb-close` on
 * hall.html has leaked a box-shadow from the global button rule once. `img-lb`
 * appears nowhere in ui.css, in any builder, or in any shared module.
 *
 * ONE NODE PER PAGE, FILLED ON CLICK. Sixty listings each carrying their own
 * hidden overlay would be sixty copies of the same markup for a thing at most
 * one of them ever shows.
 */

/* `label` is what a screen reader hears before an opener has set anything, and
 * it is also what the dialog is reset to on close: leave the last logo's label
 * on it and the next reader to open it is told about the wrong thing. */
export const imgLbMarkup = (label) =>
  `<div class="img-lb" id="imgLb" role="dialog" aria-modal="true" aria-label="${label}" hidden>
  <button type="button" class="img-lb-x" aria-label="Close">&times;</button>
  <picture><source id="imgLbAvif" type="image/avif" srcset=""><img src="" alt=""></picture>
</div>`;

/* An opener is anything carrying data-imglb. It is always a real <button>, never
 * a div with a click handler, so Enter and Space work without being written.
 *
 *   data-imglb       the full size image (required; its presence IS the opener)
 *   data-imglb-avif  an AVIF to prefer, or absent -- see the note on ordering
 *   data-imglb-alt   alt text for the opened image, and the dialog's label
 *
 * `defaultLabel` must match the one handed to imgLbMarkup above.
 */
export const imgLbJs = (defaultLabel) => `
  var lb = document.getElementById('imgLb');
  var lbImg = lb && lb.querySelector('img');
  var lbAvif = lb && lb.querySelector('#imgLbAvif');
  var lbClose = lb && lb.querySelector('.img-lb-x');
  var lbOpener = null;
  function closeLb(){
    if (!lb) return;
    lb.hidden = true;
    if (lbAvif) lbAvif.srcset = '';
    if (lbImg) { lbImg.removeAttribute('src'); lbImg.alt = ''; }
    document.body.style.overflow = '';
    var main = document.getElementById('main');
    if (main) main.inert = false;
    lb.setAttribute('aria-label', ${JSON.stringify(defaultLabel)});
    if (lbOpener) { lbOpener.focus(); lbOpener = null; }
  }
  document.querySelectorAll('[data-imglb]').forEach(function(b){
    b.addEventListener('click', function(){
      if (!lb) return;
      lbOpener = b;
      // THE SOURCE FIRST, THEN THE IMG, and the order is the whole trick. A
      // <picture> resolves when the img gets its src: if the source's srcset is
      // still empty at that moment the browser picks the WebP or JPEG and
      // commits to it, and the AVIF never loads however correct the markup
      // looks afterwards. packplayer.js records the same failure on the
      // carousel slides.
      if (lbAvif) lbAvif.srcset = b.dataset.imglbAvif || '';
      lbImg.src = b.dataset.imglb;
      lbImg.alt = b.dataset.imglbAlt || '';
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      // The dialog holds exactly ONE focusable node, so without this a single
      // Tab leaves it and lands in the footer, on links the reader cannot see
      // behind a 94% opaque overlay. Shift+Tab is worse: it walks back up the
      // whole page. inert also keeps the background out of the accessibility
      // tree for the browsers that honour it; the Tab guard below covers the
      // ones that do not.
      var main = document.getElementById('main');
      if (main) main.inert = true;
      if (b.dataset.imglbAlt) lb.setAttribute('aria-label', b.dataset.imglbAlt);
      lbClose.focus();
    });
  });
  if (lb) {
    lbClose.addEventListener('click', closeLb);
    lb.addEventListener('click', function(e){ if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function(e){
      if (lb.hidden) return;
      if (e.key === 'Escape') { closeLb(); return; }
      // One focusable node in here, so the honest trap is to refuse Tab outright
      // and keep focus on the close button rather than cycle a list of one.
      if (e.key === 'Tab') { e.preventDefault(); lbClose.focus(); }
    });
  }
`;
