/**
 * DDS — navigation component behaviour.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/components-navigation.js" defer></script>
 *
 * Contents: site header disclosure · table of contents · content navigation ·
 *   banner dismiss
 *
 * The menu component needs no JavaScript at all: it uses the `popover`
 * attribute with `popovertarget`, which the platform handles. Neither does the
 * breadcrumb's scrollable middle (dds/css/components-navigation.css) — it is
 * `overflow-x: auto` on a nested list, the same technique the pagination strip
 * already uses.
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

     Highlights the section currently being read: the last one whose top is above a
     reading line a quarter of the way down the viewport, recomputed on scroll and
     throttled to one frame.

     An `IntersectionObserver` band was tried first and is the wrong tool here, for a
     reason that is easy to miss — it answers "what is inside this band", and at the
     bottom of a page nothing is, because there is no scroll left to bring the last
     section into it. No answer means the previous mark stays, so the final entry can
     never activate. See the note on `update()` below.

     The marker is `aria-current="location"`, not `"page"`. The user has not
     navigated anywhere — the reading position moved. `"page"` would tell a
     screen-reader user they are on a different page.

     Without JavaScript the list is a set of working anchor links. Only the
     highlight is lost.
     ========================================================================= */

  DDS.register('toc', '[data-dds-toc]', function (toc) {
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    if (!links.length) return;

    // Map each target id back to its link.
    var byId = new Map();
    links.forEach(function (link) {
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      var target = document.getElementById(id);
      if (target) byId.set(target, link);
    });

    if (!byId.size) return;

    /* The entry currently marked, so the list is only scrolled when the answer
       changes. Re-revealing on every frame would fight a reader who has scrolled
       the list by hand, and would do it sixty times a second. */
    var marked = null;

    function mark(link) {
      links.forEach(function (candidate) {
        if (candidate === link) {
          candidate.setAttribute('aria-current', 'location');
        } else {
          candidate.removeAttribute('aria-current');
        }
      });

      if (link !== marked) {
        marked = link;
        reveal(link);
      }
    }

    function clear() {
      links.forEach(function (candidate) {
        candidate.removeAttribute('aria-current');
      });
      marked = null;
    }

    /**
     * The scroll region the list itself lives in, if it has one.
     *
     * A table of contents long enough to need this is normally inside a sticky
     * box with a `max-block-size` and `overflow-y: auto` — `.dds-toc-sticky`
     * here, and whatever the consuming shell uses. Returns null when there is no
     * such box, or when there is one and nothing overflows it: in both cases the
     * entry is already as visible as it is going to get, and scrolling would
     * only move something the reader did not ask to have moved.
     */
    function scrollBox(element) {
      for (
        var node = element.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        var overflow = getComputedStyle(node).overflowY;
        var scrolls = overflow === 'auto' || overflow === 'scroll';
        if (scrolls && node.scrollHeight > node.clientHeight) return node;
      }
      return null;
    }

    /**
     * Bring the marked entry into view — in the LIST, and nowhere else.
     *
     * Without this the mark moves down a list that never scrolls, so on any page
     * with more entries than fit the box it spends most of the page outside the
     * visible part of its own list, in both directions (#91). A component whose
     * entire job is to say where you are is then silent for exactly the pages
     * long enough to need one.
     *
     * `scrollTop` on one element rather than `scrollIntoView`, which is the
     * obvious call and the wrong one: it scrolls EVERY scrollable ancestor,
     * including the document — so the page scroll that just moved the reading
     * position would be answered by moving the page again. `block: 'nearest'`
     * limits how far each ancestor scrolls, not which ancestors scroll.
     *
     * The two reads plus this write are a forced layout during scroll — the
     * shape modern-web-guidance's `defer-work-until-scroll-ends.md` says to
     * move to `scrollend`. Measured before deciding not to (#98,
     * `DECISIONS.md` #045): on the reference page with the most entries, a
     * full simulated scroll shows no measurable difference in layout count,
     * layout duration, or long tasks with this write live versus disabled.
     * Moving to `scrollend` would make the mark lag a slow scroll and jump at
     * rest — a real behaviour change bought with a cost that was not there.
     */
    function reveal(link) {
      if (!link) return;

      var box = scrollBox(link);
      if (!box) return;

      var item = link.getBoundingClientRect();
      var frame = box.getBoundingClientRect();

      /* One entry of context in the direction of travel, so the current one is
         never flush against an edge with nothing visible after it. Capped at a
         quarter of the box, or in a list short enough to show three entries the
         margin would be most of the box and every update would scroll. */
      var margin = Math.min(item.height, frame.height / 4);

      if (item.top < frame.top + margin) {
        box.scrollTop += item.top - frame.top - margin;
      } else if (item.bottom > frame.bottom - margin) {
        box.scrollTop += item.bottom - frame.bottom + margin;
      }
    }

    /**
     * Is this list in view while the sections it points at scroll past?
     * ------------------------------------------------------------------------
     * Only then does "where you are" mean anything. On a phone the reference's
     * list is not sticky: it sits above the content and scrolls away with it, so
     * the mark is only ever seen in one state — whatever was current when the
     * list was last on screen, which is always the first entry. It reads as a
     * selection rather than a position, and `aria-current="location"` states a
     * reading position that, on that screen, never changes.
     *
     * The question is asked of the ELEMENT rather than of the viewport: a
     * product may make its list sticky at another width, or never, or put it in
     * a scrolling panel of its own. Reading the computed position answers for
     * all of those without anybody configuring anything — and a width would
     * answer only for this one page shell.
     *
     * `fixed` counts too: a list in a fixed sidebar is as visible as a sticky
     * one, which is the property that matters here.
     */
    function tracks() {
      for (var node = toc; node && node !== document.body; node = node.parentElement) {
        var position = getComputedStyle(node).position;
        if (position === 'sticky' || position === 'fixed') return true;
      }
      return false;
    }

    /**
     * Which section is being read, answered geometrically.
     * ------------------------------------------------------------------------
     * The section whose top is the last one above a reading line a quarter of the way
     * down the viewport. That always produces exactly one answer, which is the whole
     * point.
     *
     * This replaced a pure `IntersectionObserver` band, and the reason is worth
     * keeping. A band from 10% to 30% of the viewport reports what is inside it — and
     * at the bottom of a page nothing is, because there is no scrolling left to bring
     * the last section up into it. With no answer, the previous mark stayed, so the
     * final entry in the list could never become active. On a page whose last section
     * is short, that is an entry nobody can ever reach, in a component whose entire
     * job is to say where you are.
     *
     * Two attempts to rescue the band failed in an instructive way: a sentinel at the
     * end of the document, then a tolerance on it. Both worked on some pages and not
     * others, because `content-visibility: auto` on the sections means off-screen ones
     * are laid out at an estimated height and grow as they approach — so the page gets
     * taller while you scroll towards its end, and "the end" is not where it was a
     * moment ago. Tuning geometry against a moving target produced a component that
     * behaved differently per page while being identical.
     *
     * Measuring instead of listening for crossings costs one `getBoundingClientRect`
     * per section per frame, throttled to one frame. For a few dozen sections that is
     * nothing, and it is always right.
     */
    var targets = Array.from(byId.keys()).sort(function (a, b) {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });

    /**
     * Whether the page cannot scroll any further.
     *
     * Measured fresh, every time. That is the difference between this and the two
     * attempts before it: a sentinel observed once, or a margin tuned once, are both
     * fixed against a page whose height changes as `content-visibility: auto` sections
     * grow. Reading the numbers at the moment the question is asked has no such
     * problem.
     *
     * Two pixels of tolerance, because fractional device pixels mean an exact
     * comparison never matches on a scaled display.
     */
    function atBottom() {
      return (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      );
    }

    function update() {
      /* A list that scrolls away with its content cannot report a reading
         position, so it does not claim one. Re-asked on every update rather than
         once at setup: the answer changes when the window crosses the width at
         which the shell makes the list sticky. */
      if (!tracks()) {
        clear();
        return;
      }

      /**
       * At the end of the page, the last section is the answer regardless of geometry.
       *
       * Without this the reading line has exactly the flaw the band had, only at a
       * different threshold: a last section shorter than the distance from the line to
       * the bottom of the viewport never gets its top above the line, so its entry
       * stays permanently unreachable. Which sections are short enough differs per
       * page, which is why this failed on some pages and not others — twice, in two
       * different mechanisms, before the cause was named.
       */
      if (atBottom()) {
        mark(byId.get(targets[targets.length - 1]));
        return;
      }

      var line = window.innerHeight * 0.25;
      var current = null;

      for (var i = 0; i < targets.length; i += 1) {
        if (targets[i].getBoundingClientRect().top <= line) current = targets[i];
      }

      /* Above the first section — still in the page's introduction. The first entry is
         marked rather than none, because an empty state here reads as the highlight
         being broken. */
      mark(byId.get(current || targets[0]));
    }

    var pending = null;
    function schedule() {
      if (pending) return;
      pending = requestAnimationFrame(function () {
        pending = null;
        update();
      });
    }

    /* `passive`, so the listener can never delay a scroll. */
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    /**
     * Recompute when the DOCUMENT changes size, not only when it is scrolled.
     *
     * This is the piece that was missing through three previous attempts, and the
     * mechanism is worth stating because it is not obvious.
     *
     * With `content-visibility: auto`, a section that is off screen is laid out at an
     * estimated height and only takes its real height when it comes near the viewport.
     * So scrolling to the end of the page renders the last sections, their real heights
     * land, and **the page becomes taller after the final scroll event has already been
     * handled**. Nothing fires again: scroll is done, the size changed instead. The
     * highlight is left pointing at whatever was correct a moment before the page grew.
     *
     * That is a real defect, not a test artefact. Someone who scrolls to the bottom and
     * stops sees the wrong entry marked and nothing corrects it.
     *
     * A `ResizeObserver` on the scrolling content is exactly the right instrument: it
     * fires when the observed box changes size, which is precisely the event that had
     * no listener.
     */
    if (typeof ResizeObserver !== 'undefined') {
      var growth = new ResizeObserver(schedule);
      // The element that actually grows. Falling back to <body> keeps this working in a
      // page shell that does not use the reference's own wrapper.
      growth.observe(targets[0].closest('.ref-content, main, body') || document.body);
    }

    /**
     * Section order is measured once, and has to be re-measured when the layout
     * settles: with `content-visibility: auto` the estimated heights are replaced by
     * real ones as sections approach, which can reorder nothing but does move
     * everything. Re-sorting on resize is cheap and keeps the order honest if a
     * section is inserted later.
     */
    window.addEventListener('resize', function () {
      targets.sort(function (a, b) {
        return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
      });
    });

    update();
  });

  /* =========================================================================
     Content navigation
     =========================================================================
     Markup:
       <div class="dds-contentnav-frame">
         <div class="dds-contentnav-layout" data-dds-contentnav>
           <button class="dds-contentnav-toggle dds-button dds-button-secondary"
                   type="button" data-dds-contentnav-toggle
                   aria-expanded="false" aria-controls="help-nav">…</button>
           <div class="dds-contentnav-scrim" data-dds-contentnav-scrim></div>
           <nav class="dds-contentnav" id="help-nav" aria-labelledby="help-nav-title">
             <div class="dds-contentnav-header">
               <p class="dds-contentnav-title" id="help-nav-title">…</p>
               <button class="dds-contentnav-close …" data-dds-contentnav-close>…</button>
             </div>
             …
           </nav>
           <div data-dds-contentnav-content>… the page content …</div>
         </div>
       </div>

     Above 64rem of container width this component does nothing: the CSS turns the
     panel into a sticky column, hides the toggle, the close button and the scrim,
     and forces the nav visible and tabbable. There is nothing for JavaScript to
     manage, so it stays out of the way.

     Below it, the nav is a modal panel over the content, and three things have to
     be true while it is open.

     ---------------------------------------------------------------------------
     1. The content behind it is `inert`, not focus-trapped
     ---------------------------------------------------------------------------

     `inert` is what a focus trap was always trying to approximate, done by the
     platform: the subtree leaves the tab order AND the accessibility tree. A
     hand-written trap only does the first — it cycles Tab within the panel while a
     screen reader can still walk straight into the content behind, reading a page
     the user cannot see or reach. It also has to bookkeep the first and last
     focusable element, which is wrong the moment a disclosure inside the panel
     opens.

     `inert` goes on the CONTENT, not on the panel. Marking the panel's siblings
     would be equivalent only if the panel had no other siblings, which is not
     something this component can promise about a page it does not own.

     ---------------------------------------------------------------------------
     2. Escape closes it, and focus returns to the toggle
     ---------------------------------------------------------------------------

     Returning focus is not a nicety. Focus left on a hidden element lands on
     `<body>`, and the next Tab starts from the top of the page — so someone who
     opened the panel, changed their mind and pressed Escape is silently sent back
     to the skip link.

     ---------------------------------------------------------------------------
     3. Following a link must not restore focus
     ---------------------------------------------------------------------------

     The panel closes on navigation because these links go to other pages. Moving
     focus back to the toggle first would fight the navigation, so the close path
     for a link deliberately skips the focus restore.

     Without JavaScript: the nav is a plain `<nav>` full of working links, visible
     as a column at wide widths. Only the narrow-width panel behaviour is lost —
     the links themselves never depended on it. */

  var CONTENTNAV_WIDE = 64 * 16; // 64rem, matching the container query.

  DDS.register('contentnav', '[data-dds-contentnav]', function (layout) {
    var nav = layout.querySelector('.dds-contentnav');
    var toggle = layout.querySelector('[data-dds-contentnav-toggle]');
    var scrim = layout.querySelector('[data-dds-contentnav-scrim]');
    var closeButton = layout.querySelector('[data-dds-contentnav-close]');
    var content = layout.querySelector('[data-dds-contentnav-content]');

    if (!nav || !toggle) return;

    /**
     * Whether the layout is currently wide enough that the nav is a column.
     *
     * Measured on the frame that establishes the container, so it answers the same
     * question the container query does. Reading the viewport instead would be
     * wrong for a component placed in a narrow column of a wide window — which is
     * the entire reason this is a container query.
     */
    function isWide() {
      var frame = layout.closest('.dds-contentnav-frame') || layout;
      return frame.getBoundingClientRect().width >= CONTENTNAV_WIDE;
    }

    function isOpen() {
      return nav.hasAttribute('data-dds-open');
    }

    function open() {
      if (isWide() || isOpen()) return;

      nav.setAttribute('data-dds-open', '');
      if (scrim) scrim.setAttribute('data-dds-open', '');
      toggle.setAttribute('aria-expanded', 'true');

      // The page behind is genuinely unavailable, to a pointer and to a screen
      // reader alike.
      if (content) content.inert = true;
      document.documentElement.classList.add('dds-scroll-locked');

      // Focus the panel itself rather than its first link: the panel is labelled,
      // so a screen reader announces what just opened before reading the list.
      nav.focus();
    }

    /**
     * @param {{ restoreFocus?: boolean }} [options]
     *   `restoreFocus` defaults to true. It is false when a link inside the panel
     *   was followed — moving focus back to the toggle would compete with the
     *   navigation that is already under way.
     */
    function close(options) {
      if (!isOpen()) return;

      var restoreFocus = !options || options.restoreFocus !== false;

      nav.removeAttribute('data-dds-open');
      if (scrim) scrim.removeAttribute('data-dds-open');
      toggle.setAttribute('aria-expanded', 'false');

      if (content) content.inert = false;
      document.documentElement.classList.remove('dds-scroll-locked');

      // Order matters: focus has to move out before the panel becomes
      // `visibility: hidden`, or it lands on `<body>` and the next Tab restarts
      // from the top of the page.
      if (restoreFocus) toggle.focus();
    }

    /* The panel needs to be focusable to be announced, but must never be a tab
       stop of its own — hence -1 rather than 0. */
    if (!nav.hasAttribute('tabindex')) nav.setAttribute('tabindex', '-1');

    toggle.setAttribute('aria-expanded', String(isOpen()));
    if (!toggle.getAttribute('aria-controls') && nav.id) {
      toggle.setAttribute('aria-controls', nav.id);
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) close();
      else open();
    });

    if (closeButton) {
      closeButton.addEventListener('click', function () {
        close();
      });
    }

    if (scrim) {
      scrim.addEventListener('click', function () {
        close();
      });
    }

    nav.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      // Only when it is actually a panel — at column width Escape belongs to
      // whatever else on the page might want it.
      if (isWide() || !isOpen()) return;
      event.stopPropagation();
      close();
    });

    // A link goes to another page, so the panel closes without taking focus back.
    nav.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href]');
      if (link) close({ restoreFocus: false });
    });

    /**
     * Growing past the threshold turns the panel into a column, and the CSS makes
     * it visible again on its own. What the CSS cannot undo is the state this
     * function set on other elements: `inert` on the content and the scroll lock
     * would both survive, leaving a page that looks normal and cannot be scrolled
     * or clicked.
     *
     * Observed on the FRAME, not on the window. This is a container-query
     * component — `isWide()` measures the frame precisely so that it behaves
     * correctly in a narrow column of a wide window — and a `resize` listener
     * answers a different question. Every way the container can widen without the
     * window changing size was therefore missed: a sidebar closing, a
     * `<details>` opening beside it, a grid track resolving, and the reference's
     * own width switcher, which sets an inline size on a stage and fires nothing.
     *
     * That is the catastrophic case reached by clicking a button in the
     * documentation.
     */
    var wasWide = isWide();
    var frame = layout.closest('.dds-contentnav-frame') || layout;

    new ResizeObserver(function () {
      var wide = isWide();
      if (wide === wasWide) return;
      wasWide = wide;

      if (wide && isOpen()) {
        // Not `close()`: focus should not be yanked to a toggle that is now hidden.
        nav.removeAttribute('data-dds-open');
        if (scrim) scrim.removeAttribute('data-dds-open');
        toggle.setAttribute('aria-expanded', 'false');
        if (content) content.inert = false;
        document.documentElement.classList.remove('dds-scroll-locked');
      }
    }).observe(frame);
  });

  /* =========================================================================
     Banner dismiss
     =========================================================================
     Markup:
       <div class="dds-banner dds-banner-info">
         …
         <button class="dds-banner-dismiss dds-button dds-button-subtle dds-button-icon"
                 type="button" aria-label="Dismiss this message">
           <svg class="dds-icon" aria-hidden="true"><use href="#dds-icon-close"/></svg>
         </button>
       </div>

     DDS owns the ephemeral hide — the button removes the banner from the page,
     the same one action the toast's own close button takes (#117). It does NOT
     remember the dismissal: whether "dismissed" survives a reload is a product
     decision (a cookie, a user preference, an account setting), stated as one in
     the CSS comment beside `.dds-banner-dismiss`, and answering it here would be
     guessing at storage the product may not want DDS to own.
     ========================================================================= */
  DDS.register('banner', '.dds-banner', function (banner) {
    var dismiss = banner.querySelector('.dds-banner-dismiss');
    if (!dismiss) return;

    dismiss.addEventListener('click', function () {
      banner.remove();
    });
  });

})(typeof window !== 'undefined' ? window : globalThis);
