/**
 * DDS — navigation component behaviour.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/components-navigation.js" defer></script>
 *
 * Contents: site header disclosure · table of contents
 *
 * The menu component needs no JavaScript at all: it uses the `popover`
 * attribute with `popovertarget`, which the platform handles.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] components-navigation.js requires dds.js to be loaded first');
    return;
  }

  /* =========================================================================
     Site header disclosure
     =========================================================================
     Markup:
       <button class="dds-siteheader-toggle" data-dds-nav-toggle="primary-nav"
               aria-expanded="false" aria-controls="primary-nav">…</button>
       <nav class="dds-primary-nav" id="primary-nav" aria-label="Main" hidden>…</nav>

     A disclosure, not a menu. The `aria-expanded`/`aria-controls` pair is the
     whole contract — no `role="menu"`, which would switch assistive technology
     into application mode and change what the arrow keys do.

     One navigation, one DOM location. The narrow and wide layouts are the same
     markup, so there is no second copy to drift out of sync and no duplicate
     announced by a screen reader.

     Above the wide threshold the CSS forces the nav visible regardless of the
     `hidden` attribute, so a resize while collapsed cannot hide the navigation.
     The attribute is still corrected here, so the DOM and the visuals agree.
     ========================================================================= */

  DDS.register('nav-toggle', '[data-dds-nav-toggle]', function (toggle) {
    var id = toggle.getAttribute('data-dds-nav-toggle') || toggle.getAttribute('aria-controls');
    var nav = document.getElementById(id);

    if (!nav) {
      console.error('[DDS] nav toggle references unknown element "' + id + '"', toggle);
      return;
    }

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.hidden = !open;
    }

    // Start from whatever the markup says, so a server-rendered open state is
    // respected.
    setOpen(isOpen());

    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    // Escape closes and returns focus to the button, which is the standard
    // disclosure behaviour and the only way back for a keyboard user who opened
    // it by mistake.
    nav.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !isOpen()) return;
      setOpen(false);
      toggle.focus();
    });

    // Following a link should not leave the panel open behind the new page — and
    // on a same-page anchor, the panel would cover what was jumped to.
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a') && isOpen()) setOpen(false);
    });

    /* The header is laid out by container query, so the JS cannot simply read a
       media query to know which layout is active. Instead it observes the
       computed result: once the nav is displayed inline, `hidden` is meaningless
       and is cleared so the DOM matches what is on screen. */
    if (typeof ResizeObserver !== 'undefined') {
      var frame = toggle.closest('[class*="siteheader-frame"]') || toggle.parentElement;
      if (frame) {
        new ResizeObserver(function () {
          // The toggle is display:none above the threshold. `offsetParent` is the
          // cheapest reliable test for that, and it needs no duplicated
          // breakpoint value here.
          var wide = toggle.offsetParent === null;
          if (wide) {
            nav.hidden = false;
            toggle.setAttribute('aria-expanded', 'false');
          } else if (!isOpen()) {
            nav.hidden = true;
          }
        }).observe(frame);
      }
    }
  });

  /* =========================================================================
     Table of contents
     =========================================================================
     Markup:
       <nav class="dds-toc" data-dds-toc="main-content" aria-labelledby="toc-title">
         <p class="dds-toc-title" id="toc-title">On this page</p>
         <ul>
           <li><a href="#section-one">Section one</a></li>
         </ul>
       </nav>

     Highlights the section currently being read, using an IntersectionObserver
     rather than a scroll listener: the observer reports only when a threshold is
     actually crossed, instead of running a callback on every scroll frame.

     The marker is `aria-current="location"`, not `"page"`. The user has not
     navigated anywhere — the reading position moved. `"page"` would tell a
     screen-reader user they are on a different page.

     Without JavaScript the list is a set of working anchor links. Only the
     highlight is lost.
     ========================================================================= */

  DDS.register('toc', '[data-dds-toc]', function (toc) {
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    if (!links.length) return;

    if (typeof IntersectionObserver === 'undefined') return;

    // Map each target id back to its link.
    var byId = new Map();
    links.forEach(function (link) {
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      var target = document.getElementById(id);
      if (target) byId.set(target, link);
    });

    if (!byId.size) return;

    function mark(link) {
      links.forEach(function (candidate) {
        if (candidate === link) {
          candidate.setAttribute('aria-current', 'location');
        } else {
          candidate.removeAttribute('aria-current');
        }
      });
    }

    var visible = new Set();

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            visible.add(entry.target);
          } else {
            visible.delete(entry.target);
          }
        });

        if (!visible.size) return;

        // Several sections can be in view at once; the topmost one is the one
        // being read.
        var topmost = Array.from(visible).sort(function (a, b) {
          return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
        })[0];

        mark(byId.get(topmost));
      },
      {
        /* A band near the top of the viewport rather than the whole viewport.
           Using the full viewport means the last section never becomes active on
           a short page, because it never reaches the top. */
        rootMargin: '-10% 0px -70% 0px',
        threshold: 0,
      }
    );

    byId.forEach(function (link, target) {
      observer.observe(target);
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
