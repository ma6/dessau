/**
 * DDS — content component behaviour.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/components-content.js" defer></script>
 *
 * Contents: lightbox · consent embed
 *
 * Both degrade to a plain link. That is the whole design: without this file the
 * lightbox trigger opens the full-size image, and the consent embed offers a
 * link to the content on the provider's own site. Nothing becomes unreachable.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] components-content.js requires dds.js to be loaded first');
    return;
  }

  /* =========================================================================
     Lightbox
     =========================================================================
     Markup:
       <a href="photo-large.jpg" data-dds-lightbox data-dds-lightbox-group="tour"
          target="_blank" rel="noopener">
         <img src="photo-thumb.jpg" alt="Description of the photo">
       </a>

     The trigger is a real `<a href>` at the full-size file. Without JavaScript
     the click opens the image in a new tab — a completely acceptable outcome, and
     why the enlargement never has to be treated as essential. `target="_blank"`
     is part of the contract rather than an afterthought: it means the fallback
     does not navigate away from a page the reader was part-way through.

     One shared `<dialog>` is created lazily and reused. `showModal()` supplies
     focus containment, Escape, the top layer and focus return.

     `data-dds-lightbox-group` joins several triggers into a navigable set, in
     DOM order. Without it each trigger is its own set of one and no arrows
     appear.
     ========================================================================= */

  DDS.register('lightbox', '[data-dds-lightbox]', function (trigger) {
    /* Mark the trigger as enhanced. The `zoom-in` cursor, the hover zoom and the
       magnifier badge are all scoped to this attribute in CSS.

       That is the point: with no JavaScript there is no viewer, so promising one
       with a magnifier and a zoom cursor would be a lie. The link still opens the
       full-size image in a new tab, which is a perfectly good outcome. */
    trigger.classList.add('dds-lightbox-trigger');
    trigger.setAttribute('data-dds-lightbox-ready', '');

    /* The magnifier badge, generated rather than required in the markup — for the
       same reason. `aria-hidden` because the link already says what it does, and
       an announced magnifier adds nothing. */
    if (!trigger.querySelector('.dds-lightbox-zoom')) {
      var badge = document.createElement('span');
      badge.className = 'dds-lightbox-zoom';
      badge.setAttribute('aria-hidden', 'true');

      var badgeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      badgeIcon.setAttribute('class', 'dds-icon');
      var badgeUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      badgeUse.setAttribute('href', '#dds-icon-search');
      badgeIcon.appendChild(badgeUse);
      badge.appendChild(badgeIcon);

      trigger.appendChild(badge);
    }

    // Groups are resolved lazily on open rather than at enhancement time, so a
    // trigger added later still joins the right set.
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      open(trigger);
    });
  });

  /**
   * Lightbox wording.
   *
   * `position` takes the caption too, rather than the caller appending it. The
   * separator between "Image 3 of 8" and the caption is punctuation with a
   * language attached — and a sentence that ends in one language and continues
   * in another is the half-translated announcement this rule exists to stop
   * (DECISIONS.md 028).
   */
  var LIGHTBOX_WORDING = {
    en: {
      viewer: 'Image viewer',
      position: function (current, total, caption) {
        return 'Image ' + current + ' of ' + total + (caption ? '. ' + caption : '');
      },
    },
    de: {
      viewer: 'Bildbetrachter',
      position: function (current, total, caption) {
        return 'Bild ' + current + ' von ' + total + (caption ? '. ' + caption : '');
      },
    },
  };

  var dialog = null;
  var imageWrap = null;
  var image = null;
  var caption = null;
  var previous = null;
  var next = null;
  var previousZone = null;
  var nextZone = null;
  var group = [];
  var index = 0;
  /** The trigger that opened the viewer; focus returns here on close. */
  var opener = null;

  function build() {
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.className = 'dds-lightbox';
    // The dialog needs a name; the image's own alt text is not the dialog's name.
    dialog.setAttribute('aria-label', DDS.utils.wording(document.body, LIGHTBOX_WORDING).viewer);

    var figure = document.createElement('figure');
    figure.className = 'dds-lightbox-figure';

    /* A wrapper that shrinks to the image. The navigation zones live INSIDE it,
       so they cover half the image rather than half the viewport — clicking
       beside a portrait image should dismiss the viewer, not page through it. */
    imageWrap = document.createElement('div');
    imageWrap.className = 'dds-lightbox-imgwrap';

    image = document.createElement('img');
    image.className = 'dds-lightbox-image';
    image.alt = '';
    imageWrap.appendChild(image);

    figure.appendChild(imageWrap);

    caption = document.createElement('figcaption');
    caption.className = 'dds-lightbox-caption';
    caption.hidden = true;
    figure.appendChild(caption);

    dialog.appendChild(figure);

    var close = button('dds-lightbox-close', 'Close image viewer', 'dds-icon-close');
    close.addEventListener('click', function () {
      dialog.close();
    });
    dialog.appendChild(close);

    /* Navigation lives in a zone covering half the image, with the visible arrow
       inside it. The arrow itself is `pointer-events: none` in CSS, so the whole
       half responds to the mouse rather than just the 44px button.

       Two reasons. On touch, a small button in the corner of a full-screen image
       is a poor target for a thumb already holding the device. On a pointer,
       "click the left side to go back" is what every other image viewer has
       taught people.

       The zone is a plain `<div>`: not focusable, no accessible name. The button
       inside it is the control, so a keyboard user gets one stop per direction
       rather than two overlapping ones. */
    previousZone = document.createElement('div');
    previousZone.className = 'dds-lightbox-zone dds-lightbox-zone-start';
    previous = button('dds-lightbox-nav', 'Previous image', 'dds-icon-chevron-left');
    previousZone.appendChild(previous);
    previousZone.addEventListener('click', function () {
      show(index - 1);
    });
    imageWrap.appendChild(previousZone);

    nextZone = document.createElement('div');
    nextZone.className = 'dds-lightbox-zone dds-lightbox-zone-end';
    next = button('dds-lightbox-nav', 'Next image', 'dds-icon-chevron-right');
    nextZone.appendChild(next);
    nextZone.addEventListener('click', function () {
      show(index + 1);
    });
    imageWrap.appendChild(nextZone);

    // Clicking the backdrop closes. `event.target` is the dialog itself only when
    // the click missed every child, which is exactly "outside the image".
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener('keydown', function (event) {
      if (group.length < 2) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        show(index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        show(index + 1);
      }
    });

    dialog.addEventListener('close', function () {
      document.documentElement.classList.remove('dds-scroll-locked');
      /* Focus returns to the trigger that OPENED the viewer, not to the one for
         whichever image is showing when it closes.

         Returning to the opener is what WCAG 2.4.3 expects and what keeps the
         reader's place in the page: they were looking at one thumbnail, opened
         it, and should be back where they were. Moving focus to a different
         thumbnail because they browsed a few images silently relocates them. */
      if (opener && document.contains(opener)) opener.focus();
    });

    document.body.appendChild(dialog);
    return dialog;
  }

  function button(className, label, iconId) {
    var element = document.createElement('button');
    element.type = 'button';
    element.className = className;

    var text = document.createElement('span');
    text.className = 'dds-sr-only';
    text.textContent = label;
    element.appendChild(text);

    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'dds-icon');
    icon.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + iconId);
    icon.appendChild(use);
    element.appendChild(icon);

    return element;
  }

  /**
   * Caption precedence, most specific first:
   *
   *   1. data-dds-lightbox-caption  — an explicit override
   *   2. the enclosing <figure>'s <figcaption>
   *   3. `title` on the trigger, or on the <img> inside it
   *   4. nothing — the caption area stays hidden
   *
   * `alt` is deliberately NOT a source. `alt` and a caption do different jobs:
   * alt REPLACES the image for someone who cannot see it, a caption SUPPLEMENTS
   * it for everyone. Using alt as the caption means a screen reader announces the
   * same sentence twice — once as the image and once as its caption.
   */
  function captionFor(trigger) {
    var explicit = trigger.getAttribute('data-dds-lightbox-caption');
    if (explicit) return explicit;

    var figure = trigger.closest('figure');
    var figcaption = figure && figure.querySelector('figcaption');
    if (figcaption && figcaption.textContent.trim()) return figcaption.textContent.trim();

    var image = trigger.querySelector('img');
    var title = trigger.getAttribute('title') || (image && image.getAttribute('title'));
    if (title) return title;

    return '';
  }

  function show(nextIndex) {
    var count = group.length;
    // Wrap at both ends.
    index = ((nextIndex % count) + count) % count;

    var trigger = group[index];
    var thumbnail = trigger.querySelector('img');

    image.src = trigger.getAttribute('href');
    // Carry the thumbnail's alt across: it is the same image, so it is the same
    // description.
    image.alt = thumbnail ? thumbnail.getAttribute('alt') || '' : '';

    var text = captionFor(trigger);
    caption.textContent = text;
    caption.hidden = !text;

    // A set of one needs no arrows, and an empty zone covering half the viewport
    // would swallow the click that is meant to dismiss the viewer.
    var many = count > 1;
    previousZone.hidden = !many;
    nextZone.hidden = !many;

    if (many) {
      /* Resolved from the trigger, not from the dialog: the viewer is appended
         to `<body>`, so it has no language of its own — the gallery it was
         opened from does. */
      var place = group[index] || document.body;
      var words = DDS.utils.wording(place, LIGHTBOX_WORDING);
      DDS.announce(words.position(index + 1, count, text), { from: place });
    }
  }

  function open(trigger) {
    var key = trigger.getAttribute('data-dds-lightbox-group');

    group = key
      ? Array.prototype.slice.call(
          document.querySelectorAll('[data-dds-lightbox][data-dds-lightbox-group="' + key + '"]')
        )
      : [trigger];

    opener = trigger;

    build();
    show(group.indexOf(trigger));

    document.documentElement.classList.add('dds-scroll-locked');
    dialog.showModal();
    dialog.querySelector('.dds-lightbox-close').focus();
  }

  /* =========================================================================
     Consent embed
     =========================================================================
     Markup:
       <div class="dds-embed" data-dds-embed
            data-dds-embed-src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
            data-dds-embed-title="Video: …"
            data-dds-embed-provider="YouTube">
         <div class="dds-embed-body">
           <svg class="dds-icon" aria-hidden="true">…</svg>
           <p>…what loading it means…</p>
           <button type="button" class="dds-button dds-button-primary" data-dds-embed-consent>
             Load video
           </button>
           <p class="dds-hint">
             <a href="https://…">Open on the provider's site instead</a>
           </p>
         </div>
       </div>

     Why the frame is not simply in the markup: a third-party iframe contacts that
     provider — and can set cookies and log an IP address — the moment the page
     loads, before the visitor has agreed to anything. Creating the frame only
     after a deliberate click means no request leaves the page unasked.

     Consent is per embed and is NOT remembered. Remembering it is a product-level
     decision that needs a real consent record, not a component side effect.

     There is always a plain link to the content on the provider's own site, so
     the material is reachable without JavaScript and without accepting the embed.
     ========================================================================= */

  /**
   * Embed wording.
   *
   * `provider` is the fallback when the page did not name one. The provider
   * itself — "YouTube", "Vimeo" — is a proper noun and is not translated; what
   * varies is the sentence built around it, which is why `loaded` takes the name
   * rather than the caller appending "content loaded" to it.
   */
  var EMBED_WORDING = {
    en: {
      untitled: 'Embedded content',
      provider: 'Embedded',
      loaded: function (provider) {
        return provider + ' content loaded';
      },
    },
    de: {
      untitled: 'Eingebetteter Inhalt',
      provider: 'Eingebetteter',
      loaded: function (provider) {
        return provider + ' Inhalt geladen';
      },
    },
  };

  DDS.register('embed', '[data-dds-embed]', function (gate) {
    var trigger = gate.querySelector('[data-dds-embed-consent]');
    var src = gate.getAttribute('data-dds-embed-src');

    if (!trigger || !src) {
      console.error('[DDS] embed needs data-dds-embed-src and a consent button', gate);
      return;
    }

    trigger.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = src;
      // An iframe MUST have a title, or it is announced as an unnamed frame and
      // the user has no idea what they have just landed in.
      var words = DDS.utils.wording(gate, EMBED_WORDING);
      frame.title = gate.getAttribute('data-dds-embed-title') || words.untitled;
      frame.loading = 'lazy';
      frame.allowFullscreen = true;
      // Only what a media embed actually needs. Omitting `autoplay` is
      // deliberate: content that starts playing by itself is hostile, and
      // WCAG 1.4.2 requires a way to stop audio that plays for over three
      // seconds.
      frame.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; picture-in-picture; web-share');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

      gate.replaceChildren(frame);

      // Move focus into the frame, because the button the user just pressed no
      // longer exists — leaving focus on a removed element drops it to the
      // document and loses the user's place.
      frame.focus();

      DDS.announce(words.loaded(gate.getAttribute('data-dds-embed-provider') || words.provider), {
        from: gate,
      });
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
